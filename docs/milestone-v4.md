# Milestone V4: Production Readiness Lab

System Flow already has a strong typed architecture model, deterministic simulation,
failure scenarios, ownership metadata, decision records, and implementation
blueprints. V4 should make the product more useful for teams that need to decide
whether a backend architecture is ready for serious implementation, load testing, and
failure drills.

The goal is not to become a generic diagramming tool or a cloud provisioning tool.
The goal is to turn typed backend designs into practical readiness evidence:
capacity assumptions, region behavior, failure response, measurable gaps, and a
clear work plan.

## Product Goal

V4 should answer:

- Which region, dependency, queue, database, or network path fails first?
- What happens to users when a full region goes down?
- Which assumptions are real measurements and which are guesses?
- Which goals are still not measurable?
- What should the team test or build next?
- What evidence can be shared with other AI agents, reviewers, or engineers without
  screenshots?

## Non-Goals

These remain intentionally out of scope:

- Exact production latency prediction.
- Packet-level or event-level infrastructure simulation.
- Live cloud provisioning.
- Automatic application code generation.
- Generic drawing shapes unrelated to backend architecture.
- Real-time multi-user editing.

## 1. Visual Region Containers

### Problem

Regions currently exist as structured boundary metadata, and region shutdown can be
modeled by targeting region boundaries. But the canvas does not yet make regions feel
like real deployment areas. Users should not need to inspect JSON or remember
boundary IDs to understand regional placement.

### Goal

Add region containers on the canvas. A region should be a visible area containing its
nodes, with clear region code, owner, status, and simulation state.

### User Experience

- A user creates a region from the Regions workspace.
- The region appears as a canvas area.
- Nodes can be moved into a region area or assigned from the Regions workspace.
- Nodes inside the region inherit the region code as their deployment region.
- Running a region-unavailable scenario visually marks the region as offline,
  recovering, or healthy.

### Engine and Model Requirements

- Region containers should use existing `ArchitectureBoundary` records with
  `kind: "region"` and `regionCode`.
- Node `boundaryId` remains the canonical membership field.
- Node `responsibility.deploymentRegion` should be derived from the region code
  when a node belongs to a region boundary.
- Validation should warn when a node is inside one region but declares another
  deployment region.

### Acceptance Criteria

- Regions can be created without editing JSON.
- Nodes can be assigned to regions without typing region strings.
- Region shutdown scenarios can be created from the region UI.
- Canvas makes regional placement obvious at a glance.
- Region availability state is visible during replay.

## 2. Scenario Lab

### Problem

The simulator currently runs one active scenario at a time. This is useful, but real
architecture review requires comparing many conditions:

- Normal operation.
- Peak traffic.
- Regional outage.
- Dependency slowdown.
- Datastore failover.
- Queue consumer outage.
- Malformed or duplicate data.

### Goal

Create a Scenario Lab that runs multiple scenarios and compares results in one place.

### User Experience

- A user selects several scenarios.
- The lab runs all selected scenarios deterministically.
- Results are shown as a table with pass/fail goal status, throughput, latency,
  dropped events, user impact, bottlenecks, and recovery behavior.
- Differences from baseline are highlighted.
- Results can be exported as JSON.

### Engine Requirements

- Add a scenario batch result type.
- Reuse `runSimulation(graph, registry, scenario)` for each scenario.
- Preserve deterministic ordering and reproducible results.
- Keep scenario results independent so one scenario cannot mutate another.

### Acceptance Criteria

- Users can compare at least five scenarios side by side.
- Each scenario includes goal report, user impact, warnings, recommendations, and
  bottlenecks.
- Exported JSON includes every scenario result in a machine-readable format.

## 3. Measurement Quality and Calibration

### Problem

The simulation profile supports observed latency and throughput. That is useful, but
the app does not clearly distinguish real measurements from synthetic assumptions.
This can make an estimate look more certain than it is.

### Goal

Add measurement quality metadata so every calibrated value has provenance.

### Proposed Measurement Sources

- `assumed`: user-entered estimate.
- `load-test`: measured during a controlled test.
- `production`: observed from production telemetry.
- `vendor-doc`: taken from provider documentation.
- `unknown`: imported from older flows or incomplete data.

### User Experience

- Observed metrics require a source.
- Analysis explains whether results are estimated, calibrated by assumptions, or
  calibrated by real measurements.
- Confidence is lowered when observed values are marked `assumed`.
- Exports include source and confidence information.

### Acceptance Criteria

- Analysis never reports high confidence from synthetic observed values alone.
- Exported analysis can tell another AI agent which numbers are measured and which
  are assumptions.
- Calibration factors remain visible and explainable.

## 4. Region and Network Presets

### Problem

Network policies are currently manually configured per edge. This is powerful but
too slow for realistic regional designs. Users should be able to pick regions and get
reasonable defaults for latency, bandwidth, and outage assumptions.

### Goal

Add region and network presets that seed edge policies without pretending to be exact
cloud-provider data.

### Preset Examples

- Same availability zone.
- Same region, cross-zone.
- Same continent.
- Cross-continent.
- Public internet to edge.
- Private backbone between regions.
- External provider edge.

### User Experience

- When an edge crosses regions, the inspector suggests a network preset.
- Applying a preset fills base latency, bandwidth, TLS overhead, connection reuse,
  and outage percent.
- Users can override all values.

### Acceptance Criteria

- Cross-region edges can be configured without hand-entering every number.
- Validation warns when stateful cross-region access has no explicit network policy.
- Preset source is visible in the edge inspector and export.

