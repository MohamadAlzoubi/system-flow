import type { ArchitectureRule } from "../../contracts"
import { estimateNode, type RuleContext, synchronousInteractions } from "./rule-helpers"

const asynchronousWaits = new Set(["timeoutMs", "responseDataType"] as const)

export function interactionRules(
  context: RuleContext,
  maximumSyncDepth: number,
): ArchitectureRule[] {
  const findings: ArchitectureRule[] = []
  const { graph, nodes, outgoing } = context

  // Longest chain of consecutive synchronous edges, memoized over the DAG.
  const depthCache = new Map<string, { depth: number; path: string[] }>()
  const chainFrom = (nodeId: string): { depth: number; path: string[] } => {
    const cached = depthCache.get(nodeId)
    if (cached) return cached
    depthCache.set(nodeId, { depth: 0, path: [nodeId] })
    let best = { depth: 0, path: [nodeId] }
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (!synchronousInteractions.has(edge.interactionType)) continue
      const downstream = chainFrom(edge.toNodeId)
      if (downstream.depth + 1 > best.depth) {
        best = { depth: downstream.depth + 1, path: [nodeId, ...downstream.path] }
      }
    }
    depthCache.set(nodeId, best)
    return best
  }
  let longest = { depth: 0, path: [] as string[] }
  for (const node of graph.nodes) {
    const chain = chainFrom(node.id)
    if (chain.depth > longest.depth) longest = chain
  }
  if (longest.depth > maximumSyncDepth) {
    findings.push({
      code: "SYNC_CHAIN_TOO_DEEP",
      category: "performance",
      severity: "warning",
      message: `A caller waits through ${longest.depth} synchronous hops (limit ${maximumSyncDepth})`,
      rationale:
        "Every synchronous hop adds its latency and failure probability to the caller. Deep chains make response times fragile and outages contagious.",
      affectedIds: longest.path,
      suggestedActions: [
        "Make a mid-chain step asynchronous if the caller does not need its result.",
        "Collapse steps that always change together into one component.",
        "Cache an upstream answer to cut the chain short.",
      ],
    })
  }

  for (const edge of graph.edges) {
    const synchronous = synchronousInteractions.has(edge.interactionType)
    const timeout = edge.timeoutMs ?? edge.failurePolicy?.timeoutMs
    if (synchronous && timeout === undefined) {
      findings.push({
        code: "SYNC_CALL_WITHOUT_TIMEOUT",
        category: "reliability",
        severity: "warning",
        message: "A synchronous call has no timeout",
        rationale:
          "Without a timeout, one slow dependency holds the caller's resources indefinitely and stalls cascade upstream.",
        affectedIds: [edge.id],
        suggestedActions: [
          "Set a timeout below what the caller's own callers will tolerate.",
          "Pair the timeout with a failure policy that says what happens next.",
        ],
      })
    }
    if (synchronous && timeout !== undefined) {
      const target = nodes.get(edge.toNodeId)
      if (target) {
        const expected =
          estimateNode(context, target).latencyMs +
          graph.simulationProfile.networkLatencyMs
        if (timeout < expected) {
          findings.push({
            code: "TIMEOUT_BUDGET_TOO_SMALL",
            category: "performance",
            severity: "warning",
            message: `Timeout of ${timeout} ms is below the ~${Math.round(expected)} ms the dependency needs`,
            rationale:
              "A timeout shorter than the dependency's normal latency turns healthy responses into failures and can trigger pointless retries.",
            affectedIds: [edge.id, edge.toNodeId],
            suggestedActions: [
              "Raise the timeout above the dependency's expected latency plus headroom.",
              "Reduce the dependency's work per request if the budget cannot grow.",
            ],
          })
        }
      }
    }
    if (
      !synchronous &&
      (edge.timeoutMs !== undefined || edge.responseDataType !== undefined)
    ) {
      const coupled = [...asynchronousWaits].filter((key) => edge[key] !== undefined)
      findings.push({
        code: "ASYNC_COUPLED_TO_CALLER",
        category: "performance",
        severity: "warning",
        message: `An asynchronous interaction declares ${coupled.join(" and ")}, as if the caller waits`,
        rationale:
          "Asynchronous boundaries exist to end the caller's wait. Expecting a response or timeout across one quietly couples caller latency to downstream processing.",
        affectedIds: [edge.id],
        suggestedActions: [
          "Remove the response expectation and confirm acceptance instead.",
          "Use request-response if the caller genuinely needs the result.",
        ],
      })
    }
  }

  return findings
}
