export type DataContract = {
  name: string
  version: string
  schema: Record<string, unknown>
  estimatedSizeBytes: number
}
