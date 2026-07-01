# Simulation UX and Engine Roadmap

## Product gap

System Flow currently edits typed backend graphs, but useful simulation requires the
result to explain what moves through each connection and where capacity is exhausted.
The canvas must remain a backend architecture tool: traffic, data contracts, queues,
capacity, latency, and failures are the important visual language.

The first milestone is a topology-aware, deterministic rate simulation. It traverses
an acyclic graph from its sources, propagates rates over edges, constrains output at
node capacity, and reports metrics for every reachable node and edge.

## Branch semantics

Multiple outgoing edges have explicit deterministic behavior:

- With no percentages, the node broadcasts its accepted output to every edge.
- With `trafficPercentage`, all outgoing edges must provide percentages totaling 100.
- An edge may carry a human-readable `condition`, but expressions are not evaluated
  as JavaScript. Conditional scenarios should supply deterministic percentages.

This supports broadcast fan-out and percentage routing. Shared-queue competing
consumers require a later queue-specific distribution model and must not be confused
with broadcast.

## Result experience

After simulation:

- Nodes show incoming rate, capacity/utilization, and local latency.
- Healthy, warning, critical, and inactive nodes have distinct status treatment.
- Edges show their data contract and simulated events per second.
- Edge width reflects traffic and animation only runs for active simulated traffic.
- Bottleneck entries select the affected node for inspection.

## Delivery plan

### Milestone 1: topology and observability

1. Validate identity, connectivity, cycles, and branch percentages.
2. Traverse reachable nodes in topological order.
3. Propagate broadcast and weighted traffic.
4. Constrain output by node capacity.
5. Return node and edge telemetry.
6. Bind canvas styling and analysis interactions to telemetry.
7. Test chains, branches, disconnected nodes, and capacity constraints.

### Milestone 2: queue dynamics

Model queue depth over deterministic time slices, maximum capacity, TTL expiry,
dead-letter volume, retry delay, prefetch, and time to saturation. Add a replay
timeline backed by these frames.

Implemented: deterministic queue depth, capacity overflow, TTL expiry, dead-letter
estimates, time-to-saturation metrics, and canvas replay frames. Retry delay and
prefetch-aware consumer allocation remain part of the richer queue/consumer model.

### Milestone 3: richer routing and merging

Add scenario-based conditional distributions, round-robin routing, failover,
competing consumers, and explicit merge policies. Define latency semantics for
wait-all, first-response, asynchronous, and join patterns.

Implemented engine semantics:

- `broadcast`, `weighted`, `conditional`, `round-robin`, `failover`, and
  `competing-consumers` routing policies.
- Conditional routes use explicit scenario percentages and condition labels; condition
  text is never executed.
- Competing queue consumers receive traffic in proportion to modeled capacity.
- `sum`, `wait-all`, `first-response`, and `asynchronous` merge policies.
- Wait-all uses the slowest path and smallest completed stream; first-response uses
  the fastest path and largest available stream.

Policy editing controls and runtime health-driven failover remain future UI/runtime
work. Current failover deterministically selects the lowest-priority-number route.

### Milestone 4: design comparison

Save a baseline, change capacity or topology, rerun, and compare throughput, latency,
resource usage, dropped traffic, and whether the bottleneck moved downstream.

Implemented:

- Capture the current simulation as a named graph baseline.
- Automatically compare every subsequent run with that baseline.
- Report absolute and percentage changes for completed events, average and p95
  latency, CPU, memory, and dropped events.
- Identify resolved and newly introduced bottleneck nodes and whether the bottleneck
  moved.
- Clear the baseline to begin a new design experiment.

## Remaining model limitations

The rate model is an architecture estimator, not an event-level load test. Percentile
latencies remain deterministic estimates, resource totals are node-definition
heuristics, cycles are unsupported, and queues currently use immediate downstream
capacity rather than a full broker scheduling model.
