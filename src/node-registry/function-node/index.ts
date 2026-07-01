import { z } from "zod"
import { defineNode, number } from "../shared"

export const functionNode = defineNode({
  type: "function.service",
  label: "Function / Service",
  category: "Compute",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    functionName: "enrichEvent",
    averageExecutionMs: 20,
    cpuCostPerRequest: 0.003,
    memoryMbPerRequest: 5,
    failureRate: 0.01,
  },
  configSchema: z.object({
    functionName: z.string(),
    averageExecutionMs: z.number().nonnegative(),
    cpuCostPerRequest: z.number().nonnegative(),
    memoryMbPerRequest: z.number().nonnegative(),
    failureRate: z.number().min(0).max(1),
  }),
  simulate: (config, context) => ({
    latencyMs: number(config.averageExecutionMs),
    cpuCores: number(config.cpuCostPerRequest) * context.ratePerSecond,
    memoryMb: number(config.memoryMbPerRequest),
  }),
})
