# System Flow Roadmap V3

## Product direction

System Flow V3 is a pre-development architecture planning tool.

Its purpose is not to predict production with load-test precision. Its purpose is to
help a team describe a backend system, test its assumptions, expose missing decisions,
and produce an implementation-ready blueprint before development begins.

The central question is:

> If a team started building this system tomorrow, what important decisions, risks, and
> unknowns would still be missing?

V3 keeps data contracts as the primary domain object. Nodes describe architectural
responsibilities, typed edges describe interactions, and deterministic simulation helps
compare design choices.

Cost estimation is outside the V3 scope.

---

## Product principles

### Decisions before diagrams

Every visual element must represent an implementation decision. System Flow must not
become a generic drawing tool.

### Requirements before results

A simulation result is useful only when compared with a goal. V3 evaluates a design
against explicit latency, throughput, availability, recovery, ordering, and data
freshness requirements.

### Contracts before infrastructure

Users should define what moves through the system before choosing how it is transported
or stored.

### Explainable estimates

Results must state their assumptions. The same graph and scenario must continue to
produce deterministic results.

### Progressive complexity

A beginner should be able to build a useful flow with defaults. Advanced semantics
should appear when the design requires them.

### Implementation-ready output

The graph should become a shared plan for developers, reviewers, testers, and operators.

---

## V3 success criteria

V3 is successful when a team can use one System Flow project to answer:

- What business operation or event starts this flow?
- Which components must be implemented?
- What data crosses each boundary?
- Which interactions are synchronous and which are asynchronous?
- Which component owns each piece of state?
- What happens when a dependency is slow, unavailable, or returns invalid data?
- Which delivery, ordering, and consistency guarantees are required?
- Does the architecture meet its declared goals?
- What assumptions remain unverified?
- In what order should the system be developed and tested?

---

# Milestone 1: Architecture goals

## Objective

Give every flow a clear definition of success before simulation begins.

## Flow requirements

Add an `architectureGoals` object to the flow contract:

```ts
type ArchitectureGoals = {
  averageTrafficPerSecond: number
  peakTrafficPerSecond: number
  maximumAverageLatencyMs?: number
  maximumP95LatencyMs?: number
  minimumAvailabilityPercent?: number
  maximumDataLossEvents?: number
  maximumRecoveryTimeSeconds?: number
  maximumRecoveryPointSeconds?: number
  maximumDataStalenessMs?: number
  orderingRequirement: "none" | "per-key" | "global"
}
```

These values describe requirements, not component configuration.

## User experience

- Add a “Design goals” step when creating a flow.
- Provide presets for user-facing API, background jobs, event processing, realtime
  messaging, and batch processing.
- Show goals in the inspector when no node is selected.
- Allow unknown goals, but mark them as open questions.
- Explain every goal in plain language.

## Result changes

Simulation results should report:

- Passed goals
- Failed goals
- Goals that cannot be evaluated
- Safety margin for each measurable goal
- Assumptions responsible for low-confidence results

## Validation

Add warnings when:

- Peak traffic is missing.
- A user-facing synchronous flow has no latency target.
- A stateful flow has no recovery or data-loss requirement.
- An availability target is declared but no failure scenario exists.

## Completion criteria

- Every example flow declares meaningful goals.
- Analysis compares results against goals.
- Goal evaluation is deterministic and tested.

---

# Milestone 2: Explicit interaction types

## Objective

Make edges describe how components communicate, not only what data they carry.

## Interaction model

Extend `FlowEdge`:

```ts
type InteractionType =
  | "request-response"
  | "async-command"
  | "published-event"
  | "stream"
  | "batch-transfer"
  | "database-operation"
  | "realtime-push"

type FlowEdge = {
  // Existing fields
  interactionType: InteractionType
  timeoutMs?: number
  responseDataType?: string
  deliveryPolicy?: DeliveryPolicy
}
```

## Semantics

### Request-response

- Caller waits for completion.
- Downstream latency contributes to caller latency.
- Requires a timeout.
- Failure propagates to the caller unless a fallback is defined.

### Async command

- Requests that a specific action be performed later.
- Requires an acceptance and delivery policy.
- Caller latency ends when the command is accepted.

### Published event

- Describes a fact that has already happened.
- May broadcast to independent consumers.
- Producer should not depend on a consumer response.

### Stream

- Represents an ordered, retained sequence.
- Requires partitioning and ordering decisions.

### Batch transfer

- Moves a collection on a schedule or size threshold.
- Adds collection and flush delay.

### Database operation

- Represents a read or write against owned state.
- Requires operation and consistency semantics.

### Realtime push

- Represents server-initiated delivery over a long-lived connection.
- Requires slow-client and disconnection behavior.

