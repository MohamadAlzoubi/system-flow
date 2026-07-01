---
title: System Flow Education
description: A practical field guide to designing, configuring, validating, and simulating typed backend architectures.
slug: /education
---

# Learn backend architecture by building it

Every component in System Flow represents a real responsibility. Before learning its
controls, first ask: **what problem does this component solve, and does my system
actually have that problem?** This guide starts with those decisions. Configuration
tables are included afterward as a reference, not as the lesson itself.

---

## 1. The mental model

A System Flow design has four important layers:

1. **Data contracts** describe the shape, version, and estimated size of data.
2. **Nodes** create, transform, queue, cache, store, broadcast, or reject that data.
3. **Typed edges** describe where data travels and may add routing and network behavior.
4. **The simulation profile** describes the load and resource budget applied to the graph.

The simulator is deterministic: the same graph and profile produce the same result. It
walks reachable nodes in topological order. The visual left-to-right placement is for
humans; connections determine execution order.

### A useful way to read a flow

Read a graph as a sentence:

> “An **Event Source** produces `ProductViewedEvent` at 500 events/s, a **Worker**
> processes it, **Redis** serves frequent reads, and a **Database** persists misses.”

Then ask four questions at every node:

| Question | What to inspect |
|---|---|
| What arrives? | Incoming data type and events per second |
| What can it accept? | Throughput, concurrency, connection, IOPS, or quota limit |
| How long does it take? | Processing, waiting, network, retry, and recovery latency |
| What leaves? | Output type, accepted rate, dropped events, or queued events |

---

## 2. Editor tour

### Node library

The left sidebar groups components by architectural role. Drag a component onto the
canvas to create an instance with realistic defaults.

### Canvas

Nodes are architecture components. Connections are typed flows. Select a node or edge
to inspect it. The animated state of the canvas can reflect a selected point in the
simulation timeline.

### Inspector

With nothing selected, the inspector edits the **simulation scenario**. Selecting a node
shows its component configuration, availability, routing, and merge policies. Selecting
an edge shows its network topology.

### Toolbar actions

| Action | Purpose |
|---|---|
| Example selector | Load Product Viewed, Purchase, Chat Message, or Bottleneck examples |
| Inspector | Show or hide configuration controls |
| Analysis | Open the latest validation and simulation results |
| Delete | Remove the selected node or edge |
| Validate | Check structure, configuration, cycles, routing, and type compatibility |
| Export | Download the current graph as formatted JSON |
| Run simulation | Validate, simulate, and open the analysis panel |

Changes are stored locally during the current editor session. **Export** is the portable
representation of a design.

---

## 3. Data contracts and typed edges

A data contract has:

| Field | Meaning |
|---|---|
| `name` | Stable data type name, such as `PurchaseEvent` |
| `version` | Contract version used to communicate schema evolution |
| `schema` | The serializable field definition |
| `estimatedSizeBytes` | Approximate payload size used for network calculations |

An edge has a source node, target node, and `dataType`. Optional controls include a
condition, traffic percentage, priority, and network policy.

> **Design principle:** name contracts after business facts, not transport technology.
> `OrderPlaced` teaches more than `KafkaMessage`.

### Edge routing values

| Value | What it means | Best used for |
|---|---|---|
| `broadcast` | Every outgoing branch receives the traffic | Fan-out and notifications |
| `weighted` | Traffic is split using edge percentages | A/B, canary, or proportional routing |
| `conditional` | Branch choice is represented by edge conditions | Business rules |
| `round-robin` | Events rotate across outgoing targets | Even distribution |
| `failover` | Higher-priority target is preferred | Primary/standby designs |
| `competing-consumers` | Consumers share work rather than duplicate it | Queue workers |

For weighted routing, outgoing percentages should total 100. Conditions are descriptive
and are never executed as JavaScript.

### Incoming merge values

| Value | What it means | Architectural effect |
|---|---|---|
| `sum` | Add incoming rates | Independent producers converge |
| `wait-all` | Continue after all branches contribute | Synchronization barrier |
| `first-response` | Use the first branch to respond | Racing redundant services |
| `asynchronous` | Accept arrivals independently | Event-driven aggregation |

---

## 4. Simulation scenario controls

The scenario says, “Under these conditions, what should this design do?”

| Control | Default/example | Valid value | What it changes |
|---|---:|---|---|
| Duration | Defined by example | 1–86,400 s | Total observation window and event count |
| Traffic | Defined by example | ≥ 0 events/s | Baseline arrival rate |
| Traffic pattern | `steady` | `steady`, `burst`, `daily-peak`, `random` | Rate over the timeline |
| Peak traffic | Profile-dependent | ≥ 0 events/s | Maximum rate during non-steady load |
| Burst duration | Profile-dependent | ≥ 0 s | Time spent at elevated traffic |
| Ramp-up duration | Profile-dependent | ≥ 0 s | How quickly traffic reaches its peak |
| Payload size | Profile/contract-dependent | > 0 bytes | Network transfer capacity and latency |
| Duplicate events | 0% when omitted | 0–100% | Repeated deliveries entering the model |
| Malformed events | 0% when omitted | 0–100% | Invalid traffic considered by analysis |
| CPU budget | Defined by example | > 0 cores | Available compute budget |
| Memory budget | Defined by example | > 0 MB | Available memory budget |
| Network latency | Defined by example | ≥ 0 ms/hop | General cost added between nodes |
| Observed latency | Empty | Optional, > 0 ms | Calibrates estimated latency to reality |
| Observed throughput | Empty | Optional, > 0/s | Calibrates estimated throughput to reality |

