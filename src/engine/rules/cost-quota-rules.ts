import type { ArchitectureRule } from "../../contracts"
import {
  activeResourceScopes,
  addNodeResourceUsage,
  emptyResourceScopes,
  regionBoundaryForNode,
  resourceBudgetForBoundary,
} from "../resources/resource-scopes"
import type { RuleContext } from "./rule-helpers"

const number = (value: unknown) => Number(value) || 0

export function costQuotaRules(context: RuleContext): ArchitectureRule[] {
  const findings: ArchitectureRule[] = []
  const { graph, registry, sourceRatePerSecond } = context
  const resourceScopes = emptyResourceScopes(graph)
  const boundaries = new Map(
    (graph.boundaries ?? []).map((boundary) => [boundary.id, boundary]),
  )

  for (const node of graph.nodes) {
    const result = registry.get(node.type)?.simulate(node.config, {
      profile: graph.simulationProfile,
      ratePerSecond: sourceRatePerSecond,
    })
    addNodeResourceUsage(
      resourceScopes,
      node,
      graph,
      result?.cpuCores ?? 0,
      result?.memoryMb ?? 0,
    )

    if (node.type === "external.api") {
      const quotaCapacity = Math.min(
        number(node.config.rateLimitPerSecond),
        number(node.config.rateLimitQuota) /
          Math.max(1, number(node.config.rateLimitWindowSeconds)),
      )
      if (quotaCapacity > 0 && sourceRatePerSecond >= quotaCapacity * 0.8) {
        findings.push({
          code: "QUOTA_EXTERNAL_PROVIDER",
          category: "quota",
          severity: "warning",
          message: `${node.config.providerName ?? "External provider"} traffic ${sourceRatePerSecond}/s is near or above its ${Math.round(quotaCapacity)}/s quota`,
          rationale:
            "Provider quotas reject work regardless of local capacity and often require commercial lead time to raise.",
          affectedIds: [node.id],
          suggestedActions: [
            "Request a higher provider quota before load testing.",
            "Add local rate limiting, queuing, or a secondary provider.",
          ],
        })
      }
    }

    if (node.type === "stream.kafka-topic") {
      const partitions = number(node.config.partitions)
      const capacity = partitions * number(node.config.throughputPerPartition)
      if (capacity > 0 && sourceRatePerSecond >= capacity * 0.8) {
        findings.push({
          code: "QUOTA_KAFKA_PARTITIONS",
          category: "quota",
          severity: "warning",
          message: `${node.id} has ${partitions} partitions for ${sourceRatePerSecond}/s traffic, near its ~${Math.round(capacity)}/s configured limit`,
          rationale:
            "Partition count bounds parallelism and throughput; increasing it later can change ordering and key distribution.",
          affectedIds: [node.id],
          suggestedActions: [
            "Increase partitions before production traffic arrives.",
            "Verify partition-key distribution under the load-test dataset.",
          ],
        })
      }
    }

    const region = regionBoundaryForNode(node, boundaries)
    const memoryBudget = resourceBudgetForBoundary(region, graph).memoryBudgetMb
    if (
      node.type === "redis.cache" &&
      number(node.config.maxMemoryMb) > memoryBudget * 0.5
    ) {
      const budgetOwner = region ? `${region.label} region` : "flow"
      findings.push({
        code: "COST_CACHE_MEMORY",
        category: "cost",
        severity: "warning",
        message: `${node.id} reserves ${number(node.config.maxMemoryMb).toLocaleString()} MB, more than half the ${budgetOwner} memory budget`,
        rationale:
          "Large cache allocations are a direct cost driver and may hide an unbounded keyspace or overly long TTL.",
        affectedIds: [node.id],
        suggestedActions: [
          "Load-test key cardinality and item sizes before reserving this memory.",
          "Shorten TTL or split hot and cold cache workloads.",
        ],
      })
    }

    if (node.type === "rabbitmq.queue") {
      const payloadBytes = graph.simulationProfile.payloadSizeBytes ?? 1200
      const retainedBytes =
        sourceRatePerSecond * (number(node.config.messageTtlMs) / 1000) * payloadBytes
      const storageBytes = number(node.config.brokerStorageMb) * 1024 * 1024
      if (storageBytes > 0 && retainedBytes >= storageBytes * 0.8) {
        findings.push({
          code: "QUOTA_QUEUE_STORAGE",
          category: "quota",
          severity: "warning",
          message: `${node.id} can retain ~${Math.round(retainedBytes / 1024 / 1024).toLocaleString()} MB against ${number(node.config.brokerStorageMb).toLocaleString()} MB configured storage`,
          rationale:
            "A sustained consumer outage can exhaust broker storage before message TTL removes old work.",
          affectedIds: [node.id],
          suggestedActions: [
            "Increase broker storage or shorten message TTL.",
            "Alert on queue bytes and time-to-saturation, not only message count.",
          ],
        })
      }
    }

    if (
      node.type === "data.search-engine" &&
      number(node.config.shards) * (1 + number(node.config.replicas)) > 30
    ) {
      findings.push({
        code: "COST_SEARCH_SHARDS",
        category: "cost",
        severity: "warning",
        message: `${node.id} configures ${number(node.config.shards)} shards with ${number(node.config.replicas)} replicas`,
        rationale:
          "Every primary and replica shard consumes memory, file handles, and background merge capacity.",
        affectedIds: [node.id],
        suggestedActions: [
          "Size shards from expected index bytes and query concurrency.",
          "Avoid creating shards for future capacity that has not been measured.",
        ],
      })
    }
  }

  for (const scope of activeResourceScopes(resourceScopes)) {
    const scopeLabel =
      scope.scopeKind === "region" ? `${scope.label} region` : scope.label
    const budgetLabel =
      scope.scopeKind === "region" ? "region budget" : "simulation profile budget"
    if (scope.cpuCores > scope.cpuBudgetCores) {
      findings.push({
        code: "COST_CPU_BUDGET",
        category: "cost",
        severity: "warning",
        message: `Configured workload estimates ${scope.cpuCores.toFixed(1)} CPU cores in ${scopeLabel} against a ${scope.cpuBudgetCores}-core ${budgetLabel}`,
        rationale:
          "CPU above the declared budget is both a saturation risk and an unplanned compute-cost increase.",
        affectedIds: scope.nodeIds,
        suggestedActions: [
          "Raise the explicit CPU budget for the saturated scope or reduce per-event compute cost.",
          "Measure CPU per event in a load test before committing capacity.",
        ],
      })
    }
    if (scope.memoryMb > scope.memoryBudgetMb) {
      findings.push({
        code: "COST_MEMORY_BUDGET",
        category: "cost",
        severity: "warning",
        message: `Configured workload estimates ${Math.round(scope.memoryMb).toLocaleString()} MB in ${scopeLabel} against a ${scope.memoryBudgetMb.toLocaleString()} MB ${budgetLabel}`,
        rationale:
          "Memory reservations above budget increase instance size and can create abrupt out-of-memory failures.",
        affectedIds: scope.nodeIds,
        suggestedActions: [
          "Raise the explicit memory budget for the saturated scope or reduce cache and concurrency allocations.",
          "Measure peak resident memory during load and failure tests.",
        ],
      })
    }
  }

  for (const edge of graph.edges) {
    const network = edge.network
    if (!network || network.sourceRegion === network.targetRegion) continue
    const payloadBytes = graph.simulationProfile.payloadSizeBytes ?? 1200
    const requiredMbps = (sourceRatePerSecond * payloadBytes * 8) / 1_000_000
    if (requiredMbps >= network.bandwidthMbps * 0.5) {
      findings.push({
        code: "COST_CROSS_REGION_BANDWIDTH",
        category: "cost",
        severity: "warning",
        message: `${network.sourceRegion} → ${network.targetRegion} carries an estimated ${requiredMbps.toFixed(1)} Mbps against ${network.bandwidthMbps} Mbps configured bandwidth`,
        rationale:
          "High sustained cross-region transfer consumes network quota and can become a material data-transfer cost.",
        affectedIds: [edge.id],
        suggestedActions: [
          "Measure compressed payload size and cross-region event volume.",
          "Replicate compacted state or aggregate events before transfer.",
        ],
      })
    }
  }

  return findings
}
