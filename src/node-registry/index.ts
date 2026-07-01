import type { NodeDefinition } from "../contracts"
import { circuitBreakerNode } from "./circuit-breaker"
import { databaseNode } from "./database"
import { eventSourceNode } from "./event-source"
import { externalApiNode } from "./external-api"
import { functionNode } from "./function-node"
import { httpEndpointNode } from "./http-endpoint"
import { loadBalancerNode } from "./load-balancer"
import { loggerMetricsNode } from "./logger-metrics"
import { rabbitMqQueueNode } from "./rabbitmq-queue"
import { rateLimiterNode } from "./rate-limiter"
import { redisCacheNode } from "./redis-cache"
import { routerConditionNode } from "./router-condition"
import { schedulerNode } from "./scheduler"
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
]

export const nodeRegistry = new Map(
  nodeDefinitions.map((definition) => [definition.type, definition]),
)