## User experience

- Select interaction type when connecting nodes.
- Use visually distinct but restrained edge treatments.
- Display the interaction type and contract on edge selection.
- Show only controls relevant to the chosen interaction.
- Provide short selection guidance in the edge inspector.

## Validation

Add warnings for:

- Request-response edge without a timeout.
- Response type missing from an interaction that returns data.
- Published event configured as if the producer waits for a consumer.
- Database operation connected to a node that does not own the data.
- Realtime push targeting a component without connection semantics.

## Completion criteria

- Every edge has an explicit interaction type.
- Latency propagation respects synchronous and asynchronous boundaries.
- Existing flows migrate with safe inferred defaults.

---

# Milestone 3: Data contract workspace

## Objective

Make data contracts useful enough to guide implementation.

## Contract model

Extend `DataContract` with:

```ts
type ContractField = {
  name: string
  type: "string" | "number" | "boolean" | "object" | "array" | "timestamp"
  required: boolean
  description?: string
  example?: unknown
  sensitive?: boolean
}

type DataContract = {
  name: string
  version: string
  kind: "command" | "event" | "request" | "response" | "record"
  description: string
  fields: ContractField[]
  estimatedSizeBytes: number
  idempotencyKey?: string
  correlationKey?: string
  partitionKey?: string
  retentionSeconds?: number
  compatibility: "backward" | "forward" | "full" | "none"
}
```

The model may continue to expose a serializable schema representation, but the editor
should not require users to write raw schema JSON for normal use.

## Contract designer

- Create and edit fields using a focused form.
- Mark required and optional fields.
- Add descriptions and examples.
- Mark sensitive fields.
- Select idempotency, correlation, and partition keys.
- Preview example JSON.
- Show all producers and consumers.
- Duplicate a contract into a new version.

## Compatibility validation

Detect:

- Removed required fields
- Newly required fields without defaults
- Changed field types
- Producer and consumer version mismatch
- Missing partition keys where per-key ordering is required
- Retryable commands without an idempotency key
- Sensitive fields crossing an untrusted boundary

## Completion criteria

- A developer can derive DTOs or schemas from a contract without guessing field intent.
- Contract evolution issues are visible before simulation.
- Every example uses meaningful contract fields.

---

# Milestone 4: Boundaries, ownership, and state

## Objective

Show where responsibilities and operational boundaries exist.

## Architecture boundary

Add first-class groups that may contain nodes:

```ts
type ArchitectureBoundary = {
  id: string
  label: string
  kind: "system" | "service" | "team" | "region" | "availability-zone" | "trust-zone"
  parentId?: string
  owner?: string
}
```

Groups are architectural metadata, not free-form diagram containers.

## Node responsibility

Add optional node metadata:

- Owner or team
- Deployment region
- Stateful or stateless
- Source-of-truth status
- Data classification
- Implementation status
- Notes and linked decision records

## State ownership

For data nodes, capture:

- Data owned
- Allowed writers
- Read consumers
- Transaction boundary
- Consistency model
- Conflict-resolution strategy
- Cache invalidation strategy
- Freshness tolerance

## Validation

Add warnings for:

- Stateful node without an owner.
- Data contract with multiple uncoordinated source-of-truth writers.
- Cross-region state access without an explicit network policy.
- Cache without a miss or refill path.
- Read replica used by a flow requiring immediate read-after-write consistency.
- Sensitive data crossing a trust boundary without protection metadata.

## Completion criteria

- A reviewer can identify ownership and state boundaries without reading implementation
  code.
- Groups cannot become arbitrary visual decoration.

---

# Milestone 5: Failure and delivery design

## Objective

Require the architecture to state what happens when normal execution fails.

## Edge failure policy

```ts
type FailurePolicy = {
  timeoutMs?: number
  action:
    | "propagate"
    | "retry"
    | "queue"
    | "fallback"
    | "drop"
    | "dead-letter"
  maximumAttempts?: number
  backoff?: "fixed" | "linear" | "exponential"
  initialBackoffMs?: number
  maximumBackoffMs?: number
  fallbackNodeId?: string
}
```

## Delivery policy

```ts
type DeliveryPolicy = {
  guarantee: "at-most-once" | "at-least-once" | "effectively-once"
  ordering: "none" | "per-key" | "global"
  acknowledgement: "none" | "automatic" | "manual"
  deduplication: "none" | "producer" | "consumer" | "shared-store"
}
```

“Exactly once” should not be offered as an unexplained switch. The UI should use
“effectively once” and require an idempotency or deduplication strategy.

## Failure scenario builder

Allow users to create named scenarios:

