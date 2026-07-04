import type {
  ArchitectureRule,
  Blueprint,
  BlueprintComponent,
  BlueprintContract,
  BlueprintPhase,
  DataContract,
  FlowEdge,
  FlowGraph,
  GoalReport,
  NodeDefinition,
  NodeInstance,
  NodeSimulationMetrics,
} from "../../contracts"
import { contractVersions, resolveEdgeContract } from "../contracts/contract-versions"
import { evaluateRules, findAcceptance } from "../rules/evaluate-rules"
import { runSimulation } from "../simulation/run-simulation"
import { validateFlow } from "../validation/validate-flow"

const number = (value: unknown) => Number(value)

const cacheTypes = new Set([
  "redis.cache",
  "data.read-replica",
  "data.search-engine",
  "network.cdn",
])

/** The nine roadmap development phases, in the order work should happen. */
function phaseOf(
  node: NodeInstance,
  registry: ReadonlyMap<string, NodeDefinition>,
  fedByMessaging: boolean,
): number {
  const category = registry.get(node.type)?.category
  if (category === "Integration") return 7
  if (category === "Resilience") return 8
  if (category === "Observability") return 9
  if (cacheTypes.has(node.type)) return 6
  if (category === "Messaging" || category === "Streaming") return 4
  if (node.responsibility?.sourceOfTruth || node.type === "database") return 2
  if (fedByMessaging) return 5
  return 3
}

function componentFor(
  node: NodeInstance,
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
  metric: NodeSimulationMetrics | undefined,
  findings: ArchitectureRule[],
): BlueprintComponent {
  const definition = registry.get(node.type)
  const incoming = graph.edges.filter((edge) => edge.toNodeId === node.id)
  const outgoing = graph.edges.filter((edge) => edge.fromNodeId === node.id)
  const label = definition?.label ?? node.type

  const inputs = [...new Set(incoming.map((edge) => edge.dataType))]
  const outputs = [
    ...new Set([
      ...outgoing.map((edge) => edge.dataType),
      ...outgoing.flatMap((edge) =>
        edge.responseDataType ? [edge.responseDataType] : [],
      ),
    ]),
  ]

  const ownership = node.stateOwnership
  const stateOwnership = ownership
    ? `Owns ${ownership.dataOwned.length > 0 ? ownership.dataOwned.join(", ") : "internal state"}; ${ownership.consistencyModel} consistency${
        ownership.conflictResolution ? `, ${ownership.conflictResolution}` : ""
      }`
    : undefined

  const capacityAssumption =
    metric?.capacityPerSecond !== undefined
      ? `~${Math.round(metric.capacityPerSecond).toLocaleString()} events/s${
          metric.droppedEvents > 0
            ? ` (sheds work at ${Math.round(metric.incomingRatePerSecond).toLocaleString()}/s incoming)`
            : ""
        }`
      : "Estimated from configuration; no hard capacity limit modeled"

  const failureBehavior: string[] = []
  for (const edge of outgoing) {
    const policy = edge.failurePolicy
    if (!policy) continue
    if (policy.action === "retry") {
      failureBehavior.push(
        `Retries up to ${policy.maximumAttempts ?? "∞"}x${
          policy.backoff ? ` with ${policy.backoff} backoff` : ""
        } toward ${edge.toNodeId}`,
      )
    } else {
      failureBehavior.push(`On failure toward ${edge.toNodeId}: ${policy.action}`)
    }
  }
  if (node.availabilityPolicy && node.availabilityPolicy.mode !== "online") {
    failureBehavior.push(`Availability policy: ${node.availabilityPolicy.mode}`)
  }
  if (node.type === "rabbitmq.queue") {
    failureBehavior.push(
      node.config.deadLetterQueue === true
        ? "Dead-letters messages that exhaust retries"
        : "No dead-letter queue configured",
    )
  }
  if (failureBehavior.length === 0) {
    failureBehavior.push("Failures propagate to the caller unless handled upstream")
  }

  const owner = node.responsibility?.owner ?? boundaryOwner(graph, node) ?? "unassigned"

  const openQuestions = findings
    .filter((finding) => finding.affectedIds.includes(node.id))
    .map((finding) => finding.message)
  if (node.responsibility?.implementationStatus === undefined) {
    openQuestions.push("Implementation status is undecided")
  }

  return {
    id: node.id,
    label,
    responsibility:
      node.responsibility?.notes ?? `${label} (${definition?.category ?? "component"})`,
    inputs: inputs.length > 0 ? inputs : (definition?.inputTypes ?? []),
    outputs: outputs.length > 0 ? outputs : (definition?.outputTypes ?? []),
    stateOwnership,
    capacityAssumption,
    failureBehavior,
    dependencies: outgoing.map(
      (edge) =>
        registry.get(graph.nodes.find((n) => n.id === edge.toNodeId)?.type ?? "")
          ?.label ?? edge.toNodeId,
    ),
    owner,
    openQuestions,
  }
}

