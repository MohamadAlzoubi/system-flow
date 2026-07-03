import type { ContractField, ContractFieldType, DataContract } from "../../contracts"

const fieldTypes = new Set<ContractFieldType>([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "timestamp",
])

function fieldTypeFrom(value: unknown): ContractFieldType {
  return typeof value === "string" && fieldTypes.has(value as ContractFieldType)
    ? (value as ContractFieldType)
    : "object"
}

/**
 * Upgrades contracts saved before the structured model: a legacy
 * `schema: { name: "type" }` object becomes required typed fields, and
 * missing descriptive properties get neutral defaults.
 */
export function normalizeDataContract(value: unknown): DataContract {
  const legacy = (value ?? {}) as Partial<DataContract> & {
    schema?: Record<string, unknown>
  }
  const fields: ContractField[] = Array.isArray(legacy.fields)
    ? legacy.fields
    : Object.entries(legacy.schema ?? {}).map(([name, type]) => ({
        name,
        type: fieldTypeFrom(type),
        required: true,
      }))
  return {
    name: legacy.name ?? "UnnamedContract",
    version: legacy.version ?? "1.0",
    kind: legacy.kind ?? "event",
    description: legacy.description ?? "",
    fields,
    estimatedSizeBytes: legacy.estimatedSizeBytes ?? 1024,
    idempotencyKey: legacy.idempotencyKey,
    correlationKey: legacy.correlationKey,
    partitionKey: legacy.partitionKey,
    retentionSeconds: legacy.retentionSeconds,
    compatibility: legacy.compatibility ?? "backward",
  }
}
