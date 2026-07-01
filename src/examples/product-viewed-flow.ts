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
)
