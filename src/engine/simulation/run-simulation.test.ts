import { describe, expect, it } from "vitest"
import { bottleneckFlow, productViewedFlow } from "../../examples"
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
    graph.nodes[0].config.ratePerSecond = 1000
    graph.nodes[1].config.concurrency = 2
    graph.nodes[1].config.averageProcessingMs = 100
    graph.edges = [
      {
        id: "fast-branch",
        fromNodeId: graph.nodes[0].id,
        toNodeId: graph.nodes[1].id,
        dataType: "ProductViewedEvent",
        trafficPercentage: 70,
      },
      {
        id: "database-branch",
        fromNodeId: graph.nodes[0].id,
        toNodeId: graph.nodes[2].id,
        dataType: "ProductViewedEvent",
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
    graph.nodes = [graph.nodes[0], queue, firstWorker, secondWorker]
    graph.edges = [
      graph.edges[0],
      {
        id: "consumer-a",
        fromNodeId: queue.id,
        toNodeId: firstWorker.id,
        dataType: "QueueJob",
      },
      {
        id: "consumer-b",
        fromNodeId: queue.id,
        toNodeId: secondWorker.id,
        dataType: "QueueJob",
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
    graph.edges = [
      {
        id: "slow",
        fromNodeId: source.id,
        toNodeId: slow.id,
        dataType: "ProductViewedEvent",
      },
      {
        id: "fast",
        fromNodeId: source.id,
        toNodeId: fast.id,
        dataType: "ProductViewedEvent",
      },
      {
        id: "slow-merge",
        fromNodeId: slow.id,
        toNodeId: sink.id,
        dataType: "ProductViewedEvent",
      },
      {
        id: "fast-merge",
        fromNodeId: fast.id,
        toNodeId: sink.id,
        dataType: "ProductViewedEvent",
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
})
