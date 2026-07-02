import type {
  DeliveryPolicy,
  FlowEdge,
  InteractionType,
  NodeDefinition,
  NodeInstance,
} from "../../contracts"

export type InteractionDefaults = {
  interactionType: InteractionType
  timeoutMs?: number
  deliveryPolicy?: DeliveryPolicy
}

const atLeastOnce: DeliveryPolicy = {
  guarantee: "at-least-once",
  ordering: "none",
  acknowledgement: "automatic",
  deduplication: "none",
}

const defaultsByType: Record<InteractionType, InteractionDefaults> = {
  "request-response": { interactionType: "request-response", timeoutMs: 30000 },
  "async-command": { interactionType: "async-command", deliveryPolicy: atLeastOnce },
  "published-event": {
    interactionType: "published-event",
    deliveryPolicy: atLeastOnce,
  },
  stream: {
    interactionType: "stream",
    deliveryPolicy: { ...atLeastOnce, ordering: "per-key" },
  },
  "batch-transfer": { interactionType: "batch-transfer" },
  "database-operation": { interactionType: "database-operation" },
  "realtime-push": { interactionType: "realtime-push" },
}

/**
 * Infers how an edge communicates from what it connects. Consuming from a
 * broker stays asynchronous regardless of the consumer, so source rules win
 * over target rules; everything unrecognized defaults to request-response,
 * the most demanding assumption.
 */
export function inferInteractionDefaults(
  edge: Pick<FlowEdge, "fromNodeId" | "toNodeId">,
  nodes: NodeInstance[],
  registry: ReadonlyMap<string, NodeDefinition>,
): InteractionDefaults {
  const source = nodes.find((node) => node.id === edge.fromNodeId)
  const target = nodes.find((node) => node.id === edge.toNodeId)
  const sourceCategory = source && registry.get(source.type)?.category
  const targetCategory = target && registry.get(target.type)?.category
  const type = ((): InteractionType => {
    if (sourceCategory === "Messaging") return "async-command"
    if (sourceCategory === "Streaming") return "stream"
    if (target?.type === "compute.batch-processor") return "batch-transfer"
    if (targetCategory === "Streaming") return "stream"
    if (targetCategory === "Messaging") return "async-command"
    if (targetCategory === "Data") return "database-operation"
    if (targetCategory === "Realtime") return "realtime-push"
    if (targetCategory === "Observability") return "published-event"
    return "request-response"
  })()
  return structuredClone(defaultsByType[type])
}
