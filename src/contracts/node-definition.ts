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
  cpuCores: number
  memoryMb: number
  throughputPerSecond?: number
  outputType?: string
  retryAmplification?: number
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
