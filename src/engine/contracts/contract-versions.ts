import type { DataContract, FlowEdge } from "../../contracts"

/** Numeric segment-wise version comparison; "1.10" sorts after "1.9". */
export function compareContractVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number)
  const rightParts = right.split(".").map(Number)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function nextContractVersion(version: string): string {
  const parts = version.split(".")
  const minor = Number(parts.at(-1))
  if (Number.isNaN(minor)) return `${version}.1`
  return [...parts.slice(0, -1), String(minor + 1)].join(".")
}

export function contractVersions(
  contracts: DataContract[],
  name: string,
): DataContract[] {
  return contracts
    .filter((contract) => contract.name === name)
    .sort((left, right) => compareContractVersions(left.version, right.version))
}

/** Resolves an edge's contract: its pinned version, or the latest one. */
export function resolveEdgeContract(
  contracts: DataContract[],
  edge: Pick<FlowEdge, "dataType" | "dataTypeVersion">,
): DataContract | undefined {
  const versions = contractVersions(contracts, edge.dataType)
  if (edge.dataTypeVersion !== undefined) {
    return versions.find((contract) => contract.version === edge.dataTypeVersion)
  }
  return versions.at(-1)
}
