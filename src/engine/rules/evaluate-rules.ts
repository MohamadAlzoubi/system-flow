import type {
  ArchitectureRule,
  FlowGraph,
  NodeDefinition,
  RuleAcceptance,
} from "../../contracts"
import { dataRules } from "./data-rules"
import { interactionRules } from "./interaction-rules"
import { messagingRules } from "./messaging-rules"
import { operabilityRules } from "./operability-rules"
import { reliabilityRules } from "./reliability-rules"
import { buildRuleContext } from "./rule-helpers"
import { securityRules } from "./security-rules"

export type RuleOptions = {
  /** Synchronous hops a caller may wait through before a finding fires. */
  maximumSyncDepth?: number
}

const severityRank = { error: 0, warning: 1, question: 2 } as const

/**
 * Runs the architecture review. Deterministic for the same graph and options;
 * findings explain their rationale and offer alternatives instead of one
 * prescriptive answer.
 */
export function evaluateRules(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
  options?: RuleOptions,
): ArchitectureRule[] {
  const context = buildRuleContext(graph, registry)
  const findings = [
    ...interactionRules(context, options?.maximumSyncDepth ?? 3),
    ...reliabilityRules(context),
    ...messagingRules(context),
    ...dataRules(context),
    ...operabilityRules(context),
    ...securityRules(context),
  ]
  return findings.sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.category.localeCompare(right.category) ||
      left.code.localeCompare(right.code) ||
      left.affectedIds.join("|").localeCompare(right.affectedIds.join("|")),
  )
}

/** Stable identity of one finding instance, used to match acceptances. */
export function findingKey(finding: ArchitectureRule): string {
  return [...finding.affectedIds].sort().join("|")
}

export function findAcceptance(
  finding: ArchitectureRule,
  acceptances: RuleAcceptance[] | undefined,
): RuleAcceptance | undefined {
  return acceptances?.find(
    (acceptance) =>
      acceptance.ruleCode === finding.code &&
      acceptance.targetKey === findingKey(finding),
  )
}
