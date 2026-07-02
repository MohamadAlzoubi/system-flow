import { createExampleFlow } from "./create-example"

export const chatMessageFlow = createExampleFlow(
  "chat-message",
  "Chat Message to WebSocket Notification",
  [
    "event.source",
    "http.endpoint",
    "function.service",
    "database",
    "websocket.gateway",
    "logger.metrics",
  ],
  "ChatMessageEvent",
  {
    averageTrafficPerSecond: 500,
    peakTrafficPerSecond: 1500,
    maximumAverageLatencyMs: 250,
    maximumP95LatencyMs: 500,
    maximumDataLossEvents: 0,
    maximumDataStalenessMs: 1000,
    orderingRequirement: "per-key",
  },
)

// The gateway pushes notifications, not the original chat event.
const gatewayToLogger = chatMessageFlow.edges.at(-1)
if (gatewayToLogger) gatewayToLogger.dataType = "WebSocketNotification"
chatMessageFlow.dataContracts.push({
  name: "WebSocketNotification",
  version: "1.0",
  schema: { id: "string", channel: "string", timestamp: "string" },
  estimatedSizeBytes: 600,
})
