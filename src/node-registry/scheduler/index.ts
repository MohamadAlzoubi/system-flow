import { z } from "zod"
import { defineNode, number } from "../shared"

export const schedulerNode = defineNode({
  type: "scheduler.cron",
  label: "Scheduler / Cron",
  category: "Ingress",
  inputTypes: [],
  outputTypes: ["Event"],
  defaultConfig: {
    cronExpression: "*/5 * * * *",
    jobType: "syncRecommendations",
    batchSize: 10000,
    averageItemProcessingMs: 5,
  },
  configSchema: z.object({
    cronExpression: z.string(),
    jobType: z.string(),
    batchSize: z.number().nonnegative(),
    averageItemProcessingMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.batchSize) * number(config.averageItemProcessingMs),
    cpuCores: 0.1,
    memoryMb: 16,
    outputType: String(config.jobType),
  }),
})
