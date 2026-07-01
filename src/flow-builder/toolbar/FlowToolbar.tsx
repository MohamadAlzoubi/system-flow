import {
  BarChart3,
  CheckCircle2,
  Download,
  GraduationCap,
  PanelRight,
  Play,
  Trash2,
  Workflow,
} from "lucide-react"
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
        <select
          aria-label="Example flow"
          value={graph.id}
          onChange={(event) => {
            const example = examples.find((item) => item.id === event.target.value)
            if (example) setGraph(structuredClone(example))
          }}
        >
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
            const result = runSimulation(graph, nodeRegistry)
            setIssues(result.warnings)
            setResult(result)
            setAnalysisOpen(true)
          }}
        >
          <Play size={16} />
          Run simulation
        </Button>
      </div>
    </header>
  )
}
