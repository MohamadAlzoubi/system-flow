import { z } from "zod"
import { defineNode, number } from "../shared"

export const externalApiNode = defineNode({
  type: "external.api",
  label: "External API",
  category: "Integration",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    providerName: "SendGrid",
    averageLatencyMs: 300,
    latencyJitterPercent: 35,
    timeoutMs: 3000,
    rateLimitPerSecond: 100,
    rateLimitWindowSeconds: 1,
    rateLimitQuota: 100,
    failureRate: 0.03,
    retryCount: 2,
    circuitBreakerEnabled: true,
    circuitFailureThresholdPercent: 50,
    circuitOpenSeconds: 30,
    recoverySuccessThreshold: 5,
    bulkheadMaxConcurrent: 50,
  },
  configSchema: z.object({
    providerName: z.string(),
    averageLatencyMs: z.number().nonnegative(),
    latencyJitterPercent: z.number().min(0).max(300),
    timeoutMs: z.number().nonnegative(),
    rateLimitPerSecond: z.number().nonnegative(),
    rateLimitWindowSeconds: z.number().positive(),
    rateLimitQuota: z.number().nonnegative(),
    failureRate: z.number().min(0).max(1),
    retryCount: z.number().nonnegative(),
    circuitBreakerEnabled: z.boolean(),
    circuitFailureThresholdPercent: z.number().min(0).max(100),
    circuitOpenSeconds: z.number().nonnegative(),
    recoverySuccessThreshold: z.number().int().positive(),
    bulkheadMaxConcurrent: z.number().positive(),
  }),
  simulate: (config, context) => {
    const rateLimitCapacity = Math.min(
      number(config.rateLimitPerSecond),
      number(config.rateLimitQuota) / number(config.rateLimitWindowSeconds),
    )
    const bulkheadCapacity =
      (number(config.bulkheadMaxConcurrent) * 1000) /
      Math.max(1, number(config.averageLatencyMs))
    const circuitOpen =
      config.circuitBreakerEnabled === true &&
      number(config.failureRate) * 100 >= number(config.circuitFailureThresholdPercent)
    const recoverySeconds = circuitOpen ? number(config.circuitOpenSeconds) : 0
    const availability =
      (1 - number(config.failureRate)) *
      (circuitOpen
        ? Math.max(0, 1 - recoverySeconds / Math.max(1, context.profile.durationSeconds))
        : 1)
    const capacity = Math.min(rateLimitCapacity, bulkheadCapacity) * availability
    return {
      latencyMs: number(config.averageLatencyMs),
      latencyStdDevMs:
        number(config.averageLatencyMs) * (number(config.latencyJitterPercent) / 100),
      cpuCores: 0.01,
      memoryMb: 2,
      throughputPerSecond: capacity,
      retryAmplification: 1 + number(config.failureRate) * number(config.retryCount),
      resilience: {
        availabilityPercent: availability * 100,
        rateLimitCapacityPerSecond: rateLimitCapacity,
        bulkheadCapacityPerSecond: bulkheadCapacity,
        circuitOpen,
        rejectedPerSecond: Math.max(0, context.ratePerSecond - capacity),
        recoverySeconds,
      },
    }
  },
})
