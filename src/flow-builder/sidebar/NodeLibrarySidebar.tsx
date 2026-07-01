import { Box } from "lucide-react"
import { nodeDefinitions } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"

const groupedNodes = nodeDefinitions.reduce(
  (groups, definition) => {
    groups[definition.category] = [...(groups[definition.category] ?? []), definition]
    return groups
  },
  {} as Record<string, typeof nodeDefinitions>,
)

export function NodeLibrarySidebar() {
  const addNode = useFlowEditorStore((state) => state.addNode)

  return (
    <aside className="palette">
      <h2>Node library</h2>
      {Object.entries(groupedNodes).map(([category, definitions]) => (
        <section key={category}>
          <h3>{category}</h3>
          {definitions.map((definition) => (
            <button
              className={`palette-item node-${definition.type.replaceAll(".", "-")}`}
              key={definition.type}
              onClick={() => addNode(definition.type)}
              type="button"
            >
              <Box className="node-library-icon" size={15} />
              <span>{definition.label}</span>
            </button>
          ))}
        </section>
      ))}
    </aside>
  )
}
