import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { FailureScenarioForm, scenarioKindLabels } from "./FailureScenarioForm"

export function ScenarioPanel() {
  const graph = useFlowEditorStore((state) => state.graph)
  const activeScenarioId = useFlowEditorStore((state) => state.activeScenarioId)
  const setActiveScenario = useFlowEditorStore((state) => state.setActiveScenario)
  const upsertFailureScenario = useFlowEditorStore((state) => state.upsertFailureScenario)
  const removeFailureScenario = useFlowEditorStore((state) => state.removeFailureScenario)
  const [editingId, setEditingId] = useState<string | null>(null)
  const scenarios = graph.failureScenarios ?? []
  const editing = scenarios.find((scenario) => scenario.id === editingId)

  const create = () => {
    const scenario = {
      id: `scenario-${crypto.randomUUID()}`,
      name: "New failure scenario",
      kind: "dependency-unavailable" as const,
      affectedNodeIds: [],
      affectedBoundaryIds: [],
      startSeconds: 60,
      durationSeconds: 60,
      recoverySeconds: 30,
    }
    upsertFailureScenario(scenario)
    setEditingId(scenario.id)
  }

  return (
    <div className="scenario-panel">
      <p className="goal-hint">
        Scenarios state what goes wrong and what the team expects to happen. The active
        scenario is applied when the simulation runs.
      </p>
      <label className="contract-flag" htmlFor="scenario-none">
        <input
          id="scenario-none"
          type="radio"
          name="active-scenario"
          checked={activeScenarioId === null}
          onChange={() => setActiveScenario(null)}
        />
        Normal operation — no failure
      </label>
      {scenarios.map((scenario) => (
        <div className="scenario-row" key={scenario.id}>
          <label className="contract-flag">
            <input
              type="radio"
              name="active-scenario"
              checked={activeScenarioId === scenario.id}
              onChange={() => setActiveScenario(scenario.id)}
            />
            <span>
              <strong>{scenario.name}</strong>
              <small>{scenarioKindLabels[scenario.kind]}</small>
            </span>
          </label>
          <button
            type="button"
            className="contract-field-remove scenario-edit"
            aria-label={`Edit scenario ${scenario.name}`}
            onClick={() => setEditingId(editingId === scenario.id ? null : scenario.id)}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="contract-field-remove"
            aria-label={`Remove scenario ${scenario.name}`}
            onClick={() => {
              removeFailureScenario(scenario.id)
              if (editingId === scenario.id) setEditingId(null)
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {editing && (
        <FailureScenarioForm
          key={editing.id}
          scenario={editing}
          graph={graph}
          onSave={(scenario) => {
            upsertFailureScenario(scenario)
            setEditingId(null)
          }}
        />
      )}
      <Button variant="outline" onClick={create}>
        <Plus size={14} />
        Add scenario
      </Button>
    </div>
  )
}
