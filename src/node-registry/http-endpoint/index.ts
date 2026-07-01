import { z } from "zod"
import { defineNode, number } from "../shared"

export const httpEndpointNode = defineNode({
  type: "http.endpoint",
  label: "HTTP Endpoint",
  category: "Ingress",
  inputTypes: ["Event"],
  outputTypes: ["Event"],
  defaultConfig: {
    method: "POST",
    path: "/events",
    timeoutMs: 3000,
    authRequired: true,
    maxRequestsPerSecond: 1000,
    averageLatencyMs: 40,
  },
  configSchema: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string(),
    timeoutMs: z.number().nonnegative(),
    authRequired: z.boolean(),
    maxRequestsPerSecond: z.number().nonnegative(),
    averageLatencyMs: z.number().nonnegative(),
  }),
  simulate: (config) => ({
    latencyMs: number(config.averageLatencyMs),
    cpuCores: 0.05,
    memoryMb: 8,
    throughputPerSecond: number(config.maxRequestsPerSecond),
  }),
})
