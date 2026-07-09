import type {
  ArchitectureBoundary,
  FlowGraph,
  NodeDefinition,
  NodeInstance,
  ValidationIssue,
} from "../../contracts"
import { resolveEdgeContract } from "../contracts/contract-versions"
import { boundaryRegionCode, deploymentRegionOf } from "../graph/resolve-region"

const statefulCategories = new Set(["Data", "Messaging", "Streaming"])

function isStateful(
  node: NodeInstance,
  registry: ReadonlyMap<string, NodeDefinition>,
): boolean {
  return (
    node.responsibility?.stateful ??
    statefulCategories.has(registry.get(node.type)?.category ?? "")
  )
}

/** Nearest enclosing trust zone, walking the boundary parent chain. */
function trustZoneOf(
  node: NodeInstance,
  boundaries: Map<string, ArchitectureBoundary>,
): string | undefined {
  let current = node.boundaryId ? boundaries.get(node.boundaryId) : undefined
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    if (current.kind === "trust-zone") return current.id
    visited.add(current.id)
    current = current.parentId ? boundaries.get(current.parentId) : undefined
  }
  return undefined
}

export function validateOwnership(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const boundaries = new Map(
    (graph.boundaries ?? []).map((boundary) => [boundary.id, boundary]),
  )
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const regionCodes = new Map<string, string>()

  for (const boundary of boundaries.values()) {
    if (boundary.parentId !== undefined && !boundaries.has(boundary.parentId)) {
      issues.push({
        severity: "error",
        code: "INVALID_BOUNDARY",
        message: `Boundary ${boundary.label} references a missing parent`,
      })
    }
    if (
      (boundary.resourceBudget?.cpuCores !== undefined &&
        boundary.resourceBudget.cpuCores <= 0) ||
      (boundary.resourceBudget?.memoryMb !== undefined &&
        boundary.resourceBudget.memoryMb <= 0)
    ) {
      issues.push({
        severity: "error",
        code: "INVALID_RESOURCE_BUDGET",
        message: `Boundary ${boundary.label} has an invalid resource budget`,
      })
    }
    const chain = new Set<string>([boundary.id])
    let parent = boundary.parentId ? boundaries.get(boundary.parentId) : undefined
    while (parent) {
      if (chain.has(parent.id)) {
        issues.push({
          severity: "error",
          code: "INVALID_BOUNDARY",
          message: `Boundary ${boundary.label} is part of a containment cycle`,
        })
        break
      }
      chain.add(parent.id)
      parent = parent.parentId ? boundaries.get(parent.parentId) : undefined
    }
    const regionCode = boundary.regionCode?.trim()
    if (boundary.kind === "region" && regionCode) {
      const existingBoundaryId = regionCodes.get(regionCode)
      if (existingBoundaryId && existingBoundaryId !== boundary.id) {
        issues.push({
          severity: "error",
          code: "DUPLICATE_REGION_CODE",
          message: `Region code ${regionCode} is used by more than one region boundary`,
        })
      }
      regionCodes.set(regionCode, boundary.id)
    }
  }

  const ownersByContract = new Map<string, NodeInstance[]>()
  for (const node of graph.nodes) {
    if (node.boundaryId !== undefined && !boundaries.has(node.boundaryId)) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_BOUNDARY",
        message: "Node is assigned to a boundary that does not exist",
        nodeId: node.id,
      })
    }
    const boundary = node.boundaryId ? boundaries.get(node.boundaryId) : undefined
    const regionCode = boundaryRegionCode(node, boundaries)
    if (
      regionCode &&
      node.responsibility?.deploymentRegion !== undefined &&
      node.responsibility.deploymentRegion !== regionCode
    ) {
      issues.push({
        severity: "warning",
        code: "REGION_ASSIGNMENT_MISMATCH",
        message: `${node.id} is inside ${boundary?.label ?? node.boundaryId} but declares deployment region ${node.responsibility.deploymentRegion}`,
        nodeId: node.id,
      })
    }
    const stateful = isStateful(node, registry)
    if (stateful && !node.responsibility?.owner) {
      issues.push({
        severity: "warning",
        code: "STATEFUL_WITHOUT_OWNER",
        message: `${registry.get(node.type)?.label ?? node.type} holds state but no one owns it`,
        nodeId: node.id,
      })
    }
    if (node.responsibility?.sourceOfTruth) {
      for (const contractName of node.stateOwnership?.dataOwned ?? []) {
        ownersByContract.set(contractName, [
          ...(ownersByContract.get(contractName) ?? []),
          node,
        ])
      }
    }
    if (
      node.type === "redis.cache" &&
      (node.stateOwnership?.cacheInvalidation ?? "none") === "none"
    ) {
      issues.push({
        severity: "warning",
        code: "CACHE_WITHOUT_REFILL",
        message:
          "Cache declares no invalidation or refill strategy, so stale entries never leave",
        nodeId: node.id,
      })
    }
    if (
      node.type === "data.read-replica" &&
      node.stateOwnership !== undefined &&
      node.stateOwnership.consistencyModel !== "eventual"
    ) {
      issues.push({
        severity: "warning",
        code: "READ_REPLICA_CONSISTENCY",
        message:
          "Read replicas lag the primary and cannot promise read-after-write consistency",
        nodeId: node.id,
      })
    }
  }

  for (const [contractName, owners] of ownersByContract) {
    const coordinated = owners.every(
      (node) =>
        node.stateOwnership?.conflictResolution !== undefined &&
        node.stateOwnership.conflictResolution !== "single-writer",
    )
    if (owners.length > 1 && !coordinated) {
      issues.push({
        severity: "warning",
        code: "MULTIPLE_SOURCE_OF_TRUTH",
        message: `${contractName} has ${owners.length} uncoordinated source-of-truth writers`,
      })
    }
  }

  for (const edge of graph.edges) {
    const source = nodes.get(edge.fromNodeId)
    const target = nodes.get(edge.toNodeId)
    if (!source || !target) continue

    const sourceRegion = deploymentRegionOf(source, boundaries)
    const targetRegion = deploymentRegionOf(target, boundaries)
    if (
      isStateful(target, registry) &&
      sourceRegion !== undefined &&
      targetRegion !== undefined &&
      sourceRegion !== targetRegion &&
      edge.network === undefined
    ) {
      issues.push({
        severity: "warning",
        code: "CROSS_REGION_STATE",
        message: `State in ${targetRegion} is accessed from ${sourceRegion} without an explicit network policy`,
        edgeId: edge.id,
      })
    }

    const sourceZone = trustZoneOf(source, boundaries)
    const targetZone = trustZoneOf(target, boundaries)
    if (sourceZone !== targetZone && edge.protection === undefined) {
      const contract = resolveEdgeContract(graph.dataContracts, edge)
      const sensitiveFields = contract?.fields.filter((field) => field.sensitive) ?? []
      if (sensitiveFields.length > 0) {
        issues.push({
          severity: "warning",
          code: "SENSITIVE_TRUST_BOUNDARY",
          message: `Sensitive ${sensitiveFields
            .map((field) => field.name)
            .join(", ")} crosses a trust boundary without protection`,
          edgeId: edge.id,
        })
      }
    }
  }

  return issues
}
