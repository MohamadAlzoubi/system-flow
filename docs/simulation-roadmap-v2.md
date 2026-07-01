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

## 2. Service capacity and autoscaling

Add replicas, minimum/maximum replicas, scaling thresholds and delay, cold starts,
resource limits, maximum in-flight work, timeout, and graceful drain time.

Acceptance: replay shows capacity changing over time and reports traffic lost while
new replicas start.

Status: in progress. Worker nodes now expose replicas, autoscaling bounds and
threshold, scaling delay, cold start, resource limits, maximum in-flight work,
timeout, and drain time. Deterministic throughput accounts for the scale-up window,
and replay frames show replica readiness and capacity.

## 3. Latency and failure distributions

Replace fixed averages with deterministic percentile/distribution inputs. Model
timeouts, malformed input, duplicates, partial failure, retry backoff, and jitter
using seeded deterministic sampling.

Acceptance: p95/p99 derive from modeled samples rather than fixed multipliers.

## 4. Broker and stream fidelity

Add consumer groups, partitions, per-consumer prefetch, acknowledgement and publisher
confirm latency, redelivery, ordering, persistence cost, broker storage/bandwidth,
dead-letter capacity, and message-age tracking.

Acceptance: queue replay explains enqueue, delivery, acknowledgement, retry,
expiration, and dead-letter transitions.

## 5. Data-store fidelity

Add read/write mix, connection pools, maximum connections, IOPS, index selectivity,
contention, transaction duration, cache hit ratio, replicas, replication lag, and
failover.

Acceptance: the simulator distinguishes query capacity, connection exhaustion,
storage saturation, and replica consistency costs.

## 6. Resilience and dependency behavior

Add rate limiters, circuit breakers, bulkheads, load balancers, API gateways,
dependency quotas, recovery windows, and health-driven failover.

Acceptance: scenario timelines demonstrate cascading failure, isolation, recovery,
and bottleneck movement.

## 7. Network and regional topology

Model payload-dependent transfer time, bandwidth, connection reuse, TLS overhead,
zones, regions, cross-region cost, and partial network outages.

Acceptance: latency and throughput respond to payload size, bandwidth, and placement.

## 8. Production-oriented node catalog

Add Kafka topics, load balancers, service clusters, object storage, CDNs, rate
limiters, circuit breakers, batch/stream processors, dead-letter queues, database
proxies, read replicas, search engines, and autoscalers.

Every node must follow the repository node checklist and represent backend behavior,
not generic diagramming.

## 9. Explanation and calibration

Show units, assumptions, recommended ranges, per-node charts, message-age charts,
remediation suggestions, and confidence/limitation notes. Add importable observed
metrics so estimates can be calibrated against production or load-test data.

## Delivery order

Implement milestones in order. Each milestone must include contracts, deterministic
engine behavior, boundary validation, UI controls, examples, and tests before moving
to the next.

Current status: milestone 1 is in progress.
