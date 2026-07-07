import type {
  ArchitectureGoals,
  FailurePolicy,
  FlowGraph,
  NodeDefinition,
} from "../../contracts"

export type ReviewModeId =
  | "api-design"
  | "event-driven"
  | "data-ownership"
  | "reliability"
  | "regional-resilience"
  | "pre-implementation"

export type ReviewAnswerKind =
  | "goal"
  | "assumption"
  | "decision"
  | "failure-policy"
  | "state-ownership"

type NumericGoalKey = Exclude<keyof ArchitectureGoals, "orderingRequirement">

export type ReviewQuestion = {
  id: string
  modeId: ReviewModeId
  prompt: string
  rationale: string
  answerKind: ReviewAnswerKind
  placeholder: string
  targetId?: string
  goalKey?: NumericGoalKey
}

export type ReviewMode = {
  id: ReviewModeId
  label: string
  description: string
}

export const reviewModes: ReviewMode[] = [
  {
    id: "api-design",
    label: "API design",
    description: "Latency, contracts, synchronous dependencies, and failure behavior.",
  },
  {
    id: "event-driven",
    label: "Event-driven",
    description: "Delivery semantics, traffic assumptions, evolution, and replay.",
  },
  {
    id: "data-ownership",
    label: "Data ownership",
    description: "Sources of truth, writers, consistency, and freshness.",
  },
  {
    id: "reliability",
    label: "Reliability",
    description: "Recovery goals, dependency failures, retries, and queues.",
  },
  {
    id: "regional-resilience",
    label: "Regional resilience",
    description: "Regional strategy, recovery point, and failover assumptions.",
  },
  {
    id: "pre-implementation",
    label: "Pre-implementation",
    description: "Peak load, rollout decisions, ownership, and unresolved assumptions.",
  },
]

const synchronous = new Set(["request-response", "database-operation"])
const statefulCategories = new Set(["Data", "Messaging", "Streaming"])

function question(
  modeId: ReviewModeId,
  id: string,
  values: Omit<ReviewQuestion, "id" | "modeId">,
): ReviewQuestion {
  return { id: `${modeId}:${id}`, modeId, ...values }
}

