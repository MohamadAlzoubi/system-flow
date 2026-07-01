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
    failureRate: 0.03,
    retryCount: 2,
  },
  configSchema: z.object({
    providerName: z.string(),
    averageLatencyMs: z.number().nonnegative(),
    latencyJitterPercent: z.number().min(0).max(300),
    timeoutMs: z.number().nonnegative(),
    rateLimitPerSecond: z.number().nonnegative(),
    failureRate: z.number().min(0).max(1),
    retryCount: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageLatencyMs),
    latencyStdDevMs:
      number(config.averageLatencyMs) * (number(config.latencyJitterPercent) / 100),
    cpuCores: 0.01,
    memoryMb: 2,
    throughputPerSecond: number(config.rateLimitPerSecond),
    retryAmplification: 1 + number(config.failureRate) * number(config.retryCount),
  }),
})
