import { z } from "zod"
import { defineNode, number } from "../shared"

export const circuitBreakerNode = defineNode({
  type: "resilience.circuit-breaker",
  label: "Circuit Breaker",
  category: "Resilience",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    observedFailurePercent: 0,
    failureThresholdPercent: 50,
    openSeconds: 30,
    halfOpenRequests: 5,
    averageLatencyMs: 1,
  },
  configSchema: z.object({
    observedFailurePercent: z.number().min(0).max(100),
    failureThresholdPercent: z.number().min(0).max(100),
    openSeconds: z.number().nonnegative(),
    halfOpenRequests: z.number().int().positive(),
    averageLatencyMs: z.number().nonnegative(),
  }),
  simulate: (config, context) => {
    const open =
      number(config.observedFailurePercent) >= number(config.failureThresholdPercent)
    const availability = open
      ? Math.max(0, 1 - number(config.openSeconds) / context.profile.durationSeconds)
      : 1
    const capacity = context.ratePerSecond * availability
    return {
      latencyMs: number(config.averageLatencyMs),
      cpuCores: 0.01,
      memoryMb: 4,
      throughputPerSecond: capacity,
      resilience: {
        availabilityPercent: availability * 100,
        rateLimitCapacityPerSecond: context.ratePerSecond,
        bulkheadCapacityPerSecond: context.ratePerSecond,
        circuitOpen: open,
        rejectedPerSecond: context.ratePerSecond - capacity,
        recoverySeconds: open ? number(config.openSeconds) : 0,
      },
    }
  },
})
