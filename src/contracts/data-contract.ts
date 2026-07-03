export type ContractFieldType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "timestamp"

export type ContractField = {
  name: string
  type: ContractFieldType
  required: boolean
  description?: string
  example?: unknown
  sensitive?: boolean
}

export type ContractKind = "command" | "event" | "request" | "response" | "record"

export type ContractCompatibility = "backward" | "forward" | "full" | "none"

export type DataContract = {
  name: string
  version: string
  kind: ContractKind
  description: string
  fields: ContractField[]
  estimatedSizeBytes: number
  idempotencyKey?: string
  correlationKey?: string
  partitionKey?: string
  retentionSeconds?: number
  compatibility: ContractCompatibility
}
