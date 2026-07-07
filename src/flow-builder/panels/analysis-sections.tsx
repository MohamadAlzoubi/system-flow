import type {
  GoalReport,
  MetricDelta,
  ProductionReadinessMetrics,
  UserImpactEntry,
  UserImpactOutcome,
} from "../../contracts"

const impactLabels: Record<UserImpactOutcome, string> = {
  "rejected-immediately": "Rejected immediately",
  "timed-out": "Timed out",
  "accepted-for-later": "Accepted for later",
  "served-by-fallback": "Served by fallback",
  "degraded-response": "Degraded response",
  lost: "Lost",
  duplicated: "Duplicated",
  "delayed-beyond-goal": "Delayed beyond goal",
}

const severeOutcomes = new Set<UserImpactOutcome>([
  "lost",
  "timed-out",
  "rejected-immediately",
])

export function UserImpactSection({ entries }: { entries: UserImpactEntry[] }) {
  return (
    <div className="user-impact">
      <strong>User impact</strong>
      {entries.map((entry) => (
        <div
          className={`impact-row ${severeOutcomes.has(entry.outcome) ? "impact-severe" : ""}`}
          key={entry.outcome}
        >
          <b>{impactLabels[entry.outcome]}</b>
          <span>{entry.events.toLocaleString()} events</span>
          <small>{entry.description}</small>
        </div>
      ))}
    </div>
  )
}

const goalStatusLabels = {
  passed: "Passed",
  failed: "Failed",
  "not-evaluated": "Not evaluated",
} as const

export function GoalReportSection({ report }: { report: GoalReport }) {
  return (
    <div className="goal-report">
      <div className="goal-summary">
        <strong>Architecture goals</strong>
        <span>
          {report.passed} passed · {report.failed} failed · {report.notEvaluated} not
          evaluated
        </span>
      </div>
      {report.evaluations.map((evaluation) => (
        <div
          className={`goal-row goal-${evaluation.status}`}
          key={evaluation.goal}
          title={evaluation.reason}
        >
          <b>{goalStatusLabels[evaluation.status]}</b>
          <span>{evaluation.label}</span>
          {evaluation.target !== undefined && (
            <small>
              target {evaluation.target.toLocaleString()}
              {evaluation.unit ? ` ${evaluation.unit}` : ""}
              {evaluation.actual !== undefined &&
                ` · actual ${evaluation.actual.toLocaleString()}${
                  evaluation.unit ? ` ${evaluation.unit}` : ""
                }`}
            </small>
          )}
          {evaluation.safetyMarginPercent !== undefined && (
            <small
              className={evaluation.safetyMarginPercent >= 0 ? "improved" : "regressed"}
            >
              {evaluation.safetyMarginPercent > 0 ? "+" : ""}
              {evaluation.safetyMarginPercent.toLocaleString()}% margin
            </small>
          )}
        </div>
      ))}
      {report.openQuestions.length > 0 && (
        <div className="goal-open-questions">
          <strong>Open questions</strong>
          {report.openQuestions.map((question) => (
            <span key={question}>{question}</span>
          ))}
        </div>
      )}
      {report.assumptions.length > 0 && (
        <div className="goal-assumptions">
          {report.assumptions.map((assumption) => (
            <small key={assumption}>{assumption}</small>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReadinessSection({
  readiness,
}: {
  readiness: ProductionReadinessMetrics
}) {
  const metrics = [
    {
      label: "RTO",
      value: readiness.recoveryTimeSeconds,
      unit: "seconds",
    },
    {
      label: "RPO",
      value: readiness.recoveryPointSeconds,
      unit: "seconds",
    },
    {
      label: "Staleness",
      value: readiness.dataStalenessMs,
      unit: "ms",
    },
  ]
  if (metrics.every((metric) => metric.value === undefined)) return null

  return (
    <div className="readiness-metrics">
      <strong>Recovery and freshness</strong>
      <div className="readiness-values">
        {metrics.map((metric) => (
          <span key={metric.label}>
            <b>{metric.label}</b>
            {metric.value === undefined
              ? "Not evaluated"
              : `${metric.value.toLocaleString()} ${metric.unit}`}
          </span>
        ))}
      </div>
      <div className="readiness-evidence">
        {readiness.evidence.map((item, index) => (
          <small
            key={`${item.metric}-${item.source}-${item.nodeId ?? item.edgeId ?? index}`}
            title={item.reason}
          >
            {item.source}: {item.value.toLocaleString()} {item.unit}
            {item.role === "constraint" ? " limit" : ""}
          </small>
        ))}
      </div>
    </div>
  )
}

export function Delta({
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
