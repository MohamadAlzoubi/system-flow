import { FilePlus2, Trash2, X } from "lucide-react"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import type {
  ArchitectureAssumption,
  AssumptionStatus,
  DecisionStatus,
} from "../../contracts"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { AssumptionForm } from "./AssumptionForm"
import { DecisionRecordForm } from "./DecisionRecordForm"

const decisionStatusLabels: Record<DecisionStatus, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  rejected: "Rejected",
  superseded: "Superseded",
}

const assumptionStatusLabels: Record<AssumptionStatus, string> = {
  unverified: "Unverified",
  verified: "Verified",
  invalid: "Invalid",
}

type Props = {
  onClose: () => void
}

export function DecisionsWorkspace({ onClose }: Props) {
  const graph = useFlowEditorStore((state) => state.graph)
  const upsertDecisionRecord = useFlowEditorStore((state) => state.upsertDecisionRecord)
  const removeDecisionRecord = useFlowEditorStore((state) => state.removeDecisionRecord)
  const upsertAssumption = useFlowEditorStore((state) => state.upsertAssumption)
  const removeAssumption = useFlowEditorStore((state) => state.removeAssumption)
  const [tab, setTab] = useState<"decisions" | "assumptions">("decisions")
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null)
  const [selectedAssumptionId, setSelectedAssumptionId] = useState<string | null>(null)

  const records = graph.decisionRecords ?? []
  const assumptions = graph.assumptions ?? []
  const selectedDecision = records.find((record) => record.id === selectedDecisionId)
  const selectedAssumption = assumptions.find(
    (assumption) => assumption.id === selectedAssumptionId,
  )

  const createDecision = () => {
    const id = `decision-${crypto.randomUUID()}`
    upsertDecisionRecord({
      id,
      title: "New decision",
      status: "proposed",
      context: "",
      decision: "",
      alternatives: [],
      consequences: [],
      assumptionIds: [],
      relatedNodeIds: [],
      relatedEdgeIds: [],
    })
    setSelectedDecisionId(id)
  }

  const createAssumption = () => {
    const assumption: ArchitectureAssumption = {
      id: `assumption-${crypto.randomUUID()}`,
      statement: "",
      status: "unverified",
      impact: "medium",
      relatedIds: [],
    }
    upsertAssumption(assumption)
    setSelectedAssumptionId(assumption.id)
  }

  return (
    <div className="analysis-backdrop">
      <section
        className="results analysis-modal contract-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="decisions-title"
      >
        <div className="results-head">
          <strong id="decisions-title">Decisions & assumptions</strong>
          <span>
            {records.length} decisions · {assumptions.length} assumptions
          </span>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close decisions workspace"
          >
            <X size={16} />
          </button>
        </div>
        <div className="decisions-tabs">
          <button
            type="button"
            className={tab === "decisions" ? "active" : ""}
            onClick={() => setTab("decisions")}
          >
            Decision records
          </button>
          <button
            type="button"
            className={tab === "assumptions" ? "active" : ""}
            onClick={() => setTab("assumptions")}
          >
            Assumptions
          </button>
        </div>
        {tab === "decisions" ? (
          <div className="contract-columns">
            <aside className="contract-list">
              <Button variant="outline" onClick={createDecision}>
                <FilePlus2 size={14} />
                New decision
              </Button>
              {records.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  className={record.id === selectedDecisionId ? "active" : ""}
                  onClick={() => setSelectedDecisionId(record.id)}
                >
                  <strong>{record.title}</strong>
                  <small>{decisionStatusLabels[record.status]}</small>
                </button>
              ))}
              {records.length === 0 && (
                <p className="goal-hint">
                  No decisions yet. Accepted review findings appear here, and you can
                  record your own.
                </p>
              )}
            </aside>
            {selectedDecision ? (
              <div className="contract-detail">
                <div className="contract-actions">
                  <Button
                    className="delete-action"
                    variant="outline"
                    onClick={() => {
                      removeDecisionRecord(selectedDecision.id)
                      setSelectedDecisionId(null)
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
                <DecisionRecordForm
                  key={selectedDecision.id}
                  record={selectedDecision}
                  assumptions={assumptions}
                  onSave={upsertDecisionRecord}
                />
              </div>
            ) : (
              <div className="empty">Select a decision to edit it.</div>
            )}
          </div>
        ) : (
          <div className="contract-columns">
            <aside className="contract-list">
              <Button variant="outline" onClick={createAssumption}>
                <FilePlus2 size={14} />
                New assumption
              </Button>
              {assumptions.map((assumption) => (
                <button
                  type="button"
                  key={assumption.id}
                  className={assumption.id === selectedAssumptionId ? "active" : ""}
                  onClick={() => setSelectedAssumptionId(assumption.id)}
                >
                  <strong>{assumption.statement || "Untitled assumption"}</strong>
                  <small>
                    {assumptionStatusLabels[assumption.status]} · {assumption.impact}{" "}
                    impact
                  </small>
                </button>
              ))}
              {assumptions.length === 0 && (
                <p className="goal-hint">
                  No assumptions yet. Record what the design depends on so it can be
                  verified before implementation.
                </p>
              )}
            </aside>
            {selectedAssumption ? (
              <div className="contract-detail">
                <div className="contract-actions">
                  <Button
                    className="delete-action"
                    variant="outline"
                    onClick={() => {
                      removeAssumption(selectedAssumption.id)
                      setSelectedAssumptionId(null)
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
                <AssumptionForm
                  key={selectedAssumption.id}
                  assumption={selectedAssumption}
                  onSave={upsertAssumption}
                />
              </div>
            ) : (
              <div className="empty">Select an assumption to edit it.</div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
