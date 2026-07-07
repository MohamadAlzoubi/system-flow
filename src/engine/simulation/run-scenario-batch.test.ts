import { describe, expect, it } from "vitest"
import type { FailureScenario } from "../../contracts"
import { productViewedFlow } from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { runScenarioBatch } from "./run-scenario-batch"
import { runSimulation } from "./run-simulation"

function scenarios(count: number): FailureScenario[] {
  const target = productViewedFlow.nodes.at(-1)
  if (!target) throw new Error("Fixture requires a target node")
  return Array.from({ length: count }, (_, index) => ({
    id: `scenario-${index + 1}`,
    name: `Dependency outage ${index + 1}`,
    kind: "dependency-unavailable",
    affectedNodeIds: [target.id],
    affectedBoundaryIds: [],
    startSeconds: 10 + index * 5,
    durationSeconds: 20,
    recoverySeconds: 10,
    recoveryBehavior: `Recovery plan ${index + 1}`,
  }))
}

describe("runScenarioBatch", () => {
  it("compares at least five scenarios with a normal-operation baseline", () => {
    const selected = scenarios(5)
    const batch = runScenarioBatch(productViewedFlow, nodeRegistry, selected)

    expect(batch.baseline).toEqual(runSimulation(productViewedFlow, nodeRegistry))
    expect(batch.scenarios).toHaveLength(5)
    expect(batch.scenarios.map((entry) => entry.scenario.id)).toEqual(
      selected.map((scenario) => scenario.id),
    )
    for (const entry of batch.scenarios) {
      expect(entry.result.goalReport).toBeDefined()
      expect(entry.result.userImpact).toBeDefined()
      expect(entry.result.warnings).toBeDefined()
      expect(entry.result.explanation.recommendations).toBeDefined()
      expect(entry.result.bottlenecks).toBeDefined()
      expect(entry.comparisonToBaseline).toBeDefined()
    }
  })

  it("is reproducible and does not mutate graph or scenario inputs", () => {
    const graph = structuredClone(productViewedFlow)
    const selected = scenarios(3)
    const originalGraph = structuredClone(graph)
    const originalScenarios = structuredClone(selected)

    const first = runScenarioBatch(graph, nodeRegistry, selected)
    const second = runScenarioBatch(graph, nodeRegistry, selected)

    expect(second).toEqual(first)
    expect(graph).toEqual(originalGraph)
    expect(selected).toEqual(originalScenarios)
    expect(first.scenarios[0].result).not.toBe(first.scenarios[1].result)
  })
})
