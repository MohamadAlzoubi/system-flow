import { describe, expect, it } from "vitest"
import type { FlowEdge, InteractionType } from "../../contracts"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { validateInteractions } from "./validate-interactions"

function editEdge(index: number, changes: Partial<FlowEdge>) {
  const graph = structuredClone(productViewedFlow)
  graph.edges[index] = { ...graph.edges[index], ...changes }
  return graph
}

describe("validateInteractions", () => {
  it("accepts every bundled example", () => {
    for (const flow of [
      productViewedFlow,
      purchaseFlow,
      chatMessageFlow,
      bottleneckFlow,
    ]) {
      expect(validateInteractions(flow, nodeRegistry)).toEqual([])
    }
  })

  it("rejects edges without a known interaction type", () => {
    const graph = editEdge(0, {
      interactionType: undefined as unknown as InteractionType,
    })

    expect(validateInteractions(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_INTERACTION_TYPE",
        severity: "error",
      }),
    )
  })

  it("rejects non-positive timeouts", () => {
    const graph = editEdge(0, { timeoutMs: 0 })

    expect(validateInteractions(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "INVALID_INTERACTION", severity: "error" }),
    )
  })

  it("warns when a request-response call has no timeout or response type", () => {
    const graph = editEdge(0, { timeoutMs: undefined, responseDataType: undefined })

    const issues = validateInteractions(graph, nodeRegistry)

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "REQUEST_TIMEOUT_MISSING" }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "RESPONSE_TYPE_MISSING" }),
    )
  })

  it("warns when a published event behaves synchronously", () => {
    const graph = editEdge(1, {
      interactionType: "published-event",
      timeoutMs: 5000,
    })

    expect(validateInteractions(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "PUBLISHED_EVENT_SYNCHRONOUS" }),
    )
  })

  it("warns when a database operation targets a component without state", () => {
    // Edge 2 targets the function service, which owns no data.
    const graph = editEdge(1, { interactionType: "database-operation" })

    expect(validateInteractions(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "DATABASE_OPERATION_TARGET" }),
    )
  })

  it("warns when realtime push targets a component without connections", () => {
    const graph = editEdge(1, {
      interactionType: "realtime-push",
      timeoutMs: undefined,
      responseDataType: undefined,
    })

    expect(validateInteractions(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "REALTIME_PUSH_TARGET" }),
    )
  })
})