**Steady** keeps traffic near the baseline. **Burst** models a temporary spike.
**Daily peak** models a gradual demand cycle. **Random** varies traffic in a deterministic
pattern. The **Traffic spike** preset selects burst traffic, sets peak to 4× baseline,
burst duration to 60 seconds, and ramp-up to 30 seconds.

Observed metrics make a model more useful without pretending it is production telemetry.
They produce calibration factors and improve the explanation confidence.

---

## 5. Shared availability controls

Every node can have an availability policy.

| Mode | Meaning | Additional controls |
|---|---|---|
| Online | Normal capacity for the whole simulation | None |
| Fully offline | No service capacity | None |
| Scheduled outage | Goes offline during a chosen interval, then recovers | Start, duration, recovery |
| Degraded capacity | Remains available at reduced capacity | Remaining capacity |

Defaults are: outage starts at **60 s**, lasts **60 s**, recovery takes **15 s**, and
degraded capacity is **50%**. Time values must be non-negative; remaining capacity must
be 0–100%.

Use a scheduled outage to see whether queues absorb downtime and whether downstream
services catch up. Use degraded mode to find designs that survive total failure but fail
under the more subtle pressure of slow partial capacity.

---

## 6. Edge network controls

An edge can model a real network boundary.

| Control | Default | Valid value | Purpose |
|---|---:|---|---|
| Source region | `local` | Non-empty text | Origin location |
| Target region | `local` | Non-empty text | Destination location |
| Bandwidth | 1000 Mbps | > 0 | Limits payload transfer rate |
| Base latency | 1 ms | ≥ 0 | Propagation/routing delay |
| TLS handshake | 10 ms | ≥ 0 | New secure-connection setup cost |
| Connection reuse | 95% | 0–100% | Share of requests avoiding a new handshake |
| Partial outage | 0% | 0–100% | Share of link availability lost |

Large payloads make bandwidth important; small synchronous calls are often dominated by
base latency and TLS. High connection reuse reduces the effective handshake penalty.

---

# Component encyclopedia

All current components accept and produce `Event` unless stated otherwise. Controls use
milliseconds for latency, seconds for time, and “per second” for capacity unless noted.

## 7. Ingress

### Event Source

**Type:** `event.source` · **Input:** none · **Output:** configured event type

Represents users, devices, upstream systems, or synthetic producers. It introduces
events without requiring an incoming connection.

**Use it when:** you need to show where traffic begins—for example, customer clicks,
IoT readings, payment-provider webhooks, or events from another system.

**Do not use it as:** a processing service or storage component. It describes the
producer and its data, not what happens afterward.

**Example:** a storefront produces `ProductViewedEvent` whenever a visitor opens a
product page. Connect the source to a stream or service that consumes that fact.

| Control | Default | Valid value | What it is for |
|---|---:|---|---|
| Event type | `ProductViewedEvent` | Text | Output contract name |
| Rate per second | 500 | ≥ 0 | Source production rate |
| Payload size | 1200 bytes | ≥ 0 | Approximate size of each event |
| Burst mode | Off | Boolean | Marks the source as burst-oriented |

The node itself has zero latency and resource cost. Its `eventType` becomes the produced
type. Use the scenario profile for graph-wide traffic experiments.

### HTTP Endpoint

**Type:** `http.endpoint` · **Input/Output:** `Event`

Represents an API route receiving synchronous HTTP requests.

**Use it when:** a browser, mobile app, or another service expects an immediate request
and response. It is the front door for commands such as “create order” or “fetch user.”

**Think twice when:** the caller does not need an immediate answer. High-volume work can
often be accepted quickly and moved to a queue instead of keeping an HTTP request open.

**Example:** `POST /orders` validates an order and returns an ID, then publishes
`OrderPlaced` for slower background work.

| Control | Default | Valid value | What it is for |
|---|---:|---|---|
| Method | `POST` | GET, POST, PUT, PATCH, DELETE | HTTP operation |
| Path | `/events` | Text | Route exposed to clients |
| Timeout | 3000 ms | ≥ 0 | Client/server wait ceiling |
| Auth required | On | Boolean | Documents access protection |
| Max requests | 1000/s | ≥ 0 | Endpoint throughput ceiling |
| Average latency | 40 ms | ≥ 0 | Per-request processing delay |

Simulation capacity equals max requests per second. Timeout and authentication currently
document the design; average latency and maximum rate directly affect simulation.

### Scheduler / Cron

**Type:** `scheduler.cron` · **Input:** none · **Output:** configured job type

Starts periodic background work such as reconciliation, report generation, or sync jobs.

**Use it when:** work is triggered by time rather than a user or incoming event.

**Avoid it when:** the work should react immediately to a business event. Polling every
five minutes is usually worse than consuming `PaymentReceived` as it happens.

**Example:** generate invoices at midnight or reconcile inventory every five minutes.

