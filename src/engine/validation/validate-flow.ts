import type { FlowGraph, NodeDefinition, ValidationIssue } from "../../contracts"
import { hasCycle } from "./detect-cycles"
import { validateEdgeTypes } from "./validate-types"

export function validateFlow(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()

  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node id ${node.id}`,
        nodeId: node.id,
      })
    }
    nodeIds.add(node.id)
    const definition = registry.get(node.type)
    if (!definition) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_NODE",
        message: `Unknown node type ${node.type}`,
        nodeId: node.id,
      })
      continue
    }

    const validation = definition.configSchema.safeParse(node.config)
    if (!validation.success) {
      issues.push({
        severity: "error",
        code: "INVALID_CONFIG",
        message: `${definition.label} has invalid configuration`,
        nodeId: node.id,
      })
    }
  }

  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_EDGE_ID",
        message: `Duplicate edge id ${edge.id}`,
        edgeId: edge.id,
      })
    }
    edgeIds.add(edge.id)
    if (edge.fromNodeId === edge.toNodeId) {
      issues.push({
        severity: "error",
        code: "SELF_EDGE",
        message: "A node cannot connect to itself",
        edgeId: edge.id,
      })
    }
    if (
      edge.trafficPercentage !== undefined &&
      (edge.trafficPercentage < 0 || edge.trafficPercentage > 100)
    ) {
      issues.push({
        severity: "error",
        code: "INVALID_TRAFFIC_PERCENTAGE",
        message: "Edge traffic percentage must be between 0 and 100",
        edgeId: edge.id,
      })
    }
    if (
      edge.network &&
      (edge.network.bandwidthMbps <= 0 ||
        edge.network.connectionReusePercent < 0 ||
        edge.network.connectionReusePercent > 100 ||
        edge.network.outagePercent < 0 ||
        edge.network.outagePercent > 100 ||
        edge.network.baseLatencyMs < 0 ||
        edge.network.tlsHandshakeMs < 0)
    ) {
      issues.push({
        severity: "error",
        code: "INVALID_NETWORK_POLICY",
        message: "Edge network values are outside their valid ranges",
        edgeId: edge.id,
      })
    }
  }

  const outgoing = new Map<string, typeof graph.edges>()
  const incoming = new Map<string, typeof graph.edges>()
  for (const edge of graph.edges)
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge])
  for (const edge of graph.edges)
    incoming.set(edge.toNodeId, [...(incoming.get(edge.toNodeId) ?? []), edge])
  for (const [nodeId, edges] of outgoing) {
    const node = graph.nodes.find((item) => item.id === nodeId)
    const mode = node?.routingPolicy?.mode
    const weighted = edges.filter((edge) => edge.trafficPercentage !== undefined)
    if (
      (weighted.length > 0 || mode === "weighted" || mode === "conditional") &&
      (weighted.length !== edges.length ||
        Math.abs(
          weighted.reduce((sum, edge) => sum + (edge.trafficPercentage ?? 0), 0) - 100,
        ) > 0.001)
    ) {
      issues.push({
        severity: "error",
        code: "INVALID_TRAFFIC_SPLIT",
        message: "All branch edges must define percentages totaling 100",
        nodeId,
      })
    }
    if (mode === "conditional" && edges.some((edge) => !edge.condition?.trim())) {
      issues.push({
        severity: "error",
        code: "MISSING_ROUTE_CONDITION",
        message: "Every conditional route requires a condition label",
        nodeId,
      })
    }
    if (
      mode === "failover" &&
      new Set(edges.map((edge) => edge.priority)).size !== edges.length
    ) {
      issues.push({
        severity: "error",
        code: "INVALID_FAILOVER_PRIORITY",
        message: "Failover routes require unique priorities",
        nodeId,
      })
    }
    if (mode === "competing-consumers" && node?.type !== "rabbitmq.queue") {
      issues.push({
        severity: "error",
        code: "INVALID_COMPETING_CONSUMERS",
        message: "Competing consumers must originate from a queue",
        nodeId,
      })
    }
  }
  for (const node of graph.nodes) {
    if (node.mergePolicy && (incoming.get(node.id)?.length ?? 0) < 2) {
      issues.push({
        severity: "warning",
        code: "UNNECESSARY_MERGE_POLICY",
        message: "Merge policy has no effect without multiple inputs",
        nodeId: node.id,
      })
    }
  }

  issues.push(...validateEdgeTypes(graph, registry))
  if (hasCycle(graph)) {
    issues.push({
      severity: "error",
      code: "CIRCULAR_DEPENDENCY",
      message: "Cycles are not supported by deterministic simulation",
    })
  }

  const connected = new Set(
    graph.edges.flatMap((edge) => [edge.fromNodeId, edge.toNodeId]),
  )
  for (const node of graph.nodes) {
    if (graph.nodes.length > 1 && !connected.has(node.id)) {
      issues.push({
        severity: "error",
        code: "DISCONNECTED_NODE",
        message: "Node is disconnected from the flow",
        nodeId: node.id,
      })
    }
  }

  return issues
}
