import { FilePlus2, MapPinned, Trash2, X, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import type { ArchitectureBoundary, NodeInstance } from "../../contracts"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { RegionEditorForm } from "./RegionEditorForm"
import {
  defaultRegionCanvasLayout,
  nextPositionInRegion,
  regionCanvasLayout,
} from "./region-layout"

function regionCode(region: ArchitectureBoundary): string {
  return region.regionCode?.trim() || region.id
}

function newRegion(existing: ArchitectureBoundary[]): ArchitectureBoundary {
  const regionCount = existing.filter((boundary) => boundary.kind === "region").length
  let index = regionCount + 1
  let code = `region-${index}`
  const usedCodes = new Set(
    existing.map((boundary) => boundary.regionCode ?? boundary.id),
  )
  while (usedCodes.has(code)) {
    index += 1
    code = `region-${index}`
  }
  return {
    id: `region-${crypto.randomUUID()}`,
    label: `Region ${index}`,
    kind: "region",
    regionCode: code,
    canvasLayout: defaultRegionCanvasLayout(regionCount),
  }
}

type Props = {
  onClose: () => void
}

export function RegionsWorkspace({ onClose }: Props) {
  const graph = useFlowEditorStore((state) => state.graph)
  const upsertBoundary = useFlowEditorStore((state) => state.upsertBoundary)
  const removeBoundary = useFlowEditorStore((state) => state.removeBoundary)
  const assignNodeToRegion = useFlowEditorStore((state) => state.assignNodeToRegion)
  const setNodePosition = useFlowEditorStore((state) => state.setNodePosition)
  const upsertFailureScenario = useFlowEditorStore((state) => state.upsertFailureScenario)
  const setActiveScenario = useFlowEditorStore((state) => state.setActiveScenario)
  const regions = (graph.boundaries ?? []).filter(
    (boundary) => boundary.kind === "region",
  )
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    regions[0]?.id ?? null,
  )
  const selectedRegion =
    regions.find((region) => region.id === selectedRegionId) ?? regions[0]
  const regionMembers = selectedRegion
    ? graph.nodes.filter((node) => node.boundaryId === selectedRegion.id)
    : []
  const parentOptions = (graph.boundaries ?? []).filter(
    (boundary) => boundary.id !== selectedRegion?.id && boundary.kind !== "region",
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const createRegion = () => {
    const region = newRegion(graph.boundaries ?? [])
    upsertBoundary(region)
    setSelectedRegionId(region.id)
  }

  const assignNode = (node: NodeInstance, checked: boolean) => {
    if (!selectedRegion) return
    if (checked) {
      if (node.boundaryId !== selectedRegion.id) {
        const regionIndex = regions.findIndex((region) => region.id === selectedRegion.id)
        const layout = regionCanvasLayout(selectedRegion, regionIndex, regionMembers)
        setNodePosition(node.id, nextPositionInRegion(layout, regionMembers.length))
      }
      assignNodeToRegion(node.id, selectedRegion.id)
      return
    }
    if (node.boundaryId !== selectedRegion.id) return
    assignNodeToRegion(node.id, undefined)
  }

  const createOutageScenario = () => {
    if (!selectedRegion) return
    const scenario = {
      id: `scenario-${selectedRegion.id}-unavailable-${crypto.randomUUID()}`,
      name: `${selectedRegion.label} unavailable`,
      kind: "region-unavailable" as const,
      affectedNodeIds: [],
      affectedBoundaryIds: [selectedRegion.id],
      startSeconds: 60,
      durationSeconds: 120,
      recoverySeconds: 60,
      expectedResponse: "Traffic stops using the unavailable region.",
      expectedUserImpact:
        "Requests assigned to this region fail or move to configured failover paths.",
      recoveryBehavior: "Region capacity returns after the recovery window.",
    }
    upsertFailureScenario(scenario)
    setActiveScenario(scenario.id)
  }

  return (
    <div className="analysis-backdrop">
      <section
        className="results analysis-modal contract-workspace regions-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="regions-workspace-title"
      >
        <div className="results-head">
          <MapPinned size={16} />
          <strong id="regions-workspace-title">Regions</strong>
          <span>{regions.length} regions</span>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close regions workspace"
          >
            <X size={16} />
          </button>
        </div>
        <div className="contract-columns">
          <aside className="contract-list">
            <Button variant="outline" onClick={createRegion}>
              <FilePlus2 size={14} />
              New region
            </Button>
            {regions.map((region) => {
              const memberCount = graph.nodes.filter(
                (node) => node.boundaryId === region.id,
              ).length
              return (
                <button
                  type="button"
                  key={region.id}
                  className={region.id === selectedRegion?.id ? "active" : ""}
                  onClick={() => setSelectedRegionId(region.id)}
                >
                  <strong>{region.label}</strong>
                  <small>
                    {regionCode(region)} · {memberCount} nodes
                  </small>
                </button>
              )
            })}
            {regions.length === 0 && (
              <p className="goal-hint">
                Create regions first, then assign nodes into them from this workspace.
              </p>
            )}
          </aside>
          {selectedRegion ? (
            <div className="contract-detail">
              <RegionEditorForm
                key={selectedRegion.id}
                region={selectedRegion}
                parentOptions={parentOptions}
                onSave={upsertBoundary}
              />
              <div className="contract-actions">
                <Button variant="outline" onClick={createOutageScenario}>
                  <Zap size={14} />
                  Add shutdown scenario
                </Button>
                <Button
                  className="delete-action"
                  variant="outline"
                  onClick={() => {
                    if (
                      regionMembers.length === 0 ||
                      window.confirm(
                        `Remove ${selectedRegion.label} and clear it from ${regionMembers.length} nodes?`,
                      )
                    ) {
                      removeBoundary(selectedRegion.id)
                      setSelectedRegionId(null)
                    }
                  }}
                >
                  <Trash2 size={14} />
                  Delete region
                </Button>
              </div>
              <fieldset className="ownership-set region-node-list">
                <legend>Nodes in this region</legend>
                {graph.nodes.map((node) => {
                  const definition = nodeRegistry.get(node.type)
                  return (
                    <label className="contract-flag" key={node.id}>
                      <input
                        type="checkbox"
                        checked={node.boundaryId === selectedRegion.id}
                        onChange={(event) => assignNode(node, event.target.checked)}
                      />
                      <span>
                        <strong>{node.id}</strong>
                        <small>
                          {definition?.label ?? node.type}
                          {node.responsibility?.deploymentRegion
                            ? ` · ${node.responsibility.deploymentRegion}`
                            : ""}
                        </small>
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            </div>
          ) : (
            <p className="goal-hint">
              Regions group nodes for deployment placement and region-unavailable
              simulations.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
