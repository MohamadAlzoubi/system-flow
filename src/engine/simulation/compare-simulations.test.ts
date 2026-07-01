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
    const queue = improvedGraph.nodes.find((node) => node.type === "rabbitmq.queue")
    if (!worker || !queue) throw new Error("Fixture requires a queue and worker")
    worker.config.concurrency = 100

    const baseline = runSimulation(baselineGraph, nodeRegistry)
    const current = runSimulation(improvedGraph, nodeRegistry)
    const comparison = compareSimulations(baseline, current)

    expect(comparison.throughput.improved).toBe(true)
    expect(comparison.throughput.absolute).toBe(112500)
    expect(comparison.droppedEvents.improved).toBe(true)
    expect(comparison.bottlenecks.resolvedNodeIds).toContain(queue.id)
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
