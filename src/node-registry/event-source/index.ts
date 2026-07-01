import { z } from "zod"
import { defineNode } from "../shared"

export const eventSourceNode = defineNode({
  type: "event.source",
  label: "Event Source",
  category: "Ingress",
  inputTypes: [],
  outputTypes: ["Event"],
  defaultConfig: {
    eventType: "ProductViewedEvent",
    ratePerSecond: 500,
    payloadSizeBytes: 1200,
    burstMode: false,
  },
  configSchema: z.object({
    eventType: z.string(),
    ratePerSecond: z.number().nonnegative(),
    payloadSizeBytes: z.number().nonnegative(),
    burstMode: z.boolean(),
  }),
  simulate: (config) => ({
    latencyMs: 0,
    cpuCores: 0,
    memoryMb: 0,
    outputType: String(config.eventType),
  }),
})
