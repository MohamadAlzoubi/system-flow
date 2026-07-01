# Simulation Realism Roadmap V2

This roadmap builds on the topology, queue, routing, replay, and comparison work in
`simulation-roadmap.md`. The goal is a deterministic architecture estimator that
captures production behavior without pretending to replace load testing.

## 1. Scenario and load profile editor

Expose duration, baseline and peak traffic, burst duration, ramp time, traffic
pattern, payload size, CPU/memory budget, and network latency. Provide scenario
presets and validate units and ranges.

Acceptance: a user can change a scenario without editing JSON, rerun it, and compare
the result with a saved baseline.

Status: complete. The editor supports duration, baseline/peak traffic, burst and ramp
timing, traffic patterns, payload size, resource budgets, network latency, presets,
units, validation, reruns, and baseline comparison.

## 2. Service capacity and autoscaling

Add replicas, minimum/maximum replicas, scaling thresholds and delay, cold starts,
resource limits, maximum in-flight work, timeout, and graceful drain time.

Acceptance: replay shows capacity changing over time and reports traffic lost while
new replicas start.

Status: complete. Worker nodes expose replicas, autoscaling bounds and
threshold, scaling delay, cold start, resource limits, maximum in-flight work,
timeout, scale-down delay, and drain time. CPU, memory, concurrency, in-flight, and
timeout limits determine per-replica capacity. Deterministic throughput accounts for
scale-up and scale-down windows, and replay shows direction, readiness, capacity, and
the limiting resource.

## 3. Latency and failure distributions

Replace fixed averages with deterministic percentile/distribution inputs. Model
timeouts, malformed input, duplicates, partial failure, retry backoff, and jitter
using seeded deterministic sampling.

Acceptance: p95/p99 derive from modeled samples rather than fixed multipliers.

Status: complete. Worker processing time and external API latency accept
jitter percentages. A graph/profile-seeded normal sampler produces reproducible
latency samples, and p95/p99 are calculated from those samples instead of fixed
average-latency multipliers. Scenarios model duplicate and malformed events. Worker
failures use bounded retry counts with exponential backoff, maximum delay, and
deterministic jitter; queue replay schedules redelivery opportunities from that
policy.

## 4. Broker and stream fidelity

Add consumer groups, partitions, per-consumer prefetch, acknowledgement and publisher
confirm latency, redelivery, ordering, persistence cost, broker storage/bandwidth,
dead-letter capacity, and message-age tracking.

Acceptance: queue replay explains enqueue, delivery, acknowledgement, retry,
expiration, and dead-letter transitions.

Status: complete. RabbitMQ queues model partitions and consumer groups,
publisher confirms, acknowledgements, durable persistence latency, broker throughput,
storage/bandwidth configuration, ordering requirements, redelivery, dead-letter
capacity, and message age. Replay frames expose acknowledged, redelivered, expired,
overflowed, publisher-confirmed, persisted-byte, and dead-letter-overflow counts.
Consumer assignment is partition-aware, ordering restricts parallel partitions, and
broker storage and bandwidth constrain capacity.

## 5. Data-store fidelity

Add read/write mix, connection pools, maximum connections, IOPS, index selectivity,
contention, transaction duration, cache hit ratio, replicas, replication lag, and
failover.

Acceptance: the simulator distinguishes query capacity, connection exhaustion,
storage saturation, and replica consistency costs.

Status: complete. Database nodes model read/write mix, cache hits, connection
pool and maximum connections, storage IOPS, IOPS per operation, contention,
transaction duration, read replicas, replication lag, primary availability, and
failover duration. Results identify whether connections, IOPS, reads, or writes are
the limiting resource. Replay shows primary failover/recovery, active replicas,
connection and IOPS utilization, replication lag, and contention wait.

## 6. Resilience and dependency behavior

Add rate limiters, circuit breakers, bulkheads, load balancers, API gateways,
dependency quotas, recovery windows, and health-driven failover.

Acceptance: scenario timelines demonstrate cascading failure, isolation, recovery,
and bottleneck movement.

Status: complete. External API nodes model rate-limit windows and quotas,
bulkhead concurrency, circuit-breaker failure thresholds, open duration, recovery
thresholds, availability, and rejected traffic. Simulation results distinguish
circuit-open and dependency-rejection warnings. Replay shows open, half-open,
recovered, and closed states, cumulative rejection, availability, and downstream
traffic so cascading impact and recovery are visible.

## 7. Network and regional topology

Model payload-dependent transfer time, bandwidth, connection reuse, TLS overhead,
zones, regions, cross-region cost, and partial network outages.

Acceptance: latency and throughput respond to payload size, bandwidth, and placement.

Status: complete. Edges define source/target regions, bandwidth, base
latency, TLS handshake cost, connection reuse, and partial outage. Payload size and
bandwidth determine transfer latency and capacity; constrained edges report delivered
versus requested traffic. Selecting an edge opens a validated network-topology editor
in the inspector, so every network parameter is configurable without JSON.

## 8. Production-oriented node catalog

Add Kafka topics, load balancers, service clusters, object storage, CDNs, rate
limiters, circuit breakers, batch/stream processors, dead-letter queues, database
proxies, read replicas, search engines, and autoscalers.

Every node must follow the repository node checklist and represent backend behavior,
not generic diagramming.

Status: complete. The catalog includes deterministic Load Balancer, Rate
Limiter, and Circuit Breaker nodes with strict schemas, realistic defaults,
simulation behavior, registry discovery, and dedicated canvas icons.

It also includes Kafka Topic, Object Storage, CDN, Search Engine, Batch Processor,
Database Proxy, Read Replica, dedicated Dead-Letter Queue, Stream Processor, and
Autoscaler nodes. Every node follows the registry checklist and models backend
capacity rather than generic diagram behavior.

## 9. Explanation and calibration

Show units, assumptions, recommended ranges, per-node charts, message-age charts,
remediation suggestions, and confidence/limitation notes. Add importable observed
metrics so estimates can be calibrated against production or load-test data.

Status: complete. Results expose assumptions, confidence and confidence
reasons, calibration status, issue-specific remediation suggestions, and clickable
per-node utilization bars. The scenario editor accepts optional observed latency and
throughput values as calibration anchors and applies explicit calibration factors to
global outputs. Configuration forms show recommended ranges, and analysis includes a
queue message-age chart.

## Delivery order

Implement milestones in order. Each milestone must include contracts, deterministic
engine behavior, boundary validation, UI controls, examples, and tests before moving
to the next.

Current status: all Roadmap V2 milestones are complete.
