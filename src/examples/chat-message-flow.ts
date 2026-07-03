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
  {
    kind: "event",
    description: "A chat message accepted for delivery to channel members.",
    fields: [
      {
        name: "messageId",
        type: "string",
        required: true,
        example: "msg_5511",
      },
      {
        name: "channelId",
        type: "string",
        required: true,
        description: "Channel whose members receive the message.",
        example: "chn_42",
      },
      {
        name: "senderId",
        type: "string",
        required: true,
        example: "usr_1099",
      },
      {
        name: "body",
        type: "string",
        required: true,
        sensitive: true,
        description: "Message text written by the sender.",
      },
      {
        name: "sentAt",
        type: "timestamp",
        required: true,
      },
    ],
    correlationKey: "messageId",
    partitionKey: "channelId",
  },
  "messaging-team",
)

chatMessageFlow.failureScenarios = [
  {
    id: "chat-viral-spike",
    name: "Viral moment traffic spike",
    kind: "traffic-spike",
    affectedNodeIds: [],
    affectedBoundaryIds: [],
    startSeconds: 60,
    durationSeconds: 60,
    recoverySeconds: 0,
    trafficMultiplier: 4,
    expectedResponse: "The endpoint and gateway absorb four times normal traffic.",
    expectedUserImpact: "Messages may deliver slightly slower during the spike.",
    recoveryBehavior: "Latency returns to normal as the spike subsides.",
  },
]

// The gateway pushes notifications, not the original chat event.
const gatewayToLogger = chatMessageFlow.edges.at(-1)
if (gatewayToLogger) gatewayToLogger.dataType = "WebSocketNotification"
chatMessageFlow.dataContracts.push({
  name: "WebSocketNotification",
  version: "1.0",
  kind: "event",
  description: "Delivery record for a message pushed over a live connection.",
  fields: [
    { name: "messageId", type: "string", required: true, example: "msg_5511" },
    { name: "channelId", type: "string", required: true, example: "chn_42" },
    { name: "deliveredAt", type: "timestamp", required: true },
  ],
  estimatedSizeBytes: 600,
  compatibility: "backward",
})
