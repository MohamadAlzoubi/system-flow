import type {
  EdgeSimulationMetrics,
  FailureScenario,
  FlowGraph,
  NodeDefinition,
  NodeSimulationMetrics,
  NodeSimulationResult,
  QueueFrameMetrics,
  SimulationFrame,
  SimulationResult,
  TrafficFrameMetrics,
  ValidationIssue,
} from "../../contracts"
import { resolveEdgeContract } from "../contracts/contract-versions"
import { validateFlow } from "../validation/validate-flow"
import { applyFailureScenario } from "./apply-failure-scenario"
import { classifyUserImpact } from "./classify-user-impact"
import { estimateProductionReadiness } from "./estimate-readiness"
import { evaluateGoals } from "./evaluate-goals"
import { availabilityAt, averageAvailability } from "./simulation-availability"
import {
  createRandom,
  effectiveTrafficRate,
  nonnegativeOr,
  normalSample,
  number,
  percentile,
  positiveOr,
  round,
  seedFrom,
} from "./simulation-math"
import { recommendationsFor } from "./simulation-recommendations"
import {
  asynchronousInteractions,
  type Contribution,
  consumerParallelism,
  isDeadLetterRoute,
  mergeContributions,
  routableEdges,
  routingModeFor,
} from "./simulation-routing"
import { trafficRateAt } from "./traffic-pattern"

function retryOpportunities(
  elapsedSeconds: number,
  retryCount: number,
  initialDelayMs: number,
  maximumDelayMs: number,
  jitterPercent: number,
): number {
  let elapsedMs = 0
  let opportunities = 0
  for (let attempt = 0; attempt < retryCount; attempt += 1) {
    const delay =
      Math.min(maximumDelayMs, initialDelayMs * 2 ** attempt) * (1 + jitterPercent / 200)
    elapsedMs += delay
    if (elapsedMs > elapsedSeconds * 1000) break
    opportunities += 1
  }
  return opportunities
}

