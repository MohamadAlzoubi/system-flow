import { describe, expect, it } from "vitest"
import type { DataContract } from "../../contracts"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { validateContracts } from "./validate-contracts"

describe("validateContracts", () => {
  it("accepts every bundled example", () => {
    for (const flow of [
      productViewedFlow,
      purchaseFlow,
      chatMessageFlow,
      bottleneckFlow,
    ]) {
      expect(validateContracts(flow, nodeRegistry)).toEqual([])
    }
  })

  it("rejects duplicate contract identities and dangling keys", () => {
    const graph = structuredClone(productViewedFlow)
    graph.dataContracts.push(structuredClone(graph.dataContracts[0]))
    graph.dataContracts[0].partitionKey = "notAField"

    const issues = validateContracts(graph, nodeRegistry)

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_CONTRACT", severity: "error" }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "INVALID_CONTRACT_KEY", severity: "error" }),
    )
  })

  it("detects incompatible contract evolution", () => {
    const graph = structuredClone(productViewedFlow)
    const nextVersion: DataContract = structuredClone(graph.dataContracts[0])
    nextVersion.version = "1.1"
    nextVersion.compatibility = "full"
    nextVersion.fields = nextVersion.fields
      .filter((field) => field.name !== "referrer")
      .map((field) =>
        field.name === "productId" ? { ...field, type: "number" as const } : field,
      )
    nextVersion.fields.push({ name: "sessionId", type: "string", required: true })
    graph.dataContracts.push(nextVersion)

    const messages = validateContracts(graph, nodeRegistry)
      .filter((issue) => issue.code === "CONTRACT_INCOMPATIBLE")
      .map((issue) => issue.message)

    expect(messages).toContainEqual(expect.stringContaining("changes field productId"))
    expect(messages).toContainEqual(
      expect.stringContaining("adds required field sessionId"),
    )
    // referrer was optional, so removing it is not flagged.
    expect(messages).not.toContainEqual(expect.stringContaining("referrer"))
  })

  it("skips evolution checks when compatibility is none", () => {
    const graph = structuredClone(productViewedFlow)
    const nextVersion: DataContract = structuredClone(graph.dataContracts[0])
    nextVersion.version = "1.1"
    nextVersion.compatibility = "none"
    nextVersion.fields = [{ name: "replaced", type: "string", required: true }]
    graph.dataContracts.push(nextVersion)

    expect(
      validateContracts(graph, nodeRegistry).filter(
        (issue) => issue.code === "CONTRACT_INCOMPATIBLE",
      ),
    ).toEqual([])
  })

  it("flags edges without a contract or with an unknown pinned version", () => {
    const graph = structuredClone(productViewedFlow)
    graph.edges[0] = { ...graph.edges[0], dataType: "Undeclared" }
    graph.edges[1] = { ...graph.edges[1], dataTypeVersion: "9.9" }

    const issues = validateContracts(graph, nodeRegistry)

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "CONTRACT_MISSING", edgeId: graph.edges[0].id }),
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_CONTRACT_VERSION",
        edgeId: graph.edges[1].id,
      }),
    )
  })

  it("warns when producers and consumers resolve different versions", () => {
    const graph = structuredClone(productViewedFlow)
    const nextVersion: DataContract = structuredClone(graph.dataContracts[0])
    nextVersion.version = "1.1"
    graph.dataContracts.push(nextVersion)
    graph.edges[0] = { ...graph.edges[0], dataTypeVersion: "1.0" }

    expect(validateContracts(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "CONTRACT_VERSION_MISMATCH" }),
    )
  })

  it("requires partition keys for per-key ordering", () => {
    const graph = structuredClone(productViewedFlow)
    graph.dataContracts[0].partitionKey = undefined
    const asyncEdge = graph.edges.find((edge) => edge.deliveryPolicy)
    if (!asyncEdge?.deliveryPolicy) throw new Error("Fixture requires an async edge")
    asyncEdge.deliveryPolicy.ordering = "per-key"

    expect(validateContracts(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "PARTITION_KEY_MISSING", edgeId: asyncEdge.id }),
    )
  })

  it("requires idempotency keys for retryable commands", () => {
    const graph = structuredClone(bottleneckFlow)
    graph.dataContracts[0].idempotencyKey = undefined

    expect(validateContracts(graph, nodeRegistry)).toContainEqual(
      expect.objectContaining({ code: "COMMAND_WITHOUT_IDEMPOTENCY" }),
    )
  })

  it("warns when sensitive fields reach an external dependency", () => {
    const graph = structuredClone(purchaseFlow)
    graph.dataContracts[0].fields[0].sensitive = true

    const issues = validateContracts(graph, nodeRegistry)

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "SENSITIVE_DATA_EXPOSURE" }),
    )
    expect(
      issues.find((issue) => issue.code === "SENSITIVE_DATA_EXPOSURE")?.message,
    ).toContain("orderId")
  })
})
