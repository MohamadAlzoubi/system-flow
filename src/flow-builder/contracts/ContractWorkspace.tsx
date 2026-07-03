import { Copy, FilePlus2, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../../components/ui/button"
import type { DataContract } from "../../contracts"
import { resolveEdgeContract } from "../../engine"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { ContractEditorForm } from "./ContractEditorForm"

const identityOf = (contract: Pick<DataContract, "name" | "version">) =>
  `${contract.name}@${contract.version}`

function newContract(existing: DataContract[]): DataContract {
  let name = "NewContract"
  let counter = 2
  while (existing.some((contract) => contract.name === name)) {
    name = `NewContract${counter}`
    counter += 1
  }
  return {
    name,
    version: "1.0",
    kind: "event",
    description: "",
    fields: [{ name: "id", type: "string", required: true }],
    estimatedSizeBytes: 512,
    compatibility: "backward",
  }
}

type Props = {
  onClose: () => void
}

export function ContractWorkspace({ onClose }: Props) {
  const graph = useFlowEditorStore((state) => state.graph)
  const upsertDataContract = useFlowEditorStore((state) => state.upsertDataContract)
  const removeDataContract = useFlowEditorStore((state) => state.removeDataContract)
  const duplicateDataContract = useFlowEditorStore((state) => state.duplicateDataContract)
  const setSelectedEdge = useFlowEditorStore((state) => state.setSelectedEdge)
  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(
    graph.dataContracts[0] ? identityOf(graph.dataContracts[0]) : null,
  )

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const selected = graph.dataContracts.find(
    (contract) => identityOf(contract) === selectedIdentity,
  )
  const usages = selected
    ? graph.edges.filter(
        (edge) =>
          resolveEdgeContract(graph.dataContracts, edge) === selected ||
          edge.responseDataType === selected.name,
      )
    : []

  const create = () => {
    const contract = newContract(graph.dataContracts)
    upsertDataContract(contract)
    setSelectedIdentity(identityOf(contract))
  }

  return (
    <div className="analysis-backdrop">
      <section
        className="results analysis-modal contract-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-workspace-title"
      >
        <div className="results-head">
          <strong id="contract-workspace-title">Data contracts</strong>
          <span>{graph.dataContracts.length} contracts</span>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close contract workspace"
          >
            <X size={16} />
          </button>
        </div>
        <div className="contract-columns">
          <aside className="contract-list">
            <Button variant="outline" onClick={create}>
              <FilePlus2 size={14} />
              New contract
            </Button>
            {graph.dataContracts.map((contract) => (
              <button
                type="button"
                key={identityOf(contract)}
                className={identityOf(contract) === selectedIdentity ? "active" : ""}
                onClick={() => setSelectedIdentity(identityOf(contract))}
              >
                <strong>{contract.name}</strong>
                <small>
                  v{contract.version} · {contract.kind}
                </small>
              </button>
            ))}
            {graph.dataContracts.length === 0 && (
              <p className="goal-hint">
                No contracts yet. Define what moves through the system before choosing how
                it is transported or stored.
              </p>
            )}
          </aside>
          {selected ? (
            <div className="contract-detail">
              <div className="contract-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    duplicateDataContract(selected.name, selected.version)
                  }}
                  title="Copy this contract into a new version"
                >
                  <Copy size={14} />
                  New version
                </Button>
                <Button
                  className="delete-action"
                  variant="outline"
                  disabled={usages.length > 0}
                  title={
                    usages.length > 0
                      ? "In use by edges; repoint them first"
                      : "Delete this contract"
                  }
                  onClick={() => {
                    removeDataContract(selected.name, selected.version)
                    setSelectedIdentity(null)
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </Button>
              </div>
              {usages.length > 0 ? (
                <div className="contract-usages">
                  <strong>Producers and consumers</strong>
                  {usages.map((edge) => (
                    <button
                      type="button"
                      key={edge.id}
                      onClick={() => {
                        setSelectedEdge(edge.id)
                        onClose()
                      }}
                      title="Open this edge in the inspector"
                    >
                      {edge.fromNodeId} → {edge.toNodeId}
                      <small>
                        {edge.responseDataType === selected.name
                          ? "as response"
                          : (edge.dataTypeVersion ?? "latest")}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="goal-hint">
                  No edge carries this contract yet. Connect components or pick it on an
                  existing edge.
                </p>
              )}
              <ContractEditorForm
                key={identityOf(selected)}
                contract={selected}
                onSave={(contract) => {
                  upsertDataContract(contract, {
                    name: selected.name,
                    version: selected.version,
                  })
                  setSelectedIdentity(identityOf(contract))
                }}
              />
            </div>
          ) : (
            <div className="empty">Select a contract to edit it.</div>
          )}
        </div>
      </section>
    </div>
  )
}
