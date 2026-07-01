import type { DataContract } from "./data-contract"
import type { NodeInstance } from "./node-definition"
import type { SimulationProfile } from "./simulation"

export type FlowEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  dataType: string
  condition?: string
  trafficPercentage?: number
  priority?: number
}

export type FlowGraph = {
  id: string
  name: string
  nodes: NodeInstance[]
  edges: FlowEdge[]
  dataContracts: DataContract[]
  simulationProfile: SimulationProfile
}
