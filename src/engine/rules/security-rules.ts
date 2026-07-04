import type { ArchitectureRule } from "../../contracts"
import { resolveEdgeContract } from "../contracts/contract-versions"
import type { RuleContext } from "./rule-helpers"

export function securityRules(context: RuleContext): ArchitectureRule[] {
  const findings: ArchitectureRule[] = []
  const { graph, nodes, registry } = context

  for (const edge of graph.edges) {
    const target = nodes.get(edge.toNodeId)
    if (!target || registry.get(target.type)?.category !== "Integration") continue
    const contract = resolveEdgeContract(graph.dataContracts, edge)
    const sensitiveFields = contract?.fields.filter((field) => field.sensitive) ?? []
    if (sensitiveFields.length > 0) {
      findings.push({
        code: "SENSITIVE_TO_EXTERNAL",
        category: "security",
        severity: "question",
        message: `Sensitive ${sensitiveFields
          .map((field) => field.name)
          .join(", ")} leaves the system through an external dependency`,
        rationale:
          "Data sent to a third party is governed by their retention, breach, and jurisdiction story, not yours. That trade should be a decision, not an accident.",
        affectedIds: [edge.id, target.id],
        suggestedActions: [
          "Send a token or reference instead of the sensitive value.",
          "Confirm the provider's data handling meets your obligations and record it.",
        ],
      })
    }
  }

  return findings
}
