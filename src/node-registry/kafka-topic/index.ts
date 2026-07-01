import { z } from "zod"
import { defineNode, number } from "../shared"

export const kafkaTopicNode = defineNode({
  type: "stream.kafka-topic",
  label: "Kafka Topic",
  category: "Streaming",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    topicName: "events",
    partitions: 6,
    replicas: 3,
    throughputPerPartition: 1000,
    acknowledgementLatencyMs: 5,
    retentionHours: 168,
  },
  configSchema: z.object({
    topicName: z.string().min(1),
    partitions: z.number().int().positive(),
    replicas: z.number().int().positive(),
    throughputPerPartition: z.number().positive(),
    acknowledgementLatencyMs: z.number().nonnegative(),
    retentionHours: z.number().positive(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.acknowledgementLatencyMs),
    cpuCores: number(config.partitions) * 0.05,
    memoryMb: number(config.partitions) * 16,
    throughputPerSecond:
      number(config.partitions) * number(config.throughputPerPartition),
  }),
})
