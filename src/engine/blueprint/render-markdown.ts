import type { Blueprint } from "../../contracts"

const bullet = (items: string[]): string =>
  items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- _None._"

export function renderBlueprintMarkdown(blueprint: Blueprint): string {
  const lines: string[] = []
  lines.push(`# ${blueprint.name} — Implementation Blueprint`, "")

  lines.push("## System overview", "")
  lines.push(`**Purpose:** ${blueprint.overview.purpose}`, "")
  lines.push("**Architecture goals**", bullet(blueprint.overview.goals), "")
  lines.push("**Main flows**", bullet(blueprint.overview.mainFlows), "")
  lines.push("**Boundaries and ownership**", bullet(blueprint.overview.boundaries), "")

  lines.push("## Components to implement", "")
  for (const component of blueprint.components) {
    lines.push(`### ${component.label} (\`${component.id}\`)`, "")
    lines.push(`- **Responsibility:** ${component.responsibility}`)
    lines.push(`- **Inputs:** ${component.inputs.join(", ") || "—"}`)
    lines.push(`- **Outputs:** ${component.outputs.join(", ") || "—"}`)
    if (component.stateOwnership) {
      lines.push(`- **State ownership:** ${component.stateOwnership}`)
    }
    lines.push(`- **Capacity assumption:** ${component.capacityAssumption}`)
    lines.push(`- **Failure behavior:** ${component.failureBehavior.join("; ")}`)
    lines.push(`- **Dependencies:** ${component.dependencies.join(", ") || "none"}`)
    lines.push(`- **Owner:** ${component.owner}`)
    if (component.openQuestions.length > 0) {
      lines.push(`- **Open questions:** ${component.openQuestions.join("; ")}`)
    }
    lines.push("")
  }

  lines.push("## Contracts and interfaces", "")
  for (const contract of blueprint.contracts) {
    lines.push(
      `### ${contract.name} v${contract.version} (${contract.kind})`,
      "",
      `- **Compatibility:** ${contract.compatibility}`,
      `- **Fields:** ${contract.fields.join(", ")}`,
      `- **Producers:** ${contract.producers.join(", ") || "—"}`,
      `- **Consumers:** ${contract.consumers.join(", ") || "—"}`,
      "",
    )
  }

  lines.push("## Reliability plan", "")
  lines.push("**Timeouts**", bullet(blueprint.reliability.timeouts), "")
  lines.push("**Retries**", bullet(blueprint.reliability.retries), "")
  lines.push("**Idempotency**", bullet(blueprint.reliability.idempotency), "")
  lines.push("**Circuit breakers**", bullet(blueprint.reliability.circuitBreakers), "")
  lines.push("**Queues and DLQs**", bullet(blueprint.reliability.queues), "")
  lines.push("**Failover**", bullet(blueprint.reliability.failover), "")
  lines.push("**Recovery expectations**", bullet(blueprint.reliability.recovery), "")

  lines.push("## Development sequence", "")
  for (const phase of blueprint.developmentSequence) {
    lines.push(`${phase.step}. **${phase.title}**`)
    for (const item of phase.items) lines.push(`   - ${item}`)
  }
  lines.push("")

  lines.push("## Test plan", "")
  for (const group of blueprint.testPlan) {
    lines.push(`**${group.category}**`, bullet(group.items), "")
  }

  lines.push("## Risks and open questions", "")
  if (blueprint.risks.length === 0) {
    lines.push("_No outstanding risks recorded._", "")
  }
  for (const group of blueprint.risks) {
    lines.push(`**${group.category}**`, bullet(group.items), "")
  }

  lines.push("## Production readiness handoff", "")
  lines.push("### Regional topology", "", bullet(blueprint.handoff.regionalTopology), "")
  lines.push(
    "### Critical assumptions",
    "",
    bullet(blueprint.handoff.criticalAssumptions),
    "",
  )
  lines.push("### Architecture decisions", "", bullet(blueprint.handoff.decisions), "")
  lines.push(
    "### Required implementation tasks",
    "",
    bullet(blueprint.handoff.implementationTasks),
    "",
  )
  lines.push("### Load test plan", "", bullet(blueprint.handoff.loadTestPlan), "")
  lines.push("### Chaos test plan", "", bullet(blueprint.handoff.chaosTestPlan), "")
  lines.push(
    "### Observability checklist",
    "",
    bullet(blueprint.handoff.observabilityChecklist),
    "",
  )
  lines.push("### Runbook outline", "", bullet(blueprint.handoff.runbookOutline), "")
  lines.push(
    "### Rollout and migration sequence",
    "",
    bullet(blueprint.handoff.rolloutSequence),
    "",
  )

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n")
}