- Dependency unavailable
- Dependency slow
- Partial capacity loss
- Region unavailable
- Malformed or incompatible data
- Duplicate delivery
- Traffic spike
- Primary datastore failover
- Consumer outage

Each scenario should describe:

- Trigger
- Affected nodes or boundaries
- Start and duration
- Expected system response
- Expected user impact
- Recovery behavior

## User-impact outcomes

Classify failed work as:

- Rejected immediately
- Timed out
- Accepted for later processing
- Served by fallback
- Degraded response
- Lost
- Duplicated
- Delayed beyond goal

## Validation

Add warnings for:

- External dependency without timeout behavior.
- Retry without idempotency protection.
- Unbounded retry policy.
- Queue without terminal failure handling.
- Dead-letter queue without retention or replay ownership.
- Fallback path using the same failure boundary as the primary.
- Global ordering combined with incompatible parallelization.
- At-most-once delivery where maximum data loss is zero.

## Completion criteria

- Every important dependency has explicit failure behavior.
- Simulation explains user impact, not only component utilization.
- Failure scenarios are reusable and comparable.

---

# Milestone 6: Architecture rule engine

## Objective

Turn expert review knowledge into explainable, actionable checks.

## Rule structure

```ts
type ArchitectureRule = {
  code: string
  category:
    | "contracts"
    | "reliability"
    | "performance"
    | "state"
    | "security"
    | "operability"
  severity: "error" | "warning" | "question"
  message: string
  rationale: string
  affectedIds: string[]
  suggestedActions: string[]
}
```

Rules must remain deterministic and framework-free in `src/engine`.

## Initial rule set

### Interaction rules

- Synchronous dependency chain exceeds a configurable depth.
- Synchronous call has no timeout.
- Timeout budget is smaller than expected downstream latency.
- Asynchronous operation incorrectly contributes to caller response latency.

### Reliability rules

- Single point of failure conflicts with the availability goal.
- Retry amplification can exceed downstream capacity.
- Circuit breaker has no fallback or graceful failure outcome.
- Recovery capacity cannot drain outage backlog within the recovery goal.

### Messaging rules

- Queue has no DLQ or terminal outcome.
- TTL is shorter than expected outage plus recovery time.
- Required ordering conflicts with partition count.
- At-least-once delivery lacks idempotency.

### Data rules

- Multiple writers own the same state.
- Cache has no invalidation or expiry strategy.
- Search index is modeled as the sole source of truth.
- Event contract has no stable identity or timestamp.

### Operability rules

- Critical component has no owner.
- Failure scenario has no expected recovery behavior.
- Important assumption is not verified.
- Flow has no observability path for a declared SLO.

## Rule experience

- Group findings by architectural concern.
- Explain why each finding matters.
- Link findings to affected nodes, edges, contracts, or goals.
- Offer alternatives rather than one prescriptive answer.
- Allow documented acceptance with a reason and review date.

## Completion criteria

- Findings teach architecture rather than merely reject input.
- Accepted risks remain visible in exported documentation.
- Rules have focused tests.

---

# Milestone 7: Time-aware design simulation

## Objective

Improve scenario usefulness without turning System Flow into a load-testing product.

## Time-sliced propagation

Propagate traffic, capacity, failures, routing, queue state, and scaling state per
simulation frame instead of relying primarily on whole-scenario averages.

This enables useful answers to:

- Does a short spike overflow the queue?
- Does autoscaling become ready before the burst ends?
- How much backlog remains after an outage?
- Does failover activate before callers time out?
- Can recovery capacity drain delayed work within the target?

## Required behavior

- Traffic patterns produce a rate for each frame.
- Availability affects each frame, not only average capacity.
- Queue output follows active consumer capacity.
- Scaling changes capacity only after readiness delay.
- Failover includes detection and recovery delay.
- Synchronous timeout outcomes propagate upstream.
- Asynchronous boundaries stop caller latency propagation.

## Scope boundary

V3 remains an architecture estimator:

- No real infrastructure clients
- No nondeterministic wall-clock execution
- No claim of production percentile accuracy
- No packet-level or thread-level simulation

## Completion criteria

- Results remain reproducible.
- Timeline behavior matches documented scenarios.
- The engine clearly labels estimated versus directly configured values.

---

# Milestone 8: Decision records and assumptions

## Objective

Preserve why the architecture looks the way it does.

## Decision record

```ts
type DecisionRecord = {
  id: string
  title: string
  status: "proposed" | "accepted" | "rejected" | "superseded"
  context: string
  decision: string
  alternatives: string[]
  consequences: string[]
  assumptionIds: string[]
  relatedNodeIds: string[]
  relatedEdgeIds: string[]
  reviewDate?: string
}
```

## Assumption

