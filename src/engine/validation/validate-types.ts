import type { FlowGraph, NodeDefinition, ValidationIssue } from "../../contracts"

export function validateEdgeTypes(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): ValidationIssue[] {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const issues: ValidationIssue[] = []

  for (const edge of graph.edges) {
    const source = nodes.get(edge.fromNodeId)
    const target = nodes.get(edge.toNodeId)
    if (!source || !target) {
      issues.push({
        severity: "error",
        code: "BROKEN_EDGE",
        message: "Edge references a missing node",
        edgeId: edge.id,
      })
      continue
    }

    const outputs = registry.get(source.type)?.outputTypes ?? []
    const inputs = registry.get(target.type)?.inputTypes ?? []
    const sourceAccepts = outputs.includes("Event") || outputs.includes(edge.dataType)
    const targetAccepts = inputs.includes("Event") || inputs.includes(edge.dataType)

    if (!sourceAccepts || !targetAccepts) {
      issues.push({
        severity: "error",
        code: "TYPE_MISMATCH",
        message: `${edge.dataType} is not compatible between ${source.id} and ${target.id}`,
        edgeId: edge.id,
      })
    }
  }

  return issues
}
