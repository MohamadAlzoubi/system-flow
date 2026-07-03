import { describe, expect, it } from "vitest"
import { bottleneckFlow, chatMessageFlow, productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { runSimulation } from "./run-simulation"

describe("runSimulation", () => {
  it("returns deterministic metrics", () => {
    const first = runSimulation(productViewedFlow, nodeRegistry)
    const second = runSimulation(productViewedFlow, nodeRegistry)

    expect(first).toEqual(second)
    expect(first.totalEventsProcessed).toBe(37500)
    expect(first.averageLatencyMs).toBeGreaterThan(0)
    expect(first.p99LatencyMs).toBeGreaterThan(first.p95LatencyMs)
    expect(first.p95LatencyMs).not.toBe(Math.round(first.averageLatencyMs * 1.8))
  })

  it("detects the worker bottleneck example", () => {
    const result = runSimulation(bottleneckFlow, nodeRegistry)

    expect(result.bottlenecks).toContainEqual(
      expect.objectContaining({ code: "THROUGHPUT" }),
    )
    const queue = result.nodeMetrics.find(
      (metric) => metric.nodeId === bottleneckFlow.nodes[1].id,
    )?.queue
    expect(queue?.enqueuedEvents).toBeGreaterThan(450000)
    expect(queue?.dequeuedEvents).toBeGreaterThan(0)
    expect(queue?.acknowledgedEvents).toBeGreaterThan(0)
    expect(queue?.redeliveredEvents).toBeGreaterThan(0)
    expect(queue?.averageMessageAgeMs).toBeGreaterThan(0)
    expect(queue?.expiredEvents).toBeGreaterThan(0)
    expect(result.timeline.length).toBeGreaterThan(1)
    expect(result.timeline.at(-1)?.timeSeconds).toBe(
      bottleneckFlow.simulationProfile.durationSeconds,
    )
  })

  it("splits traffic by edge percentage and constrains overloaded output", () => {
    const graph = structuredClone(productViewedFlow)
    graph.nodes = [graph.nodes[0], graph.nodes[5], graph.nodes[6]]
    graph.failureScenarios = []
    graph.nodes[0].config.ratePerSecond = 1000
    graph.nodes[1].config.concurrency = 2
    graph.nodes[1].config.averageProcessingMs = 100
    graph.edges = [
      {
        id: "fast-branch",
        fromNodeId: graph.nodes[0].id,
        toNodeId: graph.nodes[1].id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
        trafficPercentage: 70,
      },
      {
        id: "database-branch",
        fromNodeId: graph.nodes[0].id,
        toNodeId: graph.nodes[2].id,
        dataType: "ProductViewedEvent",
        interactionType: "database-operation",
        trafficPercentage: 30,
      },
    ]

    const result = runSimulation(graph, nodeRegistry)

    expect(result.edgeMetrics).toContainEqual(
      expect.objectContaining({ edgeId: "fast-branch", ratePerSecond: 700 }),
    )
    expect(result.edgeMetrics).toContainEqual(
      expect.objectContaining({ edgeId: "database-branch", ratePerSecond: 300 }),
    )
    expect(
      result.nodeMetrics.find((metric) => metric.nodeId === graph.nodes[1].id),
    ).toEqual(
      expect.objectContaining({
        incomingRatePerSecond: 700,
        acceptedRatePerSecond: 20,
        status: "critical",
      }),
    )
  })

  it("distributes queue traffic across competing consumers by capacity", () => {
    const graph = structuredClone(bottleneckFlow)
    const queue = graph.nodes[1]
    const firstWorker = graph.nodes[2]
    const secondWorker = structuredClone(firstWorker)
    secondWorker.id = "second-worker"
    secondWorker.config.concurrency = 4
    firstWorker.config.concurrency = 2
    queue.routingPolicy = { mode: "competing-consumers" }
    queue.config.orderingRequired = false
    queue.config.partitions = 2
    graph.nodes = [graph.nodes[0], queue, firstWorker, secondWorker]
    graph.failureScenarios = []
    graph.edges = [
      graph.edges[0],
      {
        id: "consumer-a",
        fromNodeId: queue.id,
        toNodeId: firstWorker.id,
        dataType: "QueueJob",
        interactionType: "async-command",
      },
      {
        id: "consumer-b",
        fromNodeId: queue.id,
        toNodeId: secondWorker.id,
        dataType: "QueueJob",
        interactionType: "async-command",
      },
    ]

    const result = runSimulation(graph, nodeRegistry)

    expect(result.edgeMetrics.find((edge) => edge.edgeId === "consumer-a")).toEqual(
      expect.objectContaining({ ratePerSecond: 10 }),
    )
    expect(result.edgeMetrics.find((edge) => edge.edgeId === "consumer-b")).toEqual(
      expect.objectContaining({ ratePerSecond: 20 }),
    )
  })

  it("uses explicit merge semantics", () => {
    const graph = structuredClone(productViewedFlow)
    const source = graph.nodes[0]
    const slow = graph.nodes[1]
    const fast = graph.nodes[2]
    const sink = graph.nodes[6]
    source.config.ratePerSecond = 100
    source.routingPolicy = { mode: "broadcast" }
    sink.mergePolicy = { mode: "wait-all" }
    graph.nodes = [source, slow, fast, sink]
    graph.failureScenarios = []
    graph.edges = [
      {
        id: "slow",
        fromNodeId: source.id,
        toNodeId: slow.id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
      },
      {
        id: "fast",
        fromNodeId: source.id,
        toNodeId: fast.id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
      },
      {
        id: "slow-merge",
        fromNodeId: slow.id,
        toNodeId: sink.id,
        dataType: "ProductViewedEvent",
        interactionType: "database-operation",
      },
      {
        id: "fast-merge",
        fromNodeId: fast.id,
        toNodeId: sink.id,
        dataType: "ProductViewedEvent",
        interactionType: "database-operation",
      },
    ]

    const result = runSimulation(graph, nodeRegistry)
    const sinkMetrics = result.nodeMetrics.find((metric) => metric.nodeId === sink.id)

    expect(sinkMetrics).toEqual(
      expect.objectContaining({ incomingRatePerSecond: 100, mergeMode: "wait-all" }),
    )
  })

  it("does not simulate invalid cyclic graphs", () => {
    const graph = structuredClone(productViewedFlow)
    graph.edges.push({
      id: "cycle",
      fromNodeId: graph.nodes.at(-1)?.id ?? "",
      toNodeId: graph.nodes[0].id,
      dataType: "ProductViewedEvent",
      interactionType: "request-response",
    })
    const result = runSimulation(graph, nodeRegistry)
    expect(result.totalEventsProcessed).toBe(0)
    expect(result.nodeMetrics).toEqual([])
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "CIRCULAR_DEPENDENCY", severity: "error" }),
    )
  })

  it("models worker scale-up delay and replay capacity", () => {
    const graph = structuredClone(productViewedFlow)
    const worker = graph.nodes.find((node) => node.type === "worker")
    if (!worker) throw new Error("Fixture requires a worker")
    worker.config.autoscalingEnabled = true
    worker.config.maxReplicas = 10

    const result = runSimulation(graph, nodeRegistry)
    const metric = result.nodeMetrics.find((item) => item.nodeId === worker.id)
    const beforeReady = result.timeline
      .find((frame) => frame.timeSeconds === 30)
      ?.services.find((service) => service.nodeId === worker.id)
    const afterReady = result.timeline
      .find((frame) => frame.timeSeconds === 40)
      ?.services.find((service) => service.nodeId === worker.id)

    expect(metric).toEqual(
      expect.objectContaining({
        replicas: 1,
        desiredReplicas: 6,
        scaleReadySeconds: 40,
      }),
    )
    expect(beforeReady?.scaling).toBe(true)
    expect(afterReady).toEqual(expect.objectContaining({ replicas: 6, scaling: false }))
  })

  it("identifies the limiting datastore resource", () => {
    const graph = structuredClone(productViewedFlow)
    const source = graph.nodes[0]
    const database = graph.nodes.find((node) => node.type === "database")
    if (!database) throw new Error("Fixture requires a database")
    source.config.ratePerSecond = 500
    database.config.storageIops = 100
    database.config.iopsPerOperation = 2
    database.config.primaryAvailable = false
    database.config.failoverSeconds = 30
    database.config.readReplicaCount = 2
    database.config.contentionPercentage = 20
    graph.nodes = [source, database]
    graph.failureScenarios = []
    graph.edges = [
      {
        id: "database-input",
        fromNodeId: source.id,
        toNodeId: database.id,
        dataType: "ProductViewedEvent",
        interactionType: "database-operation",
      },
    ]

    const result = runSimulation(graph, nodeRegistry)
    const metric = result.nodeMetrics.find((item) => item.nodeId === database.id)

    expect(metric).toEqual(
      expect.objectContaining({
        acceptedRatePerSecond: 45,
        datastore: expect.objectContaining({
          limitingResource: "iops",
          iopsCapacityPerSecond: 50,
        }),
      }),
    )
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "DATASTORE_SATURATION" }),
    )
    const duringFailover = result.timeline
      .find((frame) => frame.timeSeconds === 0)
      ?.datastores.find((datastore) => datastore.nodeId === database.id)
    const recovered = result.timeline
      .find((frame) => frame.timeSeconds === 30)
      ?.datastores.find((datastore) => datastore.nodeId === database.id)
    expect(duringFailover).toEqual(
      expect.objectContaining({
        primaryState: "failing-over",
        activeReadReplicas: 2,
      }),
    )
    expect(recovered).toEqual(
      expect.objectContaining({
        primaryState: "recovered",
        activeReadReplicas: 3,
      }),
    )
    expect(metric?.datastore?.contentionWaitMs).toBeGreaterThan(0)
  })

  it("models circuit-breaker and bulkhead rejection", () => {
    const graph = structuredClone(productViewedFlow)
    const source = graph.nodes[0]
    const definition = nodeRegistry.get("external.api")
    if (!definition) throw new Error("Registry requires external API")
    const dependency = {
      id: "dependency",
      type: "external.api",
      position: { x: 300, y: 100 },
      config: { ...definition.defaultConfig, failureRate: 0.8 },
    }
    source.config.ratePerSecond = 500
    graph.nodes = [source, dependency]
    graph.failureScenarios = []
    graph.edges = [
      {
        id: "dependency-call",
        fromNodeId: source.id,
        toNodeId: dependency.id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
      },
    ]

    const result = runSimulation(graph, nodeRegistry)
    const metric = result.nodeMetrics.find((item) => item.nodeId === dependency.id)

    expect(metric?.resilience).toEqual(
      expect.objectContaining({
        circuitOpen: true,
        recoverySeconds: 30,
      }),
    )
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "CIRCUIT_OPEN" }),
    )
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "DEPENDENCY_REJECTION" }),
    )
    const open = result.timeline
      .find((frame) => frame.timeSeconds === 0)
      ?.resilience.find((item) => item.nodeId === dependency.id)
    const halfOpen = result.timeline
      .find((frame) => frame.timeSeconds === 25)
      ?.resilience.find((item) => item.nodeId === dependency.id)
    const recovered = result.timeline
      .find((frame) => frame.timeSeconds === 30)
      ?.resilience.find((item) => item.nodeId === dependency.id)
    expect(open).toEqual(
      expect.objectContaining({
        circuitState: "open",
        downstreamRatePerSecond: 0,
      }),
    )
    expect(halfOpen?.circuitState).toBe("half-open")
    expect(recovered?.circuitState).toBe("recovered")
  })

  it("models regional bandwidth, TLS, and outage constraints", () => {
    const graph = structuredClone(productViewedFlow)
    graph.nodes = [graph.nodes[0], graph.nodes[1]]
    graph.failureScenarios = []
    graph.edges = [
      {
        id: "regional-edge",
        fromNodeId: graph.nodes[0].id,
        toNodeId: graph.nodes[1].id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
        network: {
          sourceRegion: "eu-west",
          targetRegion: "us-east",
          bandwidthMbps: 0.01,
          baseLatencyMs: 80,
          tlsHandshakeMs: 100,
          connectionReusePercent: 50,
          outagePercent: 10,
        },
      },
    ]

    const result = runSimulation(graph, nodeRegistry)
    const edge = result.edgeMetrics[0]

    expect(edge.ratePerSecond).toBeCloseTo(1.04, 2)
    expect(edge.network).toEqual(
      expect.objectContaining({
        sourceRegion: "eu-west",
        targetRegion: "us-east",
        transferLatencyMs: 960,
        tlsLatencyMs: 50,
        availabilityPercent: 90,
      }),
    )
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "NETWORK_CONSTRAINT" }),
    )
  })

  it("simulates production resilience catalog nodes", () => {
    const graph = structuredClone(productViewedFlow)
    const source = graph.nodes[0]
    const limiterDefinition = nodeRegistry.get("resilience.rate-limiter")
    const breakerDefinition = nodeRegistry.get("resilience.circuit-breaker")
    if (!limiterDefinition || !breakerDefinition) {
      throw new Error("Registry requires resilience nodes")
    }
    source.config.ratePerSecond = 2000
    const limiter = {
      id: "limiter",
      type: limiterDefinition.type,
      position: { x: 300, y: 100 },
      config: { ...limiterDefinition.defaultConfig },
    }
    const breaker = {
      id: "breaker",
      type: breakerDefinition.type,
      position: { x: 500, y: 100 },
      config: {
        ...breakerDefinition.defaultConfig,
        observedFailurePercent: 80,
      },
    }
    graph.nodes = [source, limiter, breaker]
    graph.failureScenarios = []
    graph.edges = [
      {
        id: "limited",
        fromNodeId: source.id,
        toNodeId: limiter.id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
      },
      {
        id: "protected",
        fromNodeId: limiter.id,
        toNodeId: breaker.id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
      },
    ]

    const result = runSimulation(graph, nodeRegistry)

    expect(result.nodeMetrics.find((metric) => metric.nodeId === limiter.id)).toEqual(
      expect.objectContaining({
        incomingRatePerSecond: 2000,
        acceptedRatePerSecond: 1250,
      }),
    )
    expect(
      result.nodeMetrics.find((metric) => metric.nodeId === breaker.id)?.resilience
        ?.circuitOpen,
    ).toBe(true)
  })

  it("explains confidence, calibration, and remediation", () => {
    const graph = structuredClone(bottleneckFlow)
    graph.simulationProfile.observedLatencyMs = 250
    graph.simulationProfile.observedThroughputPerSecond = 1000

    const result = runSimulation(graph, nodeRegistry)

    expect(result.explanation).toEqual(
      expect.objectContaining({
        confidence: "high",
        calibrated: true,
      }),
    )
    expect(result.averageLatencyMs).toBe(250)
    expect(result.totalEventsProcessed).toBe(300000)
    expect(result.explanation.calibrationFactors).toEqual(
      expect.objectContaining({
        latency: expect.any(Number),
        throughput: expect.any(Number),
      }),
    )
    expect(result.explanation.assumptions.length).toBeGreaterThan(0)
    expect(result.explanation.recommendations).toContainEqual(
      expect.objectContaining({ code: "THROUGHPUT", priority: "high" }),
    )
  })

  it("applies burst, ramp, peak, and payload scenario inputs", () => {
    const graph = structuredClone(productViewedFlow)
    graph.simulationProfile.trafficPattern = "burst"
    graph.simulationProfile.peakRequestsPerSecond = 1500
    graph.simulationProfile.burstDurationSeconds = 60
    graph.simulationProfile.rampUpSeconds = 30
    graph.simulationProfile.payloadSizeBytes = 2400
    graph.nodes = [graph.nodes[0], graph.nodes[1]]
    graph.failureScenarios = []
    graph.edges = [
      {
        id: "scenario-network",
        fromNodeId: graph.nodes[0].id,
        toNodeId: graph.nodes[1].id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
        network: {
          sourceRegion: "eu",
          targetRegion: "us",
          bandwidthMbps: 1,
          baseLatencyMs: 0,
          tlsHandshakeMs: 0,
          connectionReusePercent: 100,
          outagePercent: 0,
        },
      },
    ]

    const result = runSimulation(graph, nodeRegistry)

    expect(result.nodeMetrics[0].incomingRatePerSecond).toBe(750)
    expect(result.edgeMetrics[0].network?.transferLatencyMs).toBe(19.2)
  })

  it("enforces worker timeout and models graceful scale down", () => {
    const graph = structuredClone(productViewedFlow)
    const source = graph.nodes[0]
    const worker = graph.nodes.find((node) => node.type === "worker")
    if (!worker) throw new Error("Fixture requires a worker")
    source.config.ratePerSecond = 10
    worker.config.replicas = 5
    worker.config.autoscalingEnabled = true
    worker.config.minReplicas = 1
    worker.config.averageProcessingMs = 40000
    worker.config.timeoutMs = 30000
    graph.nodes = [source, worker]
    graph.failureScenarios = []
    graph.edges = [
      {
        id: "timed-worker",
        fromNodeId: source.id,
        toNodeId: worker.id,
        dataType: "ProductViewedEvent",
        interactionType: "request-response",
      },
    ]

    const result = runSimulation(graph, nodeRegistry)
    const metric = result.nodeMetrics.find((item) => item.nodeId === worker.id)
    const beforeDrain = result.timeline
      .find((frame) => frame.timeSeconds === 60)
      ?.services.find((service) => service.nodeId === worker.id)
    const afterDrain = result.timeline
      .find((frame) => frame.timeSeconds === 90)
      ?.services.find((service) => service.nodeId === worker.id)

    expect(metric).toEqual(
      expect.objectContaining({
        acceptedRatePerSecond: 0,
        desiredReplicas: 1,
      }),
    )
    expect(beforeDrain).toEqual(
      expect.objectContaining({
        replicas: 5,
        direction: "down",
        limitingResource: "timeout",
      }),
    )
    expect(afterDrain?.replicas).toBe(1)
  })

  it("applies data-quality distributions and bounded retry policy", () => {
    const graph = structuredClone(productViewedFlow)
    graph.simulationProfile.duplicateEventPercent = 10
    graph.simulationProfile.malformedEventPercent = 10

    const result = runSimulation(graph, nodeRegistry)

    expect(result.nodeMetrics[0].incomingRatePerSecond).toBe(495)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "DATA_QUALITY" }),
    )
    const queue = result.nodeMetrics.find(
      (metric) => metric.nodeId === graph.nodes[4].id,
    )?.queue
    expect(queue?.redeliveredEvents).toBeGreaterThan(0)
  })

  it("enforces broker partitions, ordering, bandwidth, and persistence", () => {
    const graph = structuredClone(bottleneckFlow)
    const queue = graph.nodes[1]
    queue.config.orderingRequired = true
    queue.config.partitions = 4
    queue.config.bandwidthMbps = 0.1
    queue.config.brokerStorageMb = 1
    graph.simulationProfile.payloadSizeBytes = 1000

    const result = runSimulation(graph, nodeRegistry)
    const metrics = result.nodeMetrics.find((metric) => metric.nodeId === queue.id)?.queue

    expect(metrics).toEqual(
      expect.objectContaining({
        activePartitions: 1,
        maxDepth: expect.any(Number),
      }),
    )
    expect(metrics?.maxDepth).toBeLessThanOrEqual(1049)
    expect(metrics?.publisherConfirmedEvents).toBeGreaterThan(0)
    expect(metrics?.persistedBytes).toBeGreaterThan(0)
  })

  it("registers deterministic production data-plane nodes", () => {
    const expectedTypes = [
      "stream.kafka-topic",
      "storage.object",
      "network.cdn",
      "data.search-engine",
      "compute.batch-processor",
      "data.database-proxy",
      "data.read-replica",
      "messaging.dead-letter-queue",
      "stream.processor",
      "control.autoscaler",
    ]
    for (const type of expectedTypes) {
      const definition = nodeRegistry.get(type)
      expect(definition, `${type} should be registered`).toBeDefined()
      expect(definition?.configSchema.safeParse(definition.defaultConfig).success).toBe(
        true,
      )
    }

    const kafka = nodeRegistry.get("stream.kafka-topic")
    const result = kafka?.simulate(kafka.defaultConfig, {
      profile: productViewedFlow.simulationProfile,
      ratePerSecond: 1000,
    })
    expect(result?.throughputPerSecond).toBe(6000)
  })

  it("takes Redis and Worker fully offline", () => {
    const redisGraph = structuredClone(productViewedFlow)
    const redis = redisGraph.nodes.find((node) => node.type === "redis.cache")
    if (!redis) throw new Error("Fixture requires Redis")
    redis.availabilityPolicy = {
      mode: "offline",
      offlineFromSeconds: 0,
      offlineDurationSeconds: 0,
      recoverySeconds: 0,
      degradedCapacityPercent: 0,
    }
    const redisResult = runSimulation(redisGraph, nodeRegistry)
    expect(redisResult.nodeMetrics.find((metric) => metric.nodeId === redis.id)).toEqual(
      expect.objectContaining({
        acceptedRatePerSecond: 0,
        availabilityPercent: 0,
      }),
    )
    expect(redisResult.totalEventsProcessed).toBe(0)

    const workerGraph = structuredClone(bottleneckFlow)
    const worker = workerGraph.nodes.find((node) => node.type === "worker")
    const queue = workerGraph.nodes.find((node) => node.type === "rabbitmq.queue")
    if (!worker || !queue) throw new Error("Fixture requires queue and worker")
    worker.availabilityPolicy = {
      mode: "offline",
      offlineFromSeconds: 0,
      offlineDurationSeconds: 0,
      recoverySeconds: 0,
      degradedCapacityPercent: 0,
    }
    const workerResult = runSimulation(workerGraph, nodeRegistry)
    expect(
      workerResult.nodeMetrics.find((metric) => metric.nodeId === queue.id)?.queue
        ?.dequeuedEvents,
    ).toBe(0)
  })

  it("replays a scheduled outage and recovery", () => {
    const graph = structuredClone(productViewedFlow)
    const worker = graph.nodes.find((node) => node.type === "worker")
    if (!worker) throw new Error("Fixture requires worker")
    worker.availabilityPolicy = {
      mode: "scheduled",
      offlineFromSeconds: 60,
      offlineDurationSeconds: 60,
      recoverySeconds: 20,
      degradedCapacityPercent: 50,
    }

    const result = runSimulation(graph, nodeRegistry)
    const atOutage = result.timeline
      .find((frame) => frame.timeSeconds === 60)
      ?.availability.find((item) => item.nodeId === worker.id)
    const recovering = result.timeline
      .find((frame) => frame.timeSeconds === 125)
      ?.availability.find((item) => item.nodeId === worker.id)
    const recovered = result.timeline
      .find((frame) => frame.timeSeconds === 140)
      ?.availability.find((item) => item.nodeId === worker.id)

    expect(atOutage?.state).toBe("offline")
    expect(recovering).toEqual(
      expect.objectContaining({ state: "recovering", capacityPercent: 25 }),
    )
    expect(recovered?.state).toBe("online")
  })

  it("stops caller latency at asynchronous boundaries", () => {
    // Async pipeline: a slower consumer changes throughput, not response time.
    const fastConsumer = structuredClone(bottleneckFlow)
    const slowConsumer = structuredClone(bottleneckFlow)
    slowConsumer.nodes[2].config.averageProcessingMs = 800

    expect(runSimulation(slowConsumer, nodeRegistry).averageLatencyMs).toBe(
      runSimulation(fastConsumer, nodeRegistry).averageLatencyMs,
    )

    // The same worker called synchronously adds its time to the caller.
    const syncGraph = structuredClone(bottleneckFlow)
    syncGraph.nodes = [syncGraph.nodes[0], syncGraph.nodes[2], syncGraph.nodes[3]]
    syncGraph.edges = [
      {
        id: "sync-call",
        fromNodeId: syncGraph.nodes[0].id,
        toNodeId: syncGraph.nodes[1].id,
        dataType: "QueueJob",
        interactionType: "request-response",
        timeoutMs: 30000,
        responseDataType: "QueueJobAck",
      },
      {
        id: "sync-write",
        fromNodeId: syncGraph.nodes[1].id,
        toNodeId: syncGraph.nodes[2].id,
        dataType: "QueueJob",
        interactionType: "database-operation",
      },
    ]
    const slowSyncGraph = structuredClone(syncGraph)
    slowSyncGraph.nodes[1].config.averageProcessingMs = 800

    expect(runSimulation(slowSyncGraph, nodeRegistry).averageLatencyMs).toBeGreaterThan(
      runSimulation(syncGraph, nodeRegistry).averageLatencyMs,
    )
  })

  it("classifies user impact from the same deterministic metrics", () => {
    const result = runSimulation(bottleneckFlow, nodeRegistry)
    const outcomes = new Map(
      result.userImpact.map((entry) => [entry.outcome, entry.events]),
    )

    expect(outcomes.get("lost") ?? 0).toBeGreaterThan(0)
    expect(outcomes.get("duplicated") ?? 0).toBeGreaterThan(0)
    expect(outcomes.get("accepted-for-later") ?? 0).toBeGreaterThan(0)
  })

  it("applies the active failure scenario deterministically", () => {
    const scenario = productViewedFlow.failureScenarios?.[0]
    if (!scenario) throw new Error("Fixture requires a failure scenario")
    const base = runSimulation(productViewedFlow, nodeRegistry)
    const first = runSimulation(productViewedFlow, nodeRegistry, scenario)
    const second = runSimulation(productViewedFlow, nodeRegistry, scenario)

    expect(first).toEqual(second)
    expect(first.totalEventsProcessed).toBeLessThan(base.totalEventsProcessed)
    expect(first.explanation.assumptions).toContainEqual(
      expect.stringContaining(scenario.name),
    )
    // The scenario is applied to a copy; the shared example stays untouched.
    expect(
      productViewedFlow.nodes.find((node) => node.type === "worker")?.availabilityPolicy,
    ).toBeUndefined()
  })

  it("compares results against declared architecture goals", () => {
    const result = runSimulation(productViewedFlow, nodeRegistry)

    expect(result.goalReport).toBeDefined()
    expect(result.goalReport?.evaluations).toContainEqual(
      expect.objectContaining({ goal: "maximumP95LatencyMs", status: "passed" }),
    )
    expect(result.goalReport?.evaluations).toContainEqual(
      expect.objectContaining({ goal: "maximumDataLossEvents", status: "failed" }),
    )
    expect(result.goalReport?.evaluations).toContainEqual(
      expect.objectContaining({
        goal: "averageTrafficPerSecond",
        status: "failed",
        actual: 125,
      }),
    )
    expect(result.goalReport?.openQuestions).toContain(
      "Availability has not been decided.",
    )
    expect(result.goalReport?.assumptions.length).toBeGreaterThan(0)
  })

  it("evaluates the chat example goals against a valid graph", () => {
    const result = runSimulation(chatMessageFlow, nodeRegistry)

    expect(result.warnings.filter((issue) => issue.severity === "error")).toEqual([])
    expect(result.goalReport).toEqual(
      expect.objectContaining({ passed: 4, failed: 1, notEvaluated: 2 }),
    )
    expect(result.goalReport?.evaluations).toContainEqual(
      expect.objectContaining({ goal: "peakTrafficPerSecond", status: "failed" }),
    )
  })

  it("uses the selected Redis operation", () => {
    const redis = nodeRegistry.get("redis.cache")
    if (!redis) throw new Error("Registry requires Redis")
    const context = {
      profile: productViewedFlow.simulationProfile,
      ratePerSecond: 100,
    }
    const read = redis.simulate({ ...redis.defaultConfig, operation: "read" }, context)
    const write = redis.simulate({ ...redis.defaultConfig, operation: "write" }, context)

    expect(read.latencyMs).toBe(2)
    expect(write.latencyMs).toBe(4)
  })
})
