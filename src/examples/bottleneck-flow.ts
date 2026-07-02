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
)

bottleneckFlow.nodes[0].config.ratePerSecond = 1500
bottleneckFlow.nodes[2].config.concurrency = 2
bottleneckFlow.nodes[2].config.averageProcessingMs = 200
