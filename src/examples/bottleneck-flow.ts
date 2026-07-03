import { createExampleFlow } from "./create-example"

export const bottleneckFlow = createExampleFlow(
  "worker-bottleneck",
  "RabbitMQ Worker Bottleneck",
  ["event.source", "rabbitmq.queue", "worker", "database"],
  "QueueJob",
  {
    averageTrafficPerSecond: 1500,
    peakTrafficPerSecond: 3000,
    maximumDataLossEvents: 0,
    maximumRecoveryTimeSeconds: 600,
    orderingRequirement: "none",
  },
  {
    kind: "command",
    description: "A background job queued for asynchronous processing.",
    fields: [
      {
        name: "jobId",
        type: "string",
        required: true,
        description: "Identifies the job; redeliveries must not run it twice.",
        example: "job_77120",
      },
      {
        name: "payload",
        type: "object",
        required: true,
        description: "Work-specific input the worker interprets.",
      },
      {
        name: "enqueuedAt",
        type: "timestamp",
        required: true,
      },
      {
        name: "attempts",
        type: "number",
        required: false,
        description: "Delivery attempts so far.",
        example: 0,
      },
    ],
    idempotencyKey: "jobId",
    correlationKey: "jobId",
  },
  "platform-team",
)

bottleneckFlow.failureScenarios = [
  {
    id: "bottleneck-worker-brownout",
    name: "Worker loses half its capacity",
    kind: "partial-capacity-loss",
    affectedNodeIds: [bottleneckFlow.nodes[2].id],
    affectedBoundaryIds: [],
    startSeconds: 0,
    durationSeconds: 300,
    recoverySeconds: 0,
    intensityPercent: 50,
    expectedResponse: "The already-saturated queue sheds even more jobs.",
    expectedUserImpact: "More jobs expire before a worker ever sees them.",
    recoveryBehavior: "Backlog cannot drain until capacity is restored and increased.",
  },
]

bottleneckFlow.nodes[0].config.ratePerSecond = 1500
bottleneckFlow.nodes[2].config.concurrency = 2
bottleneckFlow.nodes[2].config.averageProcessingMs = 200
