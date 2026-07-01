import { createExampleFlow } from "./create-example"

export const bottleneckFlow = createExampleFlow(
  "worker-bottleneck",
  "RabbitMQ Worker Bottleneck",
  ["event.source", "rabbitmq.queue", "worker", "database"],
  "QueueJob",
)

bottleneckFlow.nodes[0].config.ratePerSecond = 1500
bottleneckFlow.nodes[2].config.concurrency = 2
bottleneckFlow.nodes[2].config.averageProcessingMs = 200
