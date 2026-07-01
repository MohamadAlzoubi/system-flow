import { Handle, type NodeProps, Position } from "@xyflow/react"
import {
  Activity,
  Braces,
  Clock3,
  Cloud,
  Cpu,
  Database,
  GitBranch,
  Globe2,
  HardDrive,
  Inbox,
  type LucideIcon,
  Radio,
  RadioTower,
} from "lucide-react"
import type {
  NodeSimulationMetrics,
  QueueFrameMetrics,
  ServiceFrameMetrics,
} from "../../contracts"
import { nodeRegistry } from "../../node-registry"

const icons: Record<string, LucideIcon> = {
  "event.source": Radio,
  "http.endpoint": Globe2,
  "function.service": Braces,
  "router.condition": GitBranch,
  "redis.cache": Database,
  "rabbitmq.queue": Inbox,
  worker: Cpu,
  database: HardDrive,
  "websocket.gateway": RadioTower,
  "external.api": Cloud,
  "scheduler.cron": Clock3,
  "logger.metrics": Activity,
}

export function SystemNode({ data, selected }: NodeProps) {
  const nodeType = String(data.nodeType)
  const definition = nodeRegistry.get(nodeType)
  const Icon = icons[nodeType] ?? Braces
  const colorClass = `node-${nodeType.replaceAll(".", "-")}`
  const metrics = data.metrics as NodeSimulationMetrics | undefined
  const queueFrame = data.queueFrame as QueueFrameMetrics | undefined
  const serviceFrame = data.serviceFrame as ServiceFrameMetrics | undefined

  return (
    <div
      className={`flow-node ${colorClass} simulation-${metrics?.status ?? "none"} ${selected ? "selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <span className="node-icon">
        <Icon size={15} />
      </span>
      <div>
        <strong>{definition?.label}</strong>
        <small>
          {serviceFrame
            ? `${serviceFrame.replicas}/${serviceFrame.desiredReplicas} replicas · ${serviceFrame.capacityPerSecond.toLocaleString()}/s`
            : queueFrame
              ? `${queueFrame.depth.toLocaleString()} queued · ${Math.round(queueFrame.averageMessageAgeMs / 1000)}s old`
              : metrics?.resilience
                ? `${Math.round(metrics.resilience.availabilityPercent)}% available · ${Math.round(metrics.resilience.rejectedPerSecond)}/s rejected`
                : metrics?.datastore
                  ? `${metrics.datastore.limitingResource} · ${Math.round(metrics.capacityPerSecond ?? 0).toLocaleString()}/s`
                  : metrics
                    ? `${metrics.incomingRatePerSecond.toLocaleString()}/s · ${metrics.capacityPerSecond ? `${Math.round(metrics.utilizationPercent ?? 0)}%` : `${metrics.latencyMs} ms`}`
                    : String(data.subtitle || definition?.category)}
        </small>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
