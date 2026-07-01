import { Activity, BookmarkPlus, Pause, Play, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { MetricDelta } from "../../contracts"
import { useFlowEditorStore } from "../../store/flow-editor.store"

function Delta({
  label,
  value,
  unit = "",
}: {
  label: string
  value: MetricDelta
  unit?: string
}) {
  const sign = value.absolute > 0 ? "+" : ""
  return (
    <span
      className={
        value.absolute === 0 ? "neutral" : value.improved ? "improved" : "regressed"
      }
    >
      <strong>{label}</strong>
      {sign}
      {Number(value.absolute.toFixed(2)).toLocaleString()}
      {unit}
      {value.percentage !== undefined && (
        <small>
          {" "}
          ({sign}
          {value.percentage.toFixed(1)}%)
        </small>
      )}
    </span>
  )
}

export function AnalysisPanel() {
  const issues = useFlowEditorStore((state) => state.validationIssues)
  const result = useFlowEditorStore((state) => state.simulationResult)
  const setSelectedNode = useFlowEditorStore((state) => state.setSelectedNode)
  const simulationTime = useFlowEditorStore((state) => state.simulationTimeSeconds)
  const setSimulationTime = useFlowEditorStore((state) => state.setSimulationTimeSeconds)
  const baseline = useFlowEditorStore((state) => state.simulationBaseline)
  const comparison = useFlowEditorStore((state) => state.simulationComparison)
  const captureBaseline = useFlowEditorStore((state) => state.captureSimulationBaseline)
  const clearBaseline = useFlowEditorStore((state) => state.clearSimulationBaseline)
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

  return (
    <section className="results">
      <div className="results-head">
        <Activity size={16} />
        <strong>Analysis</strong>
        <span>{issues.length} issues</span>
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
  )
}
