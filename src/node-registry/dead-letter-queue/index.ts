import { z } from "zod"
import { defineNode, number } from "../shared"

export const deadLetterQueueNode = defineNode({
  type: "messaging.dead-letter-queue",
  label: "Dead-Letter Queue",
  category: "Messaging",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    maxMessages: 100000,
    writesPerSecond: 2000,
    retentionHours: 168,
    replayPerSecond: 100,
    averageLatencyMs: 5,
  },
  configSchema: z.object({
    maxMessages: z.number().nonnegative(),
    writesPerSecond: z.number().positive(),
    retentionHours: z.number().positive(),
    replayPerSecond: z.number().nonnegative(),
    averageLatencyMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageLatencyMs),
    cpuCores: 0.03,
    memoryMb: 32,
    throughputPerSecond: number(config.writesPerSecond),
  }),
})
