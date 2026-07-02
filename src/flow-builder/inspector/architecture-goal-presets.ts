import type { ArchitectureGoals } from "../../contracts"

export type ArchitectureGoalPreset = {
  id: string
  label: string
  description: string
  goals: ArchitectureGoals
}

export const architectureGoalPresets: ArchitectureGoalPreset[] = [
  {
    id: "user-facing-api",
    label: "User-facing API",
    description: "Interactive requests where a person waits for the response.",
    goals: {
      averageTrafficPerSecond: 200,
      peakTrafficPerSecond: 1000,
      maximumAverageLatencyMs: 300,
      maximumP95LatencyMs: 800,
      minimumAvailabilityPercent: 99.9,
      maximumDataLossEvents: 0,
      orderingRequirement: "none",
    },
  },
  {
    id: "background-jobs",
    label: "Background jobs",
    description: "Deferred work where completion matters more than speed.",
    goals: {
      averageTrafficPerSecond: 100,
      peakTrafficPerSecond: 500,
      maximumDataLossEvents: 0,
      maximumRecoveryTimeSeconds: 600,
      orderingRequirement: "none",
    },
  },
  {
    id: "event-processing",
    label: "Event processing",
    description: "A pipeline that reacts to facts produced elsewhere.",
    goals: {
      averageTrafficPerSecond: 500,
      peakTrafficPerSecond: 2000,
      maximumDataLossEvents: 0,
      maximumRecoveryTimeSeconds: 300,
      maximumDataStalenessMs: 60000,
      orderingRequirement: "per-key",
    },
  },
  {
    id: "realtime-messaging",
    label: "Realtime messaging",
    description: "Live delivery where staleness is quickly visible to people.",
    goals: {
      averageTrafficPerSecond: 300,
      peakTrafficPerSecond: 1500,
      maximumAverageLatencyMs: 150,
      maximumP95LatencyMs: 400,
      minimumAvailabilityPercent: 99.9,
      maximumDataStalenessMs: 1000,
      orderingRequirement: "per-key",
    },
  },
  {
    id: "batch-processing",
    label: "Batch processing",
    description: "Scheduled bulk work measured in completeness, not latency.",
    goals: {
      averageTrafficPerSecond: 50,
      peakTrafficPerSecond: 200,
      maximumDataLossEvents: 0,
      maximumRecoveryTimeSeconds: 3600,
      maximumRecoveryPointSeconds: 3600,
      orderingRequirement: "none",
    },
  },
]

export const goalFieldHelp: Record<keyof ArchitectureGoals, string> = {
  averageTrafficPerSecond: "Typical events per second during normal operation.",
  peakTrafficPerSecond:
    "The highest traffic the design must absorb without shedding work.",
  maximumAverageLatencyMs: "The average time a caller may wait for the flow to finish.",
  maximumP95LatencyMs: "95 of every 100 requests must finish within this time.",
  minimumAvailabilityPercent:
    "The share of time the flow must keep responding successfully.",
  maximumDataLossEvents:
    "Events that may be lost in a scenario. Zero means every accepted event must survive.",
  maximumRecoveryTimeSeconds:
    "How quickly the flow must return to normal after a failure.",
  maximumRecoveryPointSeconds:
    "How much recently accepted work may be lost while recovering from a failure.",
  maximumDataStalenessMs:
    "How far derived or cached data may lag behind the source of truth.",
  orderingRequirement: "Whether events must be processed in the order they arrived.",
}
