export type RuleCategory =
  | "contracts"
  | "reliability"
  | "performance"
  | "state"
  | "security"
  | "operability"

export type RuleSeverity = "error" | "warning" | "question"

/** A review finding that explains itself and offers alternatives. */
export type ArchitectureRule = {
  code: string
  category: RuleCategory
  severity: RuleSeverity
  message: string
  rationale: string
  affectedIds: string[]
  suggestedActions: string[]
}

/**
 * A documented decision to live with a finding. Stored on the graph so the
 * accepted risk stays visible in exports and reviews.
 */
export type RuleAcceptance = {
  ruleCode: string
  /** Sorted affected ids joined with "|", identifying one finding instance. */
  targetKey: string
  reason: string
  acceptedBy?: string
  reviewDate?: string
}