| Control | Default | Valid value | What it is for |
|---|---:|---|---|
| Cron expression | `*/5 * * * *` | Text | Human-readable schedule |
| Job type | `syncRecommendations` | Text | Produced event/job contract |
| Batch size | 10,000 | ≥ 0 | Items started per run |
| Item processing | 5 ms | ≥ 0 | Work per item |

Estimated job latency is `batch size × item processing time`. Cron syntax is stored as
architecture intent; the simulator does not execute a wall-clock scheduler.

---

## 8. Compute

### Function / Service

**Type:** `function.service`

A general stateless transformation or business service.

**Use it when:** data needs validation, enrichment, calculation, or orchestration and the
work does not require a long-lived local state.

**Split it when:** one service has several unrelated reasons to change. A clearly named
“calculate tax” service teaches more—and is easier to scale—than a generic “processor.”

**Example:** enrich `OrderPlaced` with customer tier and delivery region before routing.

| Control | Default | Valid value | Effect |
|---|---:|---|---|
| Function name | `enrichEvent` | Text | Identifies the responsibility |
| Average execution | 20 ms | ≥ 0 | Adds node latency |
| CPU cost/request | 0.003 cores | ≥ 0 | CPU grows with incoming rate |
| Memory/request | 5 MB | ≥ 0 | Estimated memory use |
| Failure rate | 0.01 | 0–1 | Probability form: 0.01 means 1% |

CPU is `cost per request × rate`. Keep function names narrow: “enrich event” or
“calculate tax” is more educational than “process data.”

### Worker

**Type:** `worker`

Models horizontally scalable consumers with concurrency, resource limits, retries, and
optional autoscaling.

**Use it when:** work can happen asynchronously in the background, especially behind a
queue. Workers are good for email, media processing, imports, and webhook delivery.

**Do not use it when:** a user requires an immediate response from the same request.
Also remember that adding workers cannot help if the database or external API downstream
is already the bottleneck.

**Example:** ten workers consume image-upload jobs, resize images, and acknowledge each
message only after object storage succeeds.

| Control | Default | Meaning |
|---|---:|---|
| Worker name | `event-worker` | Responsibility/consumer identity |
| Concurrency | 10 | Simultaneous jobs per replica; ≥ 0 |
| Replicas | 1 | Starting instances; positive integer |
| Min / max replicas | 1 / 10 | Autoscaling bounds; positive integers |
| Autoscaling enabled | Off | Allows desired replicas to change |
| Scale-up utilization | 70% | Target that triggers scaling; > 0–100 |
| Scaling delay | 30 s | Detection/reconciliation delay |
| Scale-down delay | 60 s | Cooldown before removing capacity |
| Cold start | 10 s | Startup delay for new replicas |
| CPU limit | 2 cores | Per-replica CPU ceiling; > 0 |
| Memory limit | 512 MB | Per-replica memory ceiling; > 0 |
| Max in-flight | 100 | Accepted but unfinished work; > 0 |
| Timeout | 30,000 ms | Maximum job duration; > 0 |
| Drain time | 30 s | Graceful shutdown allowance; ≥ 0 |
| Average processing | 80 ms | Base service time; > 0 |
| Processing jitter | 25% | Variability; 0–300 |
| CPU cost/job | 0.005 | Compute demand; ≥ 0 |
| Memory/job | 20 MB | Memory demand; ≥ 0 |
| Ack mode | `manual` | `automatic`, `manual`, or `none` |
| Failure rate | 0.02 | 0–0.99 probability |
| Retry count | 3 | Extra attempts; non-negative integer |
| Retry backoff | 1000 ms | First retry delay; ≥ 0 |
| Max retry backoff | 30,000 ms | Delay cap; ≥ 0 |
| Retry jitter | 20% | Randomized delay spread; 0–100 |
| Failure jitter | 10% | Variation in failures; 0–100 |

Capacity can be limited by concurrency, in-flight work, CPU, memory, or timeout. Retries
amplify traffic: fixing a downstream failure may still leave the system processing a
retry storm. Autoscaling has a delayed effect, so a queue can grow before replicas are
ready.

### Batch Processor

**Type:** `compute.batch-processor`

Groups events to improve throughput at the cost of waiting time.

**Use it when:** a destination handles groups more efficiently than individual records,
such as analytics writes, bulk indexing, or nightly exports.

**Avoid it when:** each item has a strict low-latency deadline. Batching deliberately
waits for more work, so it trades responsiveness for efficiency.

**Example:** write 500 analytics events in one database operation every two seconds.

| Control | Default | Valid value | Effect |
|---|---:|---|---|
| Batch size | 100 | Positive integer | Items per batch |
| Parallel batches | 4 | Positive integer | Concurrent batch work |
| Processing per batch | 1000 ms | > 0 | Service time |
| Flush interval | 5000 ms | ≥ 0 | Maximum wait to fill a batch |

Capacity is `batch size × parallel batches × 1000 / processing ms`. Estimated latency
adds half the flush interval, representing average waiting time.

---

## 9. Data

### Redis Cache

**Type:** `redis.cache`

Stores hot data in memory to reduce downstream latency and load.

**Use it when:** the same data is read repeatedly and slightly stale data is acceptable.
The strongest cache designs have a clear key, expiry rule, and miss path.

