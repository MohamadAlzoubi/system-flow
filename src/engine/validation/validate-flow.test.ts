import { describe, expect, it } from "vitest"
import type { FlowGraph } from "../../contracts"
import { productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { validateFlow } from "./validate-flow"

describe("validateFlow", () => {
  it("accepts the product viewed example", () => {
    expect(validateFlow(productViewedFlow, nodeRegistry)).toEqual([])
  })

  it("reports incompatible edge contracts", () => {
    const graph: FlowGraph = structuredClone(productViewedFlow)
    const websocket = graph.nodes.at(-1)
    const lastEdge = graph.edges.at(-1)
    const websocketDefinition = nodeRegistry.get("websocket.gateway")
    if (!websocket || !lastEdge || !websocketDefinition) {
      throw new Error("Fixture requires a WebSocket target")
    }
    websocket.type = "websocket.gateway"
    lastEdge.dataType = "PurchaseEvent"
    websocketDefinition.inputTypes = ["ChatMessageEvent"]

    const issues = validateFlow(graph, nodeRegistry)

    expect(issues.some((issue) => issue.code === "TYPE_MISMATCH")).toBe(true)
    websocketDefinition.inputTypes = ["Event"]
  })

  it("reports circular dependencies", () => {
    const graph: FlowGraph = structuredClone(productViewedFlow)
    const lastNode = graph.nodes.at(-1)
    const firstNode = graph.nodes[0]
    if (!lastNode || !firstNode) throw new Error("Fixture requires nodes")
    graph.edges.push({
      id: "cycle",
      fromNodeId: lastNode.id,
      toNodeId: firstNode.id,
      dataType: "ProductViewedEvent",
    })

    expect(validateFlow(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "CIRCULAR_DEPENDENCY" }),
    )
  })

  it("requires complete branch percentages totaling 100", () => {
    const graph: FlowGraph = structuredClone(productViewedFlow)
    const source = graph.nodes[0]
    graph.edges = [
      {
        id: "a",
        fromNodeId: source.id,
        toNodeId: graph.nodes[1].id,
        dataType: "ProductViewedEvent",
        trafficPercentage: 70,
      },
      {
        id: "b",
        fromNodeId: source.id,
        toNodeId: graph.nodes[2].id,
        dataType: "ProductViewedEvent",
        trafficPercentage: 20,
      },
    ]

    expect(validateFlow(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "INVALID_TRAFFIC_SPLIT" }),
    )
  })

  it("validates conditional routes and competing consumers", () => {
    const graph: FlowGraph = structuredClone(productViewedFlow)
    graph.nodes[0].routingPolicy = { mode: "conditional" }
    graph.edges = [
      {
        id: "conditional",
        fromNodeId: graph.nodes[0].id,
        toNodeId: graph.nodes[1].id,
        dataType: "ProductViewedEvent",
        trafficPercentage: 100,
      },
    ]

    expect(validateFlow(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "MISSING_ROUTE_CONDITION" }),
    )

    graph.nodes[0].routingPolicy = { mode: "competing-consumers" }
    expect(validateFlow(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "INVALID_COMPETING_CONSUMERS" }),
    )
  })

  it("rejects disconnected nodes", () => {
    const graph = structuredClone(productViewedFlow)
    graph.nodes.push({
      id: "orphan",
      type: "worker",
      position: { x: 0, y: 0 },
      config: { ...nodeRegistry.get("worker")?.defaultConfig },
    })
    expect(validateFlow(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "DISCONNECTED_NODE", severity: "error" }),
    )
  })

  it("rejects unsupported dropdown values", () => {
    const graph = structuredClone(productViewedFlow)
    const redis = graph.nodes.find((node) => node.type === "redis.cache")
    if (!redis) throw new Error("Fixture requires Redis")
    redis.config.operation = "invented-operation"

    expect(validateFlow(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "INVALID_CONFIG",
        nodeId: redis.id,
      }),
    )
  })
})
