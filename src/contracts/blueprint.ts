/**
 * A deterministic, implementation-ready development plan derived entirely from
 * graph data, rule findings, and explicit assumptions. Contains no timestamps
 * or generated identifiers so the same project always yields the same blueprint.
 */
export type Blueprint = {
  name: string
  overview: BlueprintOverview
  components: BlueprintComponent[]
  contracts: BlueprintContract[]
  reliability: BlueprintReliability
  developmentSequence: BlueprintPhase[]
  testPlan: BlueprintTestGroup[]
  risks: BlueprintRiskGroup[]
}

export type BlueprintOverview = {
  purpose: string
  goals: string[]
  mainFlows: string[]
  boundaries: string[]
}

export type BlueprintComponent = {
  id: string
  label: string
  responsibility: string
  inputs: string[]
  outputs: string[]
  stateOwnership?: string
  capacityAssumption: string
  failureBehavior: string[]
  dependencies: string[]
  owner: string
  openQuestions: string[]
}

export type BlueprintContract = {
  name: string
  version: string
  kind: string
  compatibility: string
  fields: string[]
  producers: string[]
  consumers: string[]
}

export type BlueprintReliability = {
  timeouts: string[]
  retries: string[]
  idempotency: string[]
  circuitBreakers: string[]
  queues: string[]
  failover: string[]
  recovery: string[]
}

export type BlueprintPhase = {
  step: number
  title: string
  items: string[]
}

export type BlueprintTestGroup = {
  category: string
  items: string[]
}

export type BlueprintRiskGroup = {
  category: string
  items: string[]
}