export function buildReviewQuestions(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
  modeId: ReviewModeId,
): ReviewQuestion[] {
  const synchronousEdge = graph.edges.find((edge) =>
    synchronous.has(edge.interactionType),
  )
  const asynchronousEdge = graph.edges.find(
    (edge) => !synchronous.has(edge.interactionType),
  )
  const unprotectedEdge =
    graph.edges.find((edge) => edge.failurePolicy === undefined) ?? graph.edges[0]
  const firstRegion = (graph.boundaries ?? []).find(
    (boundary) => boundary.kind === "region",
  )
  const regionalNode = firstRegion
    ? graph.nodes.find((node) => node.boundaryId === firstRegion.id)
    : undefined

  switch (modeId) {
    case "api-design":
      return [
        question(modeId, "p95-latency", {
          prompt: "What is the maximum acceptable p95 API latency?",
          rationale:
            "A synchronous API cannot be reviewed without a measurable tail-latency target.",
          answerKind: "goal",
          goalKey: "maximumP95LatencyMs",
          placeholder: "Milliseconds, for example 800",
          targetId: synchronousEdge?.id,
        }),
        ...(synchronousEdge
          ? [
              question(modeId, `failure-${synchronousEdge.id}`, {
                prompt: `How should ${synchronousEdge.fromNodeId} handle failure of ${synchronousEdge.toNodeId}?`,
                rationale:
                  "Every synchronous dependency needs explicit timeout and failure semantics.",
                answerKind: "failure-policy",
                placeholder: "Choose a failure action",
                targetId: synchronousEdge.id,
              }),
            ]
          : []),
        question(modeId, "contract-evolution", {
          prompt: "What API contract evolution strategy will consumers rely on?",
          rationale:
            "Versioning and compatibility decisions prevent independent teams from breaking one another.",
          answerKind: "decision",
          placeholder: "Record the versioning and compatibility decision",
          targetId: synchronousEdge?.id,
        }),
      ]
    case "event-driven":
      return [
        question(modeId, "peak-traffic", {
          prompt: "What peak event rate must the pipeline absorb?",
          rationale:
            "Partitioning, retention, consumer capacity, and backlog size depend on peak traffic.",
          answerKind: "goal",
          goalKey: "peakTrafficPerSecond",
          placeholder: "Events per second",
          targetId: asynchronousEdge?.id,
        }),
        question(modeId, "delivery-assumption", {
          prompt: "What delivery, duplication, or ordering behavior is still assumed?",
          rationale:
            "Unverified broker and consumer behavior should be explicit before implementation.",
          answerKind: "assumption",
          placeholder: "Describe the assumption to verify",
          targetId: asynchronousEdge?.id,
        }),
        question(modeId, "event-evolution", {
          prompt: "How will event schemas evolve and old events be replayed?",
          rationale:
            "Event history outlives deployments, so compatibility and replay need a durable decision.",
          answerKind: "decision",
          placeholder: "Record schema evolution and replay strategy",
          targetId: asynchronousEdge?.id,
        }),
      ]
    case "data-ownership": {
      const statefulNodes = graph.nodes.filter((node) =>
        statefulCategories.has(registry.get(node.type)?.category ?? ""),
      )
      return [
        ...statefulNodes.map((node) =>
          question(modeId, `ownership-${node.id}`, {
            prompt: `Which data contracts does ${node.id} own?`,
            rationale:
              "A stateful component needs explicit data ownership, allowed writers, and consistency.",
            answerKind: "state-ownership",
            placeholder: "Comma-separated contract names",
            targetId: node.id,
          }),
        ),
        question(modeId, "staleness", {
          prompt: "What is the maximum acceptable data staleness?",
          rationale:
            "Caches, replicas, and projections need a measurable freshness requirement.",
          answerKind: "goal",
          goalKey: "maximumDataStalenessMs",
          placeholder: "Milliseconds",
          targetId: statefulNodes[0]?.id,
        }),
        question(modeId, "source-of-truth", {
          prompt: "What is the source-of-truth strategy when writers conflict?",
          rationale:
            "Conflict resolution and writer authority must be decided before data paths are implemented.",
          answerKind: "decision",
          placeholder: "Record source-of-truth and conflict-resolution strategy",
          targetId: statefulNodes[0]?.id,
        }),
      ]
    }
    case "reliability":
      return [
        question(modeId, "rto", {
          prompt: "How quickly must the system recover from a tested failure?",
          rationale:
            "Recovery capacity and runbooks need a concrete recovery-time objective.",
          answerKind: "goal",
          goalKey: "maximumRecoveryTimeSeconds",
          placeholder: "Seconds",
          targetId: unprotectedEdge?.id,
        }),
        ...(unprotectedEdge
          ? [
              question(modeId, `failure-${unprotectedEdge.id}`, {
                prompt: `What should happen when ${unprotectedEdge.toNodeId} fails?`,
                rationale:
                  "Implicit failure propagation creates unpredictable user impact.",
                answerKind: "failure-policy",
                placeholder: "Choose a failure action",
                targetId: unprotectedEdge.id,
              }),
            ]
          : []),
        question(modeId, "outage-assumption", {
          prompt: "Which outage duration or recovery dependency is still unverified?",
          rationale:
            "Queue size, retry budgets, and failover capacity depend on realistic outage assumptions.",
          answerKind: "assumption",
          placeholder: "Describe the recovery assumption to test",
          targetId: unprotectedEdge?.id,
        }),
      ]
    case "regional-resilience":
      return [
        question(modeId, "rpo", {
          prompt: "How much recently accepted work may be lost in a regional failure?",
          rationale:
            "Regional replication and failover need a measurable recovery-point objective.",
          answerKind: "goal",
          goalKey: "maximumRecoveryPointSeconds",
          placeholder: "Seconds",
          targetId: regionalNode?.id,
        }),
        question(modeId, "regional-strategy", {
          prompt:
            "Will regional recovery be active-active, active-passive, or restore-based?",
          rationale:
            "Traffic routing, state replication, and operational cost depend on this decision.",
          answerKind: "decision",
          placeholder: "Record the regional recovery strategy",
          targetId: regionalNode?.id,
        }),
        question(modeId, "regional-assumption", {
          prompt:
            "Which cross-region dependency or failover assumption must be verified?",
          rationale:
            "Regional resilience often depends on replication lag, quotas, and control planes outside the graph.",
          answerKind: "assumption",
          placeholder: "Describe the regional assumption",
          targetId: regionalNode?.id,
        }),
      ]
    case "pre-implementation": {
      const unowned = graph.nodes.find((node) => !node.responsibility?.owner)
      return [
        question(modeId, "peak-traffic", {
          prompt: "What peak production traffic must be proven before rollout?",
          rationale:
            "Implementation cannot be sized or load-tested without a peak requirement.",
          answerKind: "goal",
          goalKey: "peakTrafficPerSecond",
          placeholder: "Events per second",
          targetId: graph.nodes[0]?.id,
        }),
        question(modeId, "rollout", {
          prompt: "What rollout, migration, and rollback sequence will the team use?",
          rationale:
            "A safe implementation plan needs explicit sequencing and reversal criteria.",
          answerKind: "decision",
          placeholder: "Record rollout and rollback strategy",
          targetId: graph.nodes[0]?.id,
        }),
        question(modeId, "readiness-assumption", {
          prompt: "What unresolved assumption could still invalidate implementation?",
          rationale:
            "The most dangerous implementation risk is a high-impact belief nobody plans to test.",
          answerKind: "assumption",
          placeholder: "Record the assumption and verify it before rollout",
          targetId: unowned?.id ?? graph.nodes[0]?.id,
        }),
      ]
    }
  }
}

