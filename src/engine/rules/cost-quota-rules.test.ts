import { describe, expect, it } from "vitest"
import { productViewedFlow, purchaseFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { evaluateRules } from "./evaluate-rules"

describe("cost and quota rules", () => {
  it("identifies external provider quota risk separately from performance", () => {
    const findings = evaluateRules(purchaseFlow, nodeRegistry)

    expect(findings).toContainEqual(
      expect.objectContaining({
        code: "QUOTA_EXTERNAL_PROVIDER",
        category: "quota",
      }),
    )
  })

  it("identifies oversized cache and cross-region bandwidth cost risk", () => {
    const graph = structuredClone(productViewedFlow)
    const cache = graph.nodes.find((node) => node.type === "redis.cache")
    if (!cache) throw new Error("Fixture requires a cache")
    cache.config.maxMemoryMb = graph.simulationProfile.memoryMb
    graph.simulationProfile.payloadSizeBytes = 1_000_000
    graph.edges[0].network = {
      presetId: "private-backbone-regions",
      sourceRegion: "eu-west-1",
      targetRegion: "us-east-1",
      bandwidthMbps: 100,
      baseLatencyMs: 65,
      tlsHandshakeMs: 10,
      connectionReusePercent: 99,
      outagePercent: 0.1,
    }

    const findings = evaluateRules(graph, nodeRegistry)

    expect(findings).toContainEqual(
      expect.objectContaining({ code: "COST_CACHE_MEMORY", category: "cost" }),
    )
    expect(findings).toContainEqual(
      expect.objectContaining({
        code: "COST_CROSS_REGION_BANDWIDTH",
        category: "cost",
      }),
    )
  })

  it("checks cache memory cost against the assigned region budget", () => {
    const graph = structuredClone(productViewedFlow)
    const cache = graph.nodes.find((node) => node.type === "redis.cache")
    if (!cache) throw new Error("Fixture requires a cache")
    graph.boundaries = [
      {
        id: "region-eu",
        label: "EU",
        kind: "region",
        regionCode: "eu-west-1",
        resourceBudget: { cpuCores: 100, memoryMb: 100 },
      },
    ]
    cache.boundaryId = "region-eu"
    cache.config.maxMemoryMb = 80

    const findings = evaluateRules(graph, nodeRegistry)

    expect(findings).toContainEqual(
      expect.objectContaining({
        code: "COST_CACHE_MEMORY",
        message: expect.stringContaining("EU region memory budget"),
      }),
    )
  })
})
