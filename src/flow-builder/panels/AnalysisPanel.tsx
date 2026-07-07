import { Activity, BookmarkPlus, Download, Pause, Play, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { evaluateRules } from "../../engine"
import { nodeRegistry } from "../../node-registry"
import { useFlowEditorStore } from "../../store/flow-editor.store"
import { buildSimulationAnalysisExport } from "./analysis-export"
import {
  Delta,
  GoalReportSection,
  ReadinessSection,
  UserImpactSection,
} from "./analysis-sections"

export function AnalysisPanel() {
  const issues = useFlowEditorStore((state) => state.validationIssues)
  const result = useFlowEditorStore((state) => state.simulationResult)
  const graph = useFlowEditorStore((state) => state.graph)
  const activeScenarioId = useFlowEditorStore((state) => state.activeScenarioId)
  const activeScenario = graph.failureScenarios?.find(
    (scenario) => scenario.id === activeScenarioId,
  )
  const setSelectedNode = useFlowEditorStore((state) => state.setSelectedNode)
  const simulationTime = useFlowEditorStore((state) => state.simulationTimeSeconds)
  const setSimulationTime = useFlowEditorStore((state) => state.setSimulationTimeSeconds)
  const baseline = useFlowEditorStore((state) => state.simulationBaseline)
  const comparison = useFlowEditorStore((state) => state.simulationComparison)
  const captureBaseline = useFlowEditorStore((state) => state.captureSimulationBaseline)
  const clearBaseline = useFlowEditorStore((state) => state.clearSimulationBaseline)
  const setAnalysisOpen = useFlowEditorStore((state) => state.setAnalysisOpen)
  const highImpactAssumptions = (graph.assumptions ?? []).filter(
    (assumption) => assumption.impact === "high" && assumption.status === "unverified",
  )
  const costQuotaRisks = useMemo(
    () =>
      evaluateRules(graph, nodeRegistry).filter(
        (finding) => finding.category === "cost" || finding.category === "quota",
      ),
    [graph],
  )
  const [playing, setPlaying] = useState(false)
  const duration = result?.timeline.at(-1)?.timeSeconds ?? 0
  const queueAgeSeries =
    result?.timeline.flatMap((frame) =>
      frame.queues.map((queue) => ({
        nodeId: queue.nodeId,
        time: frame.timeSeconds,
        age: queue.averageMessageAgeMs,
      })),
    ) ?? []
  const maximumQueueAge = Math.max(1, ...queueAgeSeries.map((point) => point.age))
  const trafficSeries =
    result?.timeline.map((frame) => ({
      time: frame.timeSeconds,
      rate: frame.sourceRatePerSecond,
    })) ?? []
  const maximumTrafficRate = Math.max(1, ...trafficSeries.map((point) => point.rate))

  const exportAnalysisJson = () => {
    if (!result) return
    const payload = buildSimulationAnalysisExport({
      graph,
      result,
      visibleIssues: issues,
      scenario: activeScenario ?? null,
      baseline,
      comparison,
      riskFindings: costQuotaRisks,
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = activeScenario
      ? `${graph.id}-${activeScenario.id}-analysis.json`
      : `${graph.id}-analysis.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!playing || !result) return
    const timer = window.setInterval(() => {
      const currentIndex = result.timeline.findIndex(
        (frame) => frame.timeSeconds >= simulationTime,
      )
      const next = result.timeline[currentIndex + 1]
      if (next) setSimulationTime(next.timeSeconds)
      else {
        setSimulationTime(0)
        setPlaying(false)
      }
    }, 350)
    return () => window.clearInterval(timer)
  }, [playing, result, setSimulationTime, simulationTime])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnalysisOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [setAnalysisOpen])

  return (
    <div className="analysis-backdrop">
      <section
        className="results analysis-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-title"
      >
        <div className="results-head">
          <Activity size={16} />
          <strong id="analysis-title">Simulation analysis</strong>
          <span>{issues.length} issues</span>
          {result && (
            <button
              className="baseline-action"
              type="button"
              onClick={exportAnalysisJson}
              title="Export simulation analysis JSON"
            >
              <Download size={13} /> Export JSON
            </button>
          )}
          <button
            className="modal-close"
            type="button"
            onClick={() => setAnalysisOpen(false)}
            aria-label="Close analysis"
          >
            <X size={16} />
          </button>
          {result && !baseline && (
            <button className="baseline-action" type="button" onClick={captureBaseline}>
              <BookmarkPlus size={13} /> Save baseline
            </button>
          )}
          {baseline && (
            <button className="baseline-action" type="button" onClick={clearBaseline}>
              <X size={13} /> Clear baseline
            </button>
          )}
        </div>
        {result && (
          <>
            {activeScenario && (
              <div className="baseline-label">
                Failure scenario: {activeScenario.name}
                {activeScenario.expectedUserImpact
                  ? ` — expected: ${activeScenario.expectedUserImpact}`
                  : ""}
              </div>
            )}
            <div className="metrics">
              <b>
                {result.totalEventsProcessed.toLocaleString()}
                <small>events</small>
              </b>
              <b>
                {result.averageLatencyMs} ms<small>average</small>
              </b>
              <b>
                {result.p95LatencyMs} ms<small>p95</small>
              </b>
              <b>
                {result.resourceUsage.cpuCores}
                <small>CPU cores</small>
              </b>
              <b>
                {result.resourceUsage.memoryMb} MB<small>memory</small>
              </b>
            </div>
            {result.goalReport && <GoalReportSection report={result.goalReport} />}
            <ReadinessSection readiness={result.readiness} />
            {result.userImpact.length > 0 && (
              <UserImpactSection entries={result.userImpact} />
            )}
            {highImpactAssumptions.length > 0 && (
              <div className="assumption-alert">
                <strong>Unverified high-impact assumptions</strong>
                {highImpactAssumptions.map((assumption) => (
                  <span key={assumption.id}>{assumption.statement}</span>
                ))}
              </div>
            )}
            {costQuotaRisks.length > 0 && (
              <div className="cost-quota-risks">
                <strong>Cost and quota risks</strong>
                {costQuotaRisks.map((finding) => (
                  <span key={`${finding.code}-${finding.affectedIds.join("-")}`}>
                    <b>{finding.category}</b>
                    {finding.message}
                  </span>
                ))}
              </div>
            )}
            {result.timeline.some((frame) => frame.queues.length > 0) && (
              <div className="timeline-controls">
                <button type="button" onClick={() => setPlaying((value) => !value)}>
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={simulationTime}
                  onChange={(event) => {
                    setPlaying(false)
                    setSimulationTime(Number(event.target.value))
                  }}
                  aria-label="Simulation time"
                />
                <span>
                  {simulationTime}s / {duration}s
                </span>
              </div>
            )}
            {baseline && (
              <div className="baseline-label">
                Baseline: {baseline.graphName}. Edit the design and run simulation again.
              </div>
            )}
            {comparison && (
              <div className="comparison">
                <Delta label="Events" value={comparison.throughput} />
                <Delta label="Average" value={comparison.averageLatency} unit=" ms" />
                <Delta label="p95" value={comparison.p95Latency} unit=" ms" />
                <Delta label="CPU" value={comparison.cpuCores} />
                <Delta label="Memory" value={comparison.memoryMb} unit=" MB" />
                <Delta label="Dropped" value={comparison.droppedEvents} />
                {comparison.bottlenecks.resolvedNodeIds.length > 0 && (
                  <span className="improved">
                    Resolved: {comparison.bottlenecks.resolvedNodeIds.join(", ")}
                  </span>
                )}
                {comparison.bottlenecks.newNodeIds.length > 0 && (
                  <span className="regressed">
                    New: {comparison.bottlenecks.newNodeIds.join(", ")}
                  </span>
                )}
                {comparison.bottlenecks.moved && (
                  <span className="neutral">Bottleneck moved</span>
                )}
              </div>
            )}
            <div className="explanation">
              <span className={`confidence confidence-${result.explanation.confidence}`}>
                {result.explanation.confidence} confidence
                {result.explanation.calibrated ? " · calibrated" : ""}
              </span>
              <span>{result.explanation.confidenceReasons[0]}</span>
            </div>
            {result.explanation.calibrationEvidence.length > 0 && (
              <div className="calibration-evidence">
                <strong>Calibration evidence</strong>
                {result.explanation.calibrationEvidence.map((evidence) => (
                  <span key={evidence.metric}>
                    <b>{evidence.metric}</b>
                    {evidence.observedValue.toLocaleString()} {evidence.unit} ·{" "}
                    {evidence.source} · {evidence.quality} · factor{" "}
                    {evidence.calibrationFactor}
                  </span>
                ))}
              </div>
            )}
            {trafficSeries.length > 1 && maximumTrafficRate > 1 && (
              <div
                className="message-age-chart traffic-chart"
                role="img"
                aria-label="Incoming traffic over time"
              >
                <strong>Traffic over time</strong>
                <div>
                  {trafficSeries.map((point) => (
                    <i
                      key={point.time}
                      title={`${point.time}s: ${Math.round(point.rate).toLocaleString()}/s`}
                      style={{ height: `${(point.rate / maximumTrafficRate) * 100}%` }}
                    />
                  ))}
                </div>
                <small>{Math.round(maximumTrafficRate).toLocaleString()}/s peak</small>
              </div>
            )}
            {queueAgeSeries.length > 0 && (
              <div
                className="message-age-chart"
                role="img"
                aria-label="Queue message age over time"
              >
                <strong>Message age</strong>
                <div>
                  {queueAgeSeries.map((point) => (
                    <i
                      key={`${point.nodeId}-${point.time}`}
                      title={`${point.time}s: ${Math.round(point.age)} ms`}
                      style={{ height: `${(point.age / maximumQueueAge) * 100}%` }}
                    />
                  ))}
                </div>
                <small>{Math.round(maximumQueueAge / 1000)}s maximum</small>
              </div>
            )}
            <div className="node-capacity-list">
              {result.nodeMetrics
                .filter((metric) => metric.utilizationPercent !== undefined)
                .map((metric) => (
                  <button
                    type="button"
                    key={metric.nodeId}
                    onClick={() => setSelectedNode(metric.nodeId)}
                  >
                    <span>{metric.nodeId}</span>
                    <i>
                      <b
                        style={{
                          width: `${Math.min(100, metric.utilizationPercent ?? 0)}%`,
                        }}
                      />
                    </i>
                    <small>{Math.round(metric.utilizationPercent ?? 0)}%</small>
                  </button>
                ))}
            </div>
            {result.explanation.recommendations.length > 0 && (
              <div className="recommendations">
                {result.explanation.recommendations.map((recommendation, index) => (
                  <button
                    type="button"
                    key={`${recommendation.code}-${recommendation.nodeId ?? index}`}
                    onClick={() => {
                      if (recommendation.nodeId) setSelectedNode(recommendation.nodeId)
                    }}
                  >
                    <strong>{recommendation.priority}</strong>
                    {recommendation.message}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <div className="issue-list">
          {issues.length ? (
            issues.map((issue) => (
              <button
                type="button"
                className={issue.severity}
                key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}
                onClick={() => {
                  if (issue.nodeId) setSelectedNode(issue.nodeId)
                }}
              >
                {issue.message}
              </button>
            ))
          ) : (
            <span className="ok">Ready to validate or simulate this flow.</span>
          )}
        </div>
      </section>
    </div>
  )
}
