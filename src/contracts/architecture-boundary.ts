export type BoundaryKind =
  | "system"
  | "service"
  | "team"
  | "region"
  | "availability-zone"
  | "trust-zone"

/** Architectural metadata grouping nodes, never free-form diagram decoration. */
export type ArchitectureBoundary = {
  id: string
  label: string
  kind: BoundaryKind
  parentId?: string
  owner?: string
}

export type ImplementationStatus =
  | "planned"
  | "in-progress"
  | "implemented"
  | "deprecated"

export type DataClassification = "public" | "internal" | "confidential" | "regulated"

/** Who answers for a component and how it participates in operations. */
export type NodeResponsibility = {
  owner?: string
  deploymentRegion?: string
  /** Overrides the category-based default when set. */
  stateful?: boolean
  sourceOfTruth?: boolean
  dataClassification?: DataClassification
  implementationStatus?: ImplementationStatus
  notes?: string
  decisionRecordIds?: string[]
}

export type ConsistencyModel = "strong" | "read-after-write" | "eventual"

export type ConflictResolution = "single-writer" | "last-write-wins" | "merge" | "manual"

export type CacheInvalidation =
  | "none"
  | "ttl"
  | "event-driven"
  | "write-through"
  | "manual"

/** What state a data node holds and under which rules it changes. */
export type StateOwnership = {
  /** Contract names this node is responsible for storing. */
  dataOwned: string[]
  /** Node ids allowed to write; an empty list means the policy is undecided. */
  allowedWriterIds: string[]
  readConsumerIds?: string[]
  transactionBoundary?: string
  consistencyModel: ConsistencyModel
  conflictResolution?: ConflictResolution
  cacheInvalidation?: CacheInvalidation
  freshnessToleranceMs?: number
}
