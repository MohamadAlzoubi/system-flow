import { describe, expect, it } from "vitest"
import type { NodeInstance } from "../../contracts"
import { nodeRegistry } from "../../node-registry"
import { inferInteractionDefaults } from "./infer-interaction-defaults"

function node(id: string, type: string): NodeInstance {
  return { id, type, position: { x: 0, y: 0 }, config: {} }
}

function infer(fromType: string, toType: string) {
  const nodes = [node("from", fromType), node("to", toType)]
  return inferInteractionDefaults(
    { fromNodeId: "from", toNodeId: "to" },
    nodes,
    nodeRegistry,
  )
}

describe("inferInteractionDefaults", () => {
  it("treats broker consumption as asynchronous regardless of consumer", () => {
    expect(infer("rabbitmq.queue", "worker")).toEqual(
      expect.objectContaining({
        interactionType: "async-command",
        deliveryPolicy: expect.objectContaining({ guarantee: "at-least-once" }),
      }),
    )
    expect(infer("stream.kafka-topic", "worker")).toEqual(
      expect.objectContaining({
        interactionType: "stream",
        deliveryPolicy: expect.objectContaining({ ordering: "per-key" }),
      }),
    )
  })

  it("infers interaction from the target's responsibility", () => {
    expect(infer("function.service", "rabbitmq.queue").interactionType).toBe(
      "async-command",
    )
    expect(infer("function.service", "database").interactionType).toBe(
      "database-operation",
    )
    expect(infer("database", "websocket.gateway").interactionType).toBe("realtime-push")
    expect(infer("websocket.gateway", "logger.metrics").interactionType).toBe(
      "published-event",
    )
    expect(infer("scheduler.cron", "compute.batch-processor").interactionType).toBe(
      "batch-transfer",
    )
  })

  it("defaults to request-response with a timeout", () => {
    expect(infer("event.source", "http.endpoint")).toEqual({
      interactionType: "request-response",
      timeoutMs: 30000,
    })
    expect(infer("worker", "external.api").interactionType).toBe("request-response")
  })
})
