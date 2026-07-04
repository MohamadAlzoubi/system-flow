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
  {
    kind: "command",
    description: "Requests fulfillment of a completed checkout.",
    fields: [
      {
        name: "orderId",
        type: "string",
        required: true,
        description: "Identifies the order; retries must not duplicate it.",
        example: "ord_20260702_183",
      },
      {
        name: "items",
        type: "array",
        required: true,
        description: "Purchased product identifiers and quantities.",
        example: [{ productId: "prod_482", quantity: 1 }],
      },
      {
        name: "amount",
        type: "number",
        required: true,
        description: "Total charge in the smallest currency unit.",
        example: 12900,
      },
      {
        name: "currency",
        type: "string",
        required: true,
        example: "EUR",
      },
      {
        name: "placedAt",
        type: "timestamp",
        required: true,
        description: "When checkout completed.",
      },
    ],
    idempotencyKey: "orderId",
    correlationKey: "orderId",
  },
  "checkout-team",
)

purchaseFlow.failureScenarios = [
  {
    id: "purchase-psp-outage",
    name: "Payment provider unavailable",
    kind: "dependency-unavailable",
    affectedNodeIds: [purchaseFlow.nodes[6].id],
    affectedBoundaryIds: [],
    startSeconds: 60,
    durationSeconds: 90,
    recoverySeconds: 30,
    expectedResponse:
      "Retries back off; orders wait in the queue until the provider returns.",
    expectedUserImpact: "Order confirmation is delayed; no order is charged twice.",
    recoveryBehavior: "Queued orders drain after the provider recovers.",
  },
]

purchaseFlow.assumptions = [
  {
    id: "purchase-psp-idempotency",
    statement: "The payment provider honors idempotency keys on retried charges.",
    status: "unverified",
    impact: "high",
    relatedIds: [purchaseFlow.nodes[6].id],
  },
  {
    id: "purchase-peak-traffic",
    statement: "Peak checkout traffic stays below 2,000 requests per second.",
    status: "unverified",
    impact: "medium",
    relatedIds: [],
  },
]

purchaseFlow.decisionRecords = [
  {
    id: "purchase-queue-before-psp",
    title: "Queue orders before calling the payment provider",
    status: "accepted",
    context:
      "The payment provider has occasional outages and rate limits during peak sales.",
    decision:
      "Accept orders into a durable queue and call the provider from a worker with bounded retries.",
    alternatives: [
      "Call the provider synchronously from the request path.",
      "Drop orders the provider cannot accept immediately.",
    ],
    consequences: [
      "Order confirmation becomes asynchronous.",
      "The queue must be sized for the longest expected provider outage.",
    ],
    assumptionIds: ["purchase-psp-idempotency"],
    relatedNodeIds: [purchaseFlow.nodes[4].id, purchaseFlow.nodes[6].id],
    relatedEdgeIds: [],
  },
]
