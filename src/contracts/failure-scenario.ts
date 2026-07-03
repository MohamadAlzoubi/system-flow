export type FailureScenarioKind =
  | "dependency-unavailable"
  | "dependency-slow"
  | "partial-capacity-loss"
  | "region-unavailable"
  | "malformed-data"
  | "duplicate-delivery"
  | "traffic-spike"
  | "datastore-failover"
  | "consumer-outage"

/**
 * A named, reusable description of what goes wrong, who is affected, and what
 * the team expects to happen. Affected nodes come from explicit ids plus every
 * member of the affected boundaries.
 */
export type FailureScenario = {
  id: string
  name: string
  kind: FailureScenarioKind
  affectedNodeIds: string[]
  affectedBoundaryIds: string[]
  startSeconds: number
  durationSeconds: number
  recoverySeconds: number
  /** Capacity lost or events corrupted, in percent, where the kind needs one. */
  intensityPercent?: number
  /** Latency multiplier for dependency-slow scenarios. */
  slowdownFactor?: number
  /** Traffic multiplier for traffic-spike scenarios. */
  trafficMultiplier?: number
  expectedResponse?: string
  expectedUserImpact?: string
  recoveryBehavior?: string
}

export type UserImpactOutcome =
  | "rejected-immediately"
  | "timed-out"
  | "accepted-for-later"
  | "served-by-fallback"
  | "degraded-response"
  | "lost"
  | "duplicated"
  | "delayed-beyond-goal"
