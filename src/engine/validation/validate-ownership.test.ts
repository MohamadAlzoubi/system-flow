import { describe, expect, it } from "vitest"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { validateOwnership } from "./validate-ownership"

function nodeOfType(graph: typeof productViewedFlow, type: string) {
  const node = graph.nodes.find((item) => item.type === type)
  if (!node) throw new Error(`Fixture requires a ${type} node`)
  return node
}

describe("validateOwnership", () => {
  it("accepts every bundled example", () => {
    for (const flow of [
      productViewedFlow,
      purchaseFlow,
      chatMessageFlow,
      bottleneckFlow,
    ]) {
      expect(validateOwnership(flow, nodeRegistry)).toEqual([])
    }
  })

  it("warns when a stateful node has no owner", () => {
    const graph = structuredClone(productViewedFlow)
    const database = nodeOfType(graph, "database")
    database.responsibility = undefined

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "STATEFUL_WITHOUT_OWNER",
        nodeId: database.id,
      }),
    )
  })

  it("respects an explicit stateless override", () => {
    const graph = structuredClone(productViewedFlow)
    const database = nodeOfType(graph, "database")
    database.responsibility = { stateful: false }

    expect(validateOwnership(graph, nodeRegistry)).not.toContainEqual(
      expect.objectContaining({ code: "STATEFUL_WITHOUT_OWNER", nodeId: database.id }),
    )
  })

  it("detects uncoordinated source-of-truth writers", () => {
    const graph = structuredClone(productViewedFlow)
    const redis = nodeOfType(graph, "redis.cache")
    redis.responsibility = { ...redis.responsibility, sourceOfTruth: true }
    redis.stateOwnership = {
      ...redis.stateOwnership,
      dataOwned: ["ProductViewedEvent"],
      allowedWriterIds: [],
      consistencyModel: "eventual",
    }

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "MULTIPLE_SOURCE_OF_TRUTH" }),
    )

    const database = nodeOfType(graph, "database")
    redis.stateOwnership.conflictResolution = "merge"
    if (database.stateOwnership) database.stateOwnership.conflictResolution = "merge"
    expect(validateOwnership(graph, nodeRegistry)).not.toContainEqual(
      expect.objectContaining({ code: "MULTIPLE_SOURCE_OF_TRUTH" }),
    )
  })

  it("requires a network policy for cross-region state access", () => {
    const graph = structuredClone(productViewedFlow)
    const worker = nodeOfType(graph, "worker")
    const database = nodeOfType(graph, "database")
    worker.responsibility = { deploymentRegion: "eu-west" }
    database.responsibility = {
      ...database.responsibility,
      deploymentRegion: "us-east",
    }
    const edge = graph.edges.find(
      (item) => item.fromNodeId === worker.id && item.toNodeId === database.id,
    )
    if (!edge) throw new Error("Fixture requires worker → database edge")

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "CROSS_REGION_STATE", edgeId: edge.id }),
    )

    edge.network = {
      sourceRegion: "eu-west",
      targetRegion: "us-east",
      bandwidthMbps: 1000,
      baseLatencyMs: 80,
      tlsHandshakeMs: 20,
      connectionReusePercent: 95,
      outagePercent: 0,
    }
    expect(validateOwnership(graph, nodeRegistry)).not.toContainEqual(
      expect.objectContaining({ code: "CROSS_REGION_STATE" }),
    )
  })

  it("warns when a cache has no invalidation strategy", () => {
    const graph = structuredClone(productViewedFlow)
    const redis = nodeOfType(graph, "redis.cache")
    redis.stateOwnership = undefined

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "CACHE_WITHOUT_REFILL", nodeId: redis.id }),
    )
  })

  it("rejects read replicas promising read-after-write consistency", () => {
    const graph = structuredClone(productViewedFlow)
    graph.nodes.push({
      id: "replica",
      type: "data.read-replica",
      position: { x: 0, y: 0 },
      config: { ...nodeRegistry.get("data.read-replica")?.defaultConfig },
      responsibility: { owner: "storefront-team" },
      stateOwnership: {
        dataOwned: [],
        allowedWriterIds: [],
        consistencyModel: "read-after-write",
      },
    })

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "READ_REPLICA_CONSISTENCY", nodeId: "replica" }),
    )
  })

  it("flags sensitive data crossing trust zones without protection", () => {
    const graph = structuredClone(productViewedFlow)
    graph.boundaries = [
      ...(graph.boundaries ?? []),
      { id: "zone-edge", label: "Client edge", kind: "trust-zone" },
    ]
    const websocket = nodeOfType(graph, "websocket.gateway")
    websocket.boundaryId = "zone-edge"
    const edge = graph.edges.find((item) => item.toNodeId === websocket.id)
    if (!edge) throw new Error("Fixture requires an edge into the gateway")

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "SENSITIVE_TRUST_BOUNDARY", edgeId: edge.id }),
    )

    edge.protection = "field-encryption"
    expect(validateOwnership(graph, nodeRegistry)).not.toContainEqual(
      expect.objectContaining({ code: "SENSITIVE_TRUST_BOUNDARY" }),
    )
  })

  it("rejects broken boundary references and cycles", () => {
    const graph = structuredClone(productViewedFlow)
    graph.boundaries = [
      { id: "a", label: "A", kind: "system", parentId: "b" },
      { id: "b", label: "B", kind: "service", parentId: "a" },
      { id: "c", label: "C", kind: "team", parentId: "missing" },
    ]
    graph.nodes[0].boundaryId = "missing"

    const issues = validateOwnership(graph, nodeRegistry)

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_BOUNDARY", severity: "error" }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "UNKNOWN_BOUNDARY", nodeId: graph.nodes[0].id }),
    )
  })

  it("rejects duplicate region codes", () => {
    const graph = structuredClone(productViewedFlow)
    graph.boundaries = [
      { id: "region-a", label: "US primary", kind: "region", regionCode: "us-east-1" },
      { id: "region-b", label: "US shadow", kind: "region", regionCode: "us-east-1" },
    ]

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_REGION_CODE", severity: "error" }),
    )
  })

  it("warns when node region placement disagrees with deployment region", () => {
    const graph = structuredClone(productViewedFlow)
    graph.boundaries = [
      { id: "region-us", label: "US East", kind: "region", regionCode: "us-east-1" },
    ]
    graph.nodes[0].boundaryId = "region-us"
    graph.nodes[0].responsibility = {
      deploymentRegion: "eu-west-1",
    }

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "REGION_ASSIGNMENT_MISMATCH",
        nodeId: graph.nodes[0].id,
      }),
    )
  })

  it("derives deployment regions through nested boundaries", () => {
    const graph = structuredClone(productViewedFlow)
    const worker = nodeOfType(graph, "worker")
    const database = nodeOfType(graph, "database")
    graph.boundaries = [
      {
        id: "region-eu",
        label: "EU",
        kind: "region",
        regionCode: "eu-west-1",
      },
      {
        id: "zone-eu-a",
        label: "EU zone A",
        kind: "availability-zone",
        parentId: "region-eu",
      },
      {
        id: "region-us",
        label: "US",
        kind: "region",
        regionCode: "us-east-1",
      },
    ]
    worker.boundaryId = "zone-eu-a"
    worker.responsibility = { owner: "worker-team" }
    database.boundaryId = "region-us"
    database.responsibility = { owner: "data-team" }
    const edge = graph.edges.find(
      (item) => item.fromNodeId === worker.id && item.toNodeId === database.id,
    )
    if (!edge) throw new Error("Fixture requires worker → database edge")
    edge.network = undefined

    expect(validateOwnership(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "CROSS_REGION_STATE",
        edgeId: edge.id,
      }),
    )
  })
})
