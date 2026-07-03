import { describe, expect, it } from "vitest"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { validateFailures } from "./validate-failures"

describe("validateFailures", () => {
  it("accepts every bundled example", () => {
    for (const flow of [
      productViewedFlow,
      purchaseFlow,
      chatMessageFlow,
      bottleneckFlow,
    ]) {
      expect(validateFailures(flow, nodeRegistry)).toEqual([])
    }
  })

  it("warns when an external dependency has no timeout behavior", () => {
    const graph = structuredClone(purchaseFlow)
    const external = graph.edges.at(-1)
    if (!external) throw new Error("Fixture requires the external edge")
    external.interactionType = "async-command"
    external.timeoutMs = undefined
    external.failurePolicy = undefined

    expect(validateFailures(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "EXTERNAL_WITHOUT_TIMEOUT", edgeId: external.id }),
    )
  })

  it("warns about unbounded retries and missing idempotency protection", () => {
    const graph = structuredClone(purchaseFlow)
    const external = graph.edges.at(-1)
    if (!external?.failurePolicy) throw new Error("Fixture requires a retry policy")
    external.failurePolicy.maximumAttempts = undefined
    graph.dataContracts[0].idempotencyKey = undefined

    const issues = validateFailures(graph, nodeRegistry)

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "UNBOUNDED_RETRY", edgeId: external.id }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "RETRY_WITHOUT_IDEMPOTENCY",
        edgeId: external.id,
      }),
    )
  })

  it("rejects fallbacks that share the primary's failure boundary", () => {
    const graph = structuredClone(purchaseFlow)
    const external = graph.edges.at(-1)
    if (!external) throw new Error("Fixture requires the external edge")
    // Fallback into the same service boundary as the primary target.
    external.failurePolicy = { action: "fallback", fallbackNodeId: graph.nodes[2].id }

    expect(validateFailures(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "FALLBACK_SHARED_FAILURE", edgeId: external.id }),
    )

    external.failurePolicy = { action: "fallback", fallbackNodeId: "missing" }
    expect(validateFailures(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "INVALID_FAILURE_POLICY", severity: "error" }),
    )
  })

  it("warns when queues lack terminal failure handling", () => {
    const graph = structuredClone(bottleneckFlow)
    const queue = graph.nodes[1]
    queue.config.deadLetterQueue = false

    expect(validateFailures(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "QUEUE_WITHOUT_TERMINAL_HANDLING",
        nodeId: queue.id,
      }),
    )
  })

  it("warns when a dead-letter queue has no replay owner", () => {
    const graph = structuredClone(bottleneckFlow)
    graph.nodes.push({
      id: "dlq",
      type: "messaging.dead-letter-queue",
      position: { x: 0, y: 0 },
      config: { ...nodeRegistry.get("messaging.dead-letter-queue")?.defaultConfig },
    })

    expect(validateFailures(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "DLQ_WITHOUT_REPLAY_OWNER", nodeId: "dlq" }),
    )
  })

  it("warns when global ordering meets parallel partitions", () => {
    const graph = structuredClone(bottleneckFlow)
    const queueEdge = graph.edges[0]
    graph.nodes[1].config.partitions = 4
    if (!queueEdge.deliveryPolicy) throw new Error("Fixture requires delivery policy")
    queueEdge.deliveryPolicy.ordering = "global"

    expect(validateFailures(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "GLOBAL_ORDERING_PARALLELISM",
        edgeId: queueEdge.id,
      }),
    )
  })

  it("warns when at-most-once delivery meets a zero-loss goal", () => {
    const graph = structuredClone(bottleneckFlow)
    const queueEdge = graph.edges[0]
    if (!queueEdge.deliveryPolicy) throw new Error("Fixture requires delivery policy")
    queueEdge.deliveryPolicy.guarantee = "at-most-once"

    expect(validateFailures(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "AT_MOST_ONCE_WITH_ZERO_LOSS",
        edgeId: queueEdge.id,
      }),
    )
  })

  it("rejects scenarios with broken references or timing", () => {
    const graph = structuredClone(productViewedFlow)
    graph.failureScenarios = [
      {
        id: "broken",
        name: "",
        kind: "consumer-outage",
        affectedNodeIds: ["missing-node"],
        affectedBoundaryIds: ["missing-boundary"],
        startSeconds: 0,
        durationSeconds: 0,
        recoverySeconds: 0,
      },
    ]

    const issues = validateFailures(graph, nodeRegistry).filter(
      (issue) => issue.code === "INVALID_SCENARIO",
    )

    expect(issues.length).toBe(3)
    expect(issues.every((issue) => issue.severity === "error")).toBe(true)
  })
})
