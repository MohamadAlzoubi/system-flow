import type { Blueprint } from "../../contracts"

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const list = (items: string[]): string =>
  items.length > 0
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : '<p class="none">None.</p>'

/** Self-contained, printable HTML with no external dependencies. */
export function renderBlueprintHtml(blueprint: Blueprint): string {
  const sections: string[] = []

  sections.push(`<h1>${escapeHtml(blueprint.name)} — Implementation Blueprint</h1>`)

  sections.push("<h2>System overview</h2>")
  sections.push(
    `<p><strong>Purpose:</strong> ${escapeHtml(blueprint.overview.purpose)}</p>`,
  )
  sections.push("<h3>Architecture goals</h3>", list(blueprint.overview.goals))
  sections.push("<h3>Main flows</h3>", list(blueprint.overview.mainFlows))
  sections.push("<h3>Boundaries and ownership</h3>", list(blueprint.overview.boundaries))

  sections.push("<h2>Components to implement</h2>")
  for (const component of blueprint.components) {
    sections.push(
      `<h3>${escapeHtml(component.label)} <code>${escapeHtml(component.id)}</code></h3>`,
    )
    const rows: string[] = [
      `<strong>Responsibility:</strong> ${escapeHtml(component.responsibility)}`,
      `<strong>Inputs:</strong> ${escapeHtml(component.inputs.join(", ") || "—")}`,
      `<strong>Outputs:</strong> ${escapeHtml(component.outputs.join(", ") || "—")}`,
      ...(component.stateOwnership
        ? [`<strong>State ownership:</strong> ${escapeHtml(component.stateOwnership)}`]
        : []),
      `<strong>Capacity:</strong> ${escapeHtml(component.capacityAssumption)}`,
      `<strong>Failure behavior:</strong> ${escapeHtml(component.failureBehavior.join("; "))}`,
      `<strong>Dependencies:</strong> ${escapeHtml(component.dependencies.join(", ") || "none")}`,
      `<strong>Owner:</strong> ${escapeHtml(component.owner)}`,
      ...(component.openQuestions.length > 0
        ? [
            `<strong>Open questions:</strong> ${escapeHtml(component.openQuestions.join("; "))}`,
          ]
        : []),
    ]
    sections.push(`<ul>${rows.map((row) => `<li>${row}</li>`).join("")}</ul>`)
  }

  sections.push("<h2>Contracts and interfaces</h2>")
  for (const contract of blueprint.contracts) {
    sections.push(
      `<h3>${escapeHtml(contract.name)} v${escapeHtml(contract.version)} (${escapeHtml(contract.kind)})</h3>`,
      list([
        `Compatibility: ${contract.compatibility}`,
        `Fields: ${contract.fields.join(", ")}`,
        `Producers: ${contract.producers.join(", ") || "—"}`,
        `Consumers: ${contract.consumers.join(", ") || "—"}`,
      ]),
    )
  }

  sections.push("<h2>Reliability plan</h2>")
  sections.push("<h3>Timeouts</h3>", list(blueprint.reliability.timeouts))
  sections.push("<h3>Retries</h3>", list(blueprint.reliability.retries))
  sections.push("<h3>Idempotency</h3>", list(blueprint.reliability.idempotency))
  sections.push("<h3>Circuit breakers</h3>", list(blueprint.reliability.circuitBreakers))
  sections.push("<h3>Queues and DLQs</h3>", list(blueprint.reliability.queues))
  sections.push("<h3>Failover</h3>", list(blueprint.reliability.failover))
  sections.push("<h3>Recovery expectations</h3>", list(blueprint.reliability.recovery))

  sections.push("<h2>Development sequence</h2>", "<ol>")
  for (const phase of blueprint.developmentSequence) {
    sections.push(
      `<li><strong>${escapeHtml(phase.title)}</strong>${list(phase.items)}</li>`,
    )
  }
  sections.push("</ol>")

  sections.push("<h2>Test plan</h2>")
  for (const group of blueprint.testPlan) {
    sections.push(`<h3>${escapeHtml(group.category)}</h3>`, list(group.items))
  }

  sections.push("<h2>Risks and open questions</h2>")
  if (blueprint.risks.length === 0) {
    sections.push('<p class="none">No outstanding risks recorded.</p>')
  }
  for (const group of blueprint.risks) {
    sections.push(`<h3>${escapeHtml(group.category)}</h3>`, list(group.items))
  }

  const style = [
    "body{font-family:system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;line-height:1.55}",
    "h1{border-bottom:2px solid #333;padding-bottom:.3rem}",
    "h2{margin-top:2rem;border-bottom:1px solid #ccc;padding-bottom:.2rem}",
    "code{background:#f0f0f0;padding:.1rem .3rem;border-radius:3px}",
    ".none{color:#888;font-style:italic}",
  ].join("")

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>${escapeHtml(blueprint.name)} — Blueprint</title>`,
    `<style>${style}</style>`,
    "</head><body>",
    sections.join("\n"),
    "</body></html>",
    "",
  ].join("\n")
}