**Avoid it when:** data must always be current, reads are rarely repeated, or invalidation
would be more complex than the performance problem. A cache is another stateful system.

**Example:** cache a product page by product ID for five minutes; on a miss, read the
database and fill the cache.

| Control | Default | Valid value | Purpose |
|---|---:|---|---|
| Operation | `read-write` | read, write, read-write | Access pattern |
| Key pattern | `event:{id}` | Text | Cache key strategy |
| TTL | 3600 s | ≥ 0 | Lifetime before expiry |
| Hit rate | 0.75 | 0–1 | Fraction served from cache |
| Average read | 2 ms | ≥ 0 | Hit/read latency |
| Average write | 4 ms | ≥ 0 | Fill/update latency |
| Max memory | 512 MB | ≥ 0 | Memory ceiling |
| Item size | 2000 bytes | ≥ 0 | Per-entry footprint |
| Eviction policy | `allkeys-lru` | noeviction, allkeys-lru, volatile-lru, allkeys-lfu, volatile-ttl | Behavior under pressure |

For mixed access, latency is weighted by hit rate. Estimated memory grows with item size,
traffic, and TTL, capped by max memory. A high theoretical hit rate with an undersized
cache is a modeling smell worth testing.

### Database

**Type:** `database`

Models relational, document, and distributed persistence with connection, IOPS, read,
write, contention, replication, and failover limits.

**Use it when:** business data must survive restarts and be queried later. Choose the
database style from access patterns, consistency, and transaction needs—not fashion.

**Watch for:** connection exhaustion, missing indexes, hot rows, and pretending read
replicas improve writes. A larger database cannot repair a poor query pattern forever.

**Example:** persist orders transactionally so payment and inventory updates remain
consistent.

| Control | Default | Valid value / meaning |
|---|---:|---|
| Database type | `mongodb` | postgresql, mysql, mongodb, dynamodb, cassandra |
| Operation | `insert` | read, insert, update, delete, transaction |
| Average query | 15 ms | ≥ 0 |
| Connection pool | 50 | ≥ 0 active client connections |
| Max writes | 2000/s | ≥ 0 |
| Max reads | 5000/s | ≥ 0 |
| Read percentage | 20% | 0–100 workload split |
| Cache hit percentage | 0% | 0–100 requests avoiding the store |
| Max connections | 100 | > 0 server limit |
| Storage IOPS | 10,000 | ≥ 0 operations/s |
| IOPS per operation | 2 | > 0 storage work per request |
| Contention | 0% | 0–99 lock/hot-row pressure |
| Average transaction | 15 ms | > 0 connection hold time |
| Read replicas | 0 | Non-negative integer |
| Replication lag | 0 ms | ≥ 0 stale-read delay |
| Primary available | On | Whether normal primary service exists |
| Failover | 30 s | ≥ 0 recovery interval |
| Document size | 1500 bytes | ≥ 0 payload documentation |
| Index used | On | Whether the modeled query is indexed |

The simulator calculates four capacities—connections, IOPS, reads, and writes—and uses
the smallest as the limiting resource. Read replicas increase read capacity, not write
capacity. Contention reduces effective connection capacity and adds wait time. Cache hits
reduce effective database operations. When the primary is unavailable, failover consumes
part of the scenario duration.

### Database Proxy

**Type:** `data.database-proxy`

Multiplexes many application connections onto a smaller database pool.

**Use it when:** many short-lived application instances—especially serverless
functions—would otherwise open more connections than the database can support.

**Do not confuse it with:** a cache. A proxy manages connections; it does not remove the
underlying query or storage work.

**Example:** 1,000 function instances share 100 database connections through a proxy.

| Control | Default | Valid value | Effect |
|---|---:|---|---|
| Client connections | 1000 | > 0 | Upstream demand |
| Database connections | 100 | > 0 | Downstream pool size |
| Multiplexing ratio | 10 | > 0 | Clients served per DB connection |
| Average latency | 2 ms | ≥ 0 | Proxy overhead |

Capacity is the smaller of client connections and `DB connections × multiplexing ratio`.

### Read Replica

**Type:** `data.read-replica`

Adds horizontally scalable read capacity while making consistency delay visible.

**Use it when:** reads dominate the workload and callers can tolerate data being briefly
behind the primary.

**Avoid it for:** read-after-write paths that must immediately observe the newest value,
or write bottlenecks. Replicas do not increase primary write capacity.

**Example:** product browsing reads replicas while checkout reads the primary.

| Control | Default | Valid value | Effect |
|---|---:|---|---|
| Replica count | 2 | Positive integer | Parallel read copies |
| Reads per replica | 2000/s | > 0 | Capacity of each copy |
| Average read | 12 ms | ≥ 0 | Query time |
| Replication lag | 100 ms | ≥ 0 | Data freshness delay |
| Connections/replica | 100 | > 0 | Connection design limit |

Capacity is replicas × reads per replica. Modeled latency includes replication lag,
highlighting the throughput-versus-freshness tradeoff.

### Object Storage

**Type:** `storage.object`

Represents blob storage for media, archives, exports, and large immutable objects.

**Use it when:** storing files or large binary objects that do not need relational
queries—images, videos, backups, documents, and data exports.

**Do not use it as:** a low-latency transactional database. Store metadata in a database
and the large payload in object storage.

