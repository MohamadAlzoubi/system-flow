import type { ValidationIssue } from "./validation"

export type TrafficPattern = "steady" | "burst" | "daily-peak" | "random"

export type SimulationProfile = {
  durationSeconds: number
  cpuCores: number
  memoryMb: number
  networkLatencyMs: number
  requestsPerSecond: number
  trafficPattern: TrafficPattern
  observedLatencyMs?: number
  observedThroughputPerSecond?: number
  peakRequestsPerSecond?: number
  burstDurationSeconds?: number
  rampUpSeconds?: number
  payloadSizeBytes?: number
  duplicateEventPercent?: number
  malformedEventPercent?: number
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
  explanation: SimulationExplanation
}

export type SimulationExplanation = {
  confidence: "low" | "medium" | "high"
  confidenceReasons: string[]
  assumptions: string[]
  recommendations: SimulationRecommendation[]
  calibrated: boolean
  calibrationFactors?: {
    latency: number
    throughput: number
  }
}

export type SimulationRecommendation = {
  code: string
  priority: "high" | "medium" | "low"
  message: string
  nodeId?: string
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
  availabilityPercent: number
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
  publisherConfirmedEvents: number
  persistedBytes: number
  activePartitions: number
  timeToSaturationSeconds?: number
}

export type SimulationFrame = {
  timeSeconds: number
  queues: QueueFrameMetrics[]
  services: ServiceFrameMetrics[]
  datastores: DataStoreFrameMetrics[]
  resilience: ResilienceFrameMetrics[]
  availability: AvailabilityFrameMetrics[]
}

export type AvailabilityFrameMetrics = {
  nodeId: string
  state: "online" | "offline" | "degraded" | "recovering"
  capacityPercent: number
}

export type ResilienceFrameMetrics = {
  nodeId: string
  circuitState: "closed" | "open" | "half-open" | "recovered"
  availabilityPercent: number
  rejectedEvents: number
  downstreamRatePerSecond: number
}

export type DataStoreFrameMetrics = {
  nodeId: string
  primaryState: "available" | "failing-over" | "recovered"
  activeReadReplicas: number
  connectionUtilizationPercent: number
  iopsUtilizationPercent: number
  replicationLagMs: number
  contentionWaitMs: number
}

export type ServiceFrameMetrics = {
  nodeId: string
  replicas: number
  desiredReplicas: number
  capacityPerSecond: number
  scaling: boolean
  direction: "up" | "down" | "none"
  limitingResource: "concurrency" | "in-flight" | "cpu" | "memory" | "timeout"
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
  publisherConfirmedEvents: number
  persistedBytes: number
  activePartitions: number
}

export type EdgeSimulationMetrics = {
  edgeId: string
  ratePerSecond: number
  totalEvents: number
  percentageOfSourceTraffic: number
  status: "active" | "congested" | "inactive"
  latencyMs: number
  network?: {
    sourceRegion: string
    targetRegion: string
    transferLatencyMs: number
    tlsLatencyMs: number
    availabilityPercent: number
    bandwidthCapacityPerSecond: number
  }
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
