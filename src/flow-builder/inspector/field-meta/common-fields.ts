import type { FieldMeta } from "./types"

/**
 * Metadata for config keys that appear on several node types.
 * Node-specific entries in node-meta.ts override these per key.
 */
export const commonFieldMeta: Record<string, FieldMeta> = {
  timeoutMs: {
    label: "Timeout",
    help: "How long to wait before an operation counts as failed. Keep it above the dependency's p99 latency or you will cancel requests that would have succeeded.",
    recommend: "Set above expected p99 latency",
  },
  retryCount: {
    label: "Retry attempts",
    help: "Extra attempts after the first failure. Each retry multiplies downstream load, so pair retries with backoff and a limit.",
    recommend: "2–3 is typical; more amplifies overload",
  },
  retryBackoffMs: {
    label: "Retry backoff",
    help: "Delay before the first retry. Later retries grow exponentially from this value, which spreads load after an outage.",
  },
  retryDelayMs: {
    label: "Retry delay",
    help: "Wait before a failed message is retried. Too short re-hits a struggling consumer; too long delays recovery.",
  },
  retryMaxBackoffMs: {
    label: "Max retry backoff",
    help: "Upper cap on exponential backoff so retries never wait longer than this.",
  },
  retryJitterPercent: {
    label: "Retry jitter",
    help: "Randomizes retry timing so thousands of clients don't retry at the same instant (a retry storm).",
  },
  failureRate: {
    label: "Failure rate",
    help: "Fraction of operations that fail before retrying (0.01 = 1%). Use production error rates when you have them.",
    recommend: "0–0.1 is realistic for most services",
    placeholder: "0.01",
  },
  failureJitterPercent: {
    label: "Failure jitter",
    help: "Randomness applied to failures so they don't arrive perfectly evenly.",
  },
  replicas: {
    label: "Replicas",
    help: "Instances running at the start of the simulation. More replicas add capacity and survive single-instance failure.",
    recommend: "Start with 1–3, then scale from evidence",
  },
  concurrency: {
    label: "Concurrency",
    help: "Jobs one replica can process at the same time. Total capacity ≈ replicas × concurrency ÷ processing time.",
    recommend: "Typical starting range: 1–100",
  },
  averageLatencyMs: {
    label: "Average latency",
    help: "Typical time this component takes to handle one request.",
  },
  averageProcessingMs: {
    label: "Average processing time",
    help: "Typical time to process one job. Capacity per worker = 1000 ÷ this value jobs per second.",
  },
  averageReadMs: {
    label: "Average read time",
    help: "Typical time for one read operation.",
  },
  averageWriteMs: {
    label: "Average write time",
    help: "Typical time for one write operation.",
  },
  averageQueryMs: {
    label: "Average query time",
    help: "Typical time for one query. Slow queries usually mean a missing index or too much data per request.",
  },
  bandwidthMbps: {
    label: "Bandwidth",
    help: "Maximum network transfer capacity. Use the slowest real network segment on the path.",
  },
  connectionPoolSize: {
    label: "Connection pool size",
    help: "Database connections kept ready. Every replica opens its own pool — replicas × pool size must stay below the database's connection limit.",
    recommend: "Keep replicas × pool below DB max connections",
  },
  prefetch: {
    label: "Prefetch",
    help: "Messages a consumer reserves before acknowledging. Higher improves throughput but risks losing more work when a consumer dies.",
    recommend: "Typical range: 1–500 per consumer",
  },
  maxQueueSize: {
    label: "Max queue size",
    help: "Messages retained before overflow handling begins. A queue that only ever grows means consumers are too slow.",
  },
  messageTtlMs: {
    label: "Message TTL",
    help: "How long a message may wait before it expires. Expired messages are dropped or dead-lettered.",
  },
  cacheHitPercentage: {
    label: "Cache hit rate",
    help: "Requests served without touching the backing datastore. Measure from production when possible.",
  },
  replicationLagMs: {
    label: "Replication lag",
    help: "Delay before replicas catch up with the primary. Reads during this window can return stale data.",
  },
  storageIops: {
    label: "Storage IOPS",
    help: "Storage input/output operations available per second. Databases hit this wall before CPU more often than people expect.",
  },
  maxInFlight: {
    label: "Max in-flight work",
    help: "Accepted work allowed to be waiting or executing at once. Acts as a bulkhead against overload.",
  },
  partitions: {
    label: "Partitions",
    help: "Parallel lanes for messages. Throughput scales with partitions, but ordering only holds within one partition.",
  },
  batchSize: {
    label: "Batch size",
    help: "Items processed together. Bigger batches raise throughput and latency at the same time.",
  },
  windowSeconds: {
    label: "Window",
    help: "Time window the limit or aggregation applies to.",
  },
  retentionHours: {
    label: "Retention",
    help: "How long data is kept before deletion. 168 hours = 7 days.",
  },
  retentionDays: {
    label: "Retention",
    help: "How long data is kept before deletion.",
  },
  acknowledgementLatencyMs: {
    label: "Ack latency",
    help: "Time for the broker to confirm it accepted a message.",
  },
  ttlSeconds: {
    label: "TTL",
    help: "How long an entry stays valid before it expires. Short TTLs stay fresh but lower the hit rate.",
  },
  cpuLimitCores: {
    label: "CPU limit",
    help: "CPU cores one replica may use before throttling.",
    recommend: "Typical range: 0.25–8 cores",
  },
  memoryLimitMb: {
    label: "Memory limit",
    help: "Memory one replica may use before it is killed.",
    recommend: "Typical range: 128–8192 MB",
  },
}
