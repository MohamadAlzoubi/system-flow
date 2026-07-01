import { z } from "zod"
import { defineNode, number } from "../shared"

export const workerNode = defineNode({
  type: "worker",
  label: "Worker",
  category: "Compute",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    workerName: "event-worker",
    concurrency: 10,
    averageProcessingMs: 80,
    cpuCostPerJob: 0.005,
    memoryMbPerJob: 20,
    ackMode: "manual",
    failureRate: 0.02,
  },
  configSchema: z.object({
    workerName: z.string(),
    concurrency: z.number().nonnegative(),
    averageProcessingMs: z.number().positive(),
    cpuCostPerJob: z.number().nonnegative(),
    memoryMbPerJob: z.number().nonnegative(),
    ackMode: z.string(),
    failureRate: z.number().min(0).max(0.99),
  }),
  simulate: (config, context) => {
    const throughput =
      (number(config.concurrency) * 1000) / number(config.averageProcessingMs)
    return {
      latencyMs: number(config.averageProcessingMs),
      cpuCores:
        number(config.cpuCostPerJob) * Math.min(context.ratePerSecond, throughput),
      memoryMb: number(config.memoryMbPerJob) * number(config.concurrency),
      throughputPerSecond: throughput,
      retryAmplification: 1 / (1 - number(config.failureRate)),
    }
  },
})
