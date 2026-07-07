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
})
