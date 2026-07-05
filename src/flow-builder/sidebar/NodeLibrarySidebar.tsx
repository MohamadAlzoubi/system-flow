import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { nodeDefinitions } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { nodeDragMimeType } from "../dnd"
import { fallbackNodeIcon, nodeTypeIcons } from "../node-icons"

export function NodeLibrarySidebar() {
  const addNode = useFlowEditorStore((state) => state.addNode)
  const [query, setQuery] = useState("")

  const groupedNodes = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? nodeDefinitions.filter((definition) =>
          `${definition.label} ${definition.category} ${definition.type}`
            .toLowerCase()
            .includes(needle),
        )
      : nodeDefinitions
    return matches.reduce(
      (groups, definition) => {
        groups[definition.category] = [...(groups[definition.category] ?? []), definition]
        return groups
      },
      {} as Record<string, typeof nodeDefinitions>,
    )
  }, [query])
  const categories = Object.entries(groupedNodes)

  return (
    <aside className="palette">
      <h2>Node library</h2>
      <label className="palette-search">
        <Search size={13} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search nodes…"
          aria-label="Search nodes"
        />
      </label>
      <p className="palette-hint">Drag onto the canvas, or click to add.</p>
      {categories.map(([category, definitions]) => (
        <section key={category}>
          <h3>{category}</h3>
          {definitions.map((definition) => {
            const Icon = nodeTypeIcons[definition.type] ?? fallbackNodeIcon
            return (
              <button
                className={`palette-item node-${definition.type.replaceAll(".", "-")}`}
                key={definition.type}
                onClick={() => addNode(definition.type)}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(nodeDragMimeType, definition.type)
                  event.dataTransfer.effectAllowed = "move"
                }}
              >
                <Icon className="node-library-icon" size={15} />
                <span>{definition.label}</span>
              </button>
            )
          })}
        </section>
      ))}
      {categories.length === 0 && (
        <p className="palette-empty">No nodes match “{query}”.</p>
      )}
    </aside>
  )
}
