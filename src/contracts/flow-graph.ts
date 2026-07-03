import type { ArchitectureBoundary } from "./architecture-boundary"
import type { ArchitectureGoals } from "./architecture-goals"
import type { RuleAcceptance } from "./architecture-rule"
import type { DataContract } from "./data-contract"
import type { FailureScenario } from "./failure-scenario"
import type { NodeInstance } from "./node-definition"
import type { SimulationProfile } from "./simulation"

/** How two components communicate, not only what data they carry. */
export type InteractionType =
  | "request-response"
  | "async-command"
  | "published-event"
  | "stream"
  | "batch-transfer"
  | "database-operation"
  | "realtime-push"

export type DeliveryPolicy = {
  guarantee: "at-most-once" | "at-least-once" | "effectively-once"
  ordering: "none" | "per-key" | "global"
  acknowledgement: "none" | "automatic" | "manual"
  deduplication: "none" | "producer" | "consumer" | "shared-store"
}

/** What happens when this interaction fails; absent means failures propagate. */
export type FailurePolicy = {
  timeoutMs?: number
  action: "propagate" | "retry" | "queue" | "fallback" | "drop" | "dead-letter"
  maximumAttempts?: number
  backoff?: "fixed" | "linear" | "exponential"
  initialBackoffMs?: number
  maximumBackoffMs?: number
  fallbackNodeId?: string
}

export type FlowEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  dataType: string
  /** Contract version this edge is pinned to; the latest version when absent. */
  dataTypeVersion?: string
  interactionType: InteractionType
  timeoutMs?: number
  responseDataType?: string
  deliveryPolicy?: DeliveryPolicy
  failurePolicy?: FailurePolicy
  /** How sensitive payload data is protected when crossing trust boundaries. */
  protection?: "tls" | "field-encryption" | "tokenization"
  condition?: string
  trafficPercentage?: number
  priority?: number
  network?: EdgeNetworkPolicy
}

export type EdgeNetworkPolicy = {
  sourceRegion: string
  targetRegion: string
  bandwidthMbps: number
  baseLatencyMs: number
  tlsHandshakeMs: number
  connectionReusePercent: number
  outagePercent: number
}

export type FlowGraph = {
  id: string
  name: string
  nodes: NodeInstance[]
  edges: FlowEdge[]
  dataContracts: DataContract[]
  simulationProfile: SimulationProfile
  architectureGoals?: ArchitectureGoals
  boundaries?: ArchitectureBoundary[]
  failureScenarios?: FailureScenario[]
  ruleAcceptances?: RuleAcceptance[]
}
