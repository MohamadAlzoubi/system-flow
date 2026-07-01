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
    partitions: 1,
    consumerGroup: "default",
    publisherConfirmLatencyMs: 2,
    acknowledgementLatencyMs: 2,
    persistenceLatencyMs: 3,
    brokerMaxThroughputPerSecond: 10000,
    maxThroughputPerPartition: 5000,
    brokerStorageMb: 1024,
    bandwidthMbps: 100,
    deadLetterMaxSize: 100000,
    orderingRequired: true,
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
    partitions: z.number().int().positive(),
    consumerGroup: z.string().min(1),
    publisherConfirmLatencyMs: z.number().nonnegative(),
    acknowledgementLatencyMs: z.number().nonnegative(),
    persistenceLatencyMs: z.number().nonnegative(),
    brokerMaxThroughputPerSecond: z.number().positive(),
    maxThroughputPerPartition: z.number().positive(),
    brokerStorageMb: z.number().positive(),
    bandwidthMbps: z.number().positive(),
    deadLetterMaxSize: z.number().nonnegative(),
    orderingRequired: z.boolean(),
  }),
  simulate: (config) => ({
    latencyMs:
      Number(config.publisherConfirmLatencyMs) +
      Number(config.acknowledgementLatencyMs) +
      (config.durable === true ? Number(config.persistenceLatencyMs) : 0),
    cpuCores: 0.05 * Number(config.partitions),
    memoryMb: 32 * Number(config.partitions),
    throughputPerSecond: Math.min(
      Number(config.brokerMaxThroughputPerSecond),
      Number(config.maxThroughputPerPartition) *
        (config.orderingRequired === true ? 1 : Number(config.partitions)),
    ),
  }),
})
