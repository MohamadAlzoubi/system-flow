import { createExampleFlow } from "./create-example"

export const productViewedFlow = createExampleFlow(
  "product-viewed",
  "Product Viewed Event Pipeline",
  [
    "event.source",
    "http.endpoint",
    "function.service",
    "redis.cache",
    "rabbitmq.queue",
    "worker",
    "database",
    "websocket.gateway",
  ],
  "ProductViewedEvent",
  {
    averageTrafficPerSecond: 500,
    peakTrafficPerSecond: 1500,
    maximumP95LatencyMs: 800,
    maximumDataLossEvents: 0,
    maximumDataStalenessMs: 5000,
    orderingRequirement: "per-key",
  },
)