function boundaryOwner(graph: FlowGraph, node: NodeInstance): string | undefined {
  const boundary = (graph.boundaries ?? []).find((item) => item.id === node.boundaryId)
  return boundary?.owner
}

function contractSummaries(graph: FlowGraph): BlueprintContract[] {
  return graph.dataContracts.map((contract) => {
    const producers = new Set<string>()
    const consumers = new Set<string>()
    for (const edge of graph.edges) {
      const resolved = resolveEdgeContract(graph.dataContracts, edge)
      if (resolved?.name === contract.name || edge.responseDataType === contract.name) {
        producers.add(edge.fromNodeId)
        consumers.add(edge.toNodeId)
      }
    }
    const versions = contractVersions(graph.dataContracts, contract.name)
    const compatibility =
      versions.length > 1
        ? `${contract.compatibility} (versions ${versions.map((v) => v.version).join(", ")})`
        : contract.compatibility
    return {
      name: contract.name,
      version: contract.version,
      kind: contract.kind,
      compatibility,
      fields: contract.fields.map(
        (field) => `${field.name}: ${field.type}${field.required ? "" : "?"}`,
      ),
      producers: [...producers],
      consumers: [...consumers],
    }
  })
}

function reliabilityPlan(graph: FlowGraph) {
  const timeouts: string[] = []
  const retries: string[] = []
  const idempotency: string[] = []
  const circuitBreakers: string[] = []
  const queues: string[] = []
  const failover: string[] = []

  for (const edge of graph.edges) {
    const timeout = edge.timeoutMs ?? edge.failurePolicy?.timeoutMs
    if (timeout !== undefined) {
      timeouts.push(`${edge.fromNodeId} → ${edge.toNodeId}: ${timeout} ms`)
    }
    if (edge.failurePolicy?.action === "retry") {
      retries.push(
        `${edge.fromNodeId} → ${edge.toNodeId}: up to ${edge.failurePolicy.maximumAttempts ?? "∞"} attempts`,
      )
    }
    if (edge.failurePolicy?.action === "fallback") {
      failover.push(
        `${edge.fromNodeId} → ${edge.toNodeId}: fallback to ${edge.failurePolicy.fallbackNodeId ?? "—"}`,
      )
    }
    if (
      edge.deliveryPolicy?.deduplication &&
      edge.deliveryPolicy.deduplication !== "none"
    ) {
      idempotency.push(
        `${edge.dataType}: ${edge.deliveryPolicy.deduplication} deduplication`,
      )
    }
  }
  for (const contract of graph.dataContracts) {
    if (contract.idempotencyKey) {
      idempotency.push(`${contract.name}: idempotency key \`${contract.idempotencyKey}\``)
    }
  }
  for (const node of graph.nodes) {
    if (node.type === "resilience.circuit-breaker") {
      circuitBreakers.push(`${node.id}: circuit breaker`)
    }
    if (node.type === "rabbitmq.queue") {
      queues.push(
        `${node.id}: TTL ${number(node.config.messageTtlMs) / 1000}s, ${
          node.config.deadLetterQueue === true ? "DLQ enabled" : "no DLQ"
        }`,
      )
    }
  }
  const recovery: string[] = []
  const goals = graph.architectureGoals
  if (goals?.maximumRecoveryTimeSeconds !== undefined) {
    recovery.push(`Recover to normal within ${goals.maximumRecoveryTimeSeconds}s`)
  }
  if (goals?.maximumRecoveryPointSeconds !== undefined) {
    recovery.push(`Lose at most ${goals.maximumRecoveryPointSeconds}s of recent work`)
  }
  for (const scenario of graph.failureScenarios ?? []) {
    if (scenario.recoveryBehavior) {
      recovery.push(`${scenario.name}: ${scenario.recoveryBehavior}`)
    }
  }

  return { timeouts, retries, idempotency, circuitBreakers, queues, failover, recovery }
}

