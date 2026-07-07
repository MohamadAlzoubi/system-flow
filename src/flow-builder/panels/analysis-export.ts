import type {
  ArchitectureRule,
  FailureScenario,
  FlowGraph,
  SimulationBaseline,
  SimulationComparison,
  SimulationResult,
  ValidationIssue,
} from "../../contracts"

type AnalysisSummary = {
  totalEventsProcessed: number
  averageLatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  cpuCores: number
  memoryMb: number
  warningCount: number
  bottleneckCount: number
  issueCount: number
  userImpactEvents: number
  timelineFrames: number
}

export type SimulationAnalysisExport = {
  schemaVersion: "system-flow.analysis.v1"
  exportedAt: string
  graph: {
    id: string
    name: string
    nodeCount: number
    edgeCount: number
    dataContractCount: number
    simulationProfile: FlowGraph["simulationProfile"]
    architectureGoals: FlowGraph["architectureGoals"]
  }
  scenario: FailureScenario | null
  summary: AnalysisSummary
  goalReport: SimulationResult["goalReport"]
  userImpact: SimulationResult["userImpact"]
  bottlenecks: SimulationResult["bottlenecks"]
  warnings: SimulationResult["warnings"]
  issues: ValidationIssue[]
  recommendations: SimulationResult["explanation"]["recommendations"]
  nodeMetrics: SimulationResult["nodeMetrics"]
  edgeMetrics: SimulationResult["edgeMetrics"]
  timeline: SimulationResult["timeline"]
  explanation: SimulationResult["explanation"]
  measurementEvidence: SimulationResult["explanation"]["calibrationEvidence"]
  readiness: SimulationResult["readiness"]
  riskFindings: ArchitectureRule[]
  baseline: {
    graphId: string
    graphName: string
    capturedAt: string
    summary: AnalysisSummary
  } | null
  comparison: SimulationComparison | null
}

function summarizeResult(
  result: SimulationResult,
  issues: ValidationIssue[],
): AnalysisSummary {
  return {
    totalEventsProcessed: result.totalEventsProcessed,
    averageLatencyMs: result.averageLatencyMs,
    p95LatencyMs: result.p95LatencyMs,
    p99LatencyMs: result.p99LatencyMs,
    cpuCores: result.resourceUsage.cpuCores,
    memoryMb: result.resourceUsage.memoryMb,
    warningCount: result.warnings.length,
    bottleneckCount: result.bottlenecks.length,
    issueCount: issues.length,
    userImpactEvents: result.userImpact.reduce((sum, entry) => sum + entry.events, 0),
    timelineFrames: result.timeline.length,
  }
}

export function buildSimulationAnalysisExport({
  graph,
  result,
  visibleIssues,
  scenario,
  baseline,
  comparison,
  riskFindings,
  exportedAt = new Date().toISOString(),
}: {
  graph: FlowGraph
  result: SimulationResult
  visibleIssues: ValidationIssue[]
  scenario: FailureScenario | null
  baseline: SimulationBaseline | null
  comparison: SimulationComparison | null
  riskFindings: ArchitectureRule[]
  exportedAt?: string
}): SimulationAnalysisExport {
  return {
    schemaVersion: "system-flow.analysis.v1",
    exportedAt,
    graph: {
      id: graph.id,
      name: graph.name,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      dataContractCount: graph.dataContracts.length,
      simulationProfile: graph.simulationProfile,
      architectureGoals: graph.architectureGoals,
    },
    scenario,
    summary: summarizeResult(result, visibleIssues),
    goalReport: result.goalReport,
    userImpact: result.userImpact,
    bottlenecks: result.bottlenecks,
    warnings: result.warnings,
    issues: visibleIssues,
    recommendations: result.explanation.recommendations,
    nodeMetrics: result.nodeMetrics,
    edgeMetrics: result.edgeMetrics,
    timeline: result.timeline,
    explanation: result.explanation,
    measurementEvidence: result.explanation.calibrationEvidence,
    readiness: result.readiness,
    riskFindings,
    baseline: baseline
      ? {
          graphId: baseline.graphId,
          graphName: baseline.graphName,
          capturedAt: baseline.capturedAt,
          summary: summarizeResult(baseline.result, baseline.result.warnings),
        }
      : null,
    comparison,
  }
}
