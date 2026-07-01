import { CheckCircle2, Download, Play, Trash2, Workflow } from "lucide-react"
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
        {isDirty && <span className="dirty">Unsaved</span>}
      </div>
      <div className="actions">
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
          }}
        >
          <Play size={16} />
          Run simulation
        </Button>
      </div>
    </header>
  )
}
