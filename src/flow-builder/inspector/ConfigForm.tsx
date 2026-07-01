import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import type { NodeDefinition, NodeInstance } from "../../contracts"

type ConfigFormProps = {
  node: NodeInstance
  definition: NodeDefinition
  onSave: (config: Record<string, unknown>) => void
}

const recommendedRanges: Record<string, string> = {
  failureRate: "Recommended: 0–0.1",
  concurrency: "Typical starting range: 1–100",
  replicas: "Typical starting range: 1–20",
  cpuLimitCores: "Typical range: 0.25–8 cores",
  memoryLimitMb: "Typical range: 128–8192 MB",
  timeoutMs: "Keep above expected p99 latency",
  prefetch: "Typical range: 1–500 per consumer",
  connectionPoolSize: "Keep below database maximum connections",
  cacheHitPercentage: "Measure from production when possible",
  bandwidthMbps: "Use the slowest real network segment",
  outagePercent: "Use 0 for baseline; 1–20 for failure scenarios",
}

const fieldDescriptions: Record<string, string> = {
  concurrency: "Maximum jobs one replica can process at the same time.",
  replicas: "Number of service instances available at the start of the run.",
  failureRate: "Expected fraction of operations that fail before retrying.",
  timeoutMs: "Maximum time allowed before an operation is treated as failed.",
  averageProcessingMs: "Typical time needed to process one job.",
  maxInFlight: "Maximum accepted work that may be waiting or executing.",
  retryCount: "Maximum number of additional attempts after the first failure.",
  retryBackoffMs: "Delay before the first retry; later retries grow exponentially.",
  retryJitterPercent: "Randomizes retry timing to reduce synchronized retry storms.",
  prefetch: "Messages reserved by each consumer before acknowledgement.",
  maxQueueSize: "Maximum messages retained before overflow handling begins.",
  messageTtlMs: "Maximum time a message may wait before it expires.",
  connectionPoolSize: "Database connections this component keeps ready for work.",
  storageIops: "Maximum storage input/output operations available each second.",
  cacheHitPercentage: "Requests served without reaching the backing datastore.",
  replicationLagMs: "Delay before replica data catches up with the primary.",
  bandwidthMbps: "Maximum network transfer capacity in megabits per second.",
}

const selectOptions: Record<string, string[]> = {
  "network.load-balancer.algorithm": ["round-robin", "least-connections", "weighted"],
  "resilience.rate-limiter.strategy": ["token-bucket", "fixed-window", "sliding-window"],
  "storage.object.operation": ["put", "get", "delete"],
  "redis.cache.operation": ["read", "write", "read-write"],
  "redis.cache.evictionPolicy": [
    "noeviction",
    "allkeys-lru",
    "volatile-lru",
    "allkeys-lfu",
    "volatile-ttl",
  ],
  "rabbitmq.queue.exchangeType": ["direct", "topic", "fanout", "headers"],
  "database.databaseType": ["postgresql", "mysql", "mongodb", "dynamodb", "cassandra"],
  "database.operation": ["read", "insert", "update", "delete", "transaction"],
  "http.endpoint.method": ["GET", "POST", "PUT", "PATCH", "DELETE"],
  "worker.ackMode": ["automatic", "manual", "none"],
  "websocket.gateway.broadcastMode": ["direct", "room", "broadcast"],
}

function fieldGroup(key: string): string {
  if (/latency|timeout|delay|duration|interval|ttl|processing|backoff|lag/i.test(key)) {
    return "Timing"
  }
  if (/failure|retry|durable|ack|dead|outage|circuit|health/i.test(key)) {
    return "Reliability"
  }
  if (
    /capacity|concurrency|replica|connection|throughput|rate|memory|cpu|iops|size|prefetch|partition|bandwidth/i.test(
      key,
    )
  ) {
    return "Capacity"
  }
  return "General"
}

function describeField(key: string): string {
  if (fieldDescriptions[key]) return fieldDescriptions[key]
  const label = key.replace(/([A-Z])/g, " $1").toLowerCase()
  return `Controls the ${label} used by this node during deterministic simulation.`
}

export function ConfigForm({ node, definition, onSave }: ConfigFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<Record<string, unknown>>({ defaultValues: node.config })

  useEffect(() => reset(node.config), [node, reset])

  const submit = (values: Record<string, unknown>) => {
    const result = definition.configSchema.safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          setError(field, { message: issue.message })
        }
      }
      return
    }
    onSave(result.data as Record<string, unknown>)
  }
  const groupedFields = Object.entries(node.config).reduce(
    (groups, entry) => {
      const group = fieldGroup(entry[0])
      groups[group] = [...(groups[group] ?? []), entry]
      return groups
    },
    {} as Record<string, Array<[string, unknown]>>,
  )

  return (
    <form onSubmit={handleSubmit(submit)}>
      {Object.entries(groupedFields).map(([group, fields]) => (
        <fieldset className="config-group" key={group}>
          <legend>{group}</legend>
          {fields.map(([key, value]) => (
            <label htmlFor={`config-${key}`} key={key}>
              <span className="field-label">{key.replace(/([A-Z])/g, " $1")}</span>
              <small className="field-description">{describeField(key)}</small>
              {selectOptions[`${node.type}.${key}`] ? (
                <select id={`config-${key}`} {...register(key)}>
                  {selectOptions[`${node.type}.${key}`].map((option) => (
                    <option value={option} key={option}>
                      {option.replaceAll("-", " ")}
                    </option>
                  ))}
                </select>
              ) : typeof value === "boolean" ? (
                <input id={`config-${key}`} type="checkbox" {...register(key)} />
              ) : typeof value === "object" ? (
                <textarea
                  id={`config-${key}`}
                  defaultValue={JSON.stringify(value, null, 2)}
                  onChange={(event) => {
                    try {
                      const parsed = JSON.parse(event.target.value)
                      register(key).onChange({
                        target: { name: key, value: parsed },
                      })
                    } catch {
                      setError(key, { message: "Enter valid JSON" })
                    }
                  }}
                />
              ) : (
                <Input
                  id={`config-${key}`}
                  type={typeof value === "number" ? "number" : "text"}
                  step={typeof value === "number" ? "any" : undefined}
                  {...register(key, {
                    valueAsNumber: typeof value === "number",
                  })}
                />
              )}
              {errors[key]?.message && (
                <small className="field-error">{String(errors[key]?.message)}</small>
              )}
              {recommendedRanges[key] && (
                <small className="field-guidance">{recommendedRanges[key]}</small>
              )}
            </label>
          ))}
        </fieldset>
      ))}
      <Button className="inspector-save" type="submit">
        Apply changes
      </Button>
    </form>
  )
}
