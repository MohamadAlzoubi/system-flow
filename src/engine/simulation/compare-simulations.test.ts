import { describe, expect, it } from "vitest"
import { productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { compareSimulations } from "./compare-simulations"
import { runSimulation } from "./run-simulation"

describe("compareSimulations", () => {
  it("reports improvements and resolved bottlenecks", () => {
    const baselineGraph = structuredClone(productViewedFlow)
    const improvedGraph = structuredClone(productViewedFlow)
    const worker = improvedGraph.nodes.find((node) => node.type === "worker")
    if (!worker) throw new Error("Fixture requires a worker")
    worker.config.concurrency = 100

    const baseline = runSimulation(baselineGraph, nodeRegistry)
    const current = runSimulation(improvedGraph, nodeRegistry)
    const comparison = compareSimulations(baseline, current)

    expect(comparison.throughput.improved).toBe(true)
    expect(comparison.throughput.absolute).toBeGreaterThan(0)
    expect(comparison.droppedEvents.improved).toBe(true)
    expect(comparison.bottlenecks.moved).toBe(false)
  })

  it("handles a zero baseline without an invalid percentage", () => {
    const baseline = runSimulation(structuredClone(productViewedFlow), nodeRegistry)
    baseline.totalEventsProcessed = 0
    const current = structuredClone(baseline)
    current.totalEventsProcessed = 10

    expect(compareSimulations(baseline, current).throughput).toEqual(
      expect.objectContaining({
        absolute: 10,
        percentage: undefined,
        improved: true,
      }),
    )
  })
})
