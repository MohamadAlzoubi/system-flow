import type { MetricDelta, SimulationComparison, SimulationResult } from "../../contracts"

function delta(baseline: number, current: number, lowerIsBetter: boolean): MetricDelta {
  const absolute = current - baseline
  return {
    baseline,
    current,
    absolute,
    percentage: baseline === 0 ? undefined : (absolute / baseline) * 100,
    improved: lowerIsBetter ? current < baseline : current > baseline,
  }
}

function droppedEvents(result: SimulationResult): number {
  return result.nodeMetrics.reduce((sum, metric) => sum + metric.droppedEvents, 0)
}

function bottleneckNodeIds(result: SimulationResult): string[] {
  return [
    ...new Set(
      result.bottlenecks
        .map((issue) => issue.nodeId)
        .filter((nodeId): nodeId is string => nodeId !== undefined),
    ),
  ].sort()
}

export function compareSimulations(
  baseline: SimulationResult,
  current: SimulationResult,
): SimulationComparison {
  const baselineNodes = bottleneckNodeIds(baseline)
  const currentNodes = bottleneckNodeIds(current)
  const resolvedNodeIds = baselineNodes.filter((id) => !currentNodes.includes(id))
  const newNodeIds = currentNodes.filter((id) => !baselineNodes.includes(id))

  return {
    throughput: delta(baseline.totalEventsProcessed, current.totalEventsProcessed, false),
    averageLatency: delta(baseline.averageLatencyMs, current.averageLatencyMs, true),
    p95Latency: delta(baseline.p95LatencyMs, current.p95LatencyMs, true),
    cpuCores: delta(
      baseline.resourceUsage.cpuCores,
      current.resourceUsage.cpuCores,
      true,
    ),
    memoryMb: delta(
      baseline.resourceUsage.memoryMb,
      current.resourceUsage.memoryMb,
      true,
    ),
    droppedEvents: delta(droppedEvents(baseline), droppedEvents(current), true),
    bottlenecks: {
      baselineNodeIds: baselineNodes,
      currentNodeIds: currentNodes,
      resolvedNodeIds,
      newNodeIds,
      moved: resolvedNodeIds.length > 0 && newNodeIds.length > 0,
    },
  }
}
