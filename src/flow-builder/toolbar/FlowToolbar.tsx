import {
  BarChart3,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileJson2,
  FilePlus2,
  FileText,
  GraduationCap,
  PanelRight,
  Play,
  Trash2,
  Workflow,
} from "lucide-react"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import { runSimulation, validateFlow } from "../../engine"
import {
  bottleneckFlow,
  chatMessageFlow,
  productViewedFlow,
  purchaseFlow,
} from "../../examples"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { BlueprintWorkspace } from "../blueprint/BlueprintWorkspace"
import { ContractWorkspace } from "../contracts/ContractWorkspace"
import { DecisionsWorkspace } from "../decisions/DecisionsWorkspace"
import { ReviewPanel } from "../review/ReviewPanel"
import { NewFlowDialog } from "./NewFlowDialog"

const examples = [productViewedFlow, purchaseFlow, chatMessageFlow, bottleneckFlow]

export function FlowToolbar() {
  const graph = useFlowEditorStore((state) => state.graph)
  const isDirty = useFlowEditorStore((state) => state.isDirty)
  const setGraph = useFlowEditorStore((state) => state.setGraph)
  const setIssues = useFlowEditorStore((state) => state.setValidationIssues)
  const setResult = useFlowEditorStore((state) => state.setSimulationResult)
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useFlowEditorStore((state) => state.selectedEdgeId)
  const removeNodes = useFlowEditorStore((state) => state.removeNodes)
  const removeEdges = useFlowEditorStore((state) => state.removeEdges)
  const isInspectorOpen = useFlowEditorStore((state) => state.isInspectorOpen)
  const setInspectorOpen = useFlowEditorStore((state) => state.setInspectorOpen)
  const setAnalysisOpen = useFlowEditorStore((state) => state.setAnalysisOpen)
  const [isNewFlowOpen, setNewFlowOpen] = useState(false)
  const [isContractsOpen, setContractsOpen] = useState(false)
  const [isReviewOpen, setReviewOpen] = useState(false)
  const [isDecisionsOpen, setDecisionsOpen] = useState(false)
  const [isBlueprintOpen, setBlueprintOpen] = useState(false)
  const activeScenarioId = useFlowEditorStore((state) => state.activeScenarioId)
  const activeScenario = graph.failureScenarios?.find(
    (scenario) => scenario.id === activeScenarioId,
  )

  const exportFlow = () => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${graph.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <header>
      <div className="brand">
        <Workflow size={21} />
        <strong>System Flow</strong>
        <span className="flow-name" title={graph.name}>
          {graph.name}
        </span>
        <select
          aria-label="Load an example flow"
          title="Load an example flow (replaces the current canvas)"
          value=""
          onChange={(event) => {
            const example = examples.find((item) => item.id === event.target.value)
            if (example) setGraph(structuredClone(example))
          }}
        >
          <option value="" disabled>
            Examples…
          </option>
          {examples.map((example) => (
            <option value={example.id} key={example.id}>
              {example.name}
            </option>
          ))}
        </select>
        {isDirty && <span className="dirty">Saved locally</span>}
      </div>
      <div className="actions">
        <Button
          variant="outline"
          onClick={() => setNewFlowOpen(true)}
          title="Create a new flow from design goals"
        >
          <FilePlus2 size={16} />
          New flow
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = "/education"
          }}
          title="Open the education guide"
        >
          <GraduationCap size={16} />
          Learn
        </Button>
        <Button
          variant="outline"
          onClick={() => setContractsOpen(true)}
          title="Open the data contract workspace"
        >
          <FileJson2 size={16} />
          Contracts
        </Button>
        <Button
          variant="outline"
          onClick={() => setReviewOpen(true)}
          title="Run the architecture review"
        >
          <ClipboardCheck size={16} />
          Review
        </Button>
        <Button
          variant="outline"
          onClick={() => setDecisionsOpen(true)}
          title="Open decisions and assumptions"
        >
          <BookMarked size={16} />
          Decisions
        </Button>
        <Button
          variant="outline"
          onClick={() => setBlueprintOpen(true)}
          title="Generate the implementation blueprint"
        >
          <FileText size={16} />
          Blueprint
        </Button>
        <Button
          variant="outline"
          onClick={() => setInspectorOpen(!isInspectorOpen)}
          title={isInspectorOpen ? "Close inspector" : "Open inspector"}
        >
          <PanelRight size={16} />
          Inspector
        </Button>
        <Button
          variant="outline"
          onClick={() => setAnalysisOpen(true)}
          title="Open simulation analysis"
        >
          <BarChart3 size={16} />
          Analysis
        </Button>
        <Button
          className="delete-action"
          variant="outline"
          disabled={!selectedNodeId && !selectedEdgeId}
          onClick={() => {
            if (selectedNodeId) removeNodes([selectedNodeId])
            if (selectedEdgeId) removeEdges([selectedEdgeId])
          }}
          title="Delete selected node or connection"
        >
          <Trash2 size={16} />
          Delete
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setIssues(validateFlow(graph, nodeRegistry))
            setResult(null)
          }}
        >
          <CheckCircle2 size={16} />
          Validate
        </Button>
        <Button variant="outline" onClick={exportFlow} title="Export flow">
          <Download size={16} />
          Export
        </Button>
        <Button
          onClick={() => {
            const result = runSimulation(graph, nodeRegistry, activeScenario)
            setIssues(result.warnings)
            setResult(result)
            setAnalysisOpen(true)
          }}
          title={
            activeScenario
              ? `Run with failure scenario: ${activeScenario.name}`
              : "Run simulation"
          }
        >
          <Play size={16} />
          {activeScenario ? "Run scenario" : "Run simulation"}
        </Button>
      </div>
      {isNewFlowOpen && <NewFlowDialog onClose={() => setNewFlowOpen(false)} />}
      {isContractsOpen && <ContractWorkspace onClose={() => setContractsOpen(false)} />}
      {isReviewOpen && <ReviewPanel onClose={() => setReviewOpen(false)} />}
      {isDecisionsOpen && <DecisionsWorkspace onClose={() => setDecisionsOpen(false)} />}
      {isBlueprintOpen && <BlueprintWorkspace onClose={() => setBlueprintOpen(false)} />}
    </header>
  )
}
