import type { FlowGraph, ScenarioBatchResult } from "../../contracts"

export type ScenarioLabExport = {
  schemaVersion: "system-flow.scenario-lab.v1"
  exportedAt: string
  graph: {
    id: string
    name: string
    simulationProfile: FlowGraph["simulationProfile"]
    architectureGoals: FlowGraph["architectureGoals"]
  }
  batch: ScenarioBatchResult
}

export function buildScenarioLabExport({
  graph,
  batch,
  exportedAt = new Date().toISOString(),
}: {
  graph: FlowGraph
  batch: ScenarioBatchResult
  exportedAt?: string
}): ScenarioLabExport {
  return {
    schemaVersion: "system-flow.scenario-lab.v1",
    exportedAt,
    graph: {
      id: graph.id,
      name: graph.name,
      simulationProfile: graph.simulationProfile,
      architectureGoals: graph.architectureGoals,
    },
    batch,
  }
}
