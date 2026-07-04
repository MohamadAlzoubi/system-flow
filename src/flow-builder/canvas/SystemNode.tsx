import { Handle, type NodeProps, Position } from "@xyflow/react"
import {
  Activity,
  ArchiveX,
  Boxes,
  Braces,
  Clock3,
  Cloud,
  Copy,
  Cpu,
  Database,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  Inbox,
  Layers3,
  type LucideIcon,
  Network,
  PackageOpen,
  Radio,
  RadioTower,
  Scaling,
  Search,
  ServerCog,
  Shield,
  Waves,
} from "lucide-react"
import type {
  AvailabilityFrameMetrics,
  DataStoreFrameMetrics,
  NodeSimulationMetrics,
  QueueFrameMetrics,
  ResilienceFrameMetrics,
  ServiceFrameMetrics,
  TrafficFrameMetrics,
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
  "network.load-balancer": Network,
  "resilience.rate-limiter": Gauge,
  "resilience.circuit-breaker": Shield,
  "stream.kafka-topic": Layers3,
  "storage.object": PackageOpen,
  "network.cdn": Network,
  "data.search-engine": Search,
  "compute.batch-processor": Boxes,
  "data.database-proxy": ServerCog,
  "data.read-replica": Copy,
  "messaging.dead-letter-queue": ArchiveX,
  "stream.processor": Waves,
  "control.autoscaler": Scaling,
}

export function SystemNode({ data, selected }: NodeProps) {
  const nodeType = String(data.nodeType)
  const definition = nodeRegistry.get(nodeType)
  const Icon = icons[nodeType] ?? Braces
  const colorClass = `node-${nodeType.replaceAll(".", "-")}`
  const metrics = data.metrics as NodeSimulationMetrics | undefined
  const queueFrame = data.queueFrame as QueueFrameMetrics | undefined
  const serviceFrame = data.serviceFrame as ServiceFrameMetrics | undefined
  const datastoreFrame = data.datastoreFrame as DataStoreFrameMetrics | undefined
  const resilienceFrame = data.resilienceFrame as ResilienceFrameMetrics | undefined
  const availabilityFrame = data.availabilityFrame as AvailabilityFrameMetrics | undefined
  const trafficFrame = data.trafficFrame as TrafficFrameMetrics | undefined

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
          {availabilityFrame && availabilityFrame.state !== "online"
            ? `${availabilityFrame.state} · ${availabilityFrame.capacityPercent}% capacity`
            : serviceFrame
              ? `${serviceFrame.replicas}/${serviceFrame.desiredReplicas} replicas · ${serviceFrame.limitingResource}`
              : resilienceFrame
                ? `${resilienceFrame.circuitState} · ${resilienceFrame.downstreamRatePerSecond.toLocaleString()}/s downstream`
                : datastoreFrame
                  ? `${datastoreFrame.primaryState} · ${Math.round(datastoreFrame.connectionUtilizationPercent)}% connections`
                  : queueFrame
                    ? `${queueFrame.depth.toLocaleString()} queued · ${queueFrame.activePartitions} partitions · ${Math.round(queueFrame.averageMessageAgeMs / 1000)}s old`
                    : trafficFrame
                      ? `${trafficFrame.inputRatePerSecond.toLocaleString()}/s in · ${trafficFrame.acceptedRatePerSecond.toLocaleString()}/s served`
                      : metrics?.resilience
                        ? `${Math.round(metrics.resilience.availabilityPercent)}% available · ${Math.round(metrics.resilience.rejectedPerSecond)}/s rejected`
                        : metrics?.datastore
                          ? `${metrics.datastore.limitingResource} · ${Math.round(metrics.capacityPerSecond ?? 0).toLocaleString()}/s`
                          : metrics
                            ? `${metrics.incomingRatePerSecond.toLocaleString()}/s · ${metrics.capacityPerSecond ? `${Math.round(metrics.utilizationPercent ?? 0)}%` : `${metrics.latencyMs} ms`}`
                            : String(data.subtitle || definition?.category)}
        </small>
        {(data.boundaryLabel !== undefined || data.owner !== undefined) && (
          <em className="node-meta">
            {[data.boundaryLabel, data.owner].filter(Boolean).join(" · ")}
          </em>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
