import type { FailureScenario, FlowGraph } from "../../contracts"

/** Explicit node ids plus every member of the affected boundaries and their children. */
export function affectedNodeIdsFor(
  graph: FlowGraph,
  scenario: FailureScenario,
): Set<string> {
  const boundaryIds = new Set(scenario.affectedBoundaryIds)
  const boundaries = graph.boundaries ?? []
  let grew = true
  while (grew) {
    grew = false
    for (const boundary of boundaries) {
      if (
        boundary.parentId !== undefined &&
        boundaryIds.has(boundary.parentId) &&
        !boundaryIds.has(boundary.id)
      ) {
        boundaryIds.add(boundary.id)
        grew = true
      }
    }
  }
  const ids = new Set(scenario.affectedNodeIds)
  for (const node of graph.nodes) {
    if (node.boundaryId !== undefined && boundaryIds.has(node.boundaryId)) {
      ids.add(node.id)
    }
  }
  return ids
}

const latencyConfigKeys = ["averageProcessingMs", "averageLatencyMs"]

/**
 * Translates a scenario into the deterministic mechanisms the simulator
 * already understands: availability policies, degraded capacity, datastore
 * failover configuration, data-quality percentages, and traffic bursts.
 * The input graph is never mutated.
 */
export function applyFailureScenario(
  graph: FlowGraph,
  scenario: FailureScenario,
): FlowGraph {
  const next = structuredClone(graph)
  const affected = affectedNodeIdsFor(next, scenario)
  const outagePolicy = {
    mode: "scheduled" as const,
    offlineFromSeconds: scenario.startSeconds,
    offlineDurationSeconds: scenario.durationSeconds,
    recoverySeconds: scenario.recoverySeconds,
    degradedCapacityPercent: 100,
  }

  switch (scenario.kind) {
    case "dependency-unavailable":
    case "region-unavailable":
    case "consumer-outage":
      for (const node of next.nodes) {
        if (affected.has(node.id)) node.availabilityPolicy = outagePolicy
      }
      break
    case "partial-capacity-loss":
      for (const node of next.nodes) {
        if (affected.has(node.id)) {
          node.availabilityPolicy = {
            mode: "degraded",
            offlineFromSeconds: 0,
            offlineDurationSeconds: 0,
            recoverySeconds: 0,
            degradedCapacityPercent: Math.max(0, 100 - (scenario.intensityPercent ?? 50)),
          }
        }
      }
      break
    case "dependency-slow": {
      const factor = scenario.slowdownFactor ?? 3
      for (const node of next.nodes) {
        if (!affected.has(node.id)) continue
        for (const key of latencyConfigKeys) {
          const value = node.config[key]
          if (typeof value === "number") node.config[key] = value * factor
        }
      }
      break
    }
    case "malformed-data":
      next.simulationProfile.malformedEventPercent = scenario.intensityPercent ?? 10
      break
    case "duplicate-delivery":
      next.simulationProfile.duplicateEventPercent = scenario.intensityPercent ?? 10
      break
    case "traffic-spike": {
      const profile = next.simulationProfile
      profile.trafficPattern = "burst"
      profile.peakRequestsPerSecond =
        profile.requestsPerSecond * (scenario.trafficMultiplier ?? 4)
      profile.burstDurationSeconds = scenario.durationSeconds
      profile.rampUpSeconds = Math.min(30, scenario.durationSeconds)
      profile.burstStartSeconds = scenario.startSeconds
      break
    }
    case "datastore-failover":
      for (const node of next.nodes) {
        if (!affected.has(node.id)) continue
        if ("primaryAvailable" in node.config) {
          node.config.primaryAvailable = false
          node.config.failoverSeconds = scenario.durationSeconds
        }
      }
      break
  }
  return next
}
