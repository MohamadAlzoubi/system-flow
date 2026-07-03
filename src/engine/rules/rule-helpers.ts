import type {
  FailureScenario,
  FlowEdge,
  FlowGraph,
  NodeDefinition,
  NodeInstance,
} from "../../contracts"
import { affectedNodeIdsFor } from "../simulation/apply-failure-scenario"

export type RuleContext = {
  graph: FlowGraph
  registry: ReadonlyMap<string, NodeDefinition>
  nodes: Map<string, NodeInstance>
  outgoing: Map<string, FlowEdge[]>
  incoming: Map<string, FlowEdge[]>
  /** Traffic entering the flow, from event sources or the scenario profile. */
  sourceRatePerSecond: number
}

export function buildRuleContext(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): RuleContext {
  const outgoing = new Map<string, FlowEdge[]>()
  const incoming = new Map<string, FlowEdge[]>()
  for (const edge of graph.edges) {
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge])
    incoming.set(edge.toNodeId, [...(incoming.get(edge.toNodeId) ?? []), edge])
  }
  const sourceRates = graph.nodes
    .filter((node) => node.type === "event.source")
    .map((node) => Number(node.config.ratePerSecond) || 0)
  return {
    graph,
    registry,
    nodes: new Map(graph.nodes.map((node) => [node.id, node])),
    outgoing,
    incoming,
    sourceRatePerSecond:
      sourceRates.length > 0
        ? sourceRates.reduce((sum, rate) => sum + rate, 0)
        : graph.simulationProfile.requestsPerSecond,
  }
}

/** Deterministic single-node estimates from the node's own configuration. */
export function estimateNode(
  context: RuleContext,
  node: NodeInstance,
): { latencyMs: number; capacityPerSecond?: number } {
  const definition = context.registry.get(node.type)
  if (!definition) return { latencyMs: 0 }
  const result = definition.simulate(node.config, {
    profile: context.graph.simulationProfile,
    ratePerSecond: context.sourceRatePerSecond,
  })
  return { latencyMs: result.latencyMs, capacityPerSecond: result.throughputPerSecond }
}

export const synchronousInteractions = new Set<FlowEdge["interactionType"]>([
  "request-response",
  "database-operation",
])

export function isOutageScenario(scenario: FailureScenario): boolean {
  return (
    scenario.kind === "dependency-unavailable" ||
    scenario.kind === "consumer-outage" ||
    scenario.kind === "region-unavailable" ||
    scenario.kind === "datastore-failover"
  )
}

export function scenarioAffectedNodes(
  context: RuleContext,
  scenario: FailureScenario,
): Set<string> {
  return affectedNodeIdsFor(context.graph, scenario)
}

/**
 * Nodes every source-to-sink path passes through, found by counting paths.
 * Sources themselves are demand, not design, and are excluded.
 */
export function singlePathNodes(context: RuleContext): string[] {
  const { graph, outgoing, incoming } = context
  const order: NodeInstance[] = []
  const remaining = new Map(
    graph.nodes.map((node) => [node.id, incoming.get(node.id)?.length ?? 0]),
  )
  const queue = graph.nodes.filter((node) => remaining.get(node.id) === 0)
  for (let index = 0; index < queue.length; index += 1) {
    order.push(queue[index])
    for (const edge of outgoing.get(queue[index].id) ?? []) {
      const next = (remaining.get(edge.toNodeId) ?? 0) - 1
      remaining.set(edge.toNodeId, next)
      const node = context.nodes.get(edge.toNodeId)
      if (next === 0 && node) queue.push(node)
    }
  }

  const fromSource = new Map<string, number>()
  for (const node of order) {
    const inbound = incoming.get(node.id) ?? []
    fromSource.set(
      node.id,
      inbound.length === 0
        ? 1
        : inbound.reduce((sum, edge) => sum + (fromSource.get(edge.fromNodeId) ?? 0), 0),
    )
  }
  const toSink = new Map<string, number>()
  for (const node of [...order].reverse()) {
    const outbound = outgoing.get(node.id) ?? []
    toSink.set(
      node.id,
      outbound.length === 0
        ? 1
        : outbound.reduce((sum, edge) => sum + (toSink.get(edge.toNodeId) ?? 0), 0),
    )
  }
  const totalPaths = graph.nodes
    .filter((node) => (incoming.get(node.id)?.length ?? 0) === 0)
    .reduce((sum, node) => sum + (toSink.get(node.id) ?? 0), 0)
  if (totalPaths === 0) return []

  return graph.nodes
    .filter(
      (node) =>
        node.type !== "event.source" &&
        (fromSource.get(node.id) ?? 0) * (toSink.get(node.id) ?? 0) === totalPaths,
    )
    .map((node) => node.id)
}
