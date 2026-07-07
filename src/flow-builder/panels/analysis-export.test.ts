import { describe, expect, it } from "vitest"
import { runSimulation } from "../../engine"
import { productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { buildSimulationAnalysisExport } from "./analysis-export"

describe("buildSimulationAnalysisExport", () => {
  it("packages simulation statistics as agent-readable JSON", () => {
    const graph = structuredClone(productViewedFlow)
    graph.simulationProfile.observedLatencyMs = 120
    graph.simulationProfile.observedLatencySource = "load-test"
    const result = runSimulation(graph, nodeRegistry)
    const exported = buildSimulationAnalysisExport({
      graph,
      result,
      visibleIssues: result.warnings,
      scenario: null,
      baseline: null,
      comparison: null,
      riskFindings: [],
      exportedAt: "2026-07-05T00:00:00.000Z",
    })

    expect(exported).toEqual(
      expect.objectContaining({
        schemaVersion: "system-flow.analysis.v1",
        exportedAt: "2026-07-05T00:00:00.000Z",
        graph: expect.objectContaining({
          id: graph.id,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          dataContractCount: graph.dataContracts.length,
        }),
        summary: expect.objectContaining({
          totalEventsProcessed: result.totalEventsProcessed,
          averageLatencyMs: result.averageLatencyMs,
          p95LatencyMs: result.p95LatencyMs,
          p99LatencyMs: result.p99LatencyMs,
          warningCount: result.warnings.length,
          timelineFrames: result.timeline.length,
        }),
        goalReport: result.goalReport,
        warnings: result.warnings,
        nodeMetrics: result.nodeMetrics,
        edgeMetrics: result.edgeMetrics,
        timeline: result.timeline,
        measurementEvidence: [
          expect.objectContaining({
            metric: "latency",
            source: "load-test",
            quality: "measured",
          }),
        ],
        readiness: result.readiness,
        riskFindings: [],
      }),
    )
  })
})
