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
  {
    kind: "event",
    description: "Emitted whenever a shopper opens a product page.",
    fields: [
      {
        name: "eventId",
        type: "string",
        required: true,
        description: "Unique identifier of this view event.",
        example: "evt_8f2c41",
      },
      {
        name: "productId",
        type: "string",
        required: true,
        description: "Product whose page was opened.",
        example: "prod_482",
      },
      {
        name: "userId",
        type: "string",
        required: true,
        sensitive: true,
        description: "Shopper who viewed the product.",
        example: "usr_1099",
      },
      {
        name: "viewedAt",
        type: "timestamp",
        required: true,
        description: "When the page was opened.",
      },
      {
        name: "referrer",
        type: "string",
        required: false,
        description: "Where the shopper came from.",
        example: "search",
      },
    ],
    correlationKey: "eventId",
    partitionKey: "productId",
  },
  "storefront-team",
)

productViewedFlow.failureScenarios = [
  {
    id: "product-viewed-worker-outage",
    name: "Worker outage during peak browsing",
    kind: "consumer-outage",
    affectedNodeIds: [productViewedFlow.nodes[5].id],
    affectedBoundaryIds: [],
    startSeconds: 60,
    durationSeconds: 60,
    recoverySeconds: 30,
    expectedResponse:
      "The queue absorbs events while the worker is down and drains after recovery.",
    expectedUserImpact: "Live product-view updates arrive late; nothing is lost.",
    recoveryBehavior:
      "Backlog drains within the recovery window once the worker returns.",
  },
]
