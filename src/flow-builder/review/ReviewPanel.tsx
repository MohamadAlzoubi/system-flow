import { X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { ArchitectureRule, RuleCategory } from "../../contracts"
import { evaluateRules, findAcceptance, findingKey } from "../../engine"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"

const categoryLabels: Record<RuleCategory, string> = {
  contracts: "Contracts",
  reliability: "Reliability",
  performance: "Performance",
  state: "State & data",
  security: "Security",
  operability: "Operability",
}

const severityLabels = {
  error: "Error",
  warning: "Warning",
  question: "Question",
} as const

type Props = {
  onClose: () => void
}

export function ReviewPanel({ onClose }: Props) {
  const graph = useFlowEditorStore((state) => state.graph)
  const setSelectedNode = useFlowEditorStore((state) => state.setSelectedNode)
  const setSelectedEdge = useFlowEditorStore((state) => state.setSelectedEdge)
  const acceptRuleFinding = useFlowEditorStore((state) => state.acceptRuleFinding)
  const revokeRuleAcceptance = useFlowEditorStore((state) => state.revokeRuleAcceptance)
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [reviewDate, setReviewDate] = useState("")

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const findings = useMemo(() => evaluateRules(graph, nodeRegistry), [graph])
  const open = findings.filter(
    (finding) => !findAcceptance(finding, graph.ruleAcceptances),
  )
  const accepted = findings.filter(
    (finding) => findAcceptance(finding, graph.ruleAcceptances) !== undefined,
  )
  const categories = [...new Set(open.map((finding) => finding.category))]

  const jumpTo = (id: string) => {
    if (graph.nodes.some((node) => node.id === id)) {
      setSelectedNode(id)
      onClose()
    } else if (graph.edges.some((edge) => edge.id === id)) {
      setSelectedEdge(id)
      onClose()
    }
  }

  const renderFinding = (finding: ArchitectureRule) => {
    const key = `${finding.code}:${findingKey(finding)}`
    return (
      <div className={`review-finding review-${finding.severity}`} key={key}>
        <div className="review-finding-head">
          <b>{severityLabels[finding.severity]}</b>
          <span>{finding.message}</span>
        </div>
        <p>{finding.rationale}</p>
        <ul>
          {finding.suggestedActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
        {finding.affectedIds.length > 0 && (
          <div className="review-affected">
            {finding.affectedIds.map((id) => (
              <button type="button" key={id} onClick={() => jumpTo(id)}>
                {id}
              </button>
            ))}
          </div>
        )}
        {acceptingKey === key ? (
          <div className="review-accept-form">
            <Input
              aria-label="Acceptance reason"
              placeholder="Why this risk is acceptable"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Input
              aria-label="Review date"
              type="date"
              value={reviewDate}
              onChange={(event) => setReviewDate(event.target.value)}
            />
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                const relatedNodeIds = finding.affectedIds.filter((id) =>
                  graph.nodes.some((node) => node.id === id),
                )
                const relatedEdgeIds = finding.affectedIds.filter((id) =>
                  graph.edges.some((edge) => edge.id === id),
                )
                acceptRuleFinding(
                  {
                    ruleCode: finding.code,
                    targetKey: findingKey(finding),
                    reason: reason.trim(),
                    reviewDate: reviewDate || undefined,
                  },
                  {
                    id: "",
                    title: `Accepted: ${finding.message}`,
                    status: "accepted",
                    context: finding.rationale,
                    decision: reason.trim(),
                    alternatives: finding.suggestedActions,
                    consequences: [],
                    assumptionIds: [],
                    relatedNodeIds,
                    relatedEdgeIds,
                    reviewDate: reviewDate || undefined,
                  },
                )
                setAcceptingKey(null)
              }}
            >
              Accept risk
            </Button>
            <Button variant="ghost" onClick={() => setAcceptingKey(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setAcceptingKey(key)
              setReason("")
              setReviewDate("")
            }}
          >
            Accept with reason
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="analysis-backdrop">
      <section
        className="results analysis-modal review-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <div className="results-head">
          <strong id="review-title">Architecture review</strong>
          <span>
            {open.length} open · {accepted.length} accepted
          </span>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close review"
          >
            <X size={16} />
          </button>
        </div>
        {open.length === 0 && (
          <p className="goal-hint">
            No open findings. The review covers interactions, reliability, messaging,
            data, security, and operability.
          </p>
        )}
        {categories.map((category) => (
          <div className="review-category" key={category}>
            <h3>{categoryLabels[category]}</h3>
            {open.filter((finding) => finding.category === category).map(renderFinding)}
          </div>
        ))}
        {accepted.length > 0 && (
          <div className="review-category review-accepted-list">
            <h3>Accepted risks</h3>
            {accepted.map((finding) => {
              const acceptance = findAcceptance(finding, graph.ruleAcceptances)
              return (
                <div
                  className="review-finding review-accepted"
                  key={finding.code + findingKey(finding)}
                >
                  <div className="review-finding-head">
                    <b>Accepted</b>
                    <span>{finding.message}</span>
                  </div>
                  <p>
                    {acceptance?.reason}
                    {acceptance?.reviewDate
                      ? ` — review by ${acceptance.reviewDate}`
                      : ""}
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      revokeRuleAcceptance(finding.code, findingKey(finding))
                    }
                  >
                    Reopen
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
