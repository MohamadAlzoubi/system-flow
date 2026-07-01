import { z } from "zod"
import { defineNode, number } from "../shared"

export const batchProcessorNode = defineNode({
  type: "compute.batch-processor",
  label: "Batch Processor",
  category: "Compute",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    batchSize: 100,
    parallelBatches: 4,
    processingMsPerBatch: 1000,
    flushIntervalMs: 5000,
  },
  configSchema: z.object({
    batchSize: z.number().int().positive(),
    parallelBatches: z.number().int().positive(),
    processingMsPerBatch: z.number().positive(),
    flushIntervalMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.processingMsPerBatch) + number(config.flushIntervalMs) / 2,
    cpuCores: number(config.parallelBatches) * 0.5,
    memoryMb: number(config.batchSize) * number(config.parallelBatches) * 0.1,
    throughputPerSecond:
      (number(config.batchSize) * number(config.parallelBatches) * 1000) /
      number(config.processingMsPerBatch),
  }),
})
