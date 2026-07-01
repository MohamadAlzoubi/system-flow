import { z } from "zod"
import { defineNode, number } from "../shared"

export const databaseNode = defineNode({
  type: "database",
  label: "Database",
  category: "Data",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    databaseType: "mongodb",
    operation: "insert",
    averageQueryMs: 15,
    connectionPoolSize: 50,
    maxWritesPerSecond: 2000,
    documentSizeBytes: 1500,
    indexUsed: true,
  },
  configSchema: z.object({
    databaseType: z.string(),
    operation: z.string(),
    averageQueryMs: z.number().nonnegative(),
    connectionPoolSize: z.number().nonnegative(),
    maxWritesPerSecond: z.number().nonnegative(),
    documentSizeBytes: z.number().nonnegative(),
    indexUsed: z.boolean(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageQueryMs),
    cpuCores: 0.2,
    memoryMb: number(config.connectionPoolSize) * 2,
    throughputPerSecond: number(config.maxWritesPerSecond),
  }),
})
