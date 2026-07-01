import { z } from "zod"
import { defineNode, number } from "../shared"

export const streamProcessorNode = defineNode({
  type: "stream.processor",
  label: "Stream Processor",
  category: "Streaming",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    parallelism: 4,
    eventsPerTaskSecond: 1000,
    windowSeconds: 10,
    checkpointIntervalMs: 10000,
    processingLatencyMs: 20,
  },
  configSchema: z.object({
    parallelism: z.number().int().positive(),
    eventsPerTaskSecond: z.number().positive(),
    windowSeconds: z.number().positive(),
    checkpointIntervalMs: z.number().positive(),
    processingLatencyMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs:
      number(config.processingLatencyMs) + number(config.checkpointIntervalMs) / 2000,
    cpuCores: number(config.parallelism) * 0.5,
    memoryMb: number(config.parallelism) * 128,
    throughputPerSecond: number(config.parallelism) * number(config.eventsPerTaskSecond),
  }),
})
