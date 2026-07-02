import type {
  FlowGraph,
  InteractionType,
  NodeDefinition,
  ValidationIssue,
} from "../../contracts"

const interactionTypes = new Set<InteractionType>([
  "request-response",
  "async-command",
  "published-event",
  "stream",
  "batch-transfer",
  "database-operation",
  "realtime-push",
])

export function validateInteractions(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))

  for (const edge of graph.edges) {
    if (!interactionTypes.has(edge.interactionType)) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_INTERACTION_TYPE",
        message: "Every edge must declare how the two components interact",
        edgeId: edge.id,
      })
      continue
    }
    if (edge.timeoutMs !== undefined && edge.timeoutMs <= 0) {
      issues.push({
        severity: "error",
        code: "INVALID_INTERACTION",
        message: "Interaction timeout must be a positive duration",
        edgeId: edge.id,
      })
    }

    const target = nodes.get(edge.toNodeId)
    const targetCategory = target && registry.get(target.type)?.category

    if (edge.interactionType === "request-response") {
      if (edge.timeoutMs === undefined) {
        issues.push({
          severity: "warning",
          code: "REQUEST_TIMEOUT_MISSING",
          message:
            "Request-response call declares no timeout, so a slow dependency blocks the caller indefinitely",
          edgeId: edge.id,
        })
      }
      if (!edge.responseDataType) {
        issues.push({
          severity: "warning",
          code: "RESPONSE_TYPE_MISSING",
          message: "Request-response call does not declare what data comes back",
          edgeId: edge.id,
        })
      }
    }

    if (
      edge.interactionType === "published-event" &&
      (edge.timeoutMs !== undefined || edge.responseDataType)
    ) {
      issues.push({
        severity: "warning",
        code: "PUBLISHED_EVENT_SYNCHRONOUS",
        message:
          "Published events describe facts; the producer must not wait for a consumer response",
        edgeId: edge.id,
      })
    }

    if (edge.interactionType === "database-operation" && targetCategory !== "Data") {
      issues.push({
        severity: "warning",
        code: "DATABASE_OPERATION_TARGET",
        message: "Database operation targets a component that does not own state",
        edgeId: edge.id,
      })
    }

    if (edge.interactionType === "realtime-push" && targetCategory !== "Realtime") {
      issues.push({
        severity: "warning",
        code: "REALTIME_PUSH_TARGET",
        message:
          "Realtime push targets a component without long-lived connection semantics",
        edgeId: edge.id,
      })
    }
  }

  return issues
}
