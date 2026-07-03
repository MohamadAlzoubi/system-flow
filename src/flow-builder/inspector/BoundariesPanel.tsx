import { Plus, Trash2 } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { BoundaryKind } from "../../contracts"
import { useFlowEditorStore } from "../../store/flow-editor.store"

const kinds: BoundaryKind[] = [
  "system",
  "service",
  "team",
  "region",
  "availability-zone",
  "trust-zone",
]

export function BoundariesPanel() {
  const graph = useFlowEditorStore((state) => state.graph)
  const upsertBoundary = useFlowEditorStore((state) => state.upsertBoundary)
  const removeBoundary = useFlowEditorStore((state) => state.removeBoundary)
  const boundaries = graph.boundaries ?? []
  const membersOf = (id: string) =>
    graph.nodes.filter((node) => node.boundaryId === id).length

  return (
    <div className="boundaries-panel">
      <p className="goal-hint">
        Boundaries are architectural metadata — systems, services, teams, regions, and
        trust zones — not drawing containers. Assign nodes from their inspector.
      </p>
      {boundaries.map((boundary) => (
        <div className="boundary-row" key={boundary.id}>
          <Input
            aria-label="Boundary label"
            defaultValue={boundary.label}
            onBlur={(event) => {
              const label = event.target.value.trim()
              if (label && label !== boundary.label) {
                upsertBoundary({ ...boundary, label })
              }
            }}
          />
          <select
            aria-label="Boundary kind"
            value={boundary.kind}
            onChange={(event) =>
              upsertBoundary({ ...boundary, kind: event.target.value as BoundaryKind })
            }
          >
            {kinds.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
          <Input
            aria-label="Boundary owner"
            placeholder="Owner"
            defaultValue={boundary.owner ?? ""}
            onBlur={(event) => {
              const owner = event.target.value.trim() || undefined
              if (owner !== boundary.owner) upsertBoundary({ ...boundary, owner })
            }}
          />
          <select
            aria-label="Parent boundary"
            value={boundary.parentId ?? ""}
            onChange={(event) =>
              upsertBoundary({ ...boundary, parentId: event.target.value || undefined })
            }
          >
            <option value="">No parent</option>
            {boundaries
              .filter((candidate) => candidate.id !== boundary.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
          </select>
          <small>{membersOf(boundary.id)} nodes</small>
          <button
            type="button"
            className="contract-field-remove"
            aria-label={`Remove boundary ${boundary.label}`}
            onClick={() => removeBoundary(boundary.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          upsertBoundary({
            id: `boundary-${crypto.randomUUID()}`,
            label: "New boundary",
            kind: "service",
          })
        }
      >
        <Plus size={14} />
        Add boundary
      </Button>
    </div>
  )
}
