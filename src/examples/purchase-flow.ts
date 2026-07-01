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
)
