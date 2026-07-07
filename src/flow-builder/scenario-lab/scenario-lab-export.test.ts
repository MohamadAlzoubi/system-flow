import { describe, expect, it } from "vitest"
import { runScenarioBatch } from "../../engine"
import { productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { buildScenarioLabExport } from "./scenario-lab-export"

describe("buildScenarioLabExport", () => {
  it("exports complete baseline and scenario results", () => {
    const scenarios = productViewedFlow.failureScenarios ?? []
    const batch = runScenarioBatch(productViewedFlow, nodeRegistry, scenarios)
    const exported = buildScenarioLabExport({
      graph: productViewedFlow,
      batch,
      exportedAt: "2026-07-06T12:00:00.000Z",
    })

    expect(exported.schemaVersion).toBe("system-flow.scenario-lab.v1")
    expect(exported.exportedAt).toBe("2026-07-06T12:00:00.000Z")
    expect(exported.batch.baseline.timeline.length).toBeGreaterThan(0)
    expect(exported.batch.scenarios).toHaveLength(scenarios.length)
    expect(exported.batch.scenarios[0]).toEqual(
      expect.objectContaining({
        scenario: scenarios[0],
        result: expect.objectContaining({
          nodeMetrics: expect.any(Array),
          edgeMetrics: expect.any(Array),
          userImpact: expect.any(Array),
        }),
        comparisonToBaseline: expect.any(Object),
      }),
    )
  })
})
