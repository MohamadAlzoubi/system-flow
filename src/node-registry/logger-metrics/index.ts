import { z } from "zod"
import { defineNode, number } from "../shared"

export const loggerMetricsNode = defineNode({
  type: "logger.metrics",
  label: "Logger / Metrics",
  category: "Observability",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: { sampleRate: 1, retentionDays: 30, averageWriteMs: 3 },
  configSchema: z.object({
    sampleRate: z.number().min(0).max(1),
    retentionDays: z.number().nonnegative(),
    averageWriteMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageWriteMs),
    cpuCores: 0.02,
    memoryMb: 8,
  }),
})
