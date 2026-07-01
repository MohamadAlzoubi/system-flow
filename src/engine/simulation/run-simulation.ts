import type {
  EdgeSimulationMetrics,
  FlowGraph,
  NodeDefinition,
  NodeSimulationMetrics,
  NodeSimulationResult,
  QueueFrameMetrics,
  SimulationFrame,
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
    }
  >()

  for (const nodeId of order) {
    const node = nodes.get(nodeId)
    const definition = node && registry.get(node.type)
    if (!node || !definition) continue
    const isSource = (incomingCount.get(nodeId) ?? 0) === 0
    const configuredSourceRate =
      node.type === "event.source"
        ? number(node.config.ratePerSecond)
        : profile.requestsPerSecond
    const merged = isSource
      ? { rate: configuredSourceRate, latencyMs: 0 }
      : mergeContributions(
          incomingContributions.get(nodeId) ?? [],
          node.mergePolicy?.mode ?? "sum",
        )
    const inputRate = merged.rate
    const result = definition.simulate(node.config, { profile, ratePerSecond: inputRate })
    latencyVariance += (result.latencyStdDevMs ?? 0) ** 2
    if (result.scaling) scalingServices.set(nodeId, result.scaling)
    const capacity = result.throughputPerSecond
    let acceptedRate = capacity === undefined ? inputRate : Math.min(inputRate, capacity)
    if (node.type === "rabbitmq.queue") {
      const consumerCapacity = (outgoing.get(nodeId) ?? []).reduce((sum, edge) => {
        const target = nodes.get(edge.toNodeId)
        const targetDefinition = target && registry.get(target.type)
        if (!target || !targetDefinition) return sum
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
          sum + Math.min(targetResult.throughputPerSecond ?? inputRate, prefetchCapacity)
        )
      }, 0)
      const brokerCapacity = number(node.config.brokerMaxThroughputPerSecond)
      acceptedRate = Math.min(inputRate, consumerCapacity || inputRate, brokerCapacity)
      const consumers = (outgoing.get(nodeId) ?? [])
        .map((edge) => nodes.get(edge.toNodeId))
        .filter((target) => target !== undefined)
      const failureRate =
        consumers.length === 0
          ? 0
          : consumers.reduce(
              (sum, target) => sum + (number(target.config.failureRate) || 0),
              0,
            ) / consumers.length
      queueRates.set(nodeId, {
        incoming: inputRate,
        outgoing: acceptedRate,
        maxSize: number(node.config.maxQueueSize),
        ttlSeconds: number(node.config.messageTtlMs) / 1000,
        deadLetter: node.config.deadLetterQueue === true,
        deadLetterMaxSize: number(node.config.deadLetterMaxSize),
        retryCount: number(node.config.retryCount),
        retryDelaySeconds: number(node.config.retryDelayMs) / 1000,
        failureRate,
        acknowledgementLatencyMs: number(node.config.acknowledgementLatencyMs),
        brokerCapacity,
      })
    }
    const utilization =
      capacity && capacity > 0 ? (inputRate / capacity) * 100 : undefined
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
        const healthy = configuredFailureRate < 1 && !timeoutFailure
        const firstHealthyIndex = sortedEdges.findIndex((candidate) => {
          const candidateTarget = nodes.get(candidate.toNodeId)
          return (
            (number(candidateTarget?.config.failureRate) || 0) < 1 &&
            !(
              candidateTarget?.type === "external.api" &&
              number(candidateTarget.config.averageLatencyMs) >
                number(candidateTarget.config.timeoutMs)
            )
          )
        })
        percentage = healthy && index === firstHealthyIndex ? 100 : 0
      }
      const edgeRate = acceptedRate * (percentage / 100)
      incomingContributions.set(edge.toNodeId, [
        ...(incomingContributions.get(edge.toNodeId) ?? []),
        { rate: edgeRate, latencyMs: pathLatency },
      ])
      edgeMetrics.push({
        edgeId: edge.id,
        ratePerSecond: round(edgeRate),
        totalEvents: Math.round(edgeRate * profile.durationSeconds),
        percentageOfSourceTraffic: percentage,
        status: edgeRate === 0 ? "inactive" : droppedRate > 0 ? "congested" : "active",
        latencyMs: round(pathLatency),
      })
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
      }
      const retryEligible =
        rates.retryDelaySeconds <= 0
          ? rates.retryCount
          : Math.min(rates.retryCount, elapsed / rates.retryDelaySeconds)
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
      }
    })
    timeline.push({ timeSeconds: frameTime, queues, services })
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
      })),
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

  return {
    totalEventsProcessed: nodeMetrics
      .filter((metric) => (outgoing.get(metric.nodeId) ?? []).length === 0)
      .reduce((sum, metric) => sum + metric.processedEvents, 0),
    averageLatencyMs: Math.round(endToEndLatency),
    p95LatencyMs: Math.round(percentile(latencySamples, 0.95)),
    p99LatencyMs: Math.round(percentile(latencySamples, 0.99)),
    bottlenecks: warnings.filter(
      (issue) => issue.code === "THROUGHPUT" || issue.code.includes("SATURATION"),
    ),
    warnings,
    resourceUsage: { cpuCores: round(cpu), memoryMb: Math.round(memory) },
    nodeMetrics,
    edgeMetrics,
    timeline,
  }
}
