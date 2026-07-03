import type { ArchitectureRule } from "../../contracts"
import { resolveEdgeContract } from "../contracts/contract-versions"
import { isOutageScenario, type RuleContext } from "./rule-helpers"

export function messagingRules(context: RuleContext): ArchitectureRule[] {
  const findings: ArchitectureRule[] = []
  const { graph, nodes } = context

  const longestOutageSeconds = (graph.failureScenarios ?? [])
    .filter(isOutageScenario)
    .reduce(
      (longest, scenario) =>
        Math.max(longest, scenario.durationSeconds + scenario.recoverySeconds),
      0,
    )

  for (const node of graph.nodes) {
    if (node.type !== "rabbitmq.queue") continue
    if (node.config.deadLetterQueue !== true) {
      findings.push({
        code: "QUEUE_WITHOUT_TERMINAL_OUTCOME",
        category: "reliability",
        severity: "warning",
        message: "A queue has no dead-letter queue or terminal outcome",
        rationale:
          "Messages that keep failing must end somewhere deliberate. Without a terminal outcome they silently expire, overflow, or clog redelivery forever.",
        affectedIds: [node.id],
        suggestedActions: [
          "Enable a dead-letter queue and give a team replay ownership.",
          "Define an explicit drop policy if this data may be discarded.",
        ],
      })
    }
    const ttlSeconds = (Number(node.config.messageTtlMs) || 0) / 1000
    if (
      ttlSeconds > 0 &&
      longestOutageSeconds > 0 &&
      ttlSeconds < longestOutageSeconds
    ) {
      findings.push({
        code: "TTL_SHORTER_THAN_OUTAGE",
        category: "reliability",
        severity: "warning",
        message: `Message TTL of ${ttlSeconds}s is shorter than the ${longestOutageSeconds}s outage-plus-recovery you plan for`,
        rationale:
          "A queue only bridges an outage if messages survive it. With a shorter TTL, work expires exactly when the queue was supposed to protect it.",
        affectedIds: [node.id],
        suggestedActions: [
          "Raise the TTL beyond the longest outage plus recovery you expect.",
          "Dead-letter expiring messages instead of dropping them.",
        ],
      })
    }
  }

  for (const edge of graph.edges) {
    const delivery = edge.deliveryPolicy
    if (!delivery) continue
    if (delivery.ordering === "global") {
      const partitions = Math.max(
        Number(nodes.get(edge.fromNodeId)?.config.partitions) || 0,
        Number(nodes.get(edge.toNodeId)?.config.partitions) || 0,
      )
      if (partitions > 1) {
        findings.push({
          code: "ORDERING_VS_PARTITIONS",
          category: "contracts",
          severity: "warning",
          message: `Global ordering is promised across ${partitions} parallel partitions`,
          rationale:
            "Partitions process independently, so a global order across them cannot be guaranteed. One of the two promises will silently break.",
          affectedIds: [edge.id],
          suggestedActions: [
            "Relax ordering to per-key and choose a partition key that preserves what actually matters.",
            "Reduce to one partition and accept the throughput ceiling.",
          ],
        })
      }
    }
    if (delivery.guarantee === "at-least-once" && delivery.deduplication === "none") {
      const contract = resolveEdgeContract(graph.dataContracts, edge)
      if (contract && !contract.idempotencyKey) {
        findings.push({
          code: "AT_LEAST_ONCE_WITHOUT_IDEMPOTENCY",
          category: "contracts",
          severity: contract.kind === "command" ? "warning" : "question",
          message: `${contract.name} is delivered at-least-once with no idempotency or deduplication`,
          rationale:
            "At-least-once means duplicates will happen. Consumers must either tolerate reprocessing naturally or detect repeats with a key.",
          affectedIds: [edge.id],
          suggestedActions: [
            "Declare an idempotency key on the contract.",
            "Add consumer-side deduplication to the delivery policy.",
            "Confirm and document that reprocessing this data is harmless.",
          ],
        })
      }
    }
  }

  return findings
}
