import { z } from "zod"
import { defineNode, number } from "../shared"

export const redisCacheNode = defineNode({
  type: "redis.cache",
  label: "Redis Cache",
  category: "Data",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    operation: "read-write",
    keyPattern: "event:{id}",
    ttlSeconds: 3600,
    hitRate: 0.75,
    averageReadMs: 2,
    averageWriteMs: 4,
    maxMemoryMb: 512,
    itemSizeBytes: 2000,
    evictionPolicy: "allkeys-lru",
  },
  configSchema: z.object({
    operation: z.string(),
    keyPattern: z.string(),
    ttlSeconds: z.number().nonnegative(),
    hitRate: z.number().min(0).max(1),
    averageReadMs: z.number().nonnegative(),
    averageWriteMs: z.number().nonnegative(),
    maxMemoryMb: z.number().nonnegative(),
    itemSizeBytes: z.number().nonnegative(),
    evictionPolicy: z.string(),
  }),
  simulate: (config, context) => ({
    latencyMs:
      number(config.averageReadMs) * number(config.hitRate) +
      number(config.averageWriteMs) * (1 - number(config.hitRate)),
    cpuCores: 0.02,
    memoryMb: Math.min(
      number(config.maxMemoryMb),
      (number(config.itemSizeBytes) * context.ratePerSecond * number(config.ttlSeconds)) /
        1_000_000,
    ),
  }),
})
