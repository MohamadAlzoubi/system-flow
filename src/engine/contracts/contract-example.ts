import type { ContractField, DataContract } from "../../contracts"

const placeholders: Record<ContractField["type"], unknown> = {
  string: "text",
  number: 0,
  boolean: false,
  object: {},
  array: [],
  timestamp: "2026-01-01T00:00:00Z",
}

/** Builds a deterministic example payload from declared fields. */
export function buildContractExample(
  contract: Pick<DataContract, "fields">,
): Record<string, unknown> {
  const example: Record<string, unknown> = {}
  for (const field of contract.fields) {
    example[field.name] = field.example ?? placeholders[field.type]
  }
  return example
}
