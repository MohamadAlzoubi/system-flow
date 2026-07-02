import { createExampleFlow } from "./create-example"

export const purchaseFlow = createExampleFlow(
  "purchase",
  "Purchase Event Pipeline",
  [
    "event.source",
    "http.endpoint",
    "function.service",
    "database",
    "rabbitmq.queue",
    "worker",
    "external.api",
  ],
  "PurchaseEvent",
  {
    averageTrafficPerSecond: 500,
    peakTrafficPerSecond: 1500,
    maximumAverageLatencyMs: 800,
    maximumP95LatencyMs: 1200,
    minimumAvailabilityPercent: 99.9,
    maximumDataLossEvents: 0,
    maximumRecoveryTimeSeconds: 300,
    orderingRequirement: "none",
  },
)
