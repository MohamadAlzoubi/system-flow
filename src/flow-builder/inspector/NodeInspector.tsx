import { Box } from "lucide-react"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { ConfigForm } from "./ConfigForm"

export function NodeInspector() {
  const graph = useFlowEditorStore((state) => state.graph)
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const updateNodeConfig = useFlowEditorStore((state) => state.updateNodeConfig)
  const node = graph.nodes.find((item) => item.id === selectedNodeId)
  const definition = node ? nodeRegistry.get(node.type) : undefined

  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      {node && definition ? (
        <>
          <div className="inspector-title">
            <Box size={17} />
            <div>
              <strong>{definition.label}</strong>
              <small>{node.id}</small>
            </div>
          </div>
          <ConfigForm
            key={node.id}
            node={node}
            definition={definition}
            onSave={(config) => updateNodeConfig(node.id, config)}
          />
        </>
      ) : (
        <div className="empty">Select a node to edit its configuration.</div>
      )}
    </aside>
  )
}
