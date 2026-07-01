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
    scaleDownDelaySeconds: 60,
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
    retryCount: 3,
    retryBackoffMs: 1000,
    retryMaxBackoffMs: 30000,
    retryJitterPercent: 20,
    failureJitterPercent: 10,
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
    scaleDownDelaySeconds: z.number().nonnegative(),
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
    retryCount: z.number().int().nonnegative(),
    retryBackoffMs: z.number().nonnegative(),
    retryMaxBackoffMs: z.number().nonnegative(),
    retryJitterPercent: z.number().min(0).max(100),
    failureJitterPercent: z.number().min(0).max(100),
  }),
  simulate: (config, context) => {
    const replicas = number(config.replicas)
    const processingMs = number(config.averageProcessingMs)
    const capacities = {
      concurrency: (number(config.concurrency) * 1000) / processingMs,
      "in-flight": (number(config.maxInFlight) * 1000) / processingMs,
      cpu:
        number(config.cpuCostPerJob) > 0
          ? number(config.cpuLimitCores) / number(config.cpuCostPerJob)
          : Number.POSITIVE_INFINITY,
      memory:
        number(config.memoryMbPerJob) > 0
          ? (number(config.memoryLimitMb) / number(config.memoryMbPerJob)) *
            (1000 / processingMs)
          : Number.POSITIVE_INFINITY,
      timeout: processingMs > number(config.timeoutMs) ? 0 : Number.POSITIVE_INFINITY,
    }
    const [limitingResource, capacityPerReplica] = (
      Object.entries(capacities) as Array<[keyof typeof capacities, number]>
    ).reduce((lowest, current) => (current[1] < lowest[1] ? current : lowest))
    const desiredReplicas =
      limitingResource === "timeout"
        ? number(config.minReplicas)
        : config.autoscalingEnabled === true
          ? Math.min(
              number(config.maxReplicas),
              Math.max(
                number(config.minReplicas),
                Math.ceil(
                  context.ratePerSecond /
                    (capacityPerReplica *
                      (number(config.scaleUpUtilizationPercent) / 100)),
                ),
              ),
            )
          : replicas
    const direction =
      desiredReplicas > replicas ? "up" : desiredReplicas < replicas ? "down" : "none"
    const readyAfterSeconds =
      direction === "up"
        ? number(config.scalingDelaySeconds) + number(config.coldStartSeconds)
        : direction === "down"
          ? number(config.scaleDownDelaySeconds) + number(config.drainTimeSeconds)
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
      retryAmplification:
        (1 - number(config.failureRate) ** (number(config.retryCount) + 1)) /
        (1 - number(config.failureRate)),
      retrySchedule: {
        retryCount: number(config.retryCount),
        initialDelayMs: number(config.retryBackoffMs),
        maximumDelayMs: number(config.retryMaxBackoffMs),
        jitterPercent: number(config.retryJitterPercent),
      },
      scaling: {
        initialReplicas: replicas,
        desiredReplicas,
        readyAfterSeconds,
        capacityPerReplica,
        direction,
        limitingResource,
      },
    }
  },
})