**Example:** upload an image to object storage and persist its URL and owner in a database.

| Control | Default | Valid value |
|---|---:|---|
| Operation | `put` | put, get, delete |
| Requests | 3500/s | ≥ 0 |
| Average latency | 80 ms | ≥ 0 |
| Bandwidth | 1000 Mbps | > 0 |
| Durability copies | 3 | Positive integer |

Request capacity and average latency directly affect the model. Bandwidth and durability
describe infrastructure intent; use edge payload/network controls to explore transfer.

### Search Engine

**Type:** `data.search-engine`

Models a sharded search/indexing cluster.

**Use it when:** users need full-text search, relevance ranking, faceting, or complex
document discovery that a primary database cannot serve efficiently.

**Avoid making it:** the only source of truth. Search indexes are usually derived views
that can be rebuilt from durable business data.

**Example:** consume `ProductUpdated` events and update a searchable product index.

| Control | Default | Valid value |
|---|---:|---|
| Shards | 5 | Positive integer |
| Replicas | 1 | Non-negative integer |
| Queries per shard | 500/s | > 0 |
| Average query | 40 ms | ≥ 0 |
| Indexing | 1000/s | > 0 |

Query capacity is `shards × queries per shard`. More shards add capacity but also add
modeled CPU and memory. Replicas and indexing rate document the intended cluster and are
important design context even where they do not alter the current query formula.

---

## 10. Messaging and streaming

### RabbitMQ Queue

**Type:** `rabbitmq.queue`

Buffers work, supports acknowledgements and retries, and decouples producer speed from
consumer speed.

**Use it when:** producers and consumers run at different speeds, work must survive
temporary consumer failure, or several workers should share jobs.

**Do not add it merely to:** make a diagram “event-driven.” Queues add delayed delivery,
duplicates, ordering decisions, retention, and operational work.

**Example:** checkout publishes an email job; workers send receipts without slowing the
customer response.

| Control | Default | Meaning |
|---|---:|---|
| Exchange type | `direct` | direct, topic, fanout, or headers routing |
| Queue name | `events` | Broker queue identity |
| Durable | On | Persist queue/message state |
| Max queue size | 100,000 | Maximum buffered messages; ≥ 0 |
| Message TTL | 60,000 ms | Expiry age; ≥ 0 |
| Retry count / delay | 3 / 5000 ms | Redelivery policy |
| Dead-letter queue | On | Sends terminal failures aside |
| Prefetch | 10 | Unacknowledged deliveries per consumer; ≥ 0 |
| Partitions | 1 | Parallel queue lanes; positive integer |
| Consumer group | `default` | Shared consumption identity |
| Publisher confirm latency | 2 ms | Publish acknowledgement cost |
| Acknowledgement latency | 2 ms | Consumer ack cost |
| Persistence latency | 3 ms | Added when durable |
| Broker max throughput | 10,000/s | Cluster ceiling |
| Throughput/partition | 5000/s | Lane ceiling |
| Broker storage | 1024 MB | Durable buffer budget |
| Bandwidth | 100 Mbps | Broker transfer budget |
| DLQ max size | 100,000 | Failed-message capacity |
| Ordering required | On | Restricts effective parallelism |

Queue latency combines publisher confirmation, acknowledgement, and—when durable—
persistence. Capacity is bounded by broker throughput and partition capacity. Strict
ordering limits effective partition parallelism. Timeline metrics expose depth, age,
expiry, redelivery, acknowledgements, overflow, DLQ overflow, persisted bytes, and time
to saturation.

### Dead-Letter Queue

**Type:** `messaging.dead-letter-queue`

Isolates poison messages so healthy work can continue and failed work can be inspected
or replayed.

**Use it when:** a message has exhausted safe retries and blocking the main queue would
harm healthy traffic.

**A DLQ is not a trash can:** it needs alerts, ownership, diagnosis, retention, and a
controlled replay procedure.

**Example:** malformed partner events move to a DLQ after three failed processing attempts.

| Control | Default | Valid value |
|---|---:|---|
| Max messages | 100,000 | ≥ 0 |
| Writes | 2000/s | > 0 |
| Retention | 168 hours | > 0 |
| Replay | 100/s | ≥ 0 |
| Average latency | 5 ms | ≥ 0 |

The modeled live capacity is the write rate. Size, retention, and replay rate describe
whether operations can retain and safely recover failures.

### Kafka Topic

**Type:** `stream.kafka-topic`

Represents a durable, partitioned event log for high-throughput streams and replay.

**Use it when:** many consumers need the same ordered history, events must be replayable,
or throughput benefits from partitioning.

**Choose a simpler queue when:** you only need one group of workers to process jobs once.
Kafka’s retention, partitions, offsets, and consumer groups solve larger stream problems.

**Example:** orders are retained for several days while billing, analytics, and fraud
consumers read independently.

| Control | Default | Valid value |
|---|---:|---|
| Topic name | `events` | Non-empty text |
| Partitions | 6 | Positive integer |
| Replicas | 3 | Positive integer |
| Throughput/partition | 1000/s | > 0 |
| Ack latency | 5 ms | ≥ 0 |
| Retention | 168 hours | > 0 |

Capacity is partitions × throughput per partition. Partitions also increase modeled CPU
and memory. Replicas improve durability intent but do not multiply consumer throughput.

