import { z } from "zod"
import { defineNode, number } from "../shared"

export const databaseProxyNode = defineNode({
  type: "data.database-proxy",
  label: "Database Proxy",
  category: "Data",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    clientConnections: 1000,
    databaseConnections: 100,
    multiplexingRatio: 10,
    averageLatencyMs: 2,
  },
  configSchema: z.object({
    clientConnections: z.number().positive(),
    databaseConnections: z.number().positive(),
    multiplexingRatio: z.number().positive(),
    averageLatencyMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageLatencyMs),
    cpuCores: 0.1,
    memoryMb: number(config.databaseConnections),
    throughputPerSecond: Math.min(
      number(config.clientConnections),
      number(config.databaseConnections) * number(config.multiplexingRatio),
    ),
  }),
})
