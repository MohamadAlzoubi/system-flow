import type {
  DataContract,
  FlowGraph,
  NodeDefinition,
  ValidationIssue,
} from "../../contracts"
import { contractVersions, resolveEdgeContract } from "../contracts/contract-versions"

function keyIssues(contract: DataContract): string[] {
  const fieldNames = new Set(contract.fields.map((field) => field.name))
  return (
    [
      ["idempotency", contract.idempotencyKey],
      ["correlation", contract.correlationKey],
      ["partition", contract.partitionKey],
    ] as const
  )
    .filter(([, key]) => key !== undefined && !fieldNames.has(key))
    .map(([label]) => label)
}

function compatibilityIssues(older: DataContract, newer: DataContract): string[] {
  if (newer.compatibility === "none") return []
  const problems: string[] = []
  const olderFields = new Map(older.fields.map((field) => [field.name, field]))
  const newerFields = new Map(newer.fields.map((field) => [field.name, field]))
  for (const field of older.fields) {
    const successor = newerFields.get(field.name)
    if (
      !successor &&
      field.required &&
      (newer.compatibility === "forward" || newer.compatibility === "full")
    ) {
      problems.push(`removes required field ${field.name}, breaking older readers`)
    }
    if (successor && successor.type !== field.type) {
      problems.push(`changes field ${field.name} from ${field.type} to ${successor.type}`)
    }
  }
  if (newer.compatibility === "backward" || newer.compatibility === "full") {
    for (const field of newer.fields) {
      if (field.required && !olderFields.has(field.name)) {
        problems.push(
          `adds required field ${field.name}, which older data does not carry`,
        )
      }
    }
  }
  return problems
}

export function validateContracts(
  graph: FlowGraph,
  registry: ReadonlyMap<string, NodeDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seen = new Set<string>()
  const names = new Set<string>()

  for (const contract of graph.dataContracts) {
    names.add(contract.name)
    const identity = `${contract.name}@${contract.version}`
    if (seen.has(identity)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_CONTRACT",
        message: `Contract ${identity} is defined more than once`,
      })
    }
    seen.add(identity)
    if (!contract.name.trim() || !contract.version.trim()) {
      issues.push({
        severity: "error",
        code: "INVALID_CONTRACT",
        message: "Contracts require a name and a version",
      })
    }
    for (const label of keyIssues(contract)) {
      issues.push({
        severity: "error",
        code: "INVALID_CONTRACT_KEY",
        message: `Contract ${identity} declares a ${label} key that is not one of its fields`,
      })
    }
  }

  for (const name of names) {
    const versions = contractVersions(graph.dataContracts, name)
    for (let index = 1; index < versions.length; index += 1) {
      for (const problem of compatibilityIssues(versions[index - 1], versions[index])) {
        issues.push({
          severity: "warning",
          code: "CONTRACT_INCOMPATIBLE",
          message: `${name} ${versions[index].version} ${problem}`,
        })
      }
    }
  }

  const versionsInUse = new Map<string, Set<string>>()
  for (const edge of graph.edges) {
    const contract = resolveEdgeContract(graph.dataContracts, edge)
    if (!contract) {
      issues.push({
        severity: "warning",
        code:
          edge.dataTypeVersion === undefined
            ? "CONTRACT_MISSING"
            : "UNKNOWN_CONTRACT_VERSION",
        message:
          edge.dataTypeVersion === undefined
            ? `No contract describes ${edge.dataType}; define its fields before implementation`
            : `${edge.dataType} has no version ${edge.dataTypeVersion}`,
        edgeId: edge.id,
      })
      continue
    }
    const used = versionsInUse.get(contract.name) ?? new Set<string>()
    used.add(contract.version)
    versionsInUse.set(contract.name, used)

    if (edge.deliveryPolicy?.ordering === "per-key" && !contract.partitionKey) {
      issues.push({
        severity: "warning",
        code: "PARTITION_KEY_MISSING",
        message: `${contract.name} needs a partition key to honor per-key ordering`,
        edgeId: edge.id,
      })
    }
    if (
      contract.kind === "command" &&
      edge.deliveryPolicy?.guarantee === "at-least-once" &&
      !contract.idempotencyKey
    ) {
      issues.push({
        severity: "warning",
        code: "COMMAND_WITHOUT_IDEMPOTENCY",
        message: `${contract.name} may be delivered more than once but declares no idempotency key`,
        edgeId: edge.id,
      })
    }
    const target = graph.nodes.find((node) => node.id === edge.toNodeId)
    const targetCategory = target && registry.get(target.type)?.category
    const sensitiveFields = contract.fields.filter((field) => field.sensitive)
    if (targetCategory === "Integration" && sensitiveFields.length > 0) {
      issues.push({
        severity: "warning",
        code: "SENSITIVE_DATA_EXPOSURE",
        message: `${contract.name} sends sensitive ${sensitiveFields
          .map((field) => field.name)
          .join(", ")} to an external dependency`,
        edgeId: edge.id,
      })
    }
  }

  for (const [name, used] of versionsInUse) {
    if (used.size > 1) {
      issues.push({
        severity: "warning",
        code: "CONTRACT_VERSION_MISMATCH",
        message: `${name} is used at versions ${[...used].sort().join(" and ")}; producers and consumers disagree`,
      })
    }
  }

  return issues
}