### Stream Processor

**Type:** `stream.processor`

Performs stateful real-time transformations, aggregations, and event-time windows.

**Use it when:** you need continuous aggregation, joins, deduplication, or time-windowed
answers over an event stream.

**Avoid it when:** a normal worker can process each event independently. Stateful stream
processing introduces checkpoints, recovery, and partitioning constraints.

**Example:** compute purchases per customer over a rolling ten-minute window.

| Control | Default | Valid value |
|---|---:|---|
| Parallelism | 4 | Positive integer |
| Events/task | 1000/s | > 0 |
| Window | 10 s | > 0 |
| Checkpoint interval | 10,000 ms | > 0 |
| Processing latency | 20 ms | ≥ 0 |

Capacity is parallelism × events per task. Latency includes processing plus half the
checkpoint interval in seconds-equivalent milliseconds (`interval / 2000`), representing
periodic coordination overhead.

---

## 11. Networking and realtime

### Load Balancer

**Type:** `network.load-balancer`

Distributes requests across healthy targets.

**Use it when:** multiple service instances provide the same capability and traffic must
be spread while unhealthy instances are removed.

**Remember:** a load balancer distributes capacity; it does not create it. Three unhealthy
or overloaded targets remain unhealthy or overloaded.

**Example:** route API traffic across three identical application instances.

| Control | Default | Valid value |
|---|---:|---|
| Algorithm | `round-robin` | round-robin, least-connections, weighted |
| Healthy targets | 3 | Non-negative integer |
| Capacity/target | 1000/s | ≥ 0 |
| Connection limit | 10,000 | ≥ 0 |
| Average latency | 2 ms | ≥ 0 |
| Health-check interval | 10 s | > 0 |

Capacity is the smaller of the connection limit and healthy targets × target capacity.
Set healthy targets to zero to explore total upstream unavailability.

### CDN

**Type:** `network.cdn`

Moves cacheable content near clients and shields the origin.

**Use it when:** geographically distributed users request the same static or cacheable
content, such as images, scripts, downloads, or public pages.

**Avoid caching:** private or rapidly changing responses without a precise cache-key and
invalidation strategy.

**Example:** serve product images from nearby edge locations instead of one origin region.

| Control | Default | Valid value |
|---|---:|---|
| Edge locations | 20 | Positive integer |
| Cache hit | 90% | 0–100 |
| Edge capacity | 5000/s/location | > 0 |
| Hit latency | 15 ms | ≥ 0 |
| Miss latency | 150 ms | ≥ 0 |

Latency is the hit/miss weighted average. Capacity is locations × capacity per location.
Try lowering hit rate before scaling the origin; this reveals how sensitive a design is
to cache invalidation or cold content.

### WebSocket Gateway

**Type:** `websocket.gateway` · **Output:** `WebSocketNotification`

Maintains long-lived client connections for chat, presence, live dashboards, and push.

**Use it when:** the server must push low-latency updates without clients repeatedly
polling HTTP endpoints.

**Account for:** connection memory, reconnection storms, fan-out, presence state, and
backpressure for slow clients.

**Example:** deliver new chat messages to everyone currently connected to a room.

| Control | Default | Valid value |
|---|---:|---|
| Connected clients | 50,000 | ≥ 0 |
| Rooms | 1000 | ≥ 0 |
| Message size | 800 bytes | ≥ 0 |
| Messages | 2000/s | ≥ 0 |
| Broadcast mode | `room` | direct, room, broadcast |
| Memory/connection | 50 KB | ≥ 0 |

Memory is clients × memory per connection. CPU scales with message rate, capacity equals
configured messages per second, and base modeled latency is 8 ms. Broadcasting to every
client is conceptually much more expensive than direct delivery, even when comparing
the same configured ingress rate.

---

## 12. Resilience and integrations

### Rate Limiter

**Type:** `resilience.rate-limiter`

Protects downstream components from overload and enforces quotas.

**Use it when:** a dependency has finite safe capacity, clients need fair quotas, or abuse
must be contained before expensive work begins.

**Do not treat rejected requests as success:** callers need clear errors, retry guidance,
and often idempotency.

**Example:** permit 100 API requests per customer per minute with a small burst allowance.

| Control | Default | Valid value |
|---|---:|---|
| Strategy | `token-bucket` | token-bucket, fixed-window, sliding-window |
| Quota | 1000 | ≥ 0 per window |
| Window | 1 s | > 0 |
| Burst capacity | 250 | ≥ 0 per window |
| Average latency | 1 ms | ≥ 0 |

Modeled capacity is `(quota + burst capacity) / window`. Token bucket is useful when
short bursts are acceptable; fixed windows are simple but can spike at boundaries;
sliding windows smooth enforcement.

### Circuit Breaker

**Type:** `resilience.circuit-breaker`

Stops repeatedly calling an unhealthy dependency, trading rejected work for faster,
bounded failure.

**Use it when:** repeated calls to a failing remote dependency would waste threads,
connections, and timeout budget.

**It complements rather than replaces:** timeouts, retries, and fallbacks. Thresholds
must be high enough to avoid opening on ordinary noise.

**Example:** stop payment-provider calls for 30 seconds after sustained failures, then
allow a few probe requests.

