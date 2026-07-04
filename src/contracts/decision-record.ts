export type DecisionStatus = "proposed" | "accepted" | "rejected" | "superseded"

/** Preserves why the architecture looks the way it does. */
export type DecisionRecord = {
  id: string
  title: string
  status: DecisionStatus
  context: string
  decision: string
  alternatives: string[]
  consequences: string[]
  assumptionIds: string[]
  relatedNodeIds: string[]
  relatedEdgeIds: string[]
  reviewDate?: string
}

export type AssumptionStatus = "unverified" | "verified" | "invalid"

export type AssumptionImpact = "low" | "medium" | "high"

/** A belief the design depends on, tracked until verified or invalidated. */
export type ArchitectureAssumption = {
  id: string
  statement: string
  status: AssumptionStatus
  impact: AssumptionImpact
  evidence?: string
  relatedIds: string[]
}
