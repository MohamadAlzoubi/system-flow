import { z } from "zod"
import { defineNode, number } from "../shared"

export const websocketGatewayNode = defineNode({
  type: "websocket.gateway",
  label: "WebSocket Gateway",
  category: "Realtime",
  inputTypes: ["Event"],
  outputTypes: ["WebSocketNotification"],
  defaultConfig: {
    connectedClients: 50000,
    rooms: 1000,
    averageMessageSizeBytes: 800,
    messagesPerSecond: 2000,
    broadcastMode: "room",
    memoryPerConnectionKb: 50,
  },
  configSchema: z.object({
    connectedClients: z.number().nonnegative(),
    rooms: z.number().nonnegative(),
    averageMessageSizeBytes: z.number().nonnegative(),
    messagesPerSecond: z.number().nonnegative(),
    broadcastMode: z.string(),
    memoryPerConnectionKb: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: 8,
    cpuCores: number(config.messagesPerSecond) / 1500,
    memoryMb:
      (number(config.connectedClients) * number(config.memoryPerConnectionKb)) / 1024,
    throughputPerSecond: number(config.messagesPerSecond),
  }),
})
