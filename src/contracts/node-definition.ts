import type { ZodType } from "zod"
import type { SimulationProfile } from "./simulation"

export type NodeInstance = {
  id: string
  type: string
  position: { x: number; y: number }
  config: Record<string, unknown>
  routingPolicy?: RoutingPolicy
  mergePolicy?: MergePolicy
}

export type RoutingMode =
  | "broadcast"
  | "weighted"
  | "conditional"
  | "round-robin"
  | "failover"
  | "competing-consumers"

export type MergeMode = "sum" | "wait-all" | "first-response" | "asynchronous"

export type RoutingPolicy = {
  mode: RoutingMode
}

export type MergePolicy = {
  mode: MergeMode
}

export type SimulationContext = {
  profile: SimulationProfile
  ratePerSecond: number
}

export type NodeSimulationResult = {
  latencyMs: number
  latencyStdDevMs?: number
  cpuCores: number
  memoryMb: number
  throughputPerSecond?: number
  outputType?: string
  retryAmplification?: number
  scaling?: {
    initialReplicas: number
    desiredReplicas: number
    readyAfterSeconds: number
    capacityPerReplica: number
  }
  datastore?: {
    effectiveOperationsPerSecond: number
    connectionCapacityPerSecond: number
    iopsCapacityPerSecond: number
    readCapacityPerSecond: number
    writeCapacityPerSecond: number
    limitingResource: "connections" | "iops" | "reads" | "writes"
    replicationLagMs: number
    failoverSeconds: number
  }
  resilience?: {
    availabilityPercent: number
    rateLimitCapacityPerSecond: number
    bulkheadCapacityPerSecond: number
    circuitOpen: boolean
    rejectedPerSecond: number
    recoverySeconds: number
  }
}

export type NodeDefinition = {
  type: string
  label: string
  category: string
  inputTypes: string[]
  outputTypes: string[]
  defaultConfig: Record<string, unknown>
  configSchema: ZodType
  simulate: (
    config: Record<string, unknown>,
    context: SimulationContext,
  ) => NodeSimulationResult
  execute?: (input: unknown, context: unknown) => Promise<unknown>
}
