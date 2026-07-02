import type { ArchitectureGoals } from "./architecture-goals"
import type { DataContract } from "./data-contract"
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

export type FlowEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  dataType: string
  interactionType: InteractionType
  timeoutMs?: number
  responseDataType?: string
  deliveryPolicy?: DeliveryPolicy
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
}
