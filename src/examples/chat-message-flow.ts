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
)
