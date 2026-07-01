import { z } from "zod"
import { defineNode, number } from "../shared"

export const loadBalancerNode = defineNode({
  type: "network.load-balancer",
  label: "Load Balancer",
  category: "Networking",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    algorithm: "round-robin",
    healthyTargets: 3,
    capacityPerTarget: 1000,
    connectionLimit: 10000,
    averageLatencyMs: 2,
    healthCheckIntervalSeconds: 10,
  },
  configSchema: z.object({
    algorithm: z.enum(["round-robin", "least-connections", "weighted"]),
    healthyTargets: z.number().int().nonnegative(),
    capacityPerTarget: z.number().nonnegative(),
    connectionLimit: z.number().nonnegative(),
    averageLatencyMs: z.number().nonnegative(),
    healthCheckIntervalSeconds: z.number().positive(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageLatencyMs),
    cpuCores: 0.05 * Math.max(1, number(config.healthyTargets)),
    memoryMb: 32,
    throughputPerSecond: Math.min(
      number(config.connectionLimit),
      number(config.healthyTargets) * number(config.capacityPerTarget),
    ),
  }),
})
