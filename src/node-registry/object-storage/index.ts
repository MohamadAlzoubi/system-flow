import { z } from "zod"
import { defineNode, number } from "../shared"

export const objectStorageNode = defineNode({
  type: "storage.object",
  label: "Object Storage",
  category: "Data",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    operation: "put",
    requestsPerSecond: 3500,
    averageLatencyMs: 80,
    bandwidthMbps: 1000,
    durabilityCopies: 3,
  },
  configSchema: z.object({
    operation: z.enum(["put", "get", "delete"]),
    requestsPerSecond: z.number().nonnegative(),
    averageLatencyMs: z.number().nonnegative(),
    bandwidthMbps: z.number().positive(),
    durabilityCopies: z.number().int().positive(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageLatencyMs),
    cpuCores: 0.02,
    memoryMb: 8,
    throughputPerSecond: number(config.requestsPerSecond),
  }),
})
