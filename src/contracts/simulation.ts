import type { ValidationIssue } from "./validation"

export type TrafficPattern = "steady" | "burst" | "daily-peak" | "random"

export type SimulationProfile = {
  durationSeconds: number
  cpuCores: number
  memoryMb: number
  networkLatencyMs: number
  requestsPerSecond: number
  trafficPattern: TrafficPattern
}

export type SimulationResult = {
  totalEventsProcessed: number
  averageLatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  bottlenecks: ValidationIssue[]
  warnings: ValidationIssue[]
  resourceUsage: { cpuCores: number; memoryMb: number }
  nodeMetrics: NodeSimulationMetrics[]
  edgeMetrics: EdgeSimulationMetrics[]
  timeline: SimulationFrame[]
}

export type SimulationStatus = "healthy" | "warning" | "critical" | "inactive"

export type NodeSimulationMetrics = {
  nodeId: string
  incomingRatePerSecond: number
  acceptedRatePerSecond: number
  outgoingRatePerSecond: number
  capacityPerSecond?: number
  utilizationPercent?: number
  latencyMs: number
  processedEvents: number
  droppedEvents: number
  cpuCores: number
  memoryMb: number
  status: SimulationStatus
  queue?: QueueSimulationMetrics
  routingMode?: import("./node-definition").RoutingMode
  mergeMode?: import("./node-definition").MergeMode
  replicas?: number
  desiredReplicas?: number
  scaleReadySeconds?: number
  datastore?: import("./node-definition").NodeSimulationResult["datastore"]
  resilience?: import("./node-definition").NodeSimulationResult["resilience"]
}

export type QueueSimulationMetrics = {
  depth: number
  maxDepth: number
  enqueuedEvents: number
  dequeuedEvents: number
  expiredEvents: number
  deadLetteredEvents: number
  overflowEvents: number
  redeliveredEvents: number
  acknowledgedEvents: number
  deadLetterOverflowEvents: number
  averageMessageAgeMs: number
  timeToSaturationSeconds?: number
}

export type SimulationFrame = {
  timeSeconds: number
  queues: QueueFrameMetrics[]
  services: ServiceFrameMetrics[]
}

export type ServiceFrameMetrics = {
  nodeId: string
  replicas: number
  desiredReplicas: number
  capacityPerSecond: number
  scaling: boolean
}

export type QueueFrameMetrics = {
  nodeId: string
  depth: number
  enqueuedEvents: number
  dequeuedEvents: number
  expiredEvents: number
  deadLetteredEvents: number
  overflowEvents: number
  redeliveredEvents: number
  acknowledgedEvents: number
  deadLetterOverflowEvents: number
  averageMessageAgeMs: number
}

export type EdgeSimulationMetrics = {
  edgeId: string
  ratePerSecond: number
  totalEvents: number
  percentageOfSourceTraffic: number
  status: "active" | "congested" | "inactive"
  latencyMs: number
}

export type SimulationBaseline = {
  graphId: string
  graphName: string
  capturedAt: string
  result: SimulationResult
}

export type MetricDelta = {
  baseline: number
  current: number
  absolute: number
  percentage?: number
  improved: boolean
}

export type SimulationComparison = {
  throughput: MetricDelta
  averageLatency: MetricDelta
  p95Latency: MetricDelta
  cpuCores: MetricDelta
  memoryMb: MetricDelta
  droppedEvents: MetricDelta
  bottlenecks: {
    baselineNodeIds: string[]
    currentNodeIds: string[]
    resolvedNodeIds: string[]
    newNodeIds: string[]
    moved: boolean
  }
}
