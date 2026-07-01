import type {
  EdgeSimulationMetrics,
  FlowGraph,
  NodeDefinition,
  NodeInstance,
  NodeSimulationMetrics,
  NodeSimulationResult,
  QueueFrameMetrics,
  SimulationFrame,
  SimulationRecommendation,
  SimulationResult,
  ValidationIssue,
} from "../../contracts"
import { validateFlow } from "../validation/validate-flow"

const number = (value: unknown) => Number(value)
const round = (value: number) => Number(value.toFixed(2))
type Contribution = { rate: number; latencyMs: number }

function seedFrom(value: string): number {
  let seed = 2166136261
  for (const character of value) {
    seed ^= character.charCodeAt(0)
    seed = Math.imul(seed, 16777619)
  }
  return seed >>> 0
}

function createRandom(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function normalSample(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON)
  const second = random()
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

function recommendationsFor(issues: ValidationIssue[]): SimulationRecommendation[] {
  const messages: Record<string, string> = {
    THROUGHPUT: "Increase capacity, replicas, or reduce upstream traffic.",
    QUEUE_LOSS: "Increase consumer capacity, TTL, or queue storage.",
    DATASTORE_SATURATION: "Increase the reported limiting datastore resource.",
    REPLICATION_LAG: "Reduce replica load or improve replication capacity.",
    CIRCUIT_OPEN: "Add failover capacity or reduce dependency failures.",
    DEPENDENCY_REJECTION: "Raise dependency quota or bulkhead capacity.",
    NETWORK_CONSTRAINT:
      "Increase bandwidth, reduce payload size, or move services closer.",
    CPU_SATURATION: "Increase CPU budget or reduce per-request compute.",
    MEMORY_SATURATION: "Increase memory budget or reduce concurrency.",
  }
  return issues
    .filter((issue) => messages[issue.code])
    .map((issue) => ({
      code: issue.code,
      priority:
        issue.code === "THROUGHPUT" || issue.code === "QUEUE_LOSS" ? "high" : "medium",
      message: messages[issue.code],
      nodeId: issue.nodeId,
    }))
}

function effectiveTrafficRate(
  baseline: number,
  profile: FlowGraph["simulationProfile"],
): number {
  const peak = profile.peakRequestsPerSecond ?? baseline
  const duration = Math.max(1, profile.durationSeconds)
  const burst = Math.min(duration, Math.max(0, profile.burstDurationSeconds ?? 0))
  const ramp = Math.min(duration - burst, Math.max(0, profile.rampUpSeconds ?? 0))
  if (profile.trafficPattern === "burst") {
    return (
      (baseline * (duration - burst - ramp) +
        peak * burst +
        ((baseline + peak) / 2) * ramp) /
      duration
    )
  }
  if (profile.trafficPattern === "daily-peak") return baseline * 0.75 + peak * 0.25
  if (profile.trafficPattern === "random") return (baseline + peak) / 2
  return baseline
}

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

function availabilityAt(
  node: NodeInstance,
  timeSeconds: number,
): { state: "online" | "offline" | "degraded" | "recovering"; factor: number } {
  const policy = node.availabilityPolicy
  if (!policy || policy.mode === "online") return { state: "online", factor: 1 }
  if (policy.mode === "offline") return { state: "offline", factor: 0 }
  if (policy.mode === "degraded") {
    return { state: "degraded", factor: policy.degradedCapacityPercent / 100 }
  }
  const outageEnd = policy.offlineFromSeconds + policy.offlineDurationSeconds
  if (timeSeconds < policy.offlineFromSeconds) return { state: "online", factor: 1 }
  if (timeSeconds < outageEnd) return { state: "offline", factor: 0 }
  if (policy.recoverySeconds > 0 && timeSeconds < outageEnd + policy.recoverySeconds) {
    return {
      state: "recovering",
      factor: (timeSeconds - outageEnd) / policy.recoverySeconds,
    }
  }
  return { state: "online", factor: 1 }
}

function averageAvailability(node: NodeInstance, durationSeconds: number): number {
  const samples = Math.max(1, Math.min(300, durationSeconds))
  let total = 0
  for (let index = 0; index < samples; index += 1) {
    total += availabilityAt(node, (index / samples) * durationSeconds).factor
  }
  return total / samples
}

function mergeContributions(
  contributions: Contribution[],
  mode: "sum" | "wait-all" | "first-response" | "asynchronous",
): Contribution {
  if (contributions.length === 0) return { rate: 0, latencyMs: 0 }
  if (mode === "wait-all") {
    return {
      rate: Math.min(...contributions.map(({ rate }) => rate)),
      latencyMs: Math.max(...contributions.map(({ latencyMs }) => latencyMs)),
    }
  }
  if (mode === "first-response") {
    return {
      rate: Math.max(...contributions.map(({ rate }) => rate)),
      latencyMs: Math.min(...contributions.map(({ latencyMs }) => latencyMs)),
    }
  }
  return {
    rate: contributions.reduce((sum, item) => sum + item.rate, 0),
    latencyMs:
      mode === "asynchronous"
        ? 0
        : Math.max(...contributions.map(({ latencyMs }) => latencyMs)),
  }
}

export function runSimulation(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): SimulationResult {
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
      },
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
    }
  >()
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
    const configuredSourceRate =
      node.type === "event.source"
        ? effectiveTrafficRate(number(node.config.ratePerSecond), profile)
        : effectiveTrafficRate(profile.requestsPerSecond, profile)
    const qualityAdjustedSourceRate =
      configuredSourceRate *
      (1 + (profile.duplicateEventPercent ?? 0) / 100) *
      (1 - (profile.malformedEventPercent ?? 0) / 100)
    const merged = isSource
      ? { rate: qualityAdjustedSourceRate, latencyMs: 0 }
      : mergeContributions(
          incomingContributions.get(nodeId) ?? [],
          node.mergePolicy?.mode ?? "sum",
        )
    const inputRate = merged.rate
    const result = definition.simulate(node.config, { profile, ratePerSecond: inputRate })
    const availabilityFactor = averageAvailability(node, profile.durationSeconds)
    latencyVariance += (result.latencyStdDevMs ?? 0) ** 2
    if (result.scaling) scalingServices.set(nodeId, result.scaling)
    if (result.datastore) datastoreStates.set(nodeId, result.datastore)
    if (result.resilience) {
      resilienceStates.set(nodeId, { metrics: result.resilience, inputRate })
    }
    const capacity = result.throughputPerSecond
    const effectiveCapacity = (capacity ?? inputRate) * availabilityFactor
    let acceptedRate = Math.min(inputRate, effectiveCapacity)
    if (node.type === "rabbitmq.queue") {
      const consumerCapacities = (outgoing.get(nodeId) ?? [])
        .map((edge) => {
          const target = nodes.get(edge.toNodeId)
          const targetDefinition = target && registry.get(target.type)
          if (!target || !targetDefinition) return 0
          const targetResult = targetDefinition.simulate(target.config, {
            profile,
            ratePerSecond: inputRate,
          })
          const processingMs = number(target.config.averageProcessingMs)
          const prefetchCapacity =
            processingMs > 0
              ? (number(node.config.prefetch) *
                  Math.max(1, number(target.config.concurrency)) *
                  1000) /
                processingMs
              : Number.POSITIVE_INFINITY
          return (
            Math.min(targetResult.throughputPerSecond ?? inputRate, prefetchCapacity) *
            averageAvailability(target, profile.durationSeconds)
          )
        })
        .sort((left, right) => right - left)
      const activePartitions = Math.min(
        node.config.orderingRequired === true ? 1 : number(node.config.partitions),
        Math.max(1, consumerCapacities.length),
      )
      const consumerCapacity = consumerCapacities
        .slice(0, activePartitions)
        .reduce((sum, value) => sum + value, 0)
      const payloadSizeBytes = profile.payloadSizeBytes ?? 1200
      const bandwidthCapacity =
        (number(node.config.bandwidthMbps) * 1_000_000) / (payloadSizeBytes * 8)
      const partitionCapacity =
        number(node.config.maxThroughputPerPartition) * activePartitions
      const brokerCapacity = Math.min(
        number(node.config.brokerMaxThroughputPerSecond),
        partitionCapacity,
        bandwidthCapacity,
      )
      const storageCapacityEvents =
        (number(node.config.brokerStorageMb) * 1024 * 1024) / payloadSizeBytes
      acceptedRate =
        Math.min(
          inputRate,
          consumerCapacities.length > 0 ? consumerCapacity : inputRate,
          brokerCapacity,
        ) * availabilityFactor
      const consumers = (outgoing.get(nodeId) ?? [])
        .map((edge) => nodes.get(edge.toNodeId))
        .filter((target) => target !== undefined)
      const failureRate =
        consumers.length === 0
          ? 0
          : consumers.reduce(
              (sum, target) =>
                sum +
                Math.min(
                  0.99,
                  (number(target.config.failureRate) || 0) *
                    (1 + number(target.config.failureJitterPercent) / 200),
                ),
              0,
            ) / consumers.length
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
        maxSize: Math.min(number(node.config.maxQueueSize), storageCapacityEvents),
        ttlSeconds: number(node.config.messageTtlMs) / 1000,
        deadLetter: node.config.deadLetterQueue === true,
        deadLetterMaxSize: number(node.config.deadLetterMaxSize),
        retryCount: consumerSchedule?.retryCount ?? number(node.config.retryCount),
        retryDelaySeconds:
          (consumerSchedule?.initialDelayMs ?? number(node.config.retryDelayMs)) / 1000,
        failureRate,
        acknowledgementLatencyMs: number(node.config.acknowledgementLatencyMs),
        brokerCapacity,
        retryInitialDelayMs:
          consumerSchedule?.initialDelayMs ?? number(node.config.retryDelayMs),
        retryMaximumDelayMs:
          consumerSchedule?.maximumDelayMs ?? number(node.config.retryDelayMs),
        retryJitterPercent: consumerSchedule?.jitterPercent ?? 0,
        payloadSizeBytes,
        durable: node.config.durable === true,
        activePartitions,
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
    if ((outgoing.get(nodeId) ?? []).length === 0) {
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
      routingMode: node.routingPolicy?.mode,
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

    const edges = outgoing.get(nodeId) ?? []
    const routingMode =
      node.routingPolicy?.mode ??
      (edges.some((edge) => edge.trafficPercentage !== undefined)
        ? "weighted"
        : "broadcast")
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
        graph.dataContracts.find((contract) => contract.name === edge.dataType)
          ?.estimatedSizeBytes ??
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
      incomingContributions.set(edge.toNodeId, [
        ...(incomingContributions.get(edge.toNodeId) ?? []),
        { rate: edgeRate, latencyMs: pathLatency + networkLatency },
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
  }

  const frameStep = Math.max(1, Math.ceil(profile.durationSeconds / 60))
  const queueState = new Map<string, QueueFrameMetrics>()
  for (let time = 0; time <= profile.durationSeconds; time += frameStep) {
    const elapsed =
      time === 0 ? 0 : Math.min(frameStep, profile.durationSeconds - (time - frameStep))
    const queues: QueueFrameMetrics[] = []
    for (const [nodeId, rates] of queueRates) {
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
        activePartitions: rates.activePartitions,
      }
      const retryEligible = retryOpportunities(
        elapsed,
        rates.retryCount,
        rates.retryInitialDelayMs,
        rates.retryMaximumDelayMs,
        rates.retryJitterPercent,
      )
      const redelivered =
        rates.outgoing * rates.failureRate * Math.max(0, retryEligible) * elapsed
      const enqueued = rates.incoming * elapsed + redelivered
      const available = previous.depth + enqueued
      const acknowledgementFactor =
        1 + rates.acknowledgementLatencyMs / Math.max(1, elapsed * 1000)
      const dequeued = Math.min(
        available,
        (rates.outgoing / acknowledgementFactor) * elapsed,
      )
      let depth = Math.max(0, available - dequeued)
      const ttlLimit =
        rates.ttlSeconds > 0
          ? rates.incoming * rates.ttlSeconds
          : Number.POSITIVE_INFINITY
      const expired = Math.max(0, depth - ttlLimit)
      depth -= expired
      const overflow = Math.max(0, depth - rates.maxSize)
      depth -= overflow
      const deadLettered = rates.deadLetter ? expired + overflow : 0
      const deadLetterSpace = Math.max(
        0,
        rates.deadLetterMaxSize - previous.deadLetteredEvents,
      )
      const acceptedDeadLetters = Math.min(deadLettered, deadLetterSpace)
      const deadLetterOverflow = Math.max(0, deadLettered - acceptedDeadLetters)
      const next = {
        nodeId,
        depth: Math.round(depth),
        enqueuedEvents: Math.round(previous.enqueuedEvents + enqueued),
        dequeuedEvents: Math.round(previous.dequeuedEvents + dequeued),
        expiredEvents: Math.round(previous.expiredEvents + expired),
        deadLetteredEvents: Math.round(previous.deadLetteredEvents + acceptedDeadLetters),
        overflowEvents: Math.round(previous.overflowEvents + overflow),
        redeliveredEvents: Math.round(previous.redeliveredEvents + redelivered),
        acknowledgedEvents: Math.round(
          previous.acknowledgedEvents + dequeued * (1 - rates.failureRate),
        ),
        deadLetterOverflowEvents: Math.round(
          previous.deadLetterOverflowEvents + deadLetterOverflow,
        ),
        averageMessageAgeMs:
          rates.incoming > 0 ? Math.round((depth / rates.incoming) * 1000) : 0,
        publisherConfirmedEvents: Math.round(
          previous.publisherConfirmedEvents + rates.incoming * elapsed,
        ),
        persistedBytes: Math.round(
          previous.persistedBytes +
            (rates.durable ? rates.incoming * elapsed * rates.payloadSizeBytes : 0),
        ),
        activePartitions: rates.activePartitions,
      }
      queueState.set(nodeId, next)
      queues.push(next)
    }
    const frameTime = Math.min(time, profile.durationSeconds)
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
      queues,
      services,
      datastores,
      resilience,
      availability,
    })
  }
  if (timeline.at(-1)?.timeSeconds !== profile.durationSeconds) {
    timeline.push({
      timeSeconds: profile.durationSeconds,
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

  const calibrated =
    profile.observedLatencyMs !== undefined ||
    profile.observedThroughputPerSecond !== undefined
  const modeledDistributions = graph.nodes.filter((node) =>
    ["worker", "external.api"].includes(node.type),
  ).length
  const confidence = calibrated ? "high" : modeledDistributions > 0 ? "medium" : "low"
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

  return {
    totalEventsProcessed: Math.round(rawEventsProcessed * throughputFactor),
    averageLatencyMs: Math.round(endToEndLatency * latencyFactor),
    p95LatencyMs: Math.round(percentile(latencySamples, 0.95) * latencyFactor),
    p99LatencyMs: Math.round(percentile(latencySamples, 0.99) * latencyFactor),
    bottlenecks: warnings.filter(
      (issue) => issue.code === "THROUGHPUT" || issue.code.includes("SATURATION"),
    ),
    warnings,
    resourceUsage: { cpuCores: round(cpu), memoryMb: Math.round(memory) },
    nodeMetrics,
    edgeMetrics,
    timeline,
    explanation: {
      confidence,
      confidenceReasons: calibrated
        ? ["Observed metrics are available for calibration."]
        : ["Results use deterministic configuration estimates without observed data."],
      assumptions: [
        "Traffic and failures are deterministic for the same graph and profile.",
        "Node capacity is estimated from configured limits.",
        "Infrastructure clients are not executed by the simulator.",
      ],
      recommendations: recommendationsFor(warnings),
      calibrated,
      calibrationFactors: calibrated
        ? {
            latency: round(latencyFactor),
            throughput: round(throughputFactor),
          }
        : undefined,
    },
  }
}
