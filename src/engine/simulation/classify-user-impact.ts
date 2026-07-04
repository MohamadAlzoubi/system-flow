import type { GoalReport, NodeSimulationMetrics, UserImpactEntry } from "../../contracts"

export type UserImpactContext = {
  /** Nodes whose drops come from callers giving up rather than shed load. */
  timedOutNodeIds: ReadonlySet<string>
  /** Nodes serving while degraded to partial capacity. */
  degradedNodeIds: ReadonlySet<string>
  /** Events answered by failover targets instead of the primary path. */
  fallbackEvents: number
  /** Frame-observed caller timeouts not already covered by node drops. */
  timedOutEvents: number
  processedEvents: number
  goalReport?: GoalReport
}

/**
 * Explains failed or at-risk work in caller terms instead of component
 * utilization. Every count is derived from the same deterministic metrics
 * the analysis panel already shows.
 */
export function classifyUserImpact(
  nodeMetrics: NodeSimulationMetrics[],
  context: UserImpactContext,
): UserImpactEntry[] {
  let rejected = 0
  let timedOut = context.timedOutEvents
  let lost = 0
  let backlog = 0
  let deadLettered = 0
  let duplicated = 0
  let degraded = 0

  for (const metric of nodeMetrics) {
    if (metric.resilience) rejected += metric.droppedEvents
    else if (context.timedOutNodeIds.has(metric.nodeId)) timedOut += metric.droppedEvents
    else lost += metric.droppedEvents
    if (metric.queue) {
      lost += Math.max(
        0,
        metric.queue.expiredEvents +
          metric.queue.overflowEvents -
          metric.queue.deadLetteredEvents,
      )
      backlog += metric.queue.depth
      deadLettered += metric.queue.deadLetteredEvents
      duplicated += metric.queue.redeliveredEvents
    }
    if (context.degradedNodeIds.has(metric.nodeId)) degraded += metric.processedEvents
  }

  const latencyGoalFailed =
    context.goalReport?.evaluations.some(
      (evaluation) =>
        (evaluation.goal === "maximumAverageLatencyMs" ||
          evaluation.goal === "maximumP95LatencyMs") &&
        evaluation.status === "failed",
    ) ?? false

  const entries: UserImpactEntry[] = [
    {
      outcome: "rejected-immediately" as const,
      events: rejected,
      description:
        "Turned away at once by rate limits, bulkheads, or open circuit breakers.",
    },
    {
      outcome: "timed-out" as const,
      events: timedOut,
      description: "Callers gave up waiting before the work completed.",
    },
    {
      outcome: "accepted-for-later" as const,
      events: backlog + deadLettered,
      description:
        "Accepted and parked in queue backlogs or dead-letter storage for later processing.",
    },
    {
      outcome: "served-by-fallback" as const,
      events: context.fallbackEvents,
      description: "Answered by a failover target instead of the primary path.",
    },
    {
      outcome: "degraded-response" as const,
      events: degraded,
      description: "Served while the component ran at reduced capacity.",
    },
    {
      outcome: "lost" as const,
      events: lost,
      description:
        "Shed, expired, or overflowed with no dead-letter protection; this work is gone.",
    },
    {
      outcome: "duplicated" as const,
      events: duplicated,
      description:
        "Redelivered by retries; consumers must tolerate seeing the same work twice.",
    },
    {
      outcome: "delayed-beyond-goal" as const,
      events: latencyGoalFailed ? context.processedEvents : 0,
      description: "Completed, but slower than the declared latency goal.",
    },
  ]

  return entries
    .map((entry) => ({ ...entry, events: Math.round(entry.events) }))
    .filter((entry) => entry.events > 0)
}
