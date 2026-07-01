export type ValidationIssue = {
  severity: "error" | "warning"
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}
