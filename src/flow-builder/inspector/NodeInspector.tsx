import { X } from "lucide-react"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { FlowInspectorPanel } from "./FlowInspectorPanel"
import { SelectedEdgeInspector } from "./SelectedEdgeInspector"
import { SelectedNodeInspector } from "./SelectedNodeInspector"

export function NodeInspector() {
  const graph = useFlowEditorStore((state) => state.graph)
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const selectedEdgeId = useFlowEditorStore((state) => state.selectedEdgeId)
  const setInspectorOpen = useFlowEditorStore((state) => state.setInspectorOpen)
  const node = graph.nodes.find((item) => item.id === selectedNodeId)
  const edge = graph.edges.find((item) => item.id === selectedEdgeId)
  const definition = node ? nodeRegistry.get(node.type) : undefined

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <h2>Inspector</h2>
        <button
          type="button"
          onClick={() => setInspectorOpen(false)}
          aria-label="Close inspector"
        >
          <X size={15} />
        </button>
      </div>
      {node && definition ? (
        <SelectedNodeInspector graph={graph} node={node} definition={definition} />
      ) : edge ? (
        <SelectedEdgeInspector graph={graph} edge={edge} />
      ) : (
        <FlowInspectorPanel graph={graph} />
      )}
    </aside>
  )
}
