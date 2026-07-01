import { z } from "zod"
import { defineNode, number } from "../shared"

export const cdnNode = defineNode({
  type: "network.cdn",
  label: "CDN",
  category: "Networking",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    edgeLocations: 20,
    cacheHitPercent: 90,
    edgeCapacityPerSecond: 5000,
    hitLatencyMs: 15,
    missLatencyMs: 150,
  },
  configSchema: z.object({
    edgeLocations: z.number().int().positive(),
    cacheHitPercent: z.number().min(0).max(100),
    edgeCapacityPerSecond: z.number().positive(),
    hitLatencyMs: z.number().nonnegative(),
    missLatencyMs: z.number().nonnegative(),
  }),
  simulate: (config) => {
    const hitRate = number(config.cacheHitPercent) / 100
    return {
      latencyMs:
        number(config.hitLatencyMs) * hitRate +
        number(config.missLatencyMs) * (1 - hitRate),
      cpuCores: 0.01,
      memoryMb: 4,
      throughputPerSecond:
        number(config.edgeLocations) * number(config.edgeCapacityPerSecond),
    }
  },
})