function developmentSequence(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): BlueprintPhase[] {
  const messagingNodeIds = new Set(
    graph.nodes
      .filter((node) => {
        const category = registry.get(node.type)?.category
        return category === "Messaging" || category === "Streaming"
      })
      .map((node) => node.id),
  )
  const byPhase = new Map<number, string[]>()
  const add = (phase: number, ...items: string[]) => {
    byPhase.set(phase, [...(byPhase.get(phase) ?? []), ...items])
  }

  add(1, ...contractItems(graph))
  for (const node of graph.nodes) {
    const fedByMessaging = graph.edges.some(
      (edge) => edge.toNodeId === node.id && messagingNodeIds.has(edge.fromNodeId),
    )
    const label = registry.get(node.type)?.label ?? node.type
    add(phaseOf(node, registry, fedByMessaging), label)
  }
  for (const scenario of graph.failureScenarios ?? []) {
    add(9, `Exercise scenario: ${scenario.name}`)
  }

  const titles: Record<number, string> = {
    1: "Shared contracts",
    2: "Sources of truth",
    3: "Core synchronous path",
    4: "Messaging infrastructure",
    5: "Background consumers",
    6: "Derived views and caches",
    7: "External integrations",
    8: "Resilience behavior",
    9: "Observability and scenario tests",
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter((step) => (byPhase.get(step)?.length ?? 0) > 0)
    .map((step) => ({ step, title: titles[step], items: byPhase.get(step) ?? [] }))
}

function contractItems(graph: FlowGraph): string[] {
  return [...new Set(graph.dataContracts.map((contract) => contract.name))].map(
    (name) => `Define and version ${name}`,
  )
}

function testPlan(graph: FlowGraph, registry: ReadonlyMap<string, NodeDefinition>) {
  const groups: { category: string; items: string[] }[] = []
  const push = (category: string, items: string[]) => {
    const unique = [...new Set(items)]
    if (unique.length > 0) groups.push({ category, items: unique })
  }

  push(
    "Contract compatibility",
    graph.dataContracts.map((contract: DataContract) => {
      const versions = contractVersions(graph.dataContracts, contract.name)
      return versions.length > 1
        ? `Verify ${contract.name} evolves ${versions.map((v) => v.version).join(" → ")} within ${contract.compatibility} compatibility`
        : `Verify consumers accept ${contract.name} v${contract.version}`
    }),
  )
  push(
    "Happy-path integration",
    graph.nodes
      .filter((node) => graph.edges.every((edge) => edge.toNodeId !== node.id))
      .map(
        (node) =>
          `End-to-end flow starting at ${registry.get(node.type)?.label ?? node.id}`,
      ),
  )
  const goals = graph.architectureGoals
  push("Capacity", [
    ...(goals?.peakTrafficPerSecond !== undefined
      ? [
          `Sustain peak traffic of ${goals.peakTrafficPerSecond.toLocaleString()} events/s`,
        ]
      : []),
  ])
  push(
    "Duplicate delivery",
    graph.edges
      .filter((edge) => edge.deliveryPolicy?.guarantee === "at-least-once")
      .map((edge) => `Consumer of ${edge.dataType} tolerates a duplicate delivery`),
  )
  push(
    "Timeout and retry",
    graph.edges
      .filter((edge) => edge.failurePolicy?.action === "retry")
      .map(
        (edge) =>
          `${edge.toNodeId} recovers within its retry budget when ${edge.dataType} calls fail`,
      ),
  )
  push(
    "Dependency outage",
    (graph.failureScenarios ?? []).map(
      (scenario) => `Reproduce "${scenario.name}" and confirm the expected user impact`,
    ),
  )
  push(
    "Recovery and backlog drain",
    graph.nodes
      .filter((node) => node.type === "rabbitmq.queue")
      .map(
        (node) => `Backlog at ${node.id} drains within the recovery goal after an outage`,
      ),
  )
  push(
    "Data consistency",
    graph.nodes
      .filter((node) => node.stateOwnership !== undefined)
      .map(
        (node) =>
          `${node.id} honors ${node.stateOwnership?.consistencyModel} consistency under concurrent writes`,
      ),
  )
  return groups
}

function riskGroups(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
  findings: ArchitectureRule[],
  goalReport: GoalReport | undefined,
) {
  const groups: { category: string; items: string[] }[] = []
  const push = (category: string, items: string[]) => {
    if (items.length > 0) groups.push({ category, items })
  }

  push(
    "Failed architecture goals",
    (goalReport?.evaluations ?? [])
      .filter((evaluation) => evaluation.status === "failed")
      .map((evaluation) => `${evaluation.label}: ${evaluation.reason}`),
  )
  push(
    "Validation findings",
    validateFlow(graph, registry).map((issue) => issue.message),
  )
  push(
    "Accepted risks",
    (graph.ruleAcceptances ?? []).map(
      (acceptance) =>
        `${acceptance.ruleCode}: ${acceptance.reason}${
          acceptance.reviewDate ? ` (review by ${acceptance.reviewDate})` : ""
        }`,
    ),
  )
  push(
    "Unverified assumptions",
    (graph.assumptions ?? [])
      .filter((assumption) => assumption.status === "unverified")
      .map((assumption) => `${assumption.statement} (${assumption.impact} impact)`),
  )
  push(
    "Missing owners",
    findings
      .filter(
        (finding) =>
          finding.code === "CRITICAL_WITHOUT_OWNER" ||
          finding.code === "STATEFUL_WITHOUT_OWNER",
      )
      .map((finding) => finding.message),
  )
  push(
    "Decisions awaiting review",
    (graph.decisionRecords ?? [])
      .filter((record) => record.status === "proposed")
      .map((record) => record.title),
  )
  return groups
}

export function generateBlueprint(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): Blueprint {
  const findings = evaluateRules(graph, registry).filter(
    (finding) => !findAcceptance(finding, graph.ruleAcceptances),
  )
  const result = runSimulation(graph, registry)
  const metricsById = new Map(result.nodeMetrics.map((metric) => [metric.nodeId, metric]))

  const sources = graph.nodes.filter((node) =>
    graph.edges.every((edge: FlowEdge) => edge.toNodeId !== node.id),
  )
  const purpose =
    sources.length > 0
      ? `Handle ${sources
          .map((node) =>
            String(node.config.eventType ?? node.config.queueName ?? node.type),
          )
          .join(", ")} through ${graph.name}.`
      : `Implement ${graph.name}.`

  const goals = graph.architectureGoals
  const goalLines: string[] = []
  if (goals) {
    if (goals.averageTrafficPerSecond !== undefined) {
      goalLines.push(
        `Average traffic ${goals.averageTrafficPerSecond.toLocaleString()} events/s`,
      )
    }
    if (goals.peakTrafficPerSecond !== undefined) {
      goalLines.push(
        `Peak traffic ${goals.peakTrafficPerSecond.toLocaleString()} events/s`,
      )
    }
    if (goals.maximumP95LatencyMs !== undefined) {
      goalLines.push(`p95 latency ≤ ${goals.maximumP95LatencyMs} ms`)
    }
    if (goals.minimumAvailabilityPercent !== undefined) {
      goalLines.push(`Availability ≥ ${goals.minimumAvailabilityPercent}%`)
    }
    if (goals.maximumDataLossEvents !== undefined) {
      goalLines.push(`Data loss ≤ ${goals.maximumDataLossEvents} events`)
    }
    goalLines.push(`Ordering: ${goals.orderingRequirement}`)
  }

  const mainFlows = sources.map(
    (node) => `${String(node.config.eventType ?? node.type)} pipeline`,
  )
  const boundaries = (graph.boundaries ?? []).map(
    (boundary) =>
      `${boundary.label} (${boundary.kind}${boundary.owner ? `, owned by ${boundary.owner}` : ""})`,
  )

  return {
    name: graph.name,
    overview: { purpose, goals: goalLines, mainFlows, boundaries },
    components: graph.nodes.map((node) =>
      componentFor(node, graph, registry, metricsById.get(node.id), findings),
    ),
    contracts: contractSummaries(graph),
    reliability: reliabilityPlan(graph),
    developmentSequence: developmentSequence(graph, registry),
    testPlan: testPlan(graph, registry),
    risks: riskGroups(graph, registry, findings, result.goalReport),
  }
}
