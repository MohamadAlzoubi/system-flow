import type { ArchitectureGoals, GoalEvaluation, GoalReport } from "../../contracts"

const round = (value: number) => Number(value.toFixed(2))

/** Scenario outcomes the goal evaluator compares against declared requirements. */
export type GoalMeasurements = {
  averageLatencyMs: number
  p95LatencyMs: number
  /** Traffic entering the flow at its source nodes during the scenario. */
  sourceRatePerSecond: number
  /**
   * How far scenario traffic can scale before the tightest component saturates:
   * below 1 the flow already sheds load, above 1 it has headroom.
   */
  bottleneckRatio?: number
  /** Events dropped, expired, or overflowed without reaching a dead letter queue. */
  lostEvents: number
  /** Product of node availabilities across the flow. */
  availabilityPercent: number
  recoveryTimeSeconds?: number
  recoveryPointSeconds?: number
  dataStalenessMs?: number
}

const goalLabels: Record<keyof ArchitectureGoals, string> = {
  averageTrafficPerSecond: "Average traffic",
  peakTrafficPerSecond: "Peak traffic",
  maximumAverageLatencyMs: "Average latency",
  maximumP95LatencyMs: "p95 latency",
  minimumAvailabilityPercent: "Availability",
  maximumDataLossEvents: "Data loss",
  maximumRecoveryTimeSeconds: "Recovery time",
  maximumRecoveryPointSeconds: "Recovery point",
  maximumDataStalenessMs: "Data staleness",
  orderingRequirement: "Ordering",
}

