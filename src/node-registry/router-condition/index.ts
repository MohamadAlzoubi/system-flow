import { z } from "zod"
import { defineNode } from "../shared"

export const routerConditionNode = defineNode({
  type: "router.condition",
  label: "Router / Condition",
  category: "Logic",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    rules: [{ condition: "input.country === 'TR'", target: "turkey-flow" }],
  },
  configSchema: z.object({
    rules: z.array(z.object({ condition: z.string(), target: z.string() })),
  }),
  simulate: () => ({ latencyMs: 1, cpuCores: 0.01, memoryMb: 1 }),
})
