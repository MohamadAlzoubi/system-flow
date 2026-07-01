import { z } from "zod"
import { defineNode, number } from "../shared"

export const rateLimiterNode = defineNode({
  type: "resilience.rate-limiter",
  label: "Rate Limiter",
  category: "Resilience",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    strategy: "token-bucket",
    quota: 1000,
    windowSeconds: 1,
    burstCapacity: 250,
    averageLatencyMs: 1,
  },
  configSchema: z.object({
    strategy: z.enum(["token-bucket", "fixed-window", "sliding-window"]),
    quota: z.number().nonnegative(),
    windowSeconds: z.number().positive(),
    burstCapacity: z.number().nonnegative(),
    averageLatencyMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageLatencyMs),
    cpuCores: 0.02,
    memoryMb: 16,
    throughputPerSecond:
      number(config.quota) / number(config.windowSeconds) +
      number(config.burstCapacity) / number(config.windowSeconds),
  }),
})
