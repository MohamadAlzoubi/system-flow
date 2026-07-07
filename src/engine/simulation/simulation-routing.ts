import type { FlowGraph, NodeInstance, NodeSimulationResult } from "../../contracts"
import { positiveOr } from "./simulation-math"

export type Contribution = {
  rate: number
  latencyMs: number
  callerFacing: boolean
}

// Caller latency ends where work is accepted for later processing.
export const asynchronousInteractions = new Set<
  FlowGraph["edges"][number]["interactionType"]
>(["async-command", "published-event", "stream", "batch-transfer", "realtime-push"])

export function isDeadLetterRoute(
  edge: FlowGraph["edges"][number],
  nodes: ReadonlyMap<string, NodeInstance>,
): boolean {
  return nodes.get(edge.toNodeId)?.type === "messaging.dead-letter-queue"
}

export function routableEdges(
  node: NodeInstance,
  edges: FlowGraph["edges"],
  nodes: ReadonlyMap<string, NodeInstance>,
): FlowGraph["edges"] {
  if (node.type !== "rabbitmq.queue") return edges
  return edges.filter((edge) => !isDeadLetterRoute(edge, nodes))
}

export function routingModeFor(
  node: NodeInstance,
  edges: FlowGraph["edges"],
): NonNullable<NodeInstance["routingPolicy"]>["mode"] {
  if (node.routingPolicy?.mode) return node.routingPolicy.mode
  if (edges.some((edge) => edge.trafficPercentage !== undefined)) return "weighted"
  if (node.type === "network.load-balancer" && edges.length > 1) return "round-robin"
  return "broadcast"
}

export function consumerParallelism(
  target: NodeInstance,
  result: NodeSimulationResult,
): number {
  if (result.scaling) {
    return Math.max(result.scaling.initialReplicas, result.scaling.desiredReplicas)
  }
  return Math.max(1, Math.floor(positiveOr(target.config.replicas, 1)))
}

export function mergeContributions(
  contributions: Contribution[],
  mode: "sum" | "wait-all" | "first-response" | "asynchronous",
): Contribution {
  if (contributions.length === 0) return { rate: 0, latencyMs: 0, callerFacing: false }
  const callerFacing = contributions.some((item) => item.callerFacing)
  if (mode === "wait-all") {
    return {
      rate: Math.min(...contributions.map(({ rate }) => rate)),
      latencyMs: Math.max(...contributions.map(({ latencyMs }) => latencyMs)),
      callerFacing,
    }
  }
  if (mode === "first-response") {
    return {
      rate: Math.max(...contributions.map(({ rate }) => rate)),
      latencyMs: Math.min(...contributions.map(({ latencyMs }) => latencyMs)),
      callerFacing,
    }
  }
  return {
    rate: contributions.reduce((sum, item) => sum + item.rate, 0),
    latencyMs:
      mode === "asynchronous"
        ? 0
        : Math.max(...contributions.map(({ latencyMs }) => latencyMs)),
    callerFacing,
  }
}
