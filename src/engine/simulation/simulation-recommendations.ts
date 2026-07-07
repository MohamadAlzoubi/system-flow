import type { SimulationRecommendation, ValidationIssue } from "../../contracts"

export function recommendationsFor(
  issues: ValidationIssue[],
): SimulationRecommendation[] {
  const messages: Record<string, string> = {
    THROUGHPUT: "Increase capacity, replicas, or reduce upstream traffic.",
    QUEUE_LOSS: "Increase consumer capacity, TTL, or queue storage.",
    DATASTORE_SATURATION: "Increase the reported limiting datastore resource.",
    REPLICATION_LAG: "Reduce replica load or improve replication capacity.",
    CIRCUIT_OPEN: "Add failover capacity or reduce dependency failures.",
    DEPENDENCY_REJECTION: "Raise dependency quota or bulkhead capacity.",
    NETWORK_CONSTRAINT:
      "Increase bandwidth, reduce payload size, or move services closer.",
    CPU_SATURATION: "Increase CPU budget or reduce per-request compute.",
    MEMORY_SATURATION: "Increase memory budget or reduce concurrency.",
  }
  return issues
    .filter((issue) => messages[issue.code])
    .map((issue) => ({
      code: issue.code,
      priority:
        issue.code === "THROUGHPUT" || issue.code === "QUEUE_LOSS" ? "high" : "medium",
      message: messages[issue.code],
      nodeId: issue.nodeId,
    }))
}
