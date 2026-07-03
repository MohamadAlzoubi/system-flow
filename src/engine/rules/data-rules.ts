import type { ArchitectureRule, NodeInstance } from "../../contracts"
import type { RuleContext } from "./rule-helpers"

const identityPattern = /(^id$)|Id$/

export function dataRules(context: RuleContext): ArchitectureRule[] {
  const findings: ArchitectureRule[] = []
  const { graph, registry } = context

  const ownersByContract = new Map<string, NodeInstance[]>()
  for (const node of graph.nodes) {
    if (!node.responsibility?.sourceOfTruth) continue
    for (const contractName of node.stateOwnership?.dataOwned ?? []) {
      ownersByContract.set(contractName, [
        ...(ownersByContract.get(contractName) ?? []),
        node,
      ])
    }
  }
  for (const [contractName, owners] of ownersByContract) {
    if (owners.length > 1) {
      findings.push({
        code: "MULTIPLE_STATE_WRITERS",
        category: "state",
        severity: "question",
        message: `${owners.length} components claim to own ${contractName}`,
        rationale:
          "Two sources of truth for the same data eventually disagree. Even coordinated multi-writer setups need an explicit story for who wins.",
        affectedIds: owners.map((node) => node.id),
        suggestedActions: [
          "Choose one owner and make the others derived views.",
          "Document the conflict-resolution strategy both owners follow.",
        ],
      })
    }
  }

  for (const node of graph.nodes) {
    if (
      node.type === "redis.cache" &&
      (node.stateOwnership?.cacheInvalidation ?? "none") === "none"
    ) {
      findings.push({
        code: "CACHE_WITHOUT_INVALIDATION",
        category: "state",
        severity: "warning",
        message: "A cache has no invalidation or expiry strategy",
        rationale:
          "A cache that never invalidates serves stale data forever. The strategy decides how wrong the data may be, so it is an architecture decision.",
        affectedIds: [node.id],
        suggestedActions: [
          "Set a TTL aligned with the flow's declared staleness tolerance.",
          "Invalidate on source-of-truth writes if staleness must be near zero.",
        ],
      })
    }
    if (node.type === "data.search-engine") {
      const otherStores = graph.nodes.some(
        (candidate) =>
          candidate.id !== node.id &&
          registry.get(candidate.type)?.category === "Data" &&
          candidate.type !== "redis.cache",
      )
      if (node.responsibility?.sourceOfTruth === true || !otherStores) {
        findings.push({
          code: "SEARCH_AS_SOURCE_OF_TRUTH",
          category: "state",
          severity: "warning",
          message: "A search index is modeled as the sole source of truth",
          rationale:
            "Search indexes trade durability and consistency for query speed; they are rebuilt from elsewhere. If nothing else owns the data, there is nothing to rebuild from.",
          affectedIds: [node.id],
          suggestedActions: [
            "Store records in a durable database and index from it.",
            "Mark the index as a derived view, not a source of truth.",
          ],
        })
      }
    }
  }

  for (const contract of graph.dataContracts) {
    if (contract.kind !== "event") continue
    const hasIdentity =
      contract.correlationKey !== undefined ||
      contract.idempotencyKey !== undefined ||
      contract.fields.some((field) => identityPattern.test(field.name))
    const hasTimestamp = contract.fields.some((field) => field.type === "timestamp")
    if (!hasIdentity || !hasTimestamp) {
      const missing = [
        ...(hasIdentity ? [] : ["a stable identity"]),
        ...(hasTimestamp ? [] : ["a timestamp"]),
      ].join(" and ")
      findings.push({
        code: "EVENT_WITHOUT_IDENTITY",
        category: "contracts",
        severity: "warning",
        message: `Event ${contract.name} has no ${missing}`,
        rationale:
          "Events are replayed, deduplicated, ordered, and debugged by identity and time. Without both, consumers cannot tell repeats from new facts.",
        affectedIds: [contract.name],
        suggestedActions: [
          "Add an id field and mark it as the correlation key.",
          "Add a timestamp field recording when the fact happened.",
        ],
      })
    }
  }

  return findings
}
