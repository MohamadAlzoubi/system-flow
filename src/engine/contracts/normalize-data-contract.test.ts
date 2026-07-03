import { describe, expect, it } from "vitest"
import { normalizeDataContract } from "./normalize-data-contract"

describe("normalizeDataContract", () => {
  it("converts a legacy schema object into required typed fields", () => {
    const migrated = normalizeDataContract({
      name: "ProductViewedEvent",
      version: "1.0",
      schema: { id: "string", count: "number", nested: "map" },
      estimatedSizeBytes: 1200,
    })

    expect(migrated.kind).toBe("event")
    expect(migrated.compatibility).toBe("backward")
    expect(migrated.fields).toEqual([
      { name: "id", type: "string", required: true },
      { name: "count", type: "number", required: true },
      { name: "nested", type: "object", required: true },
    ])
  })

  it("keeps already-structured contracts untouched", () => {
    const structured = {
      name: "Order",
      version: "2.0",
      kind: "command" as const,
      description: "Fulfillment request",
      fields: [{ name: "orderId", type: "string" as const, required: true }],
      estimatedSizeBytes: 300,
      idempotencyKey: "orderId",
      compatibility: "full" as const,
    }

    expect(normalizeDataContract(structured)).toEqual(structured)
  })
})
