import { z } from "zod"
import { defineNode, number } from "../shared"

export const databaseNode = defineNode({
  type: "database",
  label: "Database",
  category: "Data",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    databaseType: "mongodb",
    operation: "insert",
    averageQueryMs: 15,
    connectionPoolSize: 50,
    maxWritesPerSecond: 2000,
    maxReadsPerSecond: 5000,
    readPercentage: 20,
    cacheHitPercentage: 0,
    maxConnections: 100,
    storageIops: 10000,
    iopsPerOperation: 2,
    contentionPercentage: 0,
    averageTransactionMs: 15,
    readReplicaCount: 0,
    replicationLagMs: 0,
    primaryAvailable: true,
    failoverSeconds: 30,
    documentSizeBytes: 1500,
    indexUsed: true,
  },
  configSchema: z.object({
    databaseType: z.enum(["postgresql", "mysql", "mongodb", "dynamodb", "cassandra"]),
    operation: z.enum(["read", "insert", "update", "delete", "transaction"]),
    averageQueryMs: z.number().nonnegative(),
    connectionPoolSize: z.number().nonnegative(),
    maxWritesPerSecond: z.number().nonnegative(),
    maxReadsPerSecond: z.number().nonnegative(),
    readPercentage: z.number().min(0).max(100),
    cacheHitPercentage: z.number().min(0).max(100),
    maxConnections: z.number().positive(),
    storageIops: z.number().nonnegative(),
    iopsPerOperation: z.number().positive(),
    contentionPercentage: z.number().min(0).max(99),
    averageTransactionMs: z.number().positive(),
    readReplicaCount: z.number().int().nonnegative(),
    replicationLagMs: z.number().nonnegative(),
    primaryAvailable: z.boolean(),
    failoverSeconds: z.number().nonnegative(),
    documentSizeBytes: z.number().nonnegative(),
    indexUsed: z.boolean(),
  }),
  simulate: (config, context) => {
    const readShare = number(config.readPercentage) / 100
    const writeShare = 1 - readShare
    const cacheMissShare = 1 - number(config.cacheHitPercentage) / 100
    const effectiveRate = context.ratePerSecond * cacheMissShare
    const connections = Math.min(
      number(config.connectionPoolSize),
      number(config.maxConnections),
    )
    const transactionMs = Math.max(
      number(config.averageQueryMs),
      number(config.averageTransactionMs),
    )
    const connectionCapacity = (connections * 1000) / transactionMs
    const iopsCapacity = number(config.storageIops) / number(config.iopsPerOperation)
    const contentionFactor = 1 - number(config.contentionPercentage) / 100
    const contentionWaitMs =
      transactionMs *
      (number(config.contentionPercentage) /
        Math.max(1, 100 - number(config.contentionPercentage)))
    const readCapacity =
      (number(config.maxReadsPerSecond) * (1 + number(config.readReplicaCount))) /
      Math.max(readShare, 0.0001)
    const writeCapacity = number(config.maxWritesPerSecond) / Math.max(writeShare, 0.0001)
    const capacities = {
      connections: connectionCapacity * contentionFactor,
      iops: iopsCapacity,
      reads: readCapacity,
      writes: writeCapacity,
    }
    const limitingResource = (
      Object.entries(capacities) as Array<[keyof typeof capacities, number]>
    ).reduce((lowest, current) => (current[1] < lowest[1] ? current : lowest))[0]
    const availableFraction =
      config.primaryAvailable === true
        ? 1
        : Math.max(
            0,
            1 - number(config.failoverSeconds) / context.profile.durationSeconds,
          )
    const throughput = capacities[limitingResource] * availableFraction
    return {
      latencyMs:
        transactionMs + number(config.replicationLagMs) * readShare + contentionWaitMs,
      cpuCores: 0.2 + effectiveRate * 0.0001,
      memoryMb: connections * 2,
      throughputPerSecond: throughput / Math.max(cacheMissShare, 0.0001),
      datastore: {
        effectiveOperationsPerSecond: effectiveRate,
        connectionCapacityPerSecond: capacities.connections,
        iopsCapacityPerSecond: capacities.iops,
        readCapacityPerSecond: capacities.reads,
        writeCapacityPerSecond: capacities.writes,
        limitingResource,
        replicationLagMs: number(config.replicationLagMs),
        failoverSeconds:
          config.primaryAvailable === true ? 0 : number(config.failoverSeconds),
        connectionUtilizationPercent:
          connectionCapacity > 0 ? (effectiveRate / connectionCapacity) * 100 : 0,
        iopsUtilizationPercent:
          iopsCapacity > 0 ? (effectiveRate / iopsCapacity) * 100 : 0,
        contentionWaitMs,
        readReplicaCount: number(config.readReplicaCount),
      },
    }
  },
})
