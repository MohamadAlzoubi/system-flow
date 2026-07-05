import type { NodeMeta } from "./types"

/**
 * Per-node UI metadata keyed by node type. `essentials` lists the fields a
 * beginner needs first; everything else moves behind the Advanced toggle.
 */
export const nodeMeta: Record<string, NodeMeta> = {
  "event.source": {
    summary: "Where traffic enters: emits a stream of typed events at a set rate.",
    fields: {
      eventType: {
        label: "Event type",
        help: "Name of the business fact this source emits. It becomes the data contract on outgoing edges.",
        placeholder: "OrderPlacedEvent",
      },
      ratePerSecond: {
        label: "Rate",
        help: "Events emitted per second. This drives load through everything downstream.",
      },
      payloadSizeBytes: {
        label: "Payload size",
        help: "Bytes per event. Matters for bandwidth and cross-region transfer.",
        advanced: true,
      },
      burstMode: {
        label: "Burst mode",
        help: "Emit in bursts instead of a steady rate — closer to real user traffic.",
        advanced: true,
      },
    },
  },
  "http.endpoint": {
    summary: "A public API route that accepts requests from clients.",
    fields: {
      method: {
        label: "HTTP method",
        options: [
          { value: "GET", label: "GET — read data", hint: "Safe to retry and cache." },
          {
            value: "POST",
            label: "POST — create / submit",
            hint: "Not naturally idempotent; retries can duplicate work.",
          },
          {
            value: "PUT",
            label: "PUT — replace",
            hint: "Idempotent: repeating gives the same result.",
          },
          {
            value: "PATCH",
            label: "PATCH — partial update",
            hint: "Updates part of a resource.",
          },
          {
            value: "DELETE",
            label: "DELETE — remove",
            hint: "Idempotent: deleting twice is still deleted.",
          },
        ],
      },
      path: {
        label: "Path",
        help: "Route the endpoint serves.",
        placeholder: "/orders",
      },
      maxRequestsPerSecond: {
        label: "Max requests",
        help: "Requests per second this endpoint can accept before rejecting traffic.",
      },
      averageLatencyMs: {
        label: "Average latency",
        help: "Typical time to handle one request, excluding downstream calls.",
      },
      authRequired: {
        label: "Requires auth",
        help: "Whether callers must authenticate. Public write endpoints without auth are flagged in review.",
        advanced: true,
      },
      timeoutMs: { advanced: true },
    },
  },
  "scheduler.cron": {
    summary: "Runs a job on a schedule instead of reacting to traffic.",
    fields: {
      cronExpression: {
        label: "Schedule (cron)",
        help: "Five fields: minute, hour, day of month, month, weekday. */5 * * * * means every 5 minutes.",
        placeholder: "*/5 * * * *",
      },
      jobType: {
        label: "Job name",
        help: "What this scheduled job does — used as the output event name.",
        placeholder: "syncRecommendations",
      },
      batchSize: {
        help: "Items each run processes. Large nightly batches can dwarf normal daytime load — simulate both.",
      },
      averageItemProcessingMs: {
        label: "Time per item",
        help: "Processing time for one item in the batch.",
        advanced: true,
      },
    },
  },
  "function.service": {
    summary: "A stateless service or function that transforms each request.",
    fields: {
      functionName: {
        label: "Function name",
        help: "What this service does — shown on the canvas.",
        placeholder: "enrichEvent",
      },
      averageExecutionMs: {
        label: "Average execution time",
        help: "Typical time to run the business logic once.",
      },
      cpuCostPerRequest: {
        label: "CPU per request",
        help: "Cores consumed by one request. Total CPU = this × request rate.",
        advanced: true,
      },
      memoryMbPerRequest: {
        label: "Memory per request",
        help: "Memory used while handling one request.",
        advanced: true,
      },
    },
  },
  worker: {
    summary: "Consumes jobs from a queue and processes them in the background.",
    essentials: [
      "workerName",
      "concurrency",
      "replicas",
      "averageProcessingMs",
      "failureRate",
    ],
    fields: {
      workerName: {
        label: "Worker name",
        placeholder: "email-worker",
        help: "What this worker does — shown on the canvas.",
      },
      autoscalingEnabled: {
        label: "Autoscaling",
        help: "Let the platform add or remove replicas based on utilization instead of a fixed count.",
      },
      minReplicas: {
        label: "Min replicas",
        help: "Floor the autoscaler never goes below. Keeps warm capacity for sudden load.",
      },
      maxReplicas: {
        label: "Max replicas",
        help: "Ceiling the autoscaler never exceeds — protects downstream systems and your budget.",
      },
      scaleUpUtilizationPercent: {
        label: "Scale-up threshold",
        help: "Utilization that triggers adding replicas. 70% leaves headroom for the delay before new capacity is ready.",
      },
      scalingDelaySeconds: {
        label: "Scale-up delay",
        help: "Time between deciding to scale and new replicas being ready. During this window the queue grows.",
      },
      scaleDownDelaySeconds: {
        label: "Scale-down delay",
        help: "Wait before removing idle replicas, so brief dips don't flap capacity.",
      },
      coldStartSeconds: {
        label: "Cold start",
        help: "Boot time for a new replica before it takes work.",
      },
      drainTimeSeconds: {
        label: "Drain time",
        help: "Grace period for in-flight jobs when a replica shuts down.",
      },
      processingJitterPercent: {
        label: "Processing jitter",
        help: "Variation around the average processing time — real workloads are never perfectly uniform.",
      },
      cpuCostPerJob: {
        label: "CPU per job",
        help: "Cores consumed by one job.",
      },
      memoryMbPerJob: {
        label: "Memory per job",
        help: "Memory used while processing one job.",
      },
      ackMode: {
        label: "Acknowledgement mode",
        options: [
          {
            value: "manual",
            label: "Manual — ack after success",
            hint: "Safest: failed jobs are redelivered. Requires idempotent processing.",
          },
          {
            value: "automatic",
            label: "Automatic — ack on receipt",
            hint: "Faster, but a crash loses the message.",
          },
          {
            value: "none",
            label: "None — fire and forget",
            hint: "Highest throughput, no delivery guarantee at all.",
          },
        ],
      },
    },
  },
  "compute.batch-processor": {
    summary: "Groups items and processes them together for throughput.",
    fields: {
      batchSize: {
        help: "Items per batch. Bigger batches raise throughput and latency together.",
      },
      parallelBatches: {
        label: "Parallel batches",
        help: "Batches processed at the same time.",
      },
      processingMsPerBatch: {
        label: "Time per batch",
        help: "Processing time for one full batch.",
      },
      flushIntervalMs: {
        label: "Flush interval",
        help: "Max wait before a partial batch is processed anyway. Bounds worst-case item latency.",
        advanced: true,
      },
    },
  },
  "redis.cache": {
    summary: "In-memory cache that answers hot reads before they hit the database.",
    essentials: ["operation", "hitRate", "ttlSeconds"],
    fields: {
      operation: {
        label: "Access pattern",
        options: [
          {
            value: "read",
            label: "Read only",
            hint: "Cache lookups only — something else fills the cache.",
          },
          {
            value: "write",
            label: "Write only",
            hint: "Only stores values, e.g. session writes.",
          },
          {
            value: "read-write",
            label: "Read + write",
            hint: "Typical cache-aside: read, and write on miss.",
          },
        ],
      },
      hitRate: {
        label: "Hit rate",
        help: "Fraction of lookups served from cache (0.75 = 75%). The single biggest lever for database load.",
        recommend: "Measure from production; 0.7–0.95 is common",
        placeholder: "0.75",
      },
      keyPattern: {
        label: "Key pattern",
        help: "Naming scheme for keys. Consistent patterns make invalidation and debugging possible.",
        placeholder: "user:{id}",
      },
      maxMemoryMb: {
        label: "Max memory",
        help: "Memory budget before the eviction policy starts removing keys.",
      },
      itemSizeBytes: {
        label: "Item size",
        help: "Average bytes per cached value.",
      },
      evictionPolicy: {
        label: "Eviction policy",
        options: [
          {
            value: "allkeys-lru",
            label: "allkeys-lru — evict least recently used",
            hint: "Safest default for a pure cache.",
          },
          {
            value: "volatile-lru",
            label: "volatile-lru — LRU among keys with TTL",
            hint: "Use when some keys must never be evicted.",
          },
          {
            value: "allkeys-lfu",
            label: "allkeys-lfu — evict least frequently used",
            hint: "Better when a small set of keys stays hot.",
          },
          {
            value: "volatile-ttl",
            label: "volatile-ttl — evict soonest-expiring",
            hint: "Prefers keys already about to expire.",
          },
          {
            value: "noeviction",
            label: "noeviction — reject writes when full",
            hint: "Writes fail when memory is full. Dangerous for caches.",
          },
        ],
      },
    },
  },
  database: {
    summary: "The system of record. Usually the first bottleneck worth understanding.",
    essentials: [
      "databaseType",
      "operation",
      "averageQueryMs",
      "readPercentage",
      "connectionPoolSize",
    ],
    fields: {
      databaseType: {
        label: "Engine",
        options: [
          {
            value: "postgresql",
            label: "PostgreSQL — relational",
            hint: "Strong consistency, joins, transactions.",
          },
          {
            value: "mysql",
            label: "MySQL — relational",
            hint: "Widely deployed relational engine.",
          },
          {
            value: "mongodb",
            label: "MongoDB — documents",
            hint: "Flexible schema, document model.",
          },
          {
            value: "dynamodb",
            label: "DynamoDB — managed KV",
            hint: "Predictable latency at scale; query by key only.",
          },
          {
            value: "cassandra",
            label: "Cassandra — wide column",
            hint: "Write-heavy workloads across many nodes.",
          },
        ],
      },
      operation: {
        label: "Dominant operation",
        options: [
          { value: "read", label: "Read", hint: "Query existing rows." },
          { value: "insert", label: "Insert", hint: "Append new rows." },
          {
            value: "update",
            label: "Update",
            hint: "Modify existing rows — can contend on hot rows.",
          },
          { value: "delete", label: "Delete", hint: "Remove rows." },
          {
            value: "transaction",
            label: "Transaction",
            hint: "Multiple statements that commit together; holds locks longer.",
          },
        ],
      },
      readPercentage: {
        label: "Read share",
        help: "Portion of operations that are reads. Read-heavy systems benefit from caches and replicas; write-heavy ones need sharding or queues.",
      },
      maxWritesPerSecond: {
        label: "Write capacity",
        help: "Sustained writes per second the primary can absorb.",
      },
      maxReadsPerSecond: {
        label: "Read capacity",
        help: "Sustained reads per second before latency degrades.",
      },
      maxConnections: {
        label: "Max connections",
        help: "Hard connection ceiling. Every client pool across every replica counts against it.",
      },
      iopsPerOperation: {
        label: "IOPS per operation",
        help: "Disk operations one query consumes. Missing indexes push this up sharply.",
      },
      contentionPercentage: {
        label: "Contention",
        help: "Share of operations that wait on locks held by others — hot rows, long transactions.",
      },
      averageTransactionMs: {
        label: "Transaction time",
        help: "How long a transaction holds its locks.",
      },
      readReplicaCount: {
        label: "Read replicas",
        help: "Copies serving reads. They offload the primary but lag slightly behind it.",
      },
      primaryAvailable: {
        label: "Primary available",
        help: "Uncheck to simulate losing the primary and measure failover impact.",
      },
      failoverSeconds: {
        label: "Failover time",
        help: "Time to promote a replica after the primary dies. Writes fail during this window.",
      },
      documentSizeBytes: {
        label: "Row / document size",
        help: "Average bytes per stored record.",
      },
      indexUsed: {
        label: "Index used",
        help: "Whether the dominant query hits an index. Uncheck to feel what a table scan does to latency.",
      },
    },
  },
  "data.database-proxy": {
    summary:
      "Pools and multiplexes many client connections onto few database connections.",
    fields: {
      clientConnections: {
        label: "Client connections",
        help: "Connections applications open against the proxy.",
      },
      databaseConnections: {
        label: "Database connections",
        help: "Real connections the proxy holds to the database — the scarce resource being protected.",
      },
      multiplexingRatio: {
        label: "Multiplexing ratio",
        help: "Client connections shared per database connection. Works because most client connections are idle.",
      },
      averageLatencyMs: { advanced: true },
    },
  },
  "data.read-replica": {
    summary: "Read-only database copies that scale reads and add lag.",
    fields: {
      replicaCount: {
        label: "Replica count",
        help: "Read-only copies of the primary.",
      },
      readsPerReplicaSecond: {
        label: "Reads per replica",
        help: "Read capacity each replica adds.",
      },
      maxConnectionsPerReplica: {
        label: "Connections per replica",
        help: "Connection ceiling on each replica.",
        advanced: true,
      },
      replicationLagMs: { advanced: true },
      averageReadMs: { advanced: true },
    },
  },
  "storage.object": {
    summary: "Blob storage for files and media — S3-style, cheap and durable.",
    fields: {
      operation: {
        label: "Operation",
        options: [
          { value: "put", label: "Put — upload", hint: "Store an object." },
          {
            value: "get",
            label: "Get — download",
            hint: "Fetch an object; pair with a CDN for public assets.",
          },
          { value: "delete", label: "Delete", hint: "Remove an object." },
        ],
      },
      requestsPerSecond: {
        label: "Request capacity",
        help: "Requests per second the store serves.",
      },
      durabilityCopies: {
        label: "Durability copies",
        help: "Copies kept of each object. Three copies is the industry norm.",
        advanced: true,
      },
      bandwidthMbps: { advanced: true },
      averageLatencyMs: {},
    },
  },
  "data.search-engine": {
    summary: "Full-text search index — fast queries, eventually-consistent updates.",
    fields: {
      shards: {
        label: "Shards",
        help: "Index split into parallel pieces. More shards = more parallel query capacity.",
      },
      replicas: {
        help: "Copies of each shard for redundancy and extra read capacity.",
      },
      queriesPerShardSecond: {
        label: "Queries per shard",
        help: "Query capacity each shard contributes.",
      },
      indexingPerSecond: {
        label: "Indexing rate",
        help: "Documents ingested per second. Indexing competes with queries for resources.",
        advanced: true,
      },
      averageQueryMs: { advanced: true },
    },
  },
  "rabbitmq.queue": {
    summary: "Message broker that buffers work between producers and consumers.",
    essentials: ["queueName", "exchangeType", "durable", "prefetch", "retryCount"],
    fields: {
      queueName: {
        label: "Queue name",
        placeholder: "order-events",
      },
      exchangeType: {
        label: "Exchange type",
        options: [
          {
            value: "direct",
            label: "Direct — exact routing key",
            hint: "Deliver to queues bound with the exact key.",
          },
          {
            value: "topic",
            label: "Topic — pattern routing",
            hint: "Route by wildcard patterns like order.*.",
          },
          {
            value: "fanout",
            label: "Fanout — copy to all",
            hint: "Every bound queue gets every message.",
          },
          {
            value: "headers",
            label: "Headers — match attributes",
            hint: "Route on message headers instead of keys.",
          },
        ],
      },
      durable: {
        label: "Durable",
        help: "Persist messages to disk so a broker restart doesn't lose them. Costs some write latency.",
      },
      deadLetterQueue: {
        label: "Dead-letter queue",
        help: "Send messages that exhaust retries to a separate queue instead of dropping them.",
      },
      consumerGroup: {
        label: "Consumer group",
        help: "Consumers sharing this name split the work between them.",
      },
      publisherConfirmLatencyMs: {
        label: "Publisher confirm",
        help: "Time for the broker to confirm a publish.",
      },
      persistenceLatencyMs: {
        label: "Persistence latency",
        help: "Disk write time per durable message.",
      },
      brokerMaxThroughputPerSecond: {
        label: "Broker throughput cap",
        help: "Total messages per second the broker can move.",
      },
      maxThroughputPerPartition: {
        label: "Per-partition cap",
        help: "Messages per second one partition can carry.",
      },
      brokerStorageMb: {
        label: "Broker storage",
        help: "Disk available for queued messages during a backlog.",
      },
      deadLetterMaxSize: {
        label: "DLQ max size",
        help: "Messages the dead-letter queue can hold.",
      },
      orderingRequired: {
        label: "Ordering required",
        help: "Whether consumers depend on message order. Ordering limits parallelism to one consumer per partition.",
      },
    },
  },
  "messaging.dead-letter-queue": {
    summary:
      "Parking lot for messages that repeatedly failed, so they can be inspected and replayed.",
    fields: {
      maxMessages: {
        label: "Capacity",
        help: "Failed messages the DLQ can hold. A full DLQ is a paging incident, not a nuisance.",
      },
      retentionHours: {},
      replayPerSecond: {
        label: "Replay rate",
        help: "How fast repaired messages are re-fed to the main flow. Replay slowly — the original failure may still be fragile.",
      },
      writesPerSecond: {
        label: "Write capacity",
        help: "Failed messages per second the DLQ can absorb.",
        advanced: true,
      },
      averageLatencyMs: { advanced: true },
    },
  },
  "stream.kafka-topic": {
    summary: "Durable event log that many consumer groups can read independently.",
    fields: {
      topicName: {
        label: "Topic name",
        placeholder: "user-events",
      },
      partitions: {
        help: "Parallelism of the topic. Consumers in a group split partitions between them; ordering holds only within one partition.",
      },
      replicas: {
        label: "Replication factor",
        help: "Copies of each partition across brokers. Three survives one broker loss with room to spare.",
      },
      throughputPerPartition: {
        label: "Throughput per partition",
        help: "Messages per second one partition sustains.",
        advanced: true,
      },
      acknowledgementLatencyMs: { advanced: true },
      retentionHours: { advanced: true },
    },
  },
  "stream.processor": {
    summary: "Continuously transforms or aggregates events over time windows.",
    fields: {
      parallelism: {
        help: "Tasks running in parallel. Usually capped by upstream partition count.",
      },
      eventsPerTaskSecond: {
        label: "Events per task",
        help: "Events one task processes per second.",
      },
      windowSeconds: {
        label: "Window",
        help: "Aggregation window length, e.g. 'orders per 10 seconds'.",
      },
      checkpointIntervalMs: {
        label: "Checkpoint interval",
        help: "How often progress is saved. After a crash, work since the last checkpoint is reprocessed.",
        advanced: true,
      },
      processingLatencyMs: { advanced: true },
    },
  },
  "network.load-balancer": {
    summary: "Spreads incoming traffic across healthy service instances.",
    fields: {
      algorithm: {
        options: [
          {
            value: "round-robin",
            label: "Round robin — take turns",
            hint: "Simple and fair when requests cost about the same.",
          },
          {
            value: "least-connections",
            label: "Least connections",
            hint: "Send to the least busy target; better for uneven request costs.",
          },
          {
            value: "weighted",
            label: "Weighted",
            hint: "Bias traffic toward bigger targets or canary deployments.",
          },
        ],
      },
      healthyTargets: {
        label: "Healthy targets",
        help: "Instances currently passing health checks. Lower it to simulate instances dying.",
      },
      capacityPerTarget: {
        label: "Capacity per target",
        help: "Requests per second one target can handle.",
      },
      connectionLimit: {
        label: "Connection limit",
        help: "Ceiling on simultaneous connections through the balancer.",
        advanced: true,
      },
      healthCheckIntervalSeconds: {
        label: "Health check interval",
        help: "Seconds between probes. Failures are only noticed on the next probe.",
        advanced: true,
      },
      averageLatencyMs: { advanced: true },
    },
  },
  "network.cdn": {
    summary: "Edge servers that serve cached content near users.",
    fields: {
      edgeLocations: {
        label: "Edge locations",
        help: "Points of presence serving users nearby.",
      },
      cacheHitPercent: {
        label: "Cache hit rate",
        help: "Requests served at the edge without reaching your origin. Static assets should exceed 90%.",
      },
      edgeCapacityPerSecond: {
        label: "Capacity per edge",
        help: "Requests per second each location serves.",
        advanced: true,
      },
      hitLatencyMs: {
        label: "Hit latency",
        help: "Latency when the edge already has the content.",
        advanced: true,
      },
      missLatencyMs: {
        label: "Miss latency",
        help: "Latency when the edge must fetch from origin.",
        advanced: true,
      },
    },
  },
  "websocket.gateway": {
    summary: "Holds persistent connections to push realtime messages to clients.",
    fields: {
      connectedClients: {
        label: "Connected clients",
        help: "Simultaneous open connections. Memory, not CPU, is usually the limit.",
      },
      messagesPerSecond: {
        label: "Message rate",
        help: "Messages pushed per second across all connections.",
      },
      broadcastMode: {
        label: "Delivery mode",
        options: [
          {
            value: "direct",
            label: "Direct — one recipient",
            hint: "Each message goes to one client.",
          },
          {
            value: "room",
            label: "Room — a group",
            hint: "Fan out to everyone in a room, like a chat channel.",
          },
          {
            value: "broadcast",
            label: "Broadcast — everyone",
            hint: "Every connected client gets every message. Multiply carefully.",
          },
        ],
      },
      rooms: {
        help: "Active rooms/channels clients are grouped into.",
        advanced: true,
      },
      averageMessageSizeBytes: {
        label: "Message size",
        advanced: true,
      },
      memoryPerConnectionKb: {
        label: "Memory per connection",
        help: "KB held per open connection. 50k connections × 50 KB = 2.5 GB before any messages flow.",
        advanced: true,
      },
    },
  },
  "resilience.rate-limiter": {
    summary: "Rejects excess requests early to protect what sits behind it.",
    fields: {
      strategy: {
        options: [
          {
            value: "token-bucket",
            label: "Token bucket — allows bursts",
            hint: "Steady refill with a burst allowance. The common default.",
          },
          {
            value: "fixed-window",
            label: "Fixed window — simple counter",
            hint: "Cheap, but traffic can double at window edges.",
          },
          {
            value: "sliding-window",
            label: "Sliding window — smooth",
            hint: "Accurate limiting without edge spikes; slightly costlier.",
          },
        ],
      },
      quota: {
        help: "Requests allowed per window.",
      },
      windowSeconds: {},
      burstCapacity: {
        label: "Burst capacity",
        help: "Extra requests allowed briefly above the steady rate (token bucket).",
        advanced: true,
      },
      averageLatencyMs: { advanced: true },
    },
  },
  "resilience.circuit-breaker": {
    summary: "Stops calling a failing dependency so it can recover and you fail fast.",
    fields: {
      observedFailurePercent: {
        label: "Observed failures",
        help: "Failure rate the breaker currently sees. Raise above the threshold to watch the circuit open.",
      },
      failureThresholdPercent: {
        label: "Trip threshold",
        help: "Failure percentage that opens the circuit and short-circuits calls.",
      },
      openSeconds: {
        label: "Open duration",
        help: "How long calls fail fast before the breaker probes the dependency again.",
      },
      halfOpenRequests: {
        label: "Probe requests",
        help: "Trial requests allowed while half-open; success closes the circuit.",
        advanced: true,
      },
      averageLatencyMs: { advanced: true },
    },
  },
  "external.api": {
    summary: "A third-party dependency you don't control — model it pessimistically.",
    essentials: [
      "providerName",
      "averageLatencyMs",
      "rateLimitPerSecond",
      "failureRate",
      "timeoutMs",
    ],
    fields: {
      providerName: {
        label: "Provider",
        placeholder: "Stripe, SendGrid…",
      },
      latencyJitterPercent: {
        label: "Latency jitter",
        help: "Variance around the average — third parties are rarely consistent.",
      },
      rateLimitPerSecond: {
        label: "Rate limit",
        help: "Requests per second the provider allows before returning 429s.",
      },
      rateLimitWindowSeconds: {
        label: "Rate limit window",
        help: "Window the provider's quota applies to.",
      },
      rateLimitQuota: {
        label: "Quota per window",
        help: "Requests allowed inside each window.",
      },
      circuitBreakerEnabled: {
        label: "Circuit breaker",
        help: "Fail fast when the provider degrades instead of stacking up slow calls.",
      },
      circuitFailureThresholdPercent: {
        label: "Breaker threshold",
        help: "Failure rate that opens the circuit.",
      },
      circuitOpenSeconds: {
        label: "Breaker open time",
        help: "How long calls fail fast before probing again.",
      },
      recoverySuccessThreshold: {
        label: "Recovery successes",
        help: "Consecutive successes needed to close the circuit.",
      },
      bulkheadMaxConcurrent: {
        label: "Bulkhead limit",
        help: "Max concurrent calls to the provider, so a slow provider can't absorb every thread you have.",
      },
    },
  },
  "router.condition": {
    summary: "Splits the flow down different paths based on message fields.",
    fields: {
      rules: {
        label: "Routing rules",
        help: "Condition → target pairs, evaluated top to bottom. Conditions are descriptive labels for the design — they are never executed as code.",
        placeholder:
          '[{ "condition": "input.country === \'TR\'", "target": "turkey-flow" }]',
      },
    },
  },
  "logger.metrics": {
    summary: "Observability sink: structured logs, metrics, or traces.",
    fields: {
      sampleRate: {
        label: "Sample rate",
        help: "Fraction of events recorded (1 = everything). Sampling trades completeness for cost at high volume.",
        placeholder: "1",
      },
      retentionDays: {},
      averageWriteMs: { advanced: true },
    },
  },
  "control.autoscaler": {
    summary: "Watches utilization and adjusts replica counts automatically.",
    fields: {
      minimumReplicas: {
        label: "Min replicas",
        help: "Floor that keeps warm capacity even when idle.",
      },
      maximumReplicas: {
        label: "Max replicas",
        help: "Ceiling that protects downstream systems and cost.",
      },
      targetUtilizationPercent: {
        label: "Target utilization",
        help: "Utilization the autoscaler tries to hold. 70% leaves room for scale-up lag.",
      },
      reconciliationSeconds: {
        label: "Check interval",
        help: "How often the autoscaler evaluates and acts.",
        advanced: true,
      },
      actionsPerSecond: {
        label: "Action capacity",
        help: "Scaling operations it can perform per second.",
        advanced: true,
      },
    },
  },
}
