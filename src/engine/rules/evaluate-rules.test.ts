import { describe, expect, it } from "vitest"
import type { FlowGraph, NodeInstance, RuleAcceptance } from "../../contracts"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import {
  evaluateRules,
  findAcceptance,
  findingKey,
  type RuleOptions,
} from "./evaluate-rules"

function codesFor(graph: FlowGraph, options?: RuleOptions): string[] {
  return evaluateRules(graph, nodeRegistry, options).map((finding) => finding.code)
}

describe("evaluateRules", () => {
  it("is deterministic and teaches on the bundled examples", () => {
    const first = evaluateRules(purchaseFlow, nodeRegistry)
    const second = evaluateRules(purchaseFlow, nodeRegistry)
    expect(first).toEqual(second)
    for (const finding of first) {
      expect(finding.rationale.length).toBeGreaterThan(0)
      expect(finding.suggestedActions.length).toBeGreaterThan(0)
    }

    expect(codesFor(purchaseFlow)).toEqual(
      expect.arrayContaining([
        "SLO_WITHOUT_OBSERVABILITY",
        "RETRY_AMPLIFICATION",
        "SINGLE_POINT_OF_FAILURE",
        "TTL_SHORTER_THAN_OUTAGE",
      ]),
    )
    expect(codesFor(productViewedFlow)).toEqual(
      expect.arrayContaining([
        "RECOVERY_DRAIN_TOO_SLOW",
        "AT_LEAST_ONCE_WITHOUT_IDEMPOTENCY",
      ]),
    )
    // The chat flow has observability, so that finding stays silent.
    expect(codesFor(chatMessageFlow)).not.toContain("SLO_WITHOUT_OBSERVABILITY")
  })

  it("limits synchronous chain depth via options", () => {
    expect(codesFor(purchaseFlow, { maximumSyncDepth: 2 })).toContain(
      "SYNC_CHAIN_TOO_DEEP",
    )
    expect(codesFor(purchaseFlow, { maximumSyncDepth: 3 })).not.toContain(
      "SYNC_CHAIN_TOO_DEEP",
    )
  })

  it("flags timeouts below the dependency's expected latency", () => {
    const graph = structuredClone(purchaseFlow)
    graph.edges[0] = { ...graph.edges[0], timeoutMs: 1 }

    expect(codesFor(graph)).toContain("TIMEOUT_BUDGET_TOO_SMALL")
  })

  it("flags asynchronous edges that behave synchronously", () => {
    const graph = structuredClone(productViewedFlow)
    const asyncEdge = graph.edges.find((edge) => edge.interactionType === "async-command")
    if (!asyncEdge) throw new Error("Fixture requires an async edge")
    asyncEdge.responseDataType = "SomeReply"

    expect(codesFor(graph)).toContain("ASYNC_COUPLED_TO_CALLER")
  })

  it("expects circuit breakers to have a graceful outcome", () => {
    const graph = structuredClone(bottleneckFlow)
    graph.failureScenarios = []
    const breaker: NodeInstance = {
      id: "breaker",
      type: "resilience.circuit-breaker",
      position: { x: 0, y: 0 },
      config: { ...nodeRegistry.get("resilience.circuit-breaker")?.defaultConfig },
    }
    graph.nodes.push(breaker)
    graph.edges.push({
      id: "guarded",
      fromNodeId: graph.nodes[0].id,
      toNodeId: breaker.id,
      dataType: "QueueJob",
      interactionType: "request-response",
      timeoutMs: 1000,
    })

    expect(codesFor(graph)).toContain("BREAKER_WITHOUT_FALLBACK")

    breaker.routingPolicy = { mode: "failover" as const }
    expect(codesFor(graph)).not.toContain("BREAKER_WITHOUT_FALLBACK")
  })

  it("expects queues to define terminal outcomes", () => {
    const graph = structuredClone(bottleneckFlow)
    graph.nodes[1].config.deadLetterQueue = false

    expect(codesFor(graph)).toContain("QUEUE_WITHOUT_TERMINAL_OUTCOME")
  })

  it("rejects global ordering across parallel partitions", () => {
    const graph = structuredClone(bottleneckFlow)
    graph.nodes[1].config.partitions = 4
    const edge = graph.edges[0]
    if (!edge.deliveryPolicy) throw new Error("Fixture requires delivery policy")
    edge.deliveryPolicy.ordering = "global"

    expect(codesFor(graph)).toContain("ORDERING_VS_PARTITIONS")
  })

  it("questions multiple owners of the same state", () => {
    const graph = structuredClone(productViewedFlow)
    const redis = graph.nodes.find((node) => node.type === "redis.cache")
    if (!redis) throw new Error("Fixture requires Redis")
    redis.responsibility = { ...redis.responsibility, sourceOfTruth: true }
    redis.stateOwnership = {
      dataOwned: ["ProductViewedEvent"],
      allowedWriterIds: [],
      consistencyModel: "eventual",
      cacheInvalidation: "ttl",
    }

    const finding = evaluateRules(graph, nodeRegistry).find(
      (item) => item.code === "MULTIPLE_STATE_WRITERS",
    )
    expect(finding?.severity).toBe("question")
    expect(finding?.affectedIds).toHaveLength(2)
  })

  it("flags caches without invalidation and search as source of truth", () => {
    const graph = structuredClone(productViewedFlow)
    const redis = graph.nodes.find((node) => node.type === "redis.cache")
    if (!redis) throw new Error("Fixture requires Redis")
    redis.stateOwnership = undefined
    graph.nodes.push({
      id: "search",
      type: "data.search-engine",
      position: { x: 0, y: 0 },
      config: { ...nodeRegistry.get("data.search-engine")?.defaultConfig },
      responsibility: { owner: "storefront-team", sourceOfTruth: true },
    })

    const codes = codesFor(graph)
    expect(codes).toContain("CACHE_WITHOUT_INVALIDATION")
    expect(codes).toContain("SEARCH_AS_SOURCE_OF_TRUTH")
  })

  it("expects events to carry identity and time", () => {
    const graph = structuredClone(chatMessageFlow)
    const notification = graph.dataContracts.find(
      (contract) => contract.name === "WebSocketNotification",
    )
    if (!notification) throw new Error("Fixture requires the notification contract")
    notification.fields = notification.fields.filter(
      (field) => field.type !== "timestamp",
    )

    const finding = evaluateRules(graph, nodeRegistry).find(
      (item) => item.code === "EVENT_WITHOUT_IDENTITY",
    )
    expect(finding?.message).toContain("timestamp")
    expect(finding?.affectedIds).toEqual(["WebSocketNotification"])
  })

  it("covers operability and security gaps", () => {
    const graph = structuredClone(productViewedFlow)
    const database = graph.nodes.find((node) => node.type === "database")
    if (!database) throw new Error("Fixture requires a database")
    database.responsibility = { sourceOfTruth: true }
    if (graph.failureScenarios?.[0]) {
      graph.failureScenarios[0].recoveryBehavior = undefined
    }
    graph.dataContracts[0].fields = graph.dataContracts[0].fields.map((field) =>
      field.name === "userId" ? { ...field, sensitive: true } : field,
    )
    graph.nodes.push({
      id: "psp",
      type: "external.api",
      position: { x: 0, y: 0 },
      config: { ...nodeRegistry.get("external.api")?.defaultConfig },
    })
    graph.edges.push({
      id: "external-call",
      fromNodeId: database.id,
      toNodeId: "psp",
      dataType: "ProductViewedEvent",
      interactionType: "request-response",
      timeoutMs: 2000,
      responseDataType: "ProductViewedEventAck",
    })

    const codes = codesFor(graph)
    expect(codes).toContain("CRITICAL_WITHOUT_OWNER")
    expect(codes).toContain("SCENARIO_WITHOUT_RECOVERY")
    expect(codes).toContain("SENSITIVE_TO_EXTERNAL")
  })

  it("questions only high-impact unverified assumptions", () => {
    const graph = structuredClone(productViewedFlow)
    graph.assumptions = [
      {
        id: "high-open",
        statement: "Product data may be up to five minutes stale.",
        status: "unverified",
        impact: "high",
        relatedIds: [graph.nodes[3].id],
      },
      {
        id: "high-verified",
        statement: "The cache supports TTL expiry.",
        status: "verified",
        impact: "high",
        relatedIds: [],
      },
      {
        id: "low-open",
        statement: "Logs are retained for 30 days.",
        status: "unverified",
        impact: "low",
        relatedIds: [],
      },
    ]

    const finding = evaluateRules(graph, nodeRegistry).find(
      (item) => item.code === "ASSUMPTION_UNVERIFIED",
    )
    expect(finding?.message).toContain("five minutes stale")
    expect(finding?.affectedIds).toEqual([graph.nodes[3].id])
    // Only the high-impact unverified assumption produces a finding.
    expect(
      evaluateRules(graph, nodeRegistry).filter(
        (item) => item.code === "ASSUMPTION_UNVERIFIED",
      ),
    ).toHaveLength(1)
  })

  it("matches acceptances to specific finding instances", () => {
    const findings = evaluateRules(purchaseFlow, nodeRegistry)
    const finding = findings.find((item) => item.code === "SINGLE_POINT_OF_FAILURE")
    if (!finding) throw new Error("Fixture requires the SPOF finding")
    const acceptances: RuleAcceptance[] = [
      {
        ruleCode: finding.code,
        targetKey: findingKey(finding),
        reason: "Single region is acceptable for launch",
        reviewDate: "2026-10-01",
      },
    ]

    expect(findAcceptance(finding, acceptances)).toBeDefined()
    const other = findings.find((item) => item.code !== finding.code)
    if (!other) throw new Error("Fixture requires another finding")
    expect(findAcceptance(other, acceptances)).toBeUndefined()
  })
})
