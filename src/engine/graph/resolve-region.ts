import type { ArchitectureBoundary, NodeInstance } from "../../contracts"

export function boundaryRegionCode(
  node: NodeInstance,
  boundaries: ReadonlyMap<string, ArchitectureBoundary>,
): string | undefined {
  let current = node.boundaryId ? boundaries.get(node.boundaryId) : undefined
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    if (current.kind === "region") {
      return current.regionCode?.trim() || current.id
    }
    visited.add(current.id)
    current = current.parentId ? boundaries.get(current.parentId) : undefined
  }
  return undefined
}

export function deploymentRegionOf(
  node: NodeInstance,
  boundaries: ReadonlyMap<string, ArchitectureBoundary>,
): string | undefined {
  return boundaryRegionCode(node, boundaries) ?? node.responsibility?.deploymentRegion
}
