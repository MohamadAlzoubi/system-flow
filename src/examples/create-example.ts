import type {
  ArchitectureBoundary,
  ArchitectureGoals,
  DataContract,
  FailurePolicy,
  FlowGraph,
  NodeInstance,
} from "../contracts"
import { inferInteractionDefaults } from "../engine"
import { nodeRegistry } from "../node-registry"

const statefulCategories = new Set(["Data", "Messaging", "Streaming"])

const profile = {
  durationSeconds: 300,
  cpuCores: 8,
  memoryMb: 16000,
  networkLatencyMs: 5,
  requestsPerSecond: 500,
  trafficPattern: "steady" as const,
  peakRequestsPerSecond: 1500,
  burstDurationSeconds: 60,
  rampUpSeconds: 30,
  payloadSizeBytes: 1200,
  duplicateEventPercent: 0,
  malformedEventPercent: 0,
}

export type ExampleContract = Pick<
  DataContract,
  "kind" | "description" | "fields" | "idempotencyKey" | "correlationKey" | "partitionKey"
>

export function createExampleFlow(
  id: string,
  name: string,
  types: string[],
  dataType: string,
  architectureGoals: ArchitectureGoals,
  contract: ExampleContract,
  ownerTeam: string,
): FlowGraph {
  const boundary: ArchitectureBoundary = {
    id: `${id}-service`,
    label: name,
    kind: "service",
    owner: ownerTeam,
  }
  const nodes: NodeInstance[] = types.map((type, index) => ({
    id: `${id}-node-${index + 1}`,
    type,
    position: { x: 80 + index * 230, y: 120 + (index % 2) * 90 },
    config: { ...nodeRegistry.get(type)?.defaultConfig },
    boundaryId: boundary.id,
  }))
  for (const [index, node] of nodes.entries()) {
    const category = nodeRegistry.get(node.type)?.category ?? ""
    if (!statefulCategories.has(category)) continue
    node.responsibility = {
      owner: ownerTeam,
      stateful: true,
      sourceOfTruth: node.type === "database",
      implementationStatus: "planned",
    }
    if (node.type === "database") {
      node.stateOwnership = {
        dataOwned: [dataType],
        allowedWriterIds: index > 0 ? [nodes[index - 1].id] : [],
        consistencyModel: "strong",
        conflictResolution: "single-writer",
        transactionBoundary: `One ${dataType} record per write`,
      }
    }
    if (node.type === "redis.cache") {
      node.stateOwnership = {
        dataOwned: [],
        allowedWriterIds: index > 0 ? [nodes[index - 1].id] : [],
        consistencyModel: "eventual",
        cacheInvalidation: "ttl",
        freshnessToleranceMs: 5000,
      }
    }
  }

  // External dependencies get explicit, bounded retry behavior by default.
  const externalRetry: FailurePolicy = {
    action: "retry",
    maximumAttempts: 3,
    backoff: "exponential",
    initialBackoffMs: 200,
    maximumBackoffMs: 2000,
  }
  const edges = nodes.slice(1).map((node, index) => {
    const base = {
      id: `${id}-edge-${index + 1}`,
      fromNodeId: nodes[index].id,
      toNodeId: node.id,
      dataType,
    }
    const defaults = inferInteractionDefaults(base, nodes, nodeRegistry)
    const targetCategory = nodeRegistry.get(node.type)?.category
    return {
      ...base,
      ...defaults,
      responseDataType:
        defaults.interactionType === "request-response" ? `${dataType}Ack` : undefined,
      failurePolicy:
        targetCategory === "Integration" ? structuredClone(externalRetry) : undefined,
    }
  })

  const dataContracts: DataContract[] = [
    {
      name: dataType,
      version: "1.0",
      estimatedSizeBytes: 1200,
      compatibility: "backward",
      ...contract,
    },
  ]
  if (edges.some((edge) => edge.responseDataType === `${dataType}Ack`)) {
    dataContracts.push({
      name: `${dataType}Ack`,
      version: "1.0",
      kind: "response",
      description: "Acknowledgement returned to the caller once work is accepted.",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "accepted", type: "boolean", required: true },
      ],
      estimatedSizeBytes: 200,
      compatibility: "backward",
    })
  }

  return {
    id,
    name,
    nodes,
    edges,
    dataContracts,
    simulationProfile: profile,
    architectureGoals,
    boundaries: [boundary],
  }
}
