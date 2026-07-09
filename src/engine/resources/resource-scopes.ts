import type {
  ArchitectureBoundary,
  FlowGraph,
  NodeInstance,
  ResourceScopeUsage,
} from "../../contracts"

const profileScopeId = "simulation-profile"

export function regionBoundaryForNode(
  node: NodeInstance,
  boundaries: ReadonlyMap<string, ArchitectureBoundary>,
): ArchitectureBoundary | undefined {
  let current = node.boundaryId ? boundaries.get(node.boundaryId) : undefined
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    if (current.kind === "region") return current
    visited.add(current.id)
    current = current.parentId ? boundaries.get(current.parentId) : undefined
  }
  return undefined
}

export function resourceBudgetForBoundary(
  boundary: ArchitectureBoundary | undefined,
  graph: FlowGraph,
): Pick<ResourceScopeUsage, "cpuBudgetCores" | "memoryBudgetMb"> {
  return {
    cpuBudgetCores:
      boundary?.resourceBudget?.cpuCores ?? graph.simulationProfile.cpuCores,
    memoryBudgetMb:
      boundary?.resourceBudget?.memoryMb ?? graph.simulationProfile.memoryMb,
  }
}

export function emptyResourceScopes(graph: FlowGraph): Map<string, ResourceScopeUsage> {
  const scopes = new Map<string, ResourceScopeUsage>()
  scopes.set(profileScopeId, {
    scopeId: profileScopeId,
    scopeKind: "simulation-profile",
    label: "Unassigned nodes",
    cpuCores: 0,
    memoryMb: 0,
    ...resourceBudgetForBoundary(undefined, graph),
    nodeIds: [],
  })

  for (const boundary of graph.boundaries ?? []) {
    if (boundary.kind !== "region") continue
    scopes.set(boundary.id, {
      scopeId: boundary.id,
      scopeKind: "region",
      label: boundary.label,
      cpuCores: 0,
      memoryMb: 0,
      ...resourceBudgetForBoundary(boundary, graph),
      nodeIds: [],
    })
  }

  return scopes
}

export function addNodeResourceUsage(
  scopes: Map<string, ResourceScopeUsage>,
  node: NodeInstance,
  graph: FlowGraph,
  cpuCores: number,
  memoryMb: number,
): void {
  const boundaries = new Map(
    (graph.boundaries ?? []).map((boundary) => [boundary.id, boundary]),
  )
  const region = regionBoundaryForNode(node, boundaries)
  const scopeId = region?.id ?? profileScopeId
  const existing =
    scopes.get(scopeId) ??
    ({
      scopeId,
      scopeKind: region ? "region" : "simulation-profile",
      label: region?.label ?? "Unassigned nodes",
      cpuCores: 0,
      memoryMb: 0,
      ...resourceBudgetForBoundary(region, graph),
      nodeIds: [],
    } satisfies ResourceScopeUsage)

  scopes.set(scopeId, {
    ...existing,
    cpuCores: existing.cpuCores + cpuCores,
    memoryMb: existing.memoryMb + memoryMb,
    nodeIds: [...existing.nodeIds, node.id],
  })
}

export function activeResourceScopes(
  scopes: ReadonlyMap<string, ResourceScopeUsage>,
): ResourceScopeUsage[] {
  return [...scopes.values()].filter((scope) => scope.nodeIds.length > 0)
}