```ts
type ArchitectureAssumption = {
  id: string
  statement: string
  status: "unverified" | "verified" | "invalid"
  impact: "low" | "medium" | "high"
  evidence?: string
  relatedIds: string[]
}
```

Examples:

- Peak traffic will remain below 2,000 requests per second.
- The email provider supports idempotency keys.
- Product data may be up to five minutes stale.
- A regional outage is acceptable for the internal reporting flow.

## User experience

- Attach decisions and assumptions to the whole flow or selected elements.
- Surface high-impact unverified assumptions in analysis.
- Carry accepted validation findings into decision records.
- Mark assumptions invalid when simulation or imported evidence contradicts them.

## Completion criteria

- Important tradeoffs survive beyond the design meeting.
- Exported plans include unresolved assumptions and review dates.

---

# Milestone 9: Implementation blueprint

## Objective

Convert the completed architecture into an actionable development plan.

## Blueprint sections

### System overview

- Purpose
- Architecture goals
- Main business flows
- Boundaries and ownership

### Components to implement

For every node:

- Responsibility
- Inputs and outputs
- State ownership
- Capacity assumption
- Failure behavior
- Dependencies
- Owner
- Open questions

### Contracts and interfaces

- API requests and responses
- Commands
- Events
- Streams
- Database operations
- Contract versions and compatibility

### Reliability plan

- Timeouts
- Retries
- Idempotency
- Circuit breakers
- Queues and DLQs
- Failover
- Recovery expectations

### Development sequence

Generate a dependency-aware suggested order:

1. Shared contracts
2. Sources of truth
3. Core synchronous path
4. Messaging infrastructure
5. Background consumers
6. Derived views and caches
7. External integrations
8. Resilience behavior
9. Observability and scenario tests

### Test plan

Generate:

- Contract compatibility tests
- Happy-path integration tests
- Capacity scenarios
- Duplicate-delivery tests
- Timeout and retry tests
- Dependency outage tests
- Recovery and backlog-drain tests
- Data consistency tests

### Risks and open questions

- Failed architecture goals
- Validation findings
- Accepted risks
- Unverified assumptions
- Missing owners
- Decisions awaiting review

## Export formats

- Human-readable Markdown
- Printable HTML
- Serializable project JSON

Machine-generated code is not a V3 requirement. The blueprint should provide enough
clarity for a team to choose its own language and frameworks.

## Completion criteria

- A team can use the export as the starting document for implementation planning.
- Every generated statement is traceable to graph data, a rule, or an explicit
  assumption.

---

# Milestone 10: Education integration

## Objective

Teach architecture decisions at the moment users need to make them.

## Contextual education

- Explain component purpose before showing advanced controls.
- Include “use when,” “avoid when,” and real examples.
- Explain the tradeoff behind each interaction type.
- Link validation findings to the relevant education section.
- Provide guided scenarios that modify the current graph.

## Guided design reviews

Add optional review modes:

- API design review
- Event-driven design review
- Data ownership review
- Reliability review
- Pre-implementation readiness review

Each review asks focused questions and records the answers as goals, policies,
decisions, or assumptions.

## Completion criteria

- Education is connected to actual design decisions.
- Users can move from an explanation directly to the affected graph element.

---

# Recommended delivery order

## Phase A: Define intent

1. Architecture goals
2. Explicit interaction types
3. Data contract workspace

This phase gives the graph enough meaning to support deeper analysis.

## Phase B: Define responsibility

4. Boundaries, ownership, and state
5. Failure and delivery design

This phase answers who owns behavior and what happens when it fails.

## Phase C: Review the design

6. Architecture rule engine
7. Time-aware design simulation

This phase converts the model into useful feedback.

## Phase D: Prepare implementation

8. Decision records and assumptions
9. Implementation blueprint
10. Education integration

This phase turns the architecture into a durable development plan.

---

# Features intentionally deferred

The following are valuable but not required for V3:

- Production infrastructure execution
- Live cloud-resource provisioning
- Packet-level network simulation
- Exact production latency prediction
- Automatic framework or application code generation
- Real-time multi-user editing
- Vendor pricing and cost estimation
- Generic free-form diagram elements

These features should not distract from pre-development architecture decisions.

---

# V3 definition of done

System Flow V3 is complete when a valid project contains:

- Measurable architecture goals
- Typed and versioned data contracts
- Explicit interaction semantics
- Component and state ownership
- Delivery and failure policies
- At least one failure scenario
- Deterministic goal evaluation
- Explainable architecture findings
- Recorded decisions and assumptions
- An exportable implementation blueprint

At that point, System Flow will not merely show what a proposed system contains. It will
explain what the team has decided, what the design is expected to achieve, how it should
behave when assumptions fail, and what developers need to build next.
