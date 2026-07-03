import type { FlowGraph, NodeDefinition, ValidationIssue } from "../../contracts"
import { resolveEdgeContract } from "../contracts/contract-versions"

export function validateFailures(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const boundaryIds = new Set((graph.boundaries ?? []).map((boundary) => boundary.id))

  for (const edge of graph.edges) {
    const policy = edge.failurePolicy
    const target = nodes.get(edge.toNodeId)
    const targetCategory = target && registry.get(target.type)?.category

    if (policy) {
      if (
        (policy.maximumAttempts !== undefined && policy.maximumAttempts <= 0) ||
        (policy.initialBackoffMs !== undefined && policy.initialBackoffMs < 0) ||
        (policy.maximumBackoffMs !== undefined && policy.maximumBackoffMs < 0) ||
        (policy.initialBackoffMs !== undefined &&
          policy.maximumBackoffMs !== undefined &&
          policy.initialBackoffMs > policy.maximumBackoffMs) ||
        (policy.timeoutMs !== undefined && policy.timeoutMs <= 0)
      ) {
        issues.push({
          severity: "error",
          code: "INVALID_FAILURE_POLICY",
          message: "Failure policy values are outside their valid ranges",
          edgeId: edge.id,
        })
      }
      if (policy.action === "fallback") {
        const fallback = policy.fallbackNodeId
          ? nodes.get(policy.fallbackNodeId)
          : undefined
        if (!fallback) {
          issues.push({
            severity: "error",
            code: "INVALID_FAILURE_POLICY",
            message: "Fallback action requires an existing fallback node",
            edgeId: edge.id,
          })
        } else {
          const sameNode = fallback.id === edge.toNodeId
          const sharedBoundary =
            fallback.boundaryId !== undefined &&
            fallback.boundaryId === target?.boundaryId
          const sharedRegion =
            fallback.responsibility?.deploymentRegion !== undefined &&
            fallback.responsibility.deploymentRegion ===
              target?.responsibility?.deploymentRegion
          if (sameNode || sharedBoundary || sharedRegion) {
            issues.push({
              severity: "warning",
              code: "FALLBACK_SHARED_FAILURE",
              message:
                "Fallback shares the primary's failure boundary, so both fail together",
              edgeId: edge.id,
            })
          }
        }
      }
      if (policy.action === "retry") {
        if (policy.maximumAttempts === undefined) {
          issues.push({
            severity: "warning",
            code: "UNBOUNDED_RETRY",
            message: "Retry policy has no attempt limit, so failures retry forever",
            edgeId: edge.id,
          })
        }
        const contract = resolveEdgeContract(graph.dataContracts, edge)
        const deduplicated =
          edge.deliveryPolicy?.deduplication !== undefined &&
          edge.deliveryPolicy.deduplication !== "none"
        if (!contract?.idempotencyKey && !deduplicated) {
          issues.push({
            severity: "warning",
            code: "RETRY_WITHOUT_IDEMPOTENCY",
            message:
              "Retries can repeat work, but neither the contract nor the delivery policy protects against duplicates",
            edgeId: edge.id,
          })
        }
      }
    }

    if (
      targetCategory === "Integration" &&
      edge.interactionType !== "request-response" &&
      edge.timeoutMs === undefined &&
      policy?.timeoutMs === undefined
    ) {
      issues.push({
        severity: "warning",
        code: "EXTERNAL_WITHOUT_TIMEOUT",
        message: "External dependency is called without any timeout behavior",
        edgeId: edge.id,
      })
    }

    if (edge.deliveryPolicy?.ordering === "global") {
      const sourcePartitions = Number(nodes.get(edge.fromNodeId)?.config.partitions) || 0
      const targetPartitions = Number(target?.config.partitions) || 0
      if (sourcePartitions > 1 || targetPartitions > 1) {
        issues.push({
          severity: "warning",
          code: "GLOBAL_ORDERING_PARALLELISM",
          message:
            "Global ordering cannot hold across multiple partitions; reduce partitions or relax ordering",
          edgeId: edge.id,
        })
      }
    }

    if (
      edge.deliveryPolicy?.guarantee === "at-most-once" &&
      graph.architectureGoals?.maximumDataLossEvents === 0
    ) {
      issues.push({
        severity: "warning",
        code: "AT_MOST_ONCE_WITH_ZERO_LOSS",
        message:
          "At-most-once delivery accepts loss, but the flow's goal allows zero lost events",
        edgeId: edge.id,
      })
    }
  }

  for (const node of graph.nodes) {
    if (node.type === "rabbitmq.queue" && node.config.deadLetterQueue !== true) {
      issues.push({
        severity: "warning",
        code: "QUEUE_WITHOUT_TERMINAL_HANDLING",
        message:
          "Queue has no dead-letter handling, so repeatedly failing messages have nowhere to go",
        nodeId: node.id,
      })
    }
    if (node.type === "messaging.dead-letter-queue" && !node.responsibility?.owner) {
      issues.push({
        severity: "warning",
        code: "DLQ_WITHOUT_REPLAY_OWNER",
        message: "No one owns replaying this dead-letter queue's messages",
        nodeId: node.id,
      })
    }
  }

  for (const scenario of graph.failureScenarios ?? []) {
    if (
      !scenario.name.trim() ||
      scenario.startSeconds < 0 ||
      scenario.durationSeconds <= 0 ||
      scenario.recoverySeconds < 0
    ) {
      issues.push({
        severity: "error",
        code: "INVALID_SCENARIO",
        message: `Failure scenario ${scenario.name || scenario.id} needs a name and valid timing`,
      })
    }
    for (const nodeId of scenario.affectedNodeIds) {
      if (!nodes.has(nodeId)) {
        issues.push({
          severity: "error",
          code: "INVALID_SCENARIO",
          message: `Failure scenario ${scenario.name} affects a missing node`,
        })
      }
    }
    for (const boundaryId of scenario.affectedBoundaryIds) {
      if (!boundaryIds.has(boundaryId)) {
        issues.push({
          severity: "error",
          code: "INVALID_SCENARIO",
          message: `Failure scenario ${scenario.name} affects a missing boundary`,
        })
      }
    }
  }

  return issues
}
