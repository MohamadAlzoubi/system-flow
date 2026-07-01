import type { FlowGraph } from "../../contracts"

export function hasCycle(graph: FlowGraph): boolean {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const outgoing = new Map<string, string[]>()

  for (const edge of graph.edges) {
    outgoing.set(edge.fromNodeId, [
      ...(outgoing.get(edge.fromNodeId) ?? []),
      edge.toNodeId,
    ])
  }

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visiting.add(nodeId)
    for (const targetId of outgoing.get(nodeId) ?? []) {
      if (visit(targetId)) return true
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }

  return graph.nodes.some((node) => visit(node.id))
}
