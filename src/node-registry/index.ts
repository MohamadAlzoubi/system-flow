import type { NodeDefinition } from "../contracts"
import { databaseNode } from "./database"
import { eventSourceNode } from "./event-source"
import { externalApiNode } from "./external-api"
import { functionNode } from "./function-node"
import { httpEndpointNode } from "./http-endpoint"
import { loggerMetricsNode } from "./logger-metrics"
import { rabbitMqQueueNode } from "./rabbitmq-queue"
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
]

export const nodeRegistry = new Map(
  nodeDefinitions.map((definition) => [definition.type, definition]),
)
