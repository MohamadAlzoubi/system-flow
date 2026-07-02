import type {
  ArchitectureGoals,
  DataContract,
  FlowGraph,
  NodeInstance,
} from "../contracts"
import { inferInteractionDefaults } from "../engine"
import { nodeRegistry } from "../node-registry"

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

export function createExampleFlow(
  id: string,
  name: string,
  types: string[],
  dataType: string,
  architectureGoals: ArchitectureGoals,
): FlowGraph {
  const nodes: NodeInstance[] = types.map((type, index) => ({
    id: `${id}-node-${index + 1}`,
    type,
    position: { x: 80 + index * 230, y: 120 + (index % 2) * 90 },
    config: { ...nodeRegistry.get(type)?.defaultConfig },
  }))

  const edges = nodes.slice(1).map((node, index) => {
    const base = {
      id: `${id}-edge-${index + 1}`,
      fromNodeId: nodes[index].id,
      toNodeId: node.id,
      dataType,
    }
    const defaults = inferInteractionDefaults(base, nodes, nodeRegistry)
    return {
      ...base,
      ...defaults,
      responseDataType:
        defaults.interactionType === "request-response" ? `${dataType}Ack` : undefined,
    }
  })

  const dataContracts: DataContract[] = [
    {
      name: dataType,
      version: "1.0",
      schema: { id: "string", timestamp: "string" },
      estimatedSizeBytes: 1200,
    },
  ]
  if (edges.some((edge) => edge.responseDataType === `${dataType}Ack`)) {
    dataContracts.push({
      name: `${dataType}Ack`,
      version: "1.0",
      schema: { id: "string", accepted: "boolean" },
      estimatedSizeBytes: 200,
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
  }
}
