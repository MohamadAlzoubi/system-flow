export type CapacityPreset = {
  id: string
  nodeType: string
  label: string
  description: string
  config: Record<string, unknown>
}

export const capacityPresets: CapacityPreset[] = [
  {
    id: "redis-small",
    nodeType: "redis.cache",
    label: "Redis small",
    description: "A small single-workload cache for modest traffic.",
    config: { maxMemoryMb: 512, hitRate: 0.75, ttlSeconds: 3600 },
  },
  {
    id: "redis-medium",
    nodeType: "redis.cache",
    label: "Redis medium",
    description: "A production cache with several gigabytes of memory.",
    config: { maxMemoryMb: 4096, hitRate: 0.85, ttlSeconds: 3600 },
  },
  {
    id: "redis-large",
    nodeType: "redis.cache",
    label: "Redis large",
    description: "A large cache footprint for high-cardinality data.",
    config: { maxMemoryMb: 16384, hitRate: 0.92, ttlSeconds: 7200 },
  },
  {
    id: "redis-regional-cluster",
    nodeType: "redis.cache",
    label: "Redis regional cluster",
    description: "A regional-scale cache assumption with a large memory budget.",
    config: {
      maxMemoryMb: 65536,
      hitRate: 0.95,
      ttlSeconds: 3600,
      evictionPolicy: "allkeys-lfu",
    },
  },
  {
    id: "kafka-compact",
    nodeType: "stream.kafka-topic",
    label: "Kafka compact",
    description: "Six partitions with one week of retention.",
    config: { partitions: 6, replicas: 3, retentionHours: 168 },
  },
  {
    id: "kafka-throughput",
    nodeType: "stream.kafka-topic",
    label: "Kafka high throughput",
    description: "Twenty-four partitions for parallel consumers.",
    config: {
      partitions: 24,
      replicas: 3,
      retentionHours: 168,
      throughputPerPartition: 1500,
    },
  },
  {
    id: "kafka-long-retention",
    nodeType: "stream.kafka-topic",
    label: "Kafka long retention",
    description: "Twelve partitions with thirty days of replay history.",
    config: { partitions: 12, replicas: 3, retentionHours: 720 },
  },
  {
    id: "postgres-primary",
    nodeType: "database",
    label: "PostgreSQL primary",
    description: "A production relational primary without read replicas.",
    config: {
      databaseType: "postgresql",
      maxWritesPerSecond: 3000,
      maxReadsPerSecond: 6000,
      maxConnections: 300,
      connectionPoolSize: 150,
      readReplicaCount: 0,
      replicationLagMs: 0,
      storageIops: 15000,
    },
  },
  {
    id: "postgres-read-replicas",
    nodeType: "database",
    label: "PostgreSQL + replicas",
    description: "A relational primary with two eventually consistent read replicas.",
    config: {
      databaseType: "postgresql",
      maxWritesPerSecond: 5000,
      maxReadsPerSecond: 10000,
      maxConnections: 500,
      connectionPoolSize: 250,
      readReplicaCount: 2,
      replicationLagMs: 100,
      storageIops: 30000,
    },
  },
  {
    id: "dynamodb-style",
    nodeType: "database",
    label: "DynamoDB-style key/value",
    description: "A high-throughput managed key/value datastore assumption.",
    config: {
      databaseType: "dynamodb",
      maxWritesPerSecond: 20000,
      maxReadsPerSecond: 50000,
      maxConnections: 1000,
      connectionPoolSize: 500,
      storageIops: 100000,
      iopsPerOperation: 1,
      averageQueryMs: 8,
    },
  },
  {
    id: "search-small",
    nodeType: "data.search-engine",
    label: "Search small",
    description: "Three shards with one replica.",
    config: { shards: 3, replicas: 1, queriesPerShardSecond: 400 },
  },
  {
    id: "search-production",
    nodeType: "data.search-engine",
    label: "Search production",
    description: "Twelve shards with two replicas.",
    config: { shards: 12, replicas: 2, queriesPerShardSecond: 750 },
  },
  {
    id: "worker-fixed",
    nodeType: "worker",
    label: "Worker fixed deployment",
    description: "Four fixed replicas with moderate concurrency.",
    config: {
      replicas: 4,
      minReplicas: 4,
      maxReplicas: 4,
      concurrency: 20,
      autoscalingEnabled: false,
      maxInFlight: 400,
    },
  },
  {
    id: "worker-autoscaling",
    nodeType: "worker",
    label: "Worker autoscaling",
    description: "A two-to-twenty replica deployment with bounded scale-up delay.",
    config: {
      replicas: 2,
      minReplicas: 2,
      maxReplicas: 20,
      concurrency: 25,
      autoscalingEnabled: true,
      scalingDelaySeconds: 30,
      coldStartSeconds: 10,
      maxInFlight: 1000,
    },
  },
  {
    id: "external-api-standard",
    nodeType: "external.api",
    label: "Vendor standard quota",
    description: "A modest external API quota with circuit protection.",
    config: {
      rateLimitPerSecond: 100,
      rateLimitWindowSeconds: 1,
      rateLimitQuota: 100,
      bulkheadMaxConcurrent: 50,
    },
  },
  {
    id: "external-api-enterprise",
    nodeType: "external.api",
    label: "Vendor enterprise quota",
    description: "A higher negotiated provider quota.",
    config: {
      rateLimitPerSecond: 2000,
      rateLimitWindowSeconds: 1,
      rateLimitQuota: 2000,
      bulkheadMaxConcurrent: 500,
    },
  },
  {
    id: "cdn-regional",
    nodeType: "network.cdn",
    label: "CDN regional",
    description: "Twenty edge locations for a regional audience.",
    config: {
      edgeLocations: 20,
      cacheHitPercent: 90,
      edgeCapacityPerSecond: 5000,
    },
  },
  {
    id: "cdn-global",
    nodeType: "network.cdn",
    label: "CDN global",
    description: "One hundred edge locations with a high expected hit rate.",
    config: {
      edgeLocations: 100,
      cacheHitPercent: 95,
      edgeCapacityPerSecond: 10000,
    },
  },
]

export function capacityPresetsFor(nodeType: string): CapacityPreset[] {
  return capacityPresets.filter((preset) => preset.nodeType === nodeType)
}

export function applyCapacityPreset(
  config: Record<string, unknown>,
  preset: CapacityPreset,
): Record<string, unknown> {
  return { ...config, ...preset.config }
}