## 5. RTO, RPO, and Staleness Evaluation

### Problem

Architecture goals already include recovery time, recovery point, and data staleness,
but the simulator currently marks them as not evaluated. These are critical for
production readiness.

### Goal

Make recovery and freshness goals measurable enough for architecture review.

### RTO

Recovery time should be estimated from failure scenario timing, availability policy,
failover settings, scaling delay, cold start, and queue drain time.

### RPO

Recovery point should estimate lost or unrecoverable work from dropped events,
queue expiration, dead-letter overflow, and datastore failover windows.

### Staleness

Data staleness should use cache TTL, read replica lag, stream processing lag,
cross-region replication lag, and configured freshness tolerance.

### Acceptance Criteria

- Recovery time goals can pass or fail for failure scenarios.
- Recovery point goals can pass or fail when data loss is modeled.
- Staleness goals can pass or fail on cache, replica, and projection paths.
- Not-evaluated status remains only when required data is missing.

## 6. Capacity Presets

### Problem

Every node has useful configuration fields, but large systems require too much manual
tuning. Users need realistic defaults for common deployment shapes.

### Goal

Add reusable capacity presets for production-oriented nodes.

### Example Presets

- Redis small, medium, large, regional cluster.
- Kafka topic by partition count and retention profile.
- PostgreSQL primary with read replicas.
- DynamoDB style key-value store.
- Search cluster by shards and replicas.
- Worker deployment by replicas, concurrency, and autoscaling.
- External API with vendor quota.
- CDN profile.

### User Experience

- Node inspector includes a preset selector.
- Applying a preset updates the node config.
- Presets are transparent and editable after application.

### Acceptance Criteria

- Users can create a realistic large architecture faster.
- Presets do not hide the underlying config.
- Exported flow remains plain JSON with explicit config values.

## 7. Cost and Quota Risk

### Problem

Teams need to know not only whether the system works, but whether it is expensive or
quota-bound. Exact billing is not required, but risk signals would be highly useful.

### Goal

Add rough cost and quota warnings based on configured capacity.

### Signals

- Memory budget exceeded.
- CPU budget exceeded.
- External provider quota near limit.
- Kafka partition count too low.
- Cross-region bandwidth high.
- Cache memory much larger than budget.
- Queue storage pressure.
- Search shard count high.

### Acceptance Criteria

- Analysis includes cost/quota risk findings.
- Warnings distinguish performance risk from cost or quota risk.
- Exported analysis includes risk category and related nodes or edges.

## 8. Implementation Handoff Pack

### Problem

The blueprint is useful, but teams need a more complete handoff: tasks, tests,
failure drills, and open assumptions.

### Goal

Generate a production readiness pack from the graph and simulation results.

### Output Sections

- Architecture summary.
- Data contracts.
- Regional topology.
- Critical assumptions.
- Required implementation tasks.
- Load test plan.
- Chaos test plan.
- Observability checklist.
- Runbook outline.
- Rollout and migration sequence.

### Acceptance Criteria

- Pack references graph nodes, edges, contracts, scenarios, decisions, and
  assumptions.
- Pack can be exported as Markdown and JSON.
- Findings can be converted into external issue tracker tickets in a later
  integration.

## 9. Review Modes

### Problem

The rule engine identifies findings, but users still need guidance on what kind of
review they are doing.

### Goal

Add focused review modes that ask questions and write answers back into the model.

### Review Modes

- API design review.
- Event-driven design review.
- Data ownership review.
- Reliability review.
- Regional resilience review.
- Pre-implementation readiness review.

### Acceptance Criteria

- Each review mode shows focused questions.
- Answers become architecture goals, assumptions, decisions, failure policies, or
  state ownership metadata.
- Users can move from a review question to the affected graph element.

## Recommended Delivery Order

### Phase A: Make Regions First-Class

1. Visual region containers.
2. Region assignment workflow.
3. Region shutdown scenario shortcut.
4. Region replay visualization.

This phase makes regional failure testing understandable without JSON.

### Phase B: Compare Scenarios

1. Scenario Lab.
2. Batch simulation result model.
3. Scenario comparison table.
4. Multi-scenario JSON export.

This phase turns one-off simulation into an architecture test suite.

### Phase C: Improve Evidence Quality

1. Measurement source metadata.
2. Confidence model improvements.
3. Calibration explanations.
4. Exported evidence quality fields.

This phase prevents synthetic data from looking like production proof.

### Phase D: Measure Recovery and Freshness

1. RTO evaluation.
2. RPO evaluation.
3. Staleness evaluation.
4. Recovery and staleness timeline views.

This phase closes the largest current architecture-goal gap.

### Phase E: Speed Up Realistic Designs

1. Capacity presets.
2. Network presets.
3. Cost and quota risk warnings.
4. Implementation handoff pack.

This phase makes the tool faster and more useful for real teams.

## Success Criteria

V4 is successful when a user can:

1. Model a multi-region backend without typing region strings manually.
2. Run normal, peak, region-down, and dependency-failure scenarios together.
3. Understand which results are measured, assumed, or estimated.
4. See RTO, RPO, and staleness pass or fail.
5. Export an analysis package that another engineer or AI agent can evaluate without
   screenshots.
6. Turn the analysis into implementation and test work.

## Summary

System Flow has reached a strong architecture-simulation core. V4 should not chase
generic diagramming or cloud execution. The highest-value next step is a Production
Readiness Lab: visual regions, scenario matrices, better evidence quality, recovery
metrics, presets, and handoff artifacts.
