import type { NodeDefinition } from "../contracts"
import { autoscalerNode } from "./autoscaler"
import { batchProcessorNode } from "./batch-processor"
import { cdnNode } from "./cdn"
import { circuitBreakerNode } from "./circuit-breaker"
import { databaseNode } from "./database"
import { databaseProxyNode } from "./database-proxy"
import { deadLetterQueueNode } from "./dead-letter-queue"
import { eventSourceNode } from "./event-source"
import { externalApiNode } from "./external-api"
import { functionNode } from "./function-node"
import { httpEndpointNode } from "./http-endpoint"
import { kafkaTopicNode } from "./kafka-topic"
import { loadBalancerNode } from "./load-balancer"
import { loggerMetricsNode } from "./logger-metrics"
import { objectStorageNode } from "./object-storage"
import { rabbitMqQueueNode } from "./rabbitmq-queue"
import { rateLimiterNode } from "./rate-limiter"
import { readReplicaNode } from "./read-replica"
import { redisCacheNode } from "./redis-cache"
import { routerConditionNode } from "./router-condition"
import { schedulerNode } from "./scheduler"
import { searchEngineNode } from "./search-engine"
import { streamProcessorNode } from "./stream-processor"
import { websocketGatewayNode } from "./websocket-gateway"
import { workerNode } from "./worker"

export const nodeDefinitions: NodeDefinition[] = [
  eventSourceNode,
  httpEndpointNode,
  functionNode,
  routerConditionNode,
  redisCacheNode,
  rabbitMqQueueNode,
  workerNode,
  databaseNode,
  websocketGatewayNode,
  externalApiNode,
  schedulerNode,
  loggerMetricsNode,
  loadBalancerNode,
  rateLimiterNode,
  circuitBreakerNode,
  kafkaTopicNode,
  objectStorageNode,
  cdnNode,
  searchEngineNode,
  batchProcessorNode,
  databaseProxyNode,
  readReplicaNode,
  deadLetterQueueNode,
  streamProcessorNode,
  autoscalerNode,
]

export const nodeRegistry = new Map(
  nodeDefinitions.map((definition) => [definition.type, definition]),
)
