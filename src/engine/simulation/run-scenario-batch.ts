import type {
  FailureScenario,
  FlowGraph,
  NodeDefinition,
  ScenarioBatchResult,
} from "../../contracts"
import { compareSimulations } from "./compare-simulations"
import { runSimulation } from "./run-simulation"

/**
 * Runs a normal-operation baseline followed by each supplied scenario.
 * Every run receives an independent graph and scenario clone so simulation
 * definitions cannot leak mutations into later results.
 */
export function runScenarioBatch(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
  scenarios: readonly FailureScenario[],
): ScenarioBatchResult {
  const baseline = runSimulation(structuredClone(graph), registry)
  return {
    graphId: graph.id,
    graphName: graph.name,
    baseline,
    scenarios: scenarios.map((scenario) => {
      const result = runSimulation(
        structuredClone(graph),
        registry,
        structuredClone(scenario),
      )
      return {
        scenario: structuredClone(scenario),
        result,
        comparisonToBaseline: compareSimulations(baseline, result),
      }
    }),
  }
}
