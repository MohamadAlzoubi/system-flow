import type { FlowGraph, NodeDefinition, ValidationIssue } from "../../contracts"

const statefulCategories = new Set(["Data", "Messaging", "Streaming"])

function hasFailureScenario(graph: FlowGraph): boolean {
  return (
    graph.nodes.some(
      (node) =>
        (node.availabilityPolicy && node.availabilityPolicy.mode !== "online") ||
        (Number(node.config.failureRate) || 0) > 0,
    ) || graph.edges.some((edge) => (edge.network?.outagePercent ?? 0) > 0)
  )
}

export function validateGoals(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const goals = graph.architectureGoals
  if (!goals) {
    issues.push({
      severity: "warning",
      code: "GOALS_MISSING",
      message:
        "Flow declares no architecture goals, so results cannot be compared with a requirement",
    })
    return issues
  }

  const declaredValues = [
    goals.averageTrafficPerSecond,
    goals.peakTrafficPerSecond,
    goals.maximumAverageLatencyMs,
    goals.maximumP95LatencyMs,
    goals.maximumDataLossEvents,
    goals.maximumRecoveryTimeSeconds,
    goals.maximumRecoveryPointSeconds,
    goals.maximumDataStalenessMs,
  ]
  if (
    declaredValues.some((value) => value !== undefined && value < 0) ||
    (goals.minimumAvailabilityPercent !== undefined &&
      (goals.minimumAvailabilityPercent < 0 || goals.minimumAvailabilityPercent > 100))
  ) {
    issues.push({
      severity: "error",
      code: "INVALID_GOALS",
      message: "Architecture goal values are outside their valid ranges",
    })
  }

  if (goals.peakTrafficPerSecond === undefined) {
    issues.push({
      severity: "warning",
      code: "GOAL_PEAK_TRAFFIC_MISSING",
      message:
        "Peak traffic is an open question; declare the highest traffic the design must absorb",
    })
  }

  const userFacing = graph.nodes.some(
    (node) =>
      node.type === "http.endpoint" || registry.get(node.type)?.category === "Realtime",
  )
  if (
    userFacing &&
    goals.maximumAverageLatencyMs === undefined &&
    goals.maximumP95LatencyMs === undefined
  ) {
    issues.push({
      severity: "warning",
      code: "GOAL_LATENCY_TARGET_MISSING",
      message: "This flow serves users synchronously but declares no latency target",
    })
  }

  const stateful = graph.nodes.some((node) =>
    statefulCategories.has(registry.get(node.type)?.category ?? ""),
  )
  if (
    stateful &&
    goals.maximumDataLossEvents === undefined &&
    goals.maximumRecoveryTimeSeconds === undefined &&
    goals.maximumRecoveryPointSeconds === undefined
  ) {
    issues.push({
      severity: "warning",
      code: "GOAL_RECOVERY_TARGET_MISSING",
      message: "This flow holds state but declares no recovery or data-loss requirement",
    })
  }

  if (goals.minimumAvailabilityPercent !== undefined && !hasFailureScenario(graph)) {
    issues.push({
      severity: "warning",
      code: "GOAL_AVAILABILITY_UNTESTED",
      message: "An availability target is declared but no failure scenario exercises it",
    })
  }

  return issues
}
