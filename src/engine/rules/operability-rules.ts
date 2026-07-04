import type { ArchitectureRule } from "../../contracts"
import type { RuleContext } from "./rule-helpers"

const statefulCategories = new Set(["Data", "Messaging", "Streaming"])

export function operabilityRules(context: RuleContext): ArchitectureRule[] {
  const findings: ArchitectureRule[] = []
  const { graph, registry } = context
  const goals = graph.architectureGoals

  for (const node of graph.nodes) {
    const critical =
      (node.responsibility?.stateful ??
        statefulCategories.has(registry.get(node.type)?.category ?? "")) ||
      node.responsibility?.sourceOfTruth === true
    if (critical && !node.responsibility?.owner) {
      findings.push({
        code: "CRITICAL_WITHOUT_OWNER",
        category: "operability",
        severity: "warning",
        message: `${registry.get(node.type)?.label ?? node.type} is critical but has no owner`,
        rationale:
          "When this component degrades at 3am, someone must know it is theirs. Unowned critical components fail slowly and recover slower.",
        affectedIds: [node.id],
        suggestedActions: [
          "Assign an owning team in the node's responsibility metadata.",
          "Fold the component into a boundary that already has an owner.",
        ],
      })
    }
  }

  for (const scenario of graph.failureScenarios ?? []) {
    if (!scenario.recoveryBehavior?.trim()) {
      findings.push({
        code: "SCENARIO_WITHOUT_RECOVERY",
        category: "operability",
        severity: "question",
        message: `Scenario "${scenario.name}" does not say how the system recovers`,
        rationale:
          "Surviving a failure is half the design; returning to normal is the other half. Undescribed recovery usually means unplanned recovery.",
        affectedIds: [scenario.id],
        suggestedActions: [
          "Describe how backlog drains and who or what triggers recovery.",
          "State the expected time back to normal so it can be tested.",
        ],
      })
    }
  }

  for (const assumption of graph.assumptions ?? []) {
    if (assumption.impact === "high" && assumption.status === "unverified") {
      findings.push({
        code: "ASSUMPTION_UNVERIFIED",
        category: "operability",
        severity: "question",
        message: `A high-impact assumption is unverified: ${assumption.statement}`,
        rationale:
          "The design leans on this belief. If it turns out wrong, everything that depends on it is wrong with it — verify it while changing course is still cheap.",
        affectedIds: assumption.relatedIds,
        suggestedActions: [
          "Verify the assumption and record the evidence on it.",
          "Design a fallback for the case where it does not hold.",
          "Lower its impact rating if the design no longer depends on it.",
        ],
      })
    }
  }

  const declaredSlo =
    goals !== undefined &&
    (goals.maximumAverageLatencyMs !== undefined ||
      goals.maximumP95LatencyMs !== undefined ||
      goals.minimumAvailabilityPercent !== undefined ||
      goals.maximumRecoveryTimeSeconds !== undefined)
  const observed = graph.nodes.some(
    (node) => registry.get(node.type)?.category === "Observability",
  )
  if (declaredSlo && !observed) {
    findings.push({
      code: "SLO_WITHOUT_OBSERVABILITY",
      category: "operability",
      severity: "warning",
      message: "The flow declares service goals but has no observability path",
      rationale:
        "A latency or availability goal nobody measures is a wish. Without metrics or logging in the flow, breaches are discovered by users.",
      affectedIds: [],
      suggestedActions: [
        "Add a metrics or logging component fed by the critical path.",
        "Export goal measurements from the components that already exist.",
      ],
    })
  }

  return findings
}
