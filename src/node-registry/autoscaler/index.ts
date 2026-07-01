import { z } from "zod"
import { defineNode, number } from "../shared"

export const autoscalerNode = defineNode({
  type: "control.autoscaler",
  label: "Autoscaler",
  category: "Control",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    minimumReplicas: 1,
    maximumReplicas: 10,
    targetUtilizationPercent: 70,
    reconciliationSeconds: 15,
    actionsPerSecond: 100,
  },
  configSchema: z.object({
    minimumReplicas: z.number().int().positive(),
    maximumReplicas: z.number().int().positive(),
    targetUtilizationPercent: z.number().positive().max(100),
    reconciliationSeconds: z.number().positive(),
    actionsPerSecond: z.number().positive(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.reconciliationSeconds) * 1000,
    cpuCores: 0.02,
    memoryMb: 16,
    throughputPerSecond: number(config.actionsPerSecond),
  }),
})