export function isReviewQuestionAnswered(
  graph: FlowGraph,
  question: ReviewQuestion,
): boolean {
  const answerId = `review-answer:${question.id}`
  switch (question.answerKind) {
    case "goal":
      return (
        question.goalKey !== undefined &&
        graph.architectureGoals?.[question.goalKey] !== undefined
      )
    case "assumption":
      return (graph.assumptions ?? []).some((item) => item.id === answerId)
    case "decision":
      return (graph.decisionRecords ?? []).some((item) => item.id === answerId)
    case "failure-policy":
      return graph.edges.some(
        (edge) => edge.id === question.targetId && edge.failurePolicy !== undefined,
      )
    case "state-ownership":
      return graph.nodes.some(
        (node) =>
          node.id === question.targetId &&
          (node.stateOwnership?.dataOwned.length ?? 0) > 0,
      )
  }
}

export function applyReviewAnswer(
  graph: FlowGraph,
  question: ReviewQuestion,
  answer: string,
): FlowGraph {
  const trimmed = answer.trim()
  if (!trimmed) return graph
  const answerId = `review-answer:${question.id}`

  switch (question.answerKind) {
    case "goal": {
      if (!question.goalKey) return graph
      const value = Number(trimmed)
      if (!Number.isFinite(value) || value < 0) return graph
      return {
        ...graph,
        architectureGoals: {
          ...(graph.architectureGoals ?? { orderingRequirement: "none" }),
          [question.goalKey]: value,
        },
      }
    }
    case "assumption": {
      const assumption = {
        id: answerId,
        statement: trimmed,
        status: "unverified" as const,
        impact: "high" as const,
        relatedIds: question.targetId ? [question.targetId] : [],
      }
      return {
        ...graph,
        assumptions: [
          ...(graph.assumptions ?? []).filter((item) => item.id !== answerId),
          assumption,
        ],
      }
    }
    case "decision": {
      const relatedNodeIds = question.targetId
        ? graph.nodes
            .filter((node) => node.id === question.targetId)
            .map((node) => node.id)
        : []
      const relatedEdgeIds = question.targetId
        ? graph.edges
            .filter((edge) => edge.id === question.targetId)
            .map((edge) => edge.id)
        : []
      const decision = {
        id: answerId,
        title: question.prompt,
        status: "proposed" as const,
        context: question.rationale,
        decision: trimmed,
        alternatives: [],
        consequences: [],
        assumptionIds: [],
        relatedNodeIds,
        relatedEdgeIds,
      }
      return {
        ...graph,
        decisionRecords: [
          ...(graph.decisionRecords ?? []).filter((item) => item.id !== answerId),
          decision,
        ],
      }
    }
    case "failure-policy": {
      const allowedActions = new Set<FailurePolicy["action"]>([
        "propagate",
        "retry",
        "queue",
        "drop",
        "dead-letter",
      ])
      const action = trimmed as FailurePolicy["action"]
      if (!allowedActions.has(action) || !question.targetId) return graph
      const failurePolicy: FailurePolicy =
        action === "retry"
          ? {
              action,
              timeoutMs: 3000,
              maximumAttempts: 3,
              backoff: "exponential",
              initialBackoffMs: 250,
              maximumBackoffMs: 5000,
            }
          : { action, timeoutMs: 3000 }
      return {
        ...graph,
        edges: graph.edges.map((edge) =>
          edge.id === question.targetId ? { ...edge, failurePolicy } : edge,
        ),
      }
    }
    case "state-ownership": {
      if (!question.targetId) return graph
      const dataOwned = [
        ...new Set(
          trimmed
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ]
      if (dataOwned.length === 0) return graph
      const allowedWriterIds = graph.edges
        .filter((edge) => edge.toNodeId === question.targetId)
        .map((edge) => edge.fromNodeId)
      return {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === question.targetId
            ? {
                ...node,
                stateOwnership: {
                  dataOwned,
                  allowedWriterIds,
                  readConsumerIds: node.stateOwnership?.readConsumerIds,
                  transactionBoundary: node.stateOwnership?.transactionBoundary,
                  consistencyModel:
                    node.stateOwnership?.consistencyModel ??
                    (node.type === "database" ? "strong" : "eventual"),
                  conflictResolution: node.stateOwnership?.conflictResolution,
                  cacheInvalidation: node.stateOwnership?.cacheInvalidation,
                  freshnessToleranceMs: node.stateOwnership?.freshnessToleranceMs,
                },
              }
            : node,
        ),
      }
    }
  }
}
