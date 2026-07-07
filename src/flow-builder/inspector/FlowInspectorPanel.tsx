import { AlertTriangle, Boxes, Gauge, Target } from "lucide-react"
import type { FlowGraph } from "../../contracts"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { ArchitectureGoalsForm } from "./ArchitectureGoalsForm"
import { BoundariesPanel } from "./BoundariesPanel"
import { InspectorSection } from "./InspectorSection"
import { ScenarioPanel } from "./ScenarioPanel"
import { SimulationProfileForm } from "./SimulationProfileForm"

export function FlowInspectorPanel({ graph }: { graph: FlowGraph }) {
  const updateSimulationProfile = useFlowEditorStore(
    (state) => state.updateSimulationProfile,
  )
  const updateArchitectureGoals = useFlowEditorStore(
    (state) => state.updateArchitectureGoals,
  )

  return (
    <>
      <div className="empty">
        Build freely: drag nodes from the library, connect them, then select any node or
        edge to tune it. The sections below apply to the whole flow.
      </div>
      <InspectorSection title="Design goals" icon={Target} defaultOpen>
        <ArchitectureGoalsForm
          key={graph.id}
          goals={graph.architectureGoals}
          onSave={updateArchitectureGoals}
        />
      </InspectorSection>
      <InspectorSection title="Simulation scenario" icon={Gauge}>
        <SimulationProfileForm
          profile={graph.simulationProfile}
          onSave={updateSimulationProfile}
        />
      </InspectorSection>
      <InspectorSection title="Failure scenarios" icon={AlertTriangle}>
        <ScenarioPanel />
      </InspectorSection>
      <InspectorSection title="Boundaries" icon={Boxes}>
        <BoundariesPanel />
      </InspectorSection>
    </>
  )
}
