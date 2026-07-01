import { z } from "zod"
import { defineNode, number } from "../shared"

export const searchEngineNode = defineNode({
  type: "data.search-engine",
  label: "Search Engine",
  category: "Data",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    shards: 5,
    replicas: 1,
    queriesPerShardSecond: 500,
    averageQueryMs: 40,
    indexingPerSecond: 1000,
  },
  configSchema: z.object({
    shards: z.number().int().positive(),
    replicas: z.number().int().nonnegative(),
    queriesPerShardSecond: z.number().positive(),
    averageQueryMs: z.number().nonnegative(),
    indexingPerSecond: z.number().positive(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageQueryMs),
    cpuCores: number(config.shards) * 0.2,
    memoryMb: number(config.shards) * 128,
    throughputPerSecond: number(config.shards) * number(config.queriesPerShardSecond),
  }),
})