export function evaluateGoals(
  goals: ArchitectureGoals | undefined,
  measurements: GoalMeasurements,
): GoalReport {
  if (!goals) {
    return {
      evaluations: [],
      passed: 0,
      failed: 0,
      notEvaluated: 0,
      openQuestions: ["No architecture goals are declared for this flow."],
      assumptions: [],
    }
  }

  const evaluations: GoalEvaluation[] = []
  const openQuestions: string[] = []
  const assumptions = new Set<string>()

  const openQuestion = (goal: keyof ArchitectureGoals) => {
    openQuestions.push(`${goalLabels[goal]} has not been decided.`)
  }

  // The tightest component bounds how much traffic the whole flow can absorb.
  const sustainableRate =
    measurements.bottleneckRatio !== undefined && measurements.sourceRatePerSecond > 0
      ? measurements.sourceRatePerSecond * measurements.bottleneckRatio
      : undefined

  const evaluateTraffic = (goal: "averageTrafficPerSecond" | "peakTrafficPerSecond") => {
    const target = goals[goal]
    if (target === undefined) {
      openQuestion(goal)
      return
    }
    if (sustainableRate === undefined) {
      evaluations.push({
        goal,
        label: goalLabels[goal],
        status: "not-evaluated",
        target,
        unit: "events/s",
        reason:
          "No component reported a capacity limit, so sustainable traffic cannot be estimated.",
      })
      return
    }
    assumptions.add(
      "Sustainable traffic is extrapolated linearly from the tightest component in the simulated scenario.",
    )
    const passed = sustainableRate >= target
    evaluations.push({
      goal,
      label: goalLabels[goal],
      status: passed ? "passed" : "failed",
      target,
      actual: round(sustainableRate),
      unit: "events/s",
      safetyMarginPercent: round(((sustainableRate - target) / target) * 100),
      reason: passed
        ? `The design sustains an estimated ${round(sustainableRate)} events/s, above the ${target} events/s requirement.`
        : `The design sustains an estimated ${round(sustainableRate)} events/s, below the ${target} events/s requirement.`,
    })
  }

  const evaluateMaximum = (
    goal: keyof ArchitectureGoals,
    target: number | undefined,
    actual: number,
    unit: string,
  ) => {
    if (target === undefined) {
      openQuestion(goal)
      return
    }
    const passed = actual <= target
    evaluations.push({
      goal,
      label: goalLabels[goal],
      status: passed ? "passed" : "failed",
      target,
      actual: round(actual),
      unit,
      safetyMarginPercent:
        target > 0 ? round(((target - actual) / target) * 100) : undefined,
      reason: passed
        ? `Measured ${round(actual)} ${unit} stays within the ${target} ${unit} limit.`
        : `Measured ${round(actual)} ${unit} exceeds the ${target} ${unit} limit.`,
    })
  }

  const evaluateEstimatedMaximum = (
    goal:
      | "maximumRecoveryTimeSeconds"
      | "maximumRecoveryPointSeconds"
      | "maximumDataStalenessMs",
    actual: number | undefined,
    unit: string,
    missingReason: string,
  ) => {
    const target = goals[goal]
    if (target === undefined) {
      openQuestion(goal)
      return
    }
    if (actual === undefined) {
      evaluations.push({
        goal,
        label: goalLabels[goal],
        status: "not-evaluated",
        target,
        unit,
        reason: missingReason,
      })
      return
    }
    assumptions.add(
      "Recovery and freshness values are deterministic architecture estimates, not production predictions.",
    )
    const passed = actual <= target
    evaluations.push({
      goal,
      label: goalLabels[goal],
      status: passed ? "passed" : "failed",
      target,
      actual: round(actual),
      unit,
      safetyMarginPercent:
        target > 0 ? round(((target - actual) / target) * 100) : undefined,
      reason: passed
        ? `Estimated ${round(actual)} ${unit} stays within the ${target} ${unit} limit.`
        : `Estimated ${round(actual)} ${unit} exceeds the ${target} ${unit} limit.`,
    })
  }

  evaluateTraffic("averageTrafficPerSecond")
  evaluateTraffic("peakTrafficPerSecond")
  evaluateMaximum(
    "maximumAverageLatencyMs",
    goals.maximumAverageLatencyMs,
    measurements.averageLatencyMs,
    "ms",
  )
  evaluateMaximum(
    "maximumP95LatencyMs",
    goals.maximumP95LatencyMs,
    measurements.p95LatencyMs,
    "ms",
  )

  if (goals.minimumAvailabilityPercent === undefined) {
    openQuestion("minimumAvailabilityPercent")
  } else {
    assumptions.add(
      "End-to-end availability is estimated as the product of node availabilities; failover paths are not credited.",
    )
    const target = goals.minimumAvailabilityPercent
    const actual = measurements.availabilityPercent
    const passed = actual >= target
    evaluations.push({
      goal: "minimumAvailabilityPercent",
      label: goalLabels.minimumAvailabilityPercent,
      status: passed ? "passed" : "failed",
      target,
      actual: round(actual),
      unit: "%",
      safetyMarginPercent:
        target > 0 ? round(((actual - target) / target) * 100) : undefined,
      reason: passed
        ? `Estimated availability ${round(actual)}% meets the ${target}% requirement.`
        : `Estimated availability ${round(actual)}% falls below the ${target}% requirement.`,
    })
  }

  evaluateMaximum(
    "maximumDataLossEvents",
    goals.maximumDataLossEvents,
    measurements.lostEvents,
    "events",
  )

  evaluateEstimatedMaximum(
    "maximumRecoveryTimeSeconds",
    measurements.recoveryTimeSeconds,
    "seconds",
    "No timed failure or recovery policy was simulated, so recovery time cannot be estimated.",
  )
  evaluateEstimatedMaximum(
    "maximumRecoveryPointSeconds",
    measurements.recoveryPointSeconds,
    "seconds",
    "No failure context with measurable source traffic was simulated, so a recovery point cannot be estimated.",
  )
  evaluateEstimatedMaximum(
    "maximumDataStalenessMs",
    measurements.dataStalenessMs,
    "ms",
    "No cache TTL, replica lag, processing lag, queue age, or cross-region transfer delay is configured.",
  )

  if (goals.orderingRequirement !== "none") {
    evaluations.push({
      goal: "orderingRequirement",
      label: goalLabels.orderingRequirement,
      status: "not-evaluated",
      reason: `The ${goals.orderingRequirement} ordering requirement can be checked once every edge declares its delivery policy.`,
    })
  }

  return {
    evaluations,
    passed: evaluations.filter((item) => item.status === "passed").length,
    failed: evaluations.filter((item) => item.status === "failed").length,
    notEvaluated: evaluations.filter((item) => item.status === "not-evaluated").length,
    openQuestions,
    assumptions: [...assumptions],
  }
}