export function runSimulation(
  baseGraph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
  scenario?: FailureScenario,
): SimulationResult {
  const graph = scenario ? applyFailureScenario(baseGraph, scenario) : baseGraph
  const warnings: ValidationIssue[] = validateFlow(graph, registry)
  const profile = graph.simulationProfile
  if (warnings.some((issue) => issue.severity === "error")) {
    return {
      totalEventsProcessed: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      bottlenecks: [],
      warnings,
      resourceUsage: { cpuCores: 0, memoryMb: 0 },
      nodeMetrics: [],
      edgeMetrics: [],
      timeline: [],
      explanation: {
        confidence: "low",
        confidenceReasons: ["Fatal validation errors prevent simulation."],
        assumptions: ["The graph must be valid and acyclic."],
        recommendations: [],
        calibrated: false,
        calibrationEvidence: [],
      },
      readiness: { evidence: [] },
      userImpact: [],
    }
  }
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, typeof graph.edges>()
  const incomingCount = new Map(graph.nodes.map((node) => [node.id, 0]))
  for (const edge of graph.edges) {
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge])
    if (nodes.has(edge.fromNodeId) && nodes.has(edge.toNodeId)) {
      incomingCount.set(edge.toNodeId, (incomingCount.get(edge.toNodeId) ?? 0) + 1)
    }
  }

  const queue = graph.nodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
  const order: string[] = []
  const remaining = new Map(incomingCount)
  for (let index = 0; index < queue.length; index += 1) {
    const nodeId = queue[index]
    order.push(nodeId)
    for (const edge of outgoing.get(nodeId) ?? []) {
      const next = (remaining.get(edge.toNodeId) ?? 0) - 1
      remaining.set(edge.toNodeId, next)
      if (next === 0) queue.push(edge.toNodeId)
    }
  }

  const incomingContributions = new Map<string, Contribution[]>()
  const nodeMetrics: NodeSimulationMetrics[] = []
  const edgeMetrics: EdgeSimulationMetrics[] = []
  let cpu = 0
  let memory = 0
  let endToEndLatency = 0
  let latencyVariance = 0
  let fallbackEvents = 0
  const timeline: SimulationFrame[] = []
  const scalingServices = new Map<string, NonNullable<NodeSimulationResult["scaling"]>>()
  const datastoreStates = new Map<
    string,
    NonNullable<NodeSimulationResult["datastore"]>
  >()
  const resilienceStates = new Map<
    string,
    {
      metrics: NonNullable<NodeSimulationResult["resilience"]>
      inputRate: number
    }
  >()
  const queueRates = new Map<
    string,
    {
      incoming: number
      outgoing: number
      maxSize: number
      ttlSeconds: number
      deadLetter: boolean
      deadLetterMaxSize: number
      retryCount: number
      retryDelaySeconds: number
      failureRate: number
      acknowledgementLatencyMs: number
      brokerCapacity: number
      retryInitialDelayMs: number
      retryMaximumDelayMs: number
      retryJitterPercent: number
      payloadSizeBytes: number
      durable: boolean
      activePartitions: number
      consumers: { id: string; staticCapacity: number }[]
    }
  >()
  // Static per-node facts the frame engine modulates with time-varying factors.
  const staticCapacities = new Map<string, number | undefined>()
  const sourceBaselines = new Map<string, number>()
  if (
    (profile.duplicateEventPercent ?? 0) > 0 ||
    (profile.malformedEventPercent ?? 0) > 0
  ) {
    warnings.push({
      severity: "warning",
      code: "DATA_QUALITY",
      message: `Traffic includes ${profile.duplicateEventPercent ?? 0}% duplicates and ${profile.malformedEventPercent ?? 0}% malformed events`,
    })
  }

  for (const nodeId of order) {
    const node = nodes.get(nodeId)
    const definition = node && registry.get(node.type)
    if (!node || !definition) continue
    const isSource = (incomingCount.get(nodeId) ?? 0) === 0
    if (isSource) {
      sourceBaselines.set(
        nodeId,
        node.type === "event.source"
          ? number(node.config.ratePerSecond)
          : profile.requestsPerSecond,
      )
    }
    const configuredSourceRate =
      node.type === "event.source"
        ? effectiveTrafficRate(number(node.config.ratePerSecond), profile)
        : effectiveTrafficRate(profile.requestsPerSecond, profile)
    const qualityAdjustedSourceRate =
      configuredSourceRate *
      (1 + (profile.duplicateEventPercent ?? 0) / 100) *
      (1 - (profile.malformedEventPercent ?? 0) / 100)
    const merged = isSource
      ? { rate: qualityAdjustedSourceRate, latencyMs: 0, callerFacing: true }
      : mergeContributions(
          incomingContributions.get(nodeId) ?? [],
          node.mergePolicy?.mode ?? "sum",
        )
    const inputRate = merged.rate
    const result = definition.simulate(node.config, { profile, ratePerSecond: inputRate })
    const allOutgoingEdges = outgoing.get(nodeId) ?? []
    const normalOutgoingEdges = routableEdges(node, allOutgoingEdges, nodes)
    const routingMode = routingModeFor(node, normalOutgoingEdges)
    const availabilityFactor = averageAvailability(node, profile.durationSeconds)
    latencyVariance += (result.latencyStdDevMs ?? 0) ** 2
    if (result.scaling) scalingServices.set(nodeId, result.scaling)
    if (result.datastore) datastoreStates.set(nodeId, result.datastore)
    if (result.resilience) {
      resilienceStates.set(nodeId, { metrics: result.resilience, inputRate })
    }
    const capacity = result.throughputPerSecond
    staticCapacities.set(nodeId, capacity)
    const effectiveCapacity = (capacity ?? inputRate) * availabilityFactor
    let acceptedRate = Math.min(inputRate, effectiveCapacity)
    if (node.type === "rabbitmq.queue") {
      const consumerEstimates = normalOutgoingEdges.map((edge) => {
        const target = nodes.get(edge.toNodeId)
        const targetDefinition = target && registry.get(target.type)
        if (!target || !targetDefinition) {
          return {
            id: edge.toNodeId,
            consumerSlots: 0,
            staticCapacity: 0,
            available: 0,
          }
        }
        const targetResult = targetDefinition.simulate(target.config, {
          profile,
          ratePerSecond: inputRate,
        })
        const processingMs = positiveOr(target.config.averageProcessingMs, 0)
        const prefetchCapacity =
          processingMs > 0
            ? (nonnegativeOr(node.config.prefetch, 0) *
                Math.max(1, positiveOr(target.config.concurrency, 1)) *
                1000) /
              processingMs
            : Number.POSITIVE_INFINITY
        const staticCapacity = Math.min(
          targetResult.throughputPerSecond ?? inputRate,
          prefetchCapacity,
        )
        return {
          id: target.id,
          consumerSlots: consumerParallelism(target, targetResult),
          staticCapacity,
          available:
            staticCapacity * averageAvailability(target, profile.durationSeconds),
        }
      })
      const consumerCapacities = consumerEstimates
        .map((estimate) => estimate.available)
        .sort((left, right) => right - left)
      const activePartitions = Math.min(
        node.config.orderingRequired === true
          ? 1
          : Math.max(1, Math.floor(positiveOr(node.config.partitions, 1))),
        Math.max(
          1,
          consumerEstimates.reduce((sum, estimate) => sum + estimate.consumerSlots, 0),
        ),
      )
      const consumerCapacity = consumerCapacities
        .slice(0, activePartitions)
        .reduce((sum, value) => sum + value, 0)
      const payloadSizeBytes = positiveOr(profile.payloadSizeBytes, 1200)
      const bandwidthCapacity =
        (positiveOr(node.config.bandwidthMbps, Number.POSITIVE_INFINITY) * 1_000_000) /
        (payloadSizeBytes * 8)
      const partitionCapacity =
        positiveOr(node.config.maxThroughputPerPartition, Number.POSITIVE_INFINITY) *
        activePartitions
      const brokerCapacity = Math.min(
        positiveOr(node.config.brokerMaxThroughputPerSecond, Number.POSITIVE_INFINITY),
        partitionCapacity,
        bandwidthCapacity,
      )
      const storageCapacityEvents =
        (nonnegativeOr(node.config.brokerStorageMb, Number.POSITIVE_INFINITY) *
          1024 *
          1024) /
        payloadSizeBytes
      acceptedRate =
        Math.min(
          inputRate,
          consumerCapacities.length > 0 ? consumerCapacity : inputRate,
          brokerCapacity,
        ) * availabilityFactor
      const consumers = normalOutgoingEdges
        .map((edge) => nodes.get(edge.toNodeId))
        .filter((target) => target !== undefined)
      const failureRate =
        consumers.length === 0
          ? 0
          : consumers.reduce((sum, target) => {
              const targetFailureRate = nonnegativeOr(target.config.failureRate, 0)
              const failureJitterPercent = nonnegativeOr(
                target.config.failureJitterPercent,
                0,
              )
              return (
                sum + Math.min(0.99, targetFailureRate * (1 + failureJitterPercent / 200))
              )
            }, 0) / consumers.length
      const consumerSchedule = consumers
        .map((target) => {
          const targetDefinition = registry.get(target.type)
          return targetDefinition?.simulate(target.config, {
            profile,
            ratePerSecond: inputRate,
          }).retrySchedule
        })
        .find((schedule) => schedule !== undefined)
      queueRates.set(nodeId, {
        incoming: inputRate,
        outgoing: acceptedRate,
        maxSize: Math.min(
          nonnegativeOr(node.config.maxQueueSize, Number.POSITIVE_INFINITY),
          storageCapacityEvents,
        ),
        ttlSeconds: nonnegativeOr(node.config.messageTtlMs, 0) / 1000,
        deadLetter: node.config.deadLetterQueue === true,
        deadLetterMaxSize: nonnegativeOr(node.config.deadLetterMaxSize, 0),
        retryCount:
          consumerSchedule?.retryCount ?? nonnegativeOr(node.config.retryCount, 0),
        retryDelaySeconds:
          (consumerSchedule?.initialDelayMs ??
            nonnegativeOr(node.config.retryDelayMs, 0)) / 1000,
        failureRate,
        acknowledgementLatencyMs: nonnegativeOr(node.config.acknowledgementLatencyMs, 0),
        brokerCapacity,
        retryInitialDelayMs:
          consumerSchedule?.initialDelayMs ?? nonnegativeOr(node.config.retryDelayMs, 0),
        retryMaximumDelayMs:
          consumerSchedule?.maximumDelayMs ?? nonnegativeOr(node.config.retryDelayMs, 0),
        retryJitterPercent: consumerSchedule?.jitterPercent ?? 0,
        payloadSizeBytes,
        durable: node.config.durable === true,
        activePartitions,
        consumers: consumerEstimates.map(({ id, staticCapacity }) => ({
          id,
          staticCapacity,
        })),
      })
    }
    const utilization =
      effectiveCapacity > 0 ? (inputRate / effectiveCapacity) * 100 : undefined
    const droppedRate = Math.max(0, inputRate - acceptedRate)
    const status =
      inputRate === 0
        ? "inactive"
        : droppedRate > 0
          ? "critical"
          : utilization !== undefined && utilization >= 70
            ? "warning"
            : "healthy"

    cpu += result.cpuCores
    memory += result.memoryMb
    const pathLatency = merged.latencyMs + result.latencyMs + profile.networkLatencyMs
    if ((outgoing.get(nodeId) ?? []).length === 0 && merged.callerFacing) {
      endToEndLatency = Math.max(endToEndLatency, pathLatency)
    }
    const nodeMetric: NodeSimulationMetrics = {
      nodeId,
      incomingRatePerSecond: round(inputRate),
      acceptedRatePerSecond: round(acceptedRate),
      outgoingRatePerSecond: round(acceptedRate),
      capacityPerSecond: capacity === undefined ? undefined : round(capacity),
      utilizationPercent: utilization === undefined ? undefined : round(utilization),
      latencyMs: round(result.latencyMs),
      processedEvents: Math.round(acceptedRate * profile.durationSeconds),
      droppedEvents: Math.round(droppedRate * profile.durationSeconds),
      cpuCores: round(result.cpuCores),
      memoryMb: round(result.memoryMb),
      status,
      routingMode,
      mergeMode: node.mergePolicy?.mode,
      replicas: result.scaling?.initialReplicas,
      desiredReplicas: result.scaling?.desiredReplicas,
      scaleReadySeconds: result.scaling?.readyAfterSeconds,
      datastore: result.datastore,
      resilience: result.resilience,
      availabilityPercent: round(availabilityFactor * 100),
    }
    nodeMetrics.push(nodeMetric)

    if (droppedRate > 0) {
      warnings.push({
        severity: "warning",
        code: "THROUGHPUT",
        message: `${definition.label} capacity ${Math.round(capacity ?? 0)}/s is below traffic ${Math.round(inputRate)}/s`,
        nodeId,
      })
    }
    if (result.retryAmplification && result.retryAmplification > 1.05) {
      warnings.push({
        severity: "warning",
        code: "RETRY_STORM",
        message: `${definition.label} retries amplify traffic by ${result.retryAmplification.toFixed(2)}x`,
        nodeId,
      })
    }
    if (
      node.type === "external.api" &&
      number(node.config.averageLatencyMs) > number(node.config.timeoutMs)
    ) {
      warnings.push({
        severity: "warning",
        code: "TIMEOUT",
        message: "External API latency exceeds its timeout",
        nodeId,
      })
    }
    if (node.type === "database" && node.config.indexUsed === false) {
      warnings.push({
        severity: "warning",
        code: "MISSING_INDEX",
        message: "Database operation does not use an index",
        nodeId,
      })
    }
    if (
      result.datastore &&
      inputRate > (result.throughputPerSecond ?? Number.POSITIVE_INFINITY)
    ) {
      warnings.push({
        severity: "warning",
        code: "DATASTORE_SATURATION",
        message: `${definition.label} is limited by ${result.datastore.limitingResource}`,
        nodeId,
      })
    }
    if (result.datastore && result.datastore.replicationLagMs > 1000) {
      warnings.push({
        severity: "warning",
        code: "REPLICATION_LAG",
        message: `${definition.label} replica lag is ${Math.round(result.datastore.replicationLagMs)} ms`,
        nodeId,
      })
    }
    if (result.resilience?.circuitOpen) {
      warnings.push({
        severity: "warning",
        code: "CIRCUIT_OPEN",
        message: `${definition.label} circuit breaker opens for ${result.resilience.recoverySeconds}s`,
        nodeId,
      })
    }
    if (result.resilience && result.resilience.rejectedPerSecond > 0) {
      warnings.push({
        severity: "warning",
        code: "DEPENDENCY_REJECTION",
        message: `${definition.label} rejects ${Math.round(result.resilience.rejectedPerSecond)}/s due to resilience limits`,
        nodeId,
      })
    }

    const edges = normalOutgoingEdges
    const deadLetterEdges = allOutgoingEdges.filter((edge) =>
      isDeadLetterRoute(edge, nodes),
    )
    const sortedEdges = [...edges].sort(
      (left, right) => (left.priority ?? 0) - (right.priority ?? 0),
    )
    const targetCapacities = new Map(
      sortedEdges.map((edge) => {
        const target = nodes.get(edge.toNodeId)
        const targetDefinition = target && registry.get(target.type)
        const targetResult =
          target &&
          targetDefinition?.simulate(target.config, {
            profile,
            ratePerSecond: acceptedRate,
          })
        return [edge.id, targetResult?.throughputPerSecond ?? acceptedRate]
      }),
    )
    const capacityTotal = [...targetCapacities.values()].reduce(
      (sum, value) => sum + value,
      0,
    )
    for (const [index, edge] of sortedEdges.entries()) {
      let percentage = edge.trafficPercentage ?? 100
      if (routingMode === "round-robin") percentage = 100 / edges.length
      if (routingMode === "competing-consumers") {
        percentage =
          capacityTotal > 0
            ? ((targetCapacities.get(edge.id) ?? 0) / capacityTotal) * 100
            : 100 / edges.length
      }
      if (routingMode === "failover") {
        const target = nodes.get(edge.toNodeId)
        const configuredFailureRate = number(target?.config.failureRate) || 0
        const timeoutFailure =
          target?.type === "external.api" &&
          number(target.config.averageLatencyMs) > number(target.config.timeoutMs)
        const healthy =
          configuredFailureRate < 1 &&
          !timeoutFailure &&
          target?.availabilityPolicy?.mode !== "offline"
        const firstHealthyIndex = sortedEdges.findIndex((candidate) => {
          const candidateTarget = nodes.get(candidate.toNodeId)
          return (
            (number(candidateTarget?.config.failureRate) || 0) < 1 &&
            candidateTarget?.availabilityPolicy?.mode !== "offline" &&
            !(
              candidateTarget?.type === "external.api" &&
              number(candidateTarget.config.averageLatencyMs) >
                number(candidateTarget.config.timeoutMs)
            )
          )
        })
        percentage = healthy && index === firstHealthyIndex ? 100 : 0
      }
      const requestedEdgeRate = acceptedRate * (percentage / 100)
      const dataSizeBytes =
        profile.payloadSizeBytes ??
        resolveEdgeContract(graph.dataContracts, edge)?.estimatedSizeBytes ??
        0
      const network = edge.network
      const availability = network ? 1 - network.outagePercent / 100 : 1
      const bandwidthCapacity =
        network && dataSizeBytes > 0
          ? (network.bandwidthMbps * 1_000_000) / (dataSizeBytes * 8)
          : Number.POSITIVE_INFINITY
      const edgeRate = Math.min(requestedEdgeRate * availability, bandwidthCapacity)
      const transferLatency =
        network && dataSizeBytes > 0
          ? (dataSizeBytes * 8 * 1000) / (network.bandwidthMbps * 1_000_000)
          : 0
      const tlsLatency = network
        ? network.tlsHandshakeMs * (1 - network.connectionReusePercent / 100)
        : 0
      const networkLatency = network
        ? network.baseLatencyMs + transferLatency + tlsLatency
        : 0
      const synchronous = !asynchronousInteractions.has(edge.interactionType)
      if (!synchronous && merged.callerFacing) {
        endToEndLatency = Math.max(endToEndLatency, pathLatency + networkLatency)
      }
      incomingContributions.set(edge.toNodeId, [
        ...(incomingContributions.get(edge.toNodeId) ?? []),
        {
          rate: edgeRate,
          latencyMs: synchronous ? pathLatency + networkLatency : 0,
          callerFacing: synchronous && merged.callerFacing,
        },
      ])
      edgeMetrics.push({
        edgeId: edge.id,
        ratePerSecond: round(edgeRate),
        totalEvents: Math.round(edgeRate * profile.durationSeconds),
        percentageOfSourceTraffic: percentage,
        status: edgeRate === 0 ? "inactive" : droppedRate > 0 ? "congested" : "active",
        latencyMs: round(pathLatency + networkLatency),
        network: network
          ? {
              sourceRegion: network.sourceRegion,
              targetRegion: network.targetRegion,
              transferLatencyMs: round(transferLatency),
              tlsLatencyMs: round(tlsLatency),
              availabilityPercent: round(availability * 100),
              bandwidthCapacityPerSecond: round(bandwidthCapacity),
            }
          : undefined,
      })
      if (network && edgeRate < requestedEdgeRate) {
        warnings.push({
          severity: "warning",
          code: "NETWORK_CONSTRAINT",
          message: `${network.sourceRegion} to ${network.targetRegion} network passes ${Math.round(edgeRate)}/${Math.round(requestedEdgeRate)} events/s`,
          edgeId: edge.id,
        })
      }
    }
    for (const edge of deadLetterEdges) {
      edgeMetrics.push({
        edgeId: edge.id,
        ratePerSecond: 0,
        totalEvents: 0,
        percentageOfSourceTraffic: 0,
        status: "inactive",
        latencyMs: round(pathLatency),
      })
    }
  }

  const frameStep = Math.max(1, Math.ceil(profile.durationSeconds / 60))
  const queueState = new Map<string, QueueFrameMetrics>()
  const trafficRandom = createRandom(
    seedFrom(`${graph.id}:traffic:${profile.durationSeconds}`),
  )
  const qualityFactor =
    (1 + (profile.duplicateEventPercent ?? 0) / 100) *
    (1 - (profile.malformedEventPercent ?? 0) / 100)
  // Nodes whose callers time out (rather than silently losing work) when the
  // node is down: some synchronous inbound edge declares a timeout.
  const timeoutProtectedNodes = new Set<string>()
  for (const edge of graph.edges) {
    if (
      !asynchronousInteractions.has(edge.interactionType) &&
      (edge.timeoutMs ?? edge.failurePolicy?.timeoutMs) !== undefined
    ) {
      timeoutProtectedNodes.add(edge.toNodeId)
    }
  }
  const downProtectedNodes = new Set<string>()
  let frameTimedOutEvents = 0
  let lastTraffic: TrafficFrameMetrics[] = []
  let lastSourceRate = 0

  // Health of a node at one moment: availability policy, datastore failover,
  // and circuit state all gate capacity per frame.
  const nodeFactorAt = (nodeId: string, timeSeconds: number): number => {
    const node = nodes.get(nodeId)
    if (!node) return 0
    let factor = availabilityAt(node, timeSeconds).factor
    const datastore = datastoreStates.get(nodeId)
    if (
      datastore &&
      datastore.failoverSeconds > 0 &&
      timeSeconds < datastore.failoverSeconds
    ) {
      factor = 0
    }
    const resilience = resilienceStates.get(nodeId)
    if (resilience?.metrics.circuitOpen) {
      const recovery = resilience.metrics.recoverySeconds
      if (timeSeconds < recovery * 0.8) factor = 0
      else if (timeSeconds < recovery) factor = Math.min(factor, 0.1)
    }
    return factor
  }
  const nodeCapacityAt = (nodeId: string, timeSeconds: number): number | undefined => {
    const scaling = scalingServices.get(nodeId)
    if (scaling) {
      const replicas =
        timeSeconds >= scaling.readyAfterSeconds
          ? scaling.desiredReplicas
          : scaling.initialReplicas
      return replicas * scaling.capacityPerReplica
    }
    return staticCapacities.get(nodeId)
  }
  const staticallyHealthy = (nodeId: string): boolean => {
    const node = nodes.get(nodeId)
    if (!node) return false
    return (
      (number(node.config.failureRate) || 0) < 1 &&
      !(
        node.type === "external.api" &&
        number(node.config.averageLatencyMs) > number(node.config.timeoutMs)
      )
    )
  }

  for (let time = 0; time <= profile.durationSeconds; time += frameStep) {
    const frameTime = Math.min(time, profile.durationSeconds)
    const elapsed =
      time === 0 ? 0 : Math.min(frameStep, profile.durationSeconds - (time - frameStep))
    const randomFraction = trafficRandom()
    // Failover detection lags one frame behind the outage it reacts to.
    const detectionTime = Math.max(0, frameTime - frameStep)
    const frameInputs = new Map<string, number[]>()
    const traffic: TrafficFrameMetrics[] = []
    const queues: QueueFrameMetrics[] = []
    let sourceRate = 0

    for (const nodeId of order) {
      const node = nodes.get(nodeId)
      if (!node || !registry.get(node.type)) continue
      const isSource = (incomingCount.get(nodeId) ?? 0) === 0
      const inbound = frameInputs.get(nodeId) ?? []
      const mergeMode = node.mergePolicy?.mode ?? "sum"
      const input = isSource
        ? trafficRateAt(
            sourceBaselines.get(nodeId) ?? 0,
            profile,
            frameTime,
            randomFraction,
          ) * qualityFactor
        : inbound.length === 0
          ? 0
          : mergeMode === "wait-all"
            ? Math.min(...inbound)
            : mergeMode === "first-response"
              ? Math.max(...inbound)
              : inbound.reduce((sum, rate) => sum + rate, 0)
      if (isSource) sourceRate += input

      const factor = nodeFactorAt(nodeId, frameTime)
      const queueInfo = queueRates.get(nodeId)
      let accepted = input
      let output = input
      if (queueInfo) {
        // Queue output follows what its consumers can take this frame.
        const consumerCapacity = queueInfo.consumers.reduce(
          (sum, consumer) =>
            sum + consumer.staticCapacity * nodeFactorAt(consumer.id, frameTime),
          0,
        )
        const dequeueCapacity = Math.min(
          queueInfo.brokerCapacity * factor,
          queueInfo.consumers.length > 0
            ? consumerCapacity
            : queueInfo.brokerCapacity * factor,
        )
        const enqueueRate = factor === 0 ? 0 : input
        const previous = queueState.get(nodeId) ?? {
          nodeId,
          depth: 0,
          enqueuedEvents: 0,
          dequeuedEvents: 0,
          expiredEvents: 0,
          deadLetteredEvents: 0,
          overflowEvents: 0,
          redeliveredEvents: 0,
          acknowledgedEvents: 0,
          deadLetterOverflowEvents: 0,
          averageMessageAgeMs: 0,
          publisherConfirmedEvents: 0,
          persistedBytes: 0,
          activePartitions: queueInfo.activePartitions,
        }
        const retryEligible = retryOpportunities(
          elapsed,
          queueInfo.retryCount,
          queueInfo.retryInitialDelayMs,
          queueInfo.retryMaximumDelayMs,
          queueInfo.retryJitterPercent,
        )
        const redelivered =
          dequeueCapacity * queueInfo.failureRate * Math.max(0, retryEligible) * elapsed
        const enqueued = enqueueRate * elapsed + redelivered
        const available = previous.depth + enqueued
        const acknowledgementFactor =
          1 + queueInfo.acknowledgementLatencyMs / Math.max(1, elapsed * 1000)
        const dequeued = Math.min(
          available,
          (dequeueCapacity / acknowledgementFactor) * elapsed,
        )
        let depth = Math.max(0, available - dequeued)
        // Little's-law bound: entries beyond inflow times TTL are older than TTL.
        const ttlLimit =
          queueInfo.ttlSeconds > 0
            ? enqueueRate * queueInfo.ttlSeconds
            : Number.POSITIVE_INFINITY
        const expired = Math.max(0, depth - ttlLimit)
        depth -= expired
        const overflow = Math.max(0, depth - queueInfo.maxSize)
        depth -= overflow
        const deadLettered = queueInfo.deadLetter ? expired + overflow : 0
        const deadLetterSpace = Math.max(
          0,
          queueInfo.deadLetterMaxSize - previous.deadLetteredEvents,
        )
        const acceptedDeadLetters = Math.min(deadLettered, deadLetterSpace)
        const deadLetterOverflow = Math.max(0, deadLettered - acceptedDeadLetters)
        const next = {
          nodeId,
          depth: Math.round(depth),
          enqueuedEvents: Math.round(previous.enqueuedEvents + enqueued),
          dequeuedEvents: Math.round(previous.dequeuedEvents + dequeued),
          expiredEvents: Math.round(previous.expiredEvents + expired),
          deadLetteredEvents: Math.round(
            previous.deadLetteredEvents + acceptedDeadLetters,
          ),
          overflowEvents: Math.round(previous.overflowEvents + overflow),
          redeliveredEvents: Math.round(previous.redeliveredEvents + redelivered),
          acknowledgedEvents: Math.round(
            previous.acknowledgedEvents + dequeued * (1 - queueInfo.failureRate),
          ),
          deadLetterOverflowEvents: Math.round(
            previous.deadLetterOverflowEvents + deadLetterOverflow,
          ),
          averageMessageAgeMs:
            enqueueRate > 0
              ? Math.round((depth / enqueueRate) * 1000)
              : previous.averageMessageAgeMs,
          publisherConfirmedEvents: Math.round(
            previous.publisherConfirmedEvents + enqueueRate * elapsed,
          ),
          persistedBytes: Math.round(
            previous.persistedBytes +
              (queueInfo.durable
                ? enqueueRate * elapsed * queueInfo.payloadSizeBytes
                : 0),
          ),
          activePartitions: queueInfo.activePartitions,
        }
        queueState.set(nodeId, next)
        queues.push(next)
        accepted = enqueueRate
        output = elapsed > 0 ? dequeued / elapsed : Math.min(input, dequeueCapacity)
      } else {
        const capacityNow = nodeCapacityAt(nodeId, frameTime)
        const effective = (capacityNow ?? input) * factor
        accepted = Math.min(input, effective)
        output = accepted
        if (input > 0 && factor === 0 && timeoutProtectedNodes.has(nodeId)) {
          downProtectedNodes.add(nodeId)
          frameTimedOutEvents += input * elapsed
        }
      }
      traffic.push({
        nodeId,
        inputRatePerSecond: round(input),
        acceptedRatePerSecond: round(accepted),
        droppedRatePerSecond: round(Math.max(0, input - accepted)),
      })

      const frameEdges = routableEdges(node, outgoing.get(nodeId) ?? [], nodes)
      if (frameEdges.length === 0) continue
      const frameRoutingMode = routingModeFor(node, frameEdges)
      const frameSorted = [...frameEdges].sort(
        (left, right) => (left.priority ?? 0) - (right.priority ?? 0),
      )
      const weights =
        frameRoutingMode === "competing-consumers" && queueInfo
          ? new Map(
              frameSorted.map((edge) => [
                edge.id,
                (queueInfo.consumers.find((consumer) => consumer.id === edge.toNodeId)
                  ?.staticCapacity ?? 0) * nodeFactorAt(edge.toNodeId, frameTime),
              ]),
            )
          : undefined
      const weightTotal = weights
        ? [...weights.values()].reduce((sum, value) => sum + value, 0)
        : 0
      const firstHealthyIndex =
        frameRoutingMode === "failover"
          ? frameSorted.findIndex(
              (edge) =>
                nodeFactorAt(edge.toNodeId, detectionTime) > 0 &&
                staticallyHealthy(edge.toNodeId),
            )
          : -1
      for (const [index, edge] of frameSorted.entries()) {
        let percentage = edge.trafficPercentage ?? 100
        if (frameRoutingMode === "round-robin") percentage = 100 / frameEdges.length
        if (frameRoutingMode === "competing-consumers") {
          percentage =
            weightTotal > 0
              ? ((weights?.get(edge.id) ?? 0) / weightTotal) * 100
              : 100 / frameEdges.length
        }
        if (frameRoutingMode === "failover") {
          percentage = index === firstHealthyIndex ? 100 : 0
        }
        const networkAvailability = edge.network
          ? 1 - edge.network.outagePercent / 100
          : 1
        const rate = output * (percentage / 100) * networkAvailability
        if (frameRoutingMode === "failover" && index > 0 && rate > 0) {
          fallbackEvents += rate * elapsed
        }
        frameInputs.set(edge.toNodeId, [...(frameInputs.get(edge.toNodeId) ?? []), rate])
      }
    }
    const services = [...scalingServices].map(([nodeId, scaling]) => {
      const ready = frameTime >= scaling.readyAfterSeconds
      const replicas = ready ? scaling.desiredReplicas : scaling.initialReplicas
      return {
        nodeId,
        replicas,
        desiredReplicas: scaling.desiredReplicas,
        capacityPerSecond: round(replicas * scaling.capacityPerReplica),
        scaling: !ready && scaling.desiredReplicas !== scaling.initialReplicas,
        direction: scaling.direction,
        limitingResource: scaling.limitingResource,
      }
    })
    const datastores = [...datastoreStates].map(([nodeId, datastore]) => ({
      nodeId,
      primaryState:
        datastore.failoverSeconds === 0
          ? ("available" as const)
          : frameTime < datastore.failoverSeconds
            ? ("failing-over" as const)
            : ("recovered" as const),
      activeReadReplicas:
        datastore.failoverSeconds > 0 && frameTime < datastore.failoverSeconds
          ? datastore.readReplicaCount
          : datastore.readReplicaCount + 1,
      connectionUtilizationPercent: round(datastore.connectionUtilizationPercent),
      iopsUtilizationPercent: round(datastore.iopsUtilizationPercent),
      replicationLagMs: datastore.replicationLagMs,
      contentionWaitMs: round(datastore.contentionWaitMs),
    }))
    const resilience = [...resilienceStates].map(
      ([nodeId, { metrics, inputRate: resilienceInputRate }]) => {
        const halfOpenAt = metrics.recoverySeconds * 0.8
        const circuitState = !metrics.circuitOpen
          ? ("closed" as const)
          : frameTime >= metrics.recoverySeconds
            ? ("recovered" as const)
            : frameTime >= halfOpenAt
              ? ("half-open" as const)
              : ("open" as const)
        const blocked = circuitState === "open"
        const halfOpen = circuitState === "half-open"
        const downstreamRate = blocked
          ? 0
          : halfOpen
            ? Math.min(resilienceInputRate * 0.1, metrics.bulkheadCapacityPerSecond)
            : Math.max(0, resilienceInputRate - metrics.rejectedPerSecond)
        return {
          nodeId,
          circuitState,
          availabilityPercent: blocked ? 0 : halfOpen ? 10 : metrics.availabilityPercent,
          rejectedEvents: Math.round(
            metrics.rejectedPerSecond *
              Math.min(frameTime, metrics.recoverySeconds || frameTime),
          ),
          downstreamRatePerSecond: round(downstreamRate),
        }
      },
    )
    const availability = graph.nodes
      .filter((node) => node.availabilityPolicy !== undefined)
      .map((node) => {
        const current = availabilityAt(node, frameTime)
        return {
          nodeId: node.id,
          state: current.state,
          capacityPercent: round(current.factor * 100),
        }
      })
    timeline.push({
      timeSeconds: frameTime,
      sourceRatePerSecond: round(sourceRate),
      traffic,
      queues,
      services,
      datastores,
      resilience,
      availability,
    })
    lastTraffic = traffic
    lastSourceRate = sourceRate
  }
  if (timeline.at(-1)?.timeSeconds !== profile.durationSeconds) {
    timeline.push({
      timeSeconds: profile.durationSeconds,
      sourceRatePerSecond: round(lastSourceRate),
      traffic: lastTraffic,
      queues: [...queueState.values()],
      services: [...scalingServices].map(([nodeId, scaling]) => ({
        nodeId,
        replicas: scaling.desiredReplicas,
        desiredReplicas: scaling.desiredReplicas,
        capacityPerSecond: round(scaling.desiredReplicas * scaling.capacityPerReplica),
        scaling: false,
        direction: scaling.direction,
        limitingResource: scaling.limitingResource,
      })),
      datastores: [...datastoreStates].map(([nodeId, datastore]) => ({
        nodeId,
        primaryState: datastore.failoverSeconds > 0 ? "recovered" : "available",
        activeReadReplicas: datastore.readReplicaCount + 1,
        connectionUtilizationPercent: round(datastore.connectionUtilizationPercent),
        iopsUtilizationPercent: round(datastore.iopsUtilizationPercent),
        replicationLagMs: datastore.replicationLagMs,
        contentionWaitMs: round(datastore.contentionWaitMs),
      })),
      resilience: [...resilienceStates].map(
        ([nodeId, { metrics, inputRate: resilienceInputRate }]) => ({
          nodeId,
          circuitState: metrics.circuitOpen
            ? ("recovered" as const)
            : ("closed" as const),
          availabilityPercent: metrics.availabilityPercent,
          rejectedEvents: Math.round(metrics.rejectedPerSecond * metrics.recoverySeconds),
          downstreamRatePerSecond: round(
            Math.max(0, resilienceInputRate - metrics.rejectedPerSecond),
          ),
        }),
      ),
      availability: graph.nodes
        .filter((node) => node.availabilityPolicy !== undefined)
        .map((node) => {
          const current = availabilityAt(node, profile.durationSeconds)
          return {
            nodeId: node.id,
            state: current.state,
            capacityPercent: round(current.factor * 100),
          }
        }),
    })
  }
  for (const metric of nodeMetrics) {
    const rates = queueRates.get(metric.nodeId)
    const finalQueue = queueState.get(metric.nodeId)
    if (!rates || !finalQueue) continue
    const growth = rates.incoming - rates.outgoing
    metric.queue = {
      depth: finalQueue.depth,
      maxDepth: rates.maxSize,
      enqueuedEvents: finalQueue.enqueuedEvents,
      dequeuedEvents: finalQueue.dequeuedEvents,
      expiredEvents: finalQueue.expiredEvents,
      deadLetteredEvents: finalQueue.deadLetteredEvents,
      overflowEvents: finalQueue.overflowEvents,
      redeliveredEvents: finalQueue.redeliveredEvents,
      acknowledgedEvents: finalQueue.acknowledgedEvents,
      deadLetterOverflowEvents: finalQueue.deadLetterOverflowEvents,
      averageMessageAgeMs: finalQueue.averageMessageAgeMs,
      publisherConfirmedEvents: finalQueue.publisherConfirmedEvents,
      persistedBytes: finalQueue.persistedBytes,
      activePartitions: finalQueue.activePartitions,
      timeToSaturationSeconds: growth > 0 ? round(rates.maxSize / growth) : undefined,
    }
    if (finalQueue.expiredEvents > 0 || finalQueue.overflowEvents > 0) {
      warnings.push({
        severity: "warning",
        code: "QUEUE_LOSS",
        message: `Queue expired ${finalQueue.expiredEvents.toLocaleString()} and overflowed ${finalQueue.overflowEvents.toLocaleString()} events`,
        nodeId: metric.nodeId,
      })
    }
  }

  if (cpu > profile.cpuCores)
    warnings.push({
      severity: "warning",
      code: "CPU_SATURATION",
      message: `Estimated CPU ${cpu.toFixed(1)} cores exceeds ${profile.cpuCores}`,
    })
  if (memory > profile.memoryMb)
    warnings.push({
      severity: "warning",
      code: "MEMORY_SATURATION",
      message: `Estimated memory ${Math.round(memory)} MB exceeds ${profile.memoryMb} MB`,
    })

  const random = createRandom(
    seedFrom(`${graph.id}:${profile.durationSeconds}:${profile.requestsPerSecond}`),
  )
  const latencyDeviation = Math.sqrt(latencyVariance)
  const latencySamples = Array.from({ length: 1000 }, () =>
    Math.max(0, endToEndLatency + normalSample(random) * latencyDeviation),
  )

  const sourceRatePerSecond = nodeMetrics
    .filter((metric) => (incomingCount.get(metric.nodeId) ?? 0) === 0)
    .reduce((sum, metric) => sum + metric.incomingRatePerSecond, 0)
  // Sources are demand rather than capacity. Every other node constrains the
  // flow either by the share of traffic it already sheds or by remaining
  // headroom against its reported capacity.
  const bottleneckRatio = nodeMetrics.reduce((minimum: number | undefined, metric) => {
    if ((incomingCount.get(metric.nodeId) ?? 0) === 0) return minimum
    if (metric.incomingRatePerSecond <= 0) return minimum
    const dropping = metric.acceptedRatePerSecond < metric.incomingRatePerSecond - 0.005
    const ratio = dropping
      ? metric.acceptedRatePerSecond / metric.incomingRatePerSecond
      : metric.capacityPerSecond !== undefined
        ? (metric.capacityPerSecond * (metric.availabilityPercent / 100)) /
          metric.incomingRatePerSecond
        : undefined
    if (ratio === undefined) return minimum
    return minimum === undefined ? ratio : Math.min(minimum, ratio)
  }, undefined)
  const lostEvents = nodeMetrics.reduce(
    (sum, metric) =>
      sum +
      metric.droppedEvents +
      (metric.queue
        ? metric.queue.expiredEvents +
          metric.queue.overflowEvents -
          metric.queue.deadLetteredEvents
        : 0),
    0,
  )
  const flowAvailabilityPercent =
    nodeMetrics.reduce(
      (product, metric) => product * (metric.availabilityPercent / 100),
      1,
    ) * 100

  const calibrated =
    profile.observedLatencyMs !== undefined ||
    profile.observedThroughputPerSecond !== undefined
  const modeledDistributions = graph.nodes.filter((node) =>
    ["worker", "external.api"].includes(node.type),
  ).length
  const rawEventsProcessed = nodeMetrics
    .filter((metric) => (outgoing.get(metric.nodeId) ?? []).length === 0)
    .reduce((sum, metric) => sum + metric.processedEvents, 0)
  const latencyFactor =
    profile.observedLatencyMs !== undefined && endToEndLatency > 0
      ? profile.observedLatencyMs / endToEndLatency
      : 1
  const observedEvents =
    (profile.observedThroughputPerSecond ?? 0) * profile.durationSeconds
  const throughputFactor =
    profile.observedThroughputPerSecond !== undefined && rawEventsProcessed > 0
      ? observedEvents / rawEventsProcessed
      : 1
  const evidenceQuality = {
    assumed: "synthetic",
    "load-test": "measured",
    production: "measured",
    "vendor-doc": "documented",
    unknown: "unknown",
  } as const
  const calibrationEvidence = [
    ...(profile.observedLatencyMs !== undefined
      ? [
          {
            metric: "latency" as const,
            observedValue: profile.observedLatencyMs,
            unit: "ms" as const,
            source: profile.observedLatencySource ?? "unknown",
            quality: evidenceQuality[profile.observedLatencySource ?? "unknown"],
            calibrationFactor: round(latencyFactor),
          },
        ]
      : []),
    ...(profile.observedThroughputPerSecond !== undefined
      ? [
          {
            metric: "throughput" as const,
            observedValue: profile.observedThroughputPerSecond,
            unit: "events/second" as const,
            source: profile.observedThroughputSource ?? "unknown",
            quality: evidenceQuality[profile.observedThroughputSource ?? "unknown"],
            calibrationFactor: round(throughputFactor),
          },
        ]
      : []),
  ]
  const allEvidenceMeasured =
    calibrationEvidence.length > 0 &&
    calibrationEvidence.every((evidence) => evidence.quality === "measured")
  const confidence = allEvidenceMeasured
    ? "high"
    : calibrated || modeledDistributions > 0
      ? "medium"
      : "low"
  const confidenceReasons = allEvidenceMeasured
    ? [
        `Calibration uses measured ${calibrationEvidence
          .map((evidence) => `${evidence.metric} (${evidence.source})`)
          .join(" and ")} evidence.`,
      ]
    : calibrated
      ? [
          `Calibration is capped at medium confidence because evidence is ${[
            ...new Set(calibrationEvidence.map((evidence) => evidence.quality)),
          ].join(" and ")}.`,
        ]
      : ["Results use deterministic configuration estimates without observed data."]

  const averageLatencyMs = Math.round(endToEndLatency * latencyFactor)
  const p95LatencyMs = Math.round(percentile(latencySamples, 0.95) * latencyFactor)
  const totalEventsProcessed = Math.round(rawEventsProcessed * throughputFactor)
  const readiness = estimateProductionReadiness({
    graph,
    scenario,
    nodeMetrics,
    timeline,
    lostEvents,
    sourceRatePerSecond,
  })
  const goalReport = evaluateGoals(graph.architectureGoals, {
    averageLatencyMs,
    p95LatencyMs,
    sourceRatePerSecond,
    bottleneckRatio,
    lostEvents,
    availabilityPercent: flowAvailabilityPercent,
    recoveryTimeSeconds: readiness.recoveryTimeSeconds,
    recoveryPointSeconds: readiness.recoveryPointSeconds,
    dataStalenessMs: readiness.dataStalenessMs,
  })
  // Frame-observed timeouts beyond what the whole-scenario averages already
  // attribute to the same down dependencies.
  const averagedProtectedDrops = nodeMetrics
    .filter((metric) => downProtectedNodes.has(metric.nodeId))
    .reduce((sum, metric) => sum + metric.droppedEvents, 0)
  const userImpact = classifyUserImpact(nodeMetrics, {
    // Down dependencies with a synchronous timeout convert their drops into
    // caller timeouts instead of silent loss.
    timedOutNodeIds: new Set([
      ...[...scalingServices]
        .filter(([, scaling]) => scaling.limitingResource === "timeout")
        .map(([nodeId]) => nodeId),
      ...downProtectedNodes,
    ]),
    timedOutEvents: Math.max(0, frameTimedOutEvents - averagedProtectedDrops),
    degradedNodeIds: new Set(
      graph.nodes
        .filter((node) => node.availabilityPolicy?.mode === "degraded")
        .map((node) => node.id),
    ),
    fallbackEvents,
    processedEvents: totalEventsProcessed,
    goalReport,
  })

  return {
    totalEventsProcessed,
    averageLatencyMs,
    p95LatencyMs,
    p99LatencyMs: Math.round(percentile(latencySamples, 0.99) * latencyFactor),
    bottlenecks: warnings.filter(
      (issue) => issue.code === "THROUGHPUT" || issue.code.includes("SATURATION"),
    ),
    warnings,
    resourceUsage: { cpuCores: round(cpu), memoryMb: Math.round(memory) },
    nodeMetrics,
    edgeMetrics,
    timeline,
    readiness,
    explanation: {
      confidence,
      confidenceReasons,
      assumptions: [
        "Traffic and failures are deterministic for the same graph and profile.",
        "Node capacity is estimated from configured limits.",
        "Infrastructure clients are not executed by the simulator.",
        "Reported latency covers the caller-facing synchronous path; caller latency ends at asynchronous boundaries.",
        `Timeline values are estimates integrated in ${frameStep}s frames; node metrics are whole-scenario averages.`,
        ...(scenario
          ? [
              `Failure scenario "${scenario.name}" (${scenario.kind}) is applied from ${scenario.startSeconds}s for ${scenario.durationSeconds}s.`,
            ]
          : []),
      ],
      recommendations: recommendationsFor(warnings),
      calibrated,
      calibrationEvidence,
      calibrationFactors: calibrated
        ? {
            latency: round(latencyFactor),
            throughput: round(throughputFactor),
          }
        : undefined,
    },
    goalReport,
    userImpact,
  }
}
