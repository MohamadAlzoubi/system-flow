export type OrderingRequirement = "none" | "per-key" | "global"

/**
 * Requirements a flow must meet, not component configuration. Every measurable
 * field is optional: an undeclared goal is a recorded open question, never a
 * silent default.
 */
export type ArchitectureGoals = {
  averageTrafficPerSecond?: number
  peakTrafficPerSecond?: number
  maximumAverageLatencyMs?: number
  maximumP95LatencyMs?: number
  minimumAvailabilityPercent?: number
  maximumDataLossEvents?: number
  maximumRecoveryTimeSeconds?: number
  maximumRecoveryPointSeconds?: number
  maximumDataStalenessMs?: number
  orderingRequirement: OrderingRequirement
}

export type GoalStatus = "passed" | "failed" | "not-evaluated"

export type GoalEvaluation = {
  goal: keyof ArchitectureGoals
  label: string
  status: GoalStatus
  target?: number
  actual?: number
  unit?: string
  safetyMarginPercent?: number
  reason: string
}

export type GoalReport = {
  evaluations: GoalEvaluation[]
  passed: number
  failed: number
  notEvaluated: number
  openQuestions: string[]
  assumptions: string[]
}