| Control | Default | Valid value |
|---|---:|---|
| Observed failures | 0% | 0–100 |
| Failure threshold | 50% | 0–100 |
| Open duration | 30 s | ≥ 0 |
| Half-open requests | 5 | Positive integer |
| Average latency | 1 ms | ≥ 0 |

The circuit opens when observed failure percentage reaches the threshold. Availability
then reflects how much of the scenario is consumed by the open period, and rejected
events are reported. Half-open requests document the recovery probe policy.

### External API

**Type:** `external.api`

Models a third-party dependency with latency variation, quota, failures, retries, a
circuit breaker, and a concurrency bulkhead.

**Use it when:** your architecture depends on a system your team cannot scale or fully
control, such as payment, email, maps, or identity providers.

**Design for its contract:** quotas, timeouts, idempotency, failure behavior, and data
privacy matter more than the provider name.

**Example:** send email through a provider limited to 100 requests per second.

| Control | Default | Valid value / meaning |
|---|---:|---|
| Provider | `SendGrid` | Text |
| Average latency | 300 ms | ≥ 0 |
| Latency jitter | 35% | 0–300 |
| Timeout | 3000 ms | ≥ 0 |
| Rate limit | 100/s | ≥ 0 |
| Window | 1 s | > 0 |
| Quota | 100/window | ≥ 0 |
| Failure rate | 0.03 | 0–1 probability |
| Retry count | 2 | ≥ 0 |
| Circuit breaker | On | Boolean |
| Circuit threshold | 50% | 0–100 |
| Circuit open | 30 s | ≥ 0 |
| Recovery successes | 5 | Positive integer |
| Bulkhead concurrency | 50 | > 0 |

Rate-limit capacity is the smaller of the direct rate and quota/window. Bulkhead capacity
is concurrency divided by average service time. Availability includes failure rate and
the circuit-open share of the scenario. Retries amplify attempted traffic; they do not
create free reliability.

---

## 13. Logic, observability, and control

### Router / Condition

**Type:** `router.condition`

Documents business routing rules. Default rule:
`input.country === 'TR' → turkey-flow`.

**Use it when:** one data contract follows different paths based on explicit business
facts such as region, type, risk score, or feature cohort.

**Avoid hiding business logic:** write meaningful conditions and label destinations so a
reader can understand the decision without reading application code.

`rules` is a list of `{ condition, target }` objects. Conditions are treated as safe,
descriptive architecture data—not evaluated code. The node adds 1 ms latency with small
fixed resource use. Pair it with `conditional` routing and labeled edges.

### Logger / Metrics

**Type:** `logger.metrics`

Represents telemetry collection.

**Use it when:** you need to make logs, metrics, traces, audit records, and their cost
visible in the architecture.

**Be deliberate:** recording everything can be expensive and may expose sensitive data;
sampling too aggressively can hide rare failures.

| Control | Default | Valid value |
|---|---:|---|
| Sample rate | 1 | 0–1 probability |
| Retention | 30 days | ≥ 0 |
| Average write | 3 ms | ≥ 0 |

The node adds write latency and small fixed resources. Sampling 1 records everything;
0.1 records about 10%. Retention affects operational cost and investigation windows,
though it does not currently change simulation storage.

### Autoscaler

**Type:** `control.autoscaler`

Represents a control loop that observes utilization and changes replica count.

**Use it when:** demand changes enough that fixed capacity wastes resources or fails at
peaks, and the workload can scale horizontally.

**Autoscaling is not instant:** measurement, reconciliation, scheduling, and cold start
all happen after demand arrives. Keep warm capacity for sudden bursts.

| Control | Default | Valid value |
|---|---:|---|
| Minimum replicas | 1 | Positive integer |
| Maximum replicas | 10 | Positive integer |
| Target utilization | 70% | > 0–100 |
| Reconciliation | 15 s | > 0 |
| Actions | 100/s | > 0 |

The control loop’s modeled latency is the reconciliation interval. It can process the
configured number of scaling actions per second. For service capacity experiments, the
Worker’s built-in autoscaling controls produce the replica timeline directly.

---

## 14. Reading simulation results

### Headline metrics

| Metric | Interpretation |
|---|---|
| Events | Total accepted and processed work |
| Average latency | Mean time through modeled work |
| p95 / p99 | Tail latency: 95% / 99% of work is faster than this |
| CPU cores | Aggregate modeled compute demand |
| Memory | Aggregate modeled memory demand |

Average latency can look healthy while p95 is poor. Tail latency matters for user-facing
systems because queues, jitter, retries, and slow dependencies affect a minority of
requests very strongly.

### Node capacity

Each capacity bar compares incoming demand with estimated capacity. A node can be:

- **Healthy:** capacity comfortably serves traffic.
- **Warning:** utilization or pressure needs attention.
- **Critical:** demand exceeds available capacity or the node is unavailable.
- **Inactive:** no reachable traffic arrives.

Clicking a result selects the node, connecting diagnosis directly to configuration.

### Queue timeline

Use Play or drag the time slider to inspect queue depth and message age. A growing queue
is not automatically bad: buffering is its job. It becomes dangerous when depth never
recovers, age violates the business deadline, TTL expires messages, or storage saturates.

### Confidence and calibration

