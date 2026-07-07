import { CheckCheck, Download, FlaskConical, Play, Square, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { MetricDelta, ScenarioBatchResult, SimulationResult } from "../../contracts"
import { runScenarioBatch } from "../../engine"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { buildScenarioLabExport } from "./scenario-lab-export"

type Props = {
  onClose: () => void
}

function droppedEvents(result: SimulationResult): number {
  return result.nodeMetrics.reduce((sum, metric) => sum + metric.droppedEvents, 0)
}

function userImpactEvents(result: SimulationResult): number {
  return result.userImpact.reduce((sum, entry) => sum + entry.events, 0)
}

function deltaClass(delta: MetricDelta | undefined): string {
  if (!delta || delta.absolute === 0) return "neutral"
  return delta.improved ? "improved" : "regressed"
}

function deltaTitle(delta: MetricDelta | undefined): string | undefined {
  if (!delta) return undefined
  const sign = delta.absolute > 0 ? "+" : ""
  const percentage =
    delta.percentage === undefined ? "" : ` (${sign}${delta.percentage.toFixed(1)}%)`
  return `${sign}${Number(delta.absolute.toFixed(2)).toLocaleString()} from baseline${percentage}`
}

function goalSummary(result: SimulationResult): string {
  const report = result.goalReport
  if (!report) return "No goals configured"
  return `${report.passed} pass · ${report.failed} fail · ${report.notEvaluated} open`
}

function bottleneckSummary(result: SimulationResult): string {
  if (result.bottlenecks.length === 0) return "None"
  return [
    ...new Set(
      result.bottlenecks.map((issue) => issue.nodeId ?? issue.edgeId ?? issue.code),
    ),
  ].join(", ")
}

export function ScenarioLab({ onClose }: Props) {
  const graph = useFlowEditorStore((state) => state.graph)
  const scenarios = graph.failureScenarios ?? []
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(scenarios.map((scenario) => scenario.id)),
  )
  const [batch, setBatch] = useState<ScenarioBatchResult | null>(null)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const toggleScenario = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setBatch(null)
  }

  const runSelected = () => {
    const selected = scenarios.filter((scenario) => selectedIds.has(scenario.id))
    setBatch(runScenarioBatch(graph, nodeRegistry, selected))
  }

  const exportBatch = () => {
    if (!batch) return
    const payload = buildScenarioLabExport({ graph, batch })
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${graph.id}-scenario-lab.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const baselineImpact = batch ? userImpactEvents(batch.baseline) : 0

  return (
    <div className="analysis-backdrop">
      <section
        className="results analysis-modal scenario-lab"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-lab-title"
      >
        <div className="results-head">
          <FlaskConical size={16} />
          <strong id="scenario-lab-title">Scenario Lab</strong>
          <span>Normal baseline + {selectedIds.size} scenarios</span>
          {batch && (
            <button
              className="baseline-action"
              type="button"
              onClick={exportBatch}
              title="Export every scenario result as JSON"
            >
              <Download size={13} />
              Export JSON
            </button>
          )}
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close Scenario Lab"
          >
            <X size={16} />
          </button>
        </div>

        <div className="scenario-lab-controls">
          <div className="scenario-lab-selection">
            <div className="scenario-lab-selection-head">
              <strong>Scenarios to compare</strong>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set(scenarios.map((scenario) => scenario.id)))
                  setBatch(null)
                }}
              >
                <CheckCheck size={13} /> Select all
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set())
                  setBatch(null)
                }}
              >
                <Square size={12} /> Clear
              </button>
            </div>
            {scenarios.map((scenario) => (
              <label className="scenario-lab-option" key={scenario.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(scenario.id)}
                  onChange={() => toggleScenario(scenario.id)}
                />
                <span>
                  <strong>{scenario.name}</strong>
                  <small>{scenario.kind}</small>
                </span>
              </label>
            ))}
            {scenarios.length === 0 && (
              <p className="goal-hint">
                Add failure scenarios in the inspector before running the lab.
              </p>
            )}
          </div>
          <button
            className="ui-button scenario-lab-run"
            type="button"
            disabled={selectedIds.size === 0}
            onClick={runSelected}
          >
            <Play size={14} />
            Run selected
          </button>
        </div>

        {batch ? (
          <div className="scenario-lab-table-wrap">
            <table className="scenario-lab-table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Goals</th>
                  <th>Throughput</th>
                  <th>Latency</th>
                  <th>Dropped</th>
                  <th>User impact</th>
                  <th>Bottlenecks</th>
                  <th>Recovery behavior</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    Normal operation
                    <small>Baseline</small>
                  </th>
                  <td className={batch.baseline.goalReport?.failed ? "regressed" : ""}>
                    {goalSummary(batch.baseline)}
                  </td>
                  <td className="neutral">
                    {Math.round(
                      batch.baseline.totalEventsProcessed /
                        graph.simulationProfile.durationSeconds,
                    ).toLocaleString()}
                    /s
                  </td>
                  <td className="neutral">{batch.baseline.averageLatencyMs} ms</td>
                  <td>{droppedEvents(batch.baseline).toLocaleString()}</td>
                  <td>{baselineImpact.toLocaleString()} events</td>
                  <td title={bottleneckSummary(batch.baseline)}>
                    {bottleneckSummary(batch.baseline)}
                  </td>
                  <td>Expected steady-state behavior.</td>
                  <td>
                    {batch.baseline.warnings.length} warnings ·{" "}
                    {batch.baseline.explanation.recommendations.length} actions
                  </td>
                </tr>
                {batch.scenarios.map((entry) => {
                  const impact = userImpactEvents(entry.result)
                  return (
                    <tr key={entry.scenario.id}>
                      <th scope="row">
                        {entry.scenario.name}
                        <small>{entry.scenario.kind}</small>
                      </th>
                      <td className={entry.result.goalReport?.failed ? "regressed" : ""}>
                        {goalSummary(entry.result)}
                      </td>
                      <td
                        className={deltaClass(entry.comparisonToBaseline.throughput)}
                        title={deltaTitle(entry.comparisonToBaseline.throughput)}
                      >
                        {Math.round(
                          entry.result.totalEventsProcessed /
                            graph.simulationProfile.durationSeconds,
                        ).toLocaleString()}
                        /s
                      </td>
                      <td
                        className={deltaClass(entry.comparisonToBaseline.averageLatency)}
                        title={deltaTitle(entry.comparisonToBaseline.averageLatency)}
                      >
                        {entry.result.averageLatencyMs} ms
                      </td>
                      <td
                        className={deltaClass(entry.comparisonToBaseline.droppedEvents)}
                        title={deltaTitle(entry.comparisonToBaseline.droppedEvents)}
                      >
                        {droppedEvents(entry.result).toLocaleString()}
                      </td>
                      <td className={impact > baselineImpact ? "regressed" : ""}>
                        {impact.toLocaleString()} events
                      </td>
                      <td title={bottleneckSummary(entry.result)}>
                        {bottleneckSummary(entry.result)}
                      </td>
                      <td>
                        {entry.result.readiness.recoveryTimeSeconds !== undefined &&
                          `${entry.result.readiness.recoveryTimeSeconds.toLocaleString()}s estimated. `}
                        {entry.scenario.recoveryBehavior ||
                          "No recovery expectation recorded."}
                      </td>
                      <td>
                        {entry.result.warnings.length} warnings ·{" "}
                        {entry.result.explanation.recommendations.length} actions
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="scenario-lab-empty">
            Select scenarios and run the lab to compare them against normal operation.
          </p>
        )}
      </section>
    </div>
  )
}
