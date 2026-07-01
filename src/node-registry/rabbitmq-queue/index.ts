import { z } from "zod"
import { defineNode } from "../shared"

export const rabbitMqQueueNode = defineNode({
  type: "rabbitmq.queue",
  label: "RabbitMQ Queue",
  category: "Messaging",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    exchangeType: "direct",
    queueName: "events",
    durable: true,
    maxQueueSize: 100000,
    messageTtlMs: 60000,
    retryCount: 3,
    retryDelayMs: 5000,
    deadLetterQueue: true,
    prefetch: 10,
  },
  configSchema: z.object({
    exchangeType: z.string(),
    queueName: z.string(),
    durable: z.boolean(),
    maxQueueSize: z.number().nonnegative(),
    messageTtlMs: z.number().nonnegative(),
    retryCount: z.number().nonnegative(),
    retryDelayMs: z.number().nonnegative(),
    deadLetterQueue: z.boolean(),
    prefetch: z.number().nonnegative(),
  }),
  simulate: () => ({ latencyMs: 5, cpuCores: 0.05, memoryMb: 32 }),
})
