import type { ArchitectureRule } from "../../contracts"
import {
  estimateNode,
  isOutageScenario,
  type RuleContext,
  scenarioAffectedNodes,
  singlePathNodes,
} from "./rule-helpers"

export function reliabilityRules(context: RuleContext): ArchitectureRule[] {
  const findings: ArchitectureRule[] = []
  const { graph, nodes, outgoing, incoming, sourceRatePerSecond } = context
  const goals = graph.architectureGoals

  if (goals?.minimumAvailabilityPercent !== undefined) {
    const singlePoints = singlePathNodes(context)
    if (singlePoints.length > 0) {
      findings.push({
        code: "SINGLE_POINT_OF_FAILURE",
        category: "reliability",
        severity: "warning",
        message: `${singlePoints.length} components carry every request, conflicting with the ${goals.minimumAvailabilityPercent}% availability goal`,
        rationale:
          "When one component sits on every path, its availability caps the whole flow. A high availability target needs redundancy or failover somewhere.",
        affectedIds: singlePoints,
        suggestedActions: [
          "Add replicas or a failover route for the most fragile of these components.",
          "Lower the availability goal if this risk is acceptable, and record why.",
        ],
      })
    }
  }

  for (const edge of graph.edges) {
    const policy = edge.failurePolicy
    if (policy?.action !== "retry" || policy.maximumAttempts === undefined) continue
    const target = nodes.get(edge.toNodeId)
    if (!target) continue
    const capacity = estimateNode(context, target).capacityPerSecond
    const amplified = sourceRatePerSecond * policy.maximumAttempts
    if (capacity !== undefined && amplified > capacity) {
      findings.push({
        code: "RETRY_AMPLIFICATION",
        category: "reliability",
        severity: "warning",
        message: `${policy.maximumAttempts} attempts can amplify ${sourceRatePerSecond}/s into ${amplified}/s against a ~${Math.round(capacity)}/s dependency`,
        rationale:
          "During an incident every caller retries at once. If amplified traffic exceeds the dependency's capacity, retries prolong the outage they are meant to survive.",
        affectedIds: [edge.id, target.id],
        suggestedActions: [
          "Add a circuit breaker so retries stop while the dependency is down.",
          "Lower the attempt limit or add jittered backoff to spread the load.",
        ],
      })
    }
  }

  for (const node of graph.nodes) {
    if (node.type !== "resilience.circuit-breaker") continue
    const hasFallback =
      node.routingPolicy?.mode === "failover" ||
      (outgoing.get(node.id) ?? []).some(
        (edge) => edge.failurePolicy?.action === "fallback",
      ) ||
      (incoming.get(node.id) ?? []).some(
        (edge) =>
          edge.failurePolicy?.action === "fallback" ||
          edge.failurePolicy?.action === "queue",
      )
    if (!hasFallback) {
      findings.push({
        code: "BREAKER_WITHOUT_FALLBACK",
        category: "reliability",
        severity: "warning",
        message: "A circuit breaker opens with nothing to answer callers",
        rationale:
          "A breaker protects the dependency, not the caller. Without a fallback or queue, opening the circuit just converts slow failures into fast ones.",
        affectedIds: [node.id],
        suggestedActions: [
          "Serve a cached or degraded answer while the circuit is open.",
          "Queue the work for later if callers can wait.",
        ],
      })
    }
  }

  const recoveryGoal = goals?.maximumRecoveryTimeSeconds
  for (const scenario of graph.failureScenarios ?? []) {
    if (!isOutageScenario(scenario)) continue
    const affected = scenarioAffectedNodes(context, scenario)
    for (const node of graph.nodes) {
      if (node.type !== "rabbitmq.queue") continue
      const consumers = (outgoing.get(node.id) ?? [])
        .map((edge) => nodes.get(edge.toNodeId))
        .filter((consumer) => consumer !== undefined)
      if (!consumers.some((consumer) => affected.has(consumer.id))) continue
      const consumerCapacity = consumers.reduce(
        (sum, consumer) => sum + (estimateNode(context, consumer).capacityPerSecond ?? 0),
        0,
      )
      const backlog = sourceRatePerSecond * scenario.durationSeconds
      const drainRate = consumerCapacity - sourceRatePerSecond
      const drainSeconds = drainRate > 0 ? backlog / drainRate : Number.POSITIVE_INFINITY
      const exceedsGoal = recoveryGoal !== undefined && drainSeconds > recoveryGoal
      if (drainRate <= 0 || exceedsGoal) {
        findings.push({
          code: "RECOVERY_DRAIN_TOO_SLOW",
          category: "reliability",
          severity: "warning",
          message:
            drainRate <= 0
              ? `After "${scenario.name}", consumers (~${Math.round(consumerCapacity)}/s) cannot outpace inflow (${sourceRatePerSecond}/s), so the backlog never drains`
              : `After "${scenario.name}", draining the backlog takes ~${Math.round(drainSeconds)}s against a ${recoveryGoal}s recovery goal`,
          rationale:
            "Recovering from an outage needs spare capacity beyond normal traffic. Without it, delayed work stays delayed and the outage effectively continues.",
          affectedIds: [node.id, ...consumers.map((consumer) => consumer.id)],
          suggestedActions: [
            "Scale consumers up during recovery, automatically or by runbook.",
            "Shed or archive low-value backlog instead of replaying all of it.",
            "Relax the recovery goal if slower catch-up is acceptable, and record why.",
          ],
        })
      }
    }
  }

  return findings
}
