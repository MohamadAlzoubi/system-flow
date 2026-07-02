import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { ArchitectureGoals, FlowGraph } from "../../contracts"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { architectureGoalPresets } from "../inspector/architecture-goal-presets"

const openQuestionsGoals: ArchitectureGoals = { orderingRequirement: "none" }

function createFlow(name: string, goals: ArchitectureGoals): FlowGraph {
  return {
    id: `flow-${crypto.randomUUID()}`,
    name,
    nodes: [],
    edges: [],
    dataContracts: [],
    simulationProfile: {
      durationSeconds: 300,
      cpuCores: 8,
      memoryMb: 16000,
      networkLatencyMs: 5,
      requestsPerSecond: goals.averageTrafficPerSecond ?? 100,
      trafficPattern: "steady",
      peakRequestsPerSecond: goals.peakTrafficPerSecond,
    },
    architectureGoals: goals,
  }
}

type Props = {
  onClose: () => void
}

export function NewFlowDialog({ onClose }: Props) {
  const setGraph = useFlowEditorStore((state) => state.setGraph)
  const [name, setName] = useState("Untitled flow")
  const [presetId, setPresetId] = useState(architectureGoalPresets[0].id)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const create = () => {
    const preset = architectureGoalPresets.find((item) => item.id === presetId)
    setGraph(
      createFlow(name.trim() || "Untitled flow", preset?.goals ?? openQuestionsGoals),
    )
    onClose()
  }

  return (
    <div className="analysis-backdrop">
      <section
        className="new-flow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-flow-title"
      >
        <div className="results-head">
          <strong id="new-flow-title">New flow</strong>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close new flow dialog"
          >
            <X size={16} />
          </button>
        </div>
        <label htmlFor="new-flow-name">
          Flow name
          <Input
            id="new-flow-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset className="goal-preset-options">
          <legend>Design goals</legend>
          <p className="goal-hint">
            Pick the kind of flow you are designing. Every goal can be adjusted in the
            inspector, and goals you leave unknown stay visible as open questions.
          </p>
          {architectureGoalPresets.map((preset) => (
            <label key={preset.id}>
              <input
                type="radio"
                name="goal-preset"
                value={preset.id}
                checked={presetId === preset.id}
                onChange={() => setPresetId(preset.id)}
              />
              <span>
                <strong>{preset.label}</strong>
                <small>{preset.description}</small>
              </span>
            </label>
          ))}
          <label>
            <input
              type="radio"
              name="goal-preset"
              value="open-questions"
              checked={presetId === "open-questions"}
              onChange={() => setPresetId("open-questions")}
            />
            <span>
              <strong>I don't know yet</strong>
              <small>Record every goal as an open question to answer later.</small>
            </span>
          </label>
        </fieldset>
        <Button className="inspector-save" type="button" onClick={create}>
          Create flow
        </Button>
      </section>
    </div>
  )
}
