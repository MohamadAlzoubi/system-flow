import type {
  FailureScenario,
  FlowGraph,
  NodeSimulationMetrics,
  ProductionReadinessMetrics,
  ReadinessMetricEvidence,
  SimulationFrame,
} from "../../contracts"

const round = (value: number) => Number(value.toFixed(2))
const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

const timedRecoveryKinds = new Set<FailureScenario["kind"]>([
  "dependency-unavailable",
  "region-unavailable",
  "consumer-outage",
  "datastore-failover",
  "traffic-spike",
])

const asynchronousInteractions = new Set<FlowGraph["edges"][number]["interactionType"]>([
  "async-command",
  "published-event",
  "stream",
  "batch-transfer",
  "realtime-push",
])

export function estimateProductionReadiness({
  graph,
  scenario,
  nodeMetrics,
  timeline,
  lostEvents,
  sourceRatePerSecond,
}: {
  graph: FlowGraph
  scenario?: FailureScenario
  nodeMetrics: NodeSimulationMetrics[]
  timeline: SimulationFrame[]
  lostEvents: number
  sourceRatePerSecond: number
}): ProductionReadinessMetrics {
  const evidence: ReadinessMetricEvidence[] = []
  const scheduledRecovery = Math.max(
    0,
    ...graph.nodes.map((node) => {
      const policy = node.availabilityPolicy
      if (policy?.mode !== "scheduled") return 0
      return policy.offlineDurationSeconds + policy.recoverySeconds
    }),
  )
  const scenarioRecovery =
    scenario && timedRecoveryKinds.has(scenario.kind)
      ? scenario.durationSeconds + scenario.recoverySeconds
      : 0
  const failoverSeconds = Math.max(
    0,
    ...nodeMetrics.map((metric) => metric.datastore?.failoverSeconds ?? 0),
  )
  const recoveryWindow = Math.max(scheduledRecovery, scenarioRecovery, failoverSeconds)
  const scaleDelaySeconds = Math.max(
    0,
    ...nodeMetrics.map((metric) =>
      metric.desiredReplicas !== undefined &&
      metric.replicas !== undefined &&
      metric.desiredReplicas !== metric.replicas
        ? (metric.scaleReadySeconds ?? 0)
        : 0,
    ),
  )
  const queueLagSeconds =
    Math.max(
      0,
      ...timeline.flatMap((frame) =>
        frame.queues.map((queue) => queue.averageMessageAgeMs),
      ),
    ) / 1000

  let recoveryTimeSeconds: number | undefined
  if (recoveryWindow > 0) {
    recoveryTimeSeconds = round(
      recoveryWindow + Math.max(scaleDelaySeconds, queueLagSeconds),
    )
    evidence.push({
      metric: "recovery-time",
      value: round(recoveryWindow),
      unit: "seconds",
      source: scenario?.id ?? "node-availability-policy",
      role: "estimate",
      reason:
        "Failure duration, configured recovery, and datastore failover define the base recovery window.",
    })
    if (scaleDelaySeconds > 0) {
      evidence.push({
        metric: "recovery-time",
        value: round(scaleDelaySeconds),
        unit: "seconds",
        source: "scaling-readiness",
        role: "estimate",
        reason:
          "Scaling delay and cold-start time can extend recovery after capacity returns.",
      })
    }
    if (queueLagSeconds > 0) {
      evidence.push({
        metric: "recovery-time",
        value: round(queueLagSeconds),
        unit: "seconds",
        source: "queue-backlog",
        role: "estimate",
        reason:
          "Maximum observed queue message age estimates the additional backlog drain delay.",
      })
    }
  }

  const hasFailureContext =
    scenario !== undefined ||
    graph.nodes.some((node) => node.availabilityPolicy?.mode === "scheduled") ||
    failoverSeconds > 0
  let recoveryPointSeconds: number | undefined
  if (hasFailureContext && sourceRatePerSecond > 0) {
    const lostWorkSeconds = Math.max(0, lostEvents) / sourceRatePerSecond
    const datastoreLossWindow =
      lostEvents > 0 && scenario?.kind === "datastore-failover"
        ? failoverSeconds
        : Math.max(
            0,
            ...nodeMetrics.map((metric) =>
              metric.datastore && metric.droppedEvents > 0
                ? metric.datastore.failoverSeconds
                : 0,
            ),
          )
    recoveryPointSeconds = round(Math.max(lostWorkSeconds, datastoreLossWindow))
    evidence.push({
      metric: "recovery-point",
      value: round(Math.max(0, lostEvents)),
      unit: "events",
      source: "unrecoverable-work",
      role: "estimate",
      reason:
        "Dropped events, queue expiration, and dead-letter overflow are treated as unrecoverable work.",
    })
    if (datastoreLossWindow > 0) {
      evidence.push({
        metric: "recovery-point",
        value: round(datastoreLossWindow),
        unit: "seconds",
        source: "datastore-failover",
        role: "estimate",
        reason:
          "A failover window with dropped datastore work bounds the recovery point.",
      })
    }
  }

  const stalenessEstimates: ReadinessMetricEvidence[] = []
  for (const node of graph.nodes) {
    if (node.type === "redis.cache") {
      const ttlSeconds = number(node.config.ttlSeconds)
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        stalenessEstimates.push({
          metric: "data-staleness",
          value: round(ttlSeconds * 1000),
          unit: "ms",
          source: "cache-ttl",
          role: "estimate",
          reason: "Cache entries may remain stale until their TTL expires.",
          nodeId: node.id,
        })
      }
    }
    if (node.type === "data.read-replica") {
      const lag = number(node.config.replicationLagMs)
      if (lag !== undefined) {
        stalenessEstimates.push({
          metric: "data-staleness",
          value: round(lag),
          unit: "ms",
          source: "read-replica-lag",
          role: "estimate",
          reason: "Replica reads can trail the primary by the configured lag.",
          nodeId: node.id,
        })
      }
    }
    if (node.type === "database" && (number(node.config.readReplicaCount) ?? 0) > 0) {
      const lag = number(node.config.replicationLagMs)
      if (lag !== undefined) {
        stalenessEstimates.push({
          metric: "data-staleness",
          value: round(lag),
          unit: "ms",
          source: "database-replication-lag",
          role: "estimate",
          reason: "Database read replicas can trail the primary.",
          nodeId: node.id,
        })
      }
    }
    if (node.type === "stream.processor") {
      const processing = number(node.config.processingLatencyMs)
      const windowSeconds = number(node.config.windowSeconds)
      const checkpoint = number(node.config.checkpointIntervalMs)
      if (
        processing !== undefined &&
        windowSeconds !== undefined &&
        checkpoint !== undefined
      ) {
        stalenessEstimates.push({
          metric: "data-staleness",
          value: round(processing + windowSeconds * 1000 + checkpoint),
          unit: "ms",
          source: "stream-processing-lag",
          role: "estimate",
          reason:
            "Windowing, checkpointing, and processing latency delay stream projections.",
          nodeId: node.id,
        })
      }
    }
    if (node.type === "compute.batch-processor") {
      const processing = number(node.config.processingMsPerBatch)
      const flush = number(node.config.flushIntervalMs)
      if (processing !== undefined && flush !== undefined) {
        stalenessEstimates.push({
          metric: "data-staleness",
          value: round(processing + flush),
          unit: "ms",
          source: "batch-projection-lag",
          role: "estimate",
          reason: "Batch flush and processing intervals delay projection updates.",
          nodeId: node.id,
        })
      }
    }
    const tolerance = node.stateOwnership?.freshnessToleranceMs
    if (tolerance !== undefined) {
      evidence.push({
        metric: "data-staleness",
        value: tolerance,
        unit: "ms",
        source: "node-freshness-tolerance",
        role: "constraint",
        reason: "The node declares its own freshness tolerance.",
        nodeId: node.id,
      })
    }
  }

  const maximumQueueAge = new Map<string, number>()
  for (const frame of timeline) {
    for (const queue of frame.queues) {
      maximumQueueAge.set(
        queue.nodeId,
        Math.max(maximumQueueAge.get(queue.nodeId) ?? 0, queue.averageMessageAgeMs),
      )
    }
  }
  for (const [nodeId, age] of maximumQueueAge) {
    if (age <= 0) continue
    stalenessEstimates.push({
      metric: "data-staleness",
      value: age,
      unit: "ms",
      source: "queue-message-age",
      role: "estimate",
      reason: "Queued work delays downstream projections.",
      nodeId,
    })
  }

  for (const edge of graph.edges) {
    const network = edge.network
    if (
      !network ||
      network.sourceRegion === network.targetRegion ||
      !asynchronousInteractions.has(edge.interactionType)
    ) {
      continue
    }
    const expectedTlsMs =
      network.tlsHandshakeMs * (1 - network.connectionReusePercent / 100)
    stalenessEstimates.push({
      metric: "data-staleness",
      value: round(network.baseLatencyMs + expectedTlsMs),
      unit: "ms",
      source: "cross-region-replication-lag",
      role: "estimate",
      reason:
        "Asynchronous cross-region transfer adds network and expected TLS setup delay.",
      edgeId: edge.id,
    })
  }

  const dataStalenessMs =
    stalenessEstimates.length > 0
      ? round(Math.max(...stalenessEstimates.map((item) => item.value)))
      : undefined
  evidence.push(...stalenessEstimates)

  return {
    recoveryTimeSeconds,
    recoveryPointSeconds,
    dataStalenessMs,
    evidence,
  }
}