Confidence is based on how much explicit, realistic information the graph provides.
Observed latency and throughput calibrate results. A deterministic estimate is a learning
and comparison tool, not a promise of production performance.

### Baseline comparison

Select **Save baseline**, change the design, and simulate again. The comparison shows
absolute and percentage changes in throughput, latency, CPU, memory, dropped events, and
bottleneck location.

> Optimization is successful only when the system-level tradeoff improves. Removing one
> bottleneck often moves it downstream.

---

## 15. Validation: what the editor protects you from

Validation checks graph boundaries before simulation, including:

- Unknown component types
- Invalid node configuration values
- Missing nodes referenced by edges
- Cycles where deterministic topological simulation is not possible
- Incompatible input and output data types
- Invalid routing percentages or policies
- Structurally unreachable or suspicious flows

An error means the graph cannot be modeled reliably. A warning means the graph can still
teach you something, but an assumption or risk deserves attention.

---

## 16. Guided learning labs

### Lab A — Find a throughput bottleneck

1. Load the Bottleneck example and run it unchanged.
2. Find the node with utilization above 100%.
3. Save the result as a baseline.
4. Increase only that node’s capacity and simulate again.
5. Observe whether the bottleneck disappears or moves.

**Lesson:** system capacity is constrained by the narrowest relevant stage.

### Lab B — Cache effectiveness

1. Put Redis before a database.
2. Test hit rates of 0, 0.5, 0.75, and 0.95.
3. Compare database operations and end-to-end latency.
4. Reduce Redis max memory or increase TTL and item size.

**Lesson:** hit rate, working-set size, and eviction behavior belong in the same design
conversation.

### Lab C — Queue during an outage

1. Connect Event Source → RabbitMQ → Worker.
2. Schedule the Worker offline during peak traffic.
3. Watch queue depth and message age.
4. Increase worker replicas until the queue drains after recovery.
5. Compare the oldest message age with the queue TTL.

**Lesson:** a queue buys time; consumers still need enough recovery capacity.

### Lab D — Retry storm

1. Connect a Worker to an External API.
2. Raise API failure rate and retry count.
3. Compare attempted work, rejection, and capacity.
4. Add or tune a Circuit Breaker.

**Lesson:** retries improve individual success probability while increasing system load.

### Lab E — Cross-region payloads

1. Select an edge and add a network policy.
2. Increase base latency and reduce connection reuse.
3. Compare a 1 KB payload with a 5 MB payload.
4. Restore bandwidth, then restore latency, one at a time.

**Lesson:** small request/response traffic is latency-sensitive; large transfers are
often bandwidth-sensitive.

### Lab F — Scale-out delay

1. Enable Worker autoscaling.
2. Select the Traffic spike preset.
3. Compare scaling delay + cold start with burst duration.
4. Change minimum replicas and save a baseline.

**Lesson:** autoscaling reacts after demand arrives; warm capacity handles sudden spikes.

---

## 17. Modeling advice

### Start with the business event

Define what moves through the system before selecting infrastructure. A purchase, chat
message, image upload, and search query have different durability, ordering, latency,
and fan-out needs.

### Use realistic ranges, then test extremes

Begin with measured or defensible values. Then test 2× traffic, a cold cache, a failed
primary, a slow dependency, and reduced bandwidth. Resilient designs are understood at
their boundaries, not only at the happy-path average.

### Separate capacity from latency

A service may be fast but unable to handle enough concurrent work. Another may have high
capacity but unacceptable per-request latency. Tune the metric related to the requirement.

### Do not count replicas twice

Replica counts improve capacity only where the node’s simulation says they do. A Kafka
replica protects durability; it is not another partition. A database read replica helps
reads, not writes.

### Prefer comparisons over false precision

“Design B reduces p95 by 30% in this model” is more useful than “production p95 will be
exactly 84 ms.” Save baselines and make one meaningful change at a time.

---

## 18. Glossary

| Term | Plain-language definition |
|---|---|
| Availability | Share of time/capacity a component can serve work |
| Backpressure | Slowing or rejecting producers when consumers cannot keep up |
| Bottleneck | The resource or stage limiting system throughput |
| Bulkhead | Concurrency isolation that prevents one dependency consuming all capacity |
| Capacity | Maximum work accepted per unit of time |
| Circuit breaker | Temporarily stops calls to an unhealthy dependency |
| Concurrency | Work being processed at the same time |
| Data contract | Named, versioned definition of data crossing a boundary |
| Dead-letter queue | Storage for messages that could not be processed safely |
| Durability | Likelihood data survives component failure |
| Fan-out | Sending one event to multiple consumers |
| IOPS | Storage input/output operations per second |
| Jitter | Variation around average latency or retry timing |
| Latency | Time required for work to complete |
| p95 | Value below which 95% of observations fall |
| Partition | Independent lane that can increase parallel throughput |
| Replication lag | Delay before a replica reflects primary data |
| Throughput | Work completed per unit of time |
| TTL | Time-to-live before cached or queued data expires |
| Utilization | Demand divided by available capacity |

---

## 19. Where to go next

Build a small flow around one business event. Validate it, simulate it, save a baseline,
and break one dependency on purpose. The most valuable question in System Flow is not
“Does this diagram look right?” It is:

> **What assumption does this design make, and what happens when that assumption stops
> being true?**
