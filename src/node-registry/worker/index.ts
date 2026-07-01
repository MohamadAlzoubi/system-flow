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
    replicas: 1,
    minReplicas: 1,
    maxReplicas: 10,
    autoscalingEnabled: false,
    scaleUpUtilizationPercent: 70,
    scalingDelaySeconds: 30,
    coldStartSeconds: 10,
    cpuLimitCores: 2,
    memoryLimitMb: 512,
    maxInFlight: 100,
    timeoutMs: 30000,
    drainTimeSeconds: 30,
    averageProcessingMs: 80,
    processingJitterPercent: 25,
    cpuCostPerJob: 0.005,
    memoryMbPerJob: 20,
    ackMode: "manual",
    failureRate: 0.02,
  },
  configSchema: z.object({
    workerName: z.string(),
    concurrency: z.number().nonnegative(),
    replicas: z.number().int().positive(),
    minReplicas: z.number().int().positive(),
    maxReplicas: z.number().int().positive(),
    autoscalingEnabled: z.boolean(),
    scaleUpUtilizationPercent: z.number().positive().max(100),
    scalingDelaySeconds: z.number().nonnegative(),
    coldStartSeconds: z.number().nonnegative(),
    cpuLimitCores: z.number().positive(),
    memoryLimitMb: z.number().positive(),
    maxInFlight: z.number().positive(),
    timeoutMs: z.number().positive(),
    drainTimeSeconds: z.number().nonnegative(),
    averageProcessingMs: z.number().positive(),
    processingJitterPercent: z.number().min(0).max(300),
    cpuCostPerJob: z.number().nonnegative(),
    memoryMbPerJob: z.number().nonnegative(),
    ackMode: z.string(),
    failureRate: z.number().min(0).max(0.99),
  }),
  simulate: (config, context) => {
    const replicas = number(config.replicas)
    const capacityPerReplica = Math.min(
      (number(config.concurrency) * 1000) / number(config.averageProcessingMs),
      (number(config.maxInFlight) * 1000) / number(config.averageProcessingMs),
    )
    const desiredReplicas =
      config.autoscalingEnabled === true
        ? Math.min(
            number(config.maxReplicas),
            Math.max(
              number(config.minReplicas),
              Math.ceil(
                context.ratePerSecond /
                  (capacityPerReplica * (number(config.scaleUpUtilizationPercent) / 100)),
              ),
            ),
          )
        : replicas
    const readyAfterSeconds =
      desiredReplicas > replicas
        ? number(config.scalingDelaySeconds) + number(config.coldStartSeconds)
        : 0
    const scaledSeconds = Math.max(0, context.profile.durationSeconds - readyAfterSeconds)
    const effectiveReplicas =
      (replicas * Math.min(context.profile.durationSeconds, readyAfterSeconds) +
        desiredReplicas * scaledSeconds) /
      context.profile.durationSeconds
    const throughput = capacityPerReplica * effectiveReplicas
    return {
      latencyMs: number(config.averageProcessingMs),
      latencyStdDevMs:
        number(config.averageProcessingMs) *
        (number(config.processingJitterPercent) / 100),
      cpuCores:
        number(config.cpuCostPerJob) * Math.min(context.ratePerSecond, throughput),
      memoryMb: Math.min(
        number(config.memoryLimitMb) * effectiveReplicas,
        number(config.memoryMbPerJob) * number(config.concurrency) * effectiveReplicas,
      ),
      throughputPerSecond: throughput,
      retryAmplification: 1 / (1 - number(config.failureRate)),
      scaling: {
        initialReplicas: replicas,
        desiredReplicas,
        readyAfterSeconds,
        capacityPerReplica,
      },
    }
  },
})
