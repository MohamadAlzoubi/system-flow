import { z } from "zod"
import { defineNode, number } from "../shared"

export const readReplicaNode = defineNode({
  type: "data.read-replica",
  label: "Read Replica",
  category: "Data",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    replicaCount: 2,
    readsPerReplicaSecond: 2000,
    averageReadMs: 12,
    replicationLagMs: 100,
    maxConnectionsPerReplica: 100,
  },
  configSchema: z.object({
    replicaCount: z.number().int().positive(),
    readsPerReplicaSecond: z.number().positive(),
    averageReadMs: z.number().nonnegative(),
    replicationLagMs: z.number().nonnegative(),
    maxConnectionsPerReplica: z.number().positive(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageReadMs) + number(config.replicationLagMs),
    cpuCores: number(config.replicaCount) * 0.2,
    memoryMb: number(config.replicaCount) * 128,
    throughputPerSecond:
      number(config.replicaCount) * number(config.readsPerReplicaSecond),
  }),
})
