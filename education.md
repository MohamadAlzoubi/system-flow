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

Read this like a conversation with a senior engineer at a whiteboard. We will keep
asking: "What is moving?", "Who owns it?", "What can break?", and "How would we know?"
If a section feels abstract, build the tiny example next to it in the editor and run
one simulation. Backend architecture becomes much easier when the boxes have jobs,
the arrows have data, and the numbers have consequences.

> **Teacher note:** You are not trying to memorize every component. You are learning how
> to reason. A good system design answer sounds like: "I chose a queue here because the
> user does not need to wait for this work, and I tested what happens when consumers are
> slow."

---

## 1. The mental model

A System Flow design has four important layers:

1. **Data contracts** describe the shape, version, and estimated size of data.
2. **Nodes** create, transform, queue, cache, store, broadcast, or reject that data.
3. **Typed edges** describe where data travels and may add routing and network behavior.
4. **The simulation profile** describes load and fallback resource budgets; regions can
   declare their own capacity.

The simulator is deterministic: the same graph and profile produce the same result. It
walks reachable nodes in topological order. The visual left-to-right placement is for
humans; connections determine execution order.

Imagine a restaurant. The menu item is the **contract**, the stations in the kitchen are
the **nodes**, the handoffs between stations are the **edges**, and the dinner rush is
the **simulation profile**. If the grill is too slow, adding more cashiers will not help.
That is the whole point of modeling the flow instead of drawing random boxes.

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

> **Teacher note:** If you feel lost, point at one edge and say out loud: "This edge
> carries `X` from `A` to `B` at about `N` per second." That one sentence usually exposes
> missing contracts, fake capacity, or a component that has no clear job.

---

## 2. Editor tour

Think of the editor as a practice bench, not a drawing canvas. The left side gives you
parts, the center shows the system, the right side asks for evidence, and the analysis
panel tells you what your choices imply. You learn by changing one thing and watching
the result move.

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

Try this first: load the Bottleneck example, run it unchanged, and do not fix anything
yet. Just read the result. The first skill is diagnosis. The second skill is changing
only the thing that diagnosis points to.

---

## 3. Data contracts and typed edges

Contracts are the language your system speaks. A queue, database, or service can be
perfectly healthy and still be useless if it receives the wrong kind of data. In real
teams, many incidents start with "I thought that field was always present." System Flow
makes that assumption visible.

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

Example conversation:

> "What goes from checkout to email?"
>
> "A message."
>
> "What kind of message?"
>
> "`OrderPlaced`, with order ID, customer ID, total, and email address."
>
> Now you have an architecture detail that can be reviewed and tested.

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

When you choose a routing value, you are answering a business question. Should every
branch get the event, like analytics plus email? Should only one worker get it, like a
job queue? Should a backup service receive traffic only when the primary fails? Routing
is not decoration; it is behavior.

---

## 4. Simulation scenario controls

The scenario says, “Under these conditions, what should this design do?”

Treat a scenario like a science experiment. Keep the design still, change the traffic
or failure condition, and compare the result. If you change five things at once, you may
get a better number, but you will not know why.

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
| Fallback CPU budget | Defined by example | > 0 cores | Compute budget for nodes without a regional budget |
| Fallback memory budget | Defined by example | > 0 MB | Memory budget for nodes without a regional budget |
| Network latency | Defined by example | ≥ 0 ms/hop | General cost added between nodes |
| Observed latency | Empty | Optional, > 0 ms | Calibrates estimated latency to reality |
| Observed throughput | Empty | Optional, > 0/s | Calibrates estimated throughput to reality |

**Steady** keeps traffic near the baseline. **Burst** models a temporary spike.
**Daily peak** models a gradual demand cycle. **Random** varies traffic in a deterministic
pattern. The **Traffic spike** preset selects burst traffic, sets peak to 4× baseline,
burst duration to 60 seconds, and ramp-up to 30 seconds.

Observed metrics make a model more useful without pretending it is production telemetry.
They produce calibration factors and improve the explanation confidence.

Teacher example: suppose normal checkout traffic is 200 requests/s, but a sale creates
900 requests/s for five minutes. A steady test tells you whether the design works on a
normal day. A burst test tells you whether the system survives the sale without turning
the queue into tomorrow's work.

---

## 5. Shared availability controls

Every node can have an availability policy.

Availability controls answer the uncomfortable question: "What does the user experience
when this thing is not healthy?" Do not save these controls for advanced work. Even a
beginner design should try one outage, because failure often teaches more than the happy
path.

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

Try it: make a Worker fully offline for 60 seconds. If the queue grows but later drains,
the design has breathing room. If the queue grows forever, the system is borrowing time
it cannot repay.

---

## 6. Edge network controls

An edge can model a real network boundary.

The network is the distance between promises. A service can be fast in isolation and
still feel slow when every request crosses a region, opens a fresh TLS connection, and
moves a large payload. Network settings help you notice when "just call that service"
is not cheap.

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

Simple rule: for tiny request/response traffic, latency usually hurts first. For images,
exports, backups, and video, bandwidth usually hurts first. Test both before arguing.

---

# Component encyclopedia

All current components accept and produce `Event` unless stated otherwise. Controls use
milliseconds for latency, seconds for time, and “per second” for capacity unless noted.

Use this part like a set of flash cards. For each component, learn three things: the
problem it solves, the mistake beginners make with it, and the experiment that proves
whether it helped.

## 7. Ingress

Ingress is where work enters the system. If you model ingress poorly, every later number
is shaky. A payment webhook, a browser request, and a scheduled nightly job do not create
the same pressure, even if they all eventually touch the same database.

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

Teacher example: if a mobile app sends location updates every second, the Event Source
is not "the app." It is the stream of `LocationUpdated` facts entering your backend.
That distinction keeps the design focused on data flow.

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

Human test: if the caller is staring at a spinner, model an HTTP Endpoint. If the caller
can leave and get the result later, consider a queue after the endpoint.

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

Teacher warning: cron jobs are quiet until they are not. A job that runs fine at 1,000
items can damage the system at 10 million items if it wakes up and competes with user
traffic for the same database.

---

## 8. Compute

Compute nodes are where the system thinks. They validate, transform, enrich, fan out, or
consume work. The teaching question is: "Is this work happening while a user waits, or
can it happen later?"

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

If a service name sounds like a department, it is probably too vague. `OrderService`
could mean ten things. `ReserveInventory` tells you what arrives, what changes, and what
failure means.

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

Teacher example: a worker is the person who takes tickets from a pile. More workers
help only if the next desk can handle the extra completed tickets. If every worker calls
the same overloaded vendor API, adding workers can make the incident worse.

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

Batching is a trade: "I will wait a little so I can do more work at once." It is great
for analytics writes and search indexing. It is bad for "user clicked pay and needs an
answer now."

---

## 9. Data

Data nodes are where architecture becomes serious. State has memory. It can be stale,
locked, missing, duplicated, too large, too expensive, or impossible to rebuild. When in
doubt, slow down and ask what must be true about the data after failure.

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

Teacher example: a cache is like keeping popular books on the front desk. It helps only
if people ask for the same books often. If every request is for a different rare book,
the front desk just becomes another place to maintain.

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

Human explanation: the database is not "where we put stuff." It is the system of record.
When it slows down, everything that needs truth slows down. When it is wrong, the whole
business can be wrong. Treat it with more respect than any other box on the canvas.

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

Teacher example: a proxy is a receptionist for database connections. It helps when too
many clients try to walk into the database at once. It does not make bad queries faster,
and it does not create more disk IOPS.

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

Ask this before using replicas: "Is it okay if this read is slightly behind?" Product
pages often say yes. Bank balances, inventory reservation, and checkout confirmation
often say no.

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

Think of object storage as a warehouse for large things. You store the video, image, PDF,
or backup there, then store its address and business meaning somewhere else.

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

Teacher warning: search is usually a copy of truth, not truth itself. If search says a
product exists but the primary database says it was deleted, the primary database wins.

---

## 10. Messaging and streaming

Messaging is how a system says, "This work does not have to finish right now, but it
must not be forgotten." Queues and streams are powerful because they separate producers
from consumers. They are dangerous when nobody owns delay, retries, ordering, and replay.

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

Teacher example: RabbitMQ is a ticket counter. Producers drop tickets into a lane.
Workers take tickets when ready. If the lane gets longer, RabbitMQ did not fail; it is
showing you that consumers are slower than producers.

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

Explain a DLQ to a teammate like this: "We move suspicious messages aside so healthy
messages keep flowing, then we investigate and replay them deliberately." If nobody
watches the DLQ, it is just delayed data loss with a nicer name.

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

Teacher example: Kafka is closer to a notebook than a mailbox. Consumers can reread the
notebook from an offset. That is excellent for analytics and event history, but more
complex than a simple work queue.

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

Use a stream processor when the answer depends on a moving window: "How many purchases
in the last ten minutes?" or "Did this user do three risky things in a row?" If each
event can be handled alone, a worker is easier to reason about.

---

## 11. Networking and realtime

Networking components decide where requests go and how close content feels to users.
They are easy to draw and easy to misunderstand. A load balancer, CDN, and WebSocket
gateway solve different problems; swapping their names does not swap their behavior.

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

Teacher example: a load balancer is a traffic officer. If all roads behind the officer
are blocked, better directing does not create a new road. You still need healthy targets.

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

Human example: a CDN is why a product image feels fast far from the origin. But the
first uncached request still pays the trip back to the origin, so cold content matters.

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

Teacher warning: long-lived connections are a promise. During a reconnect storm, clients
do not arrive politely one at a time. They come back together, often exactly when the
system is already recovering.

---

## 12. Resilience and integrations

Resilience is not a magic layer you add at the end. It is a set of choices about what
the system should do when reality disagrees with the plan. Reject, retry, queue, degrade,
or fail fast, but choose intentionally.

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

Teacher example: a rate limiter is a bouncer at the door. It is better to reject early
than to let everyone inside and discover the database cannot breathe.

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

Circuit breakers feel harsh because they reject work on purpose. That is the lesson:
sometimes fast, honest failure protects the rest of the system better than slow hope.

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

When teaching external APIs, say: "This is another team's system with our user's wait
time attached." Model quotas, timeouts, and failure because you cannot scale the provider
from your own dashboard.

---

## 13. Logic, observability, and control

These components make intent visible. They do not always look like heavy infrastructure,
but they answer review questions: why did traffic go this way, what did we observe, and
how did the system react?

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

Teacher example: route VIP purchases to extra fraud checks, but route normal browsing
to analytics only. The condition should read like a business rule a product manager can
understand.

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

Observability is how the future version of your team understands today. If a flow has no
metrics or logs, debugging becomes archaeology.

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

Teacher warning: autoscaling is a reaction, not a seatbelt. If traffic spikes in five
seconds and new capacity needs forty seconds, users experience the gap.

---

## 14. Reading simulation results

Results are not grades. They are clues. Read them like a detective: what changed, where
did pressure collect, what assumption became visible, and what would you measure next in
the real world?

### Headline metrics

| Metric | Interpretation |
|---|---|
| Events | Total accepted and processed work |
| Average latency | Mean time through modeled work |
| p95 / p99 | Tail latency: 95% / 99% of work is faster than this |
| CPU cores | Aggregate modeled compute demand |
| Memory | Aggregate modeled memory demand |
| Resource scopes | Per-region or fallback demand compared with its budget |

Average latency can look healthy while p95 is poor. Tail latency matters for user-facing
systems because queues, jitter, retries, and slow dependencies affect a minority of
requests very strongly.

Teacher move: read p95 and p99 before celebrating the average. Users do not call support
because the average was fine. They call because their own request was slow.

### Node capacity

Each capacity bar compares incoming demand with estimated capacity. A node can be:

- **Healthy:** capacity comfortably serves traffic.
- **Warning:** utilization or pressure needs attention.
- **Critical:** demand exceeds available capacity or the node is unavailable.
- **Inactive:** no reachable traffic arrives.

Clicking a result selects the node, connecting diagnosis directly to configuration.

When a node is critical, resist the urge to immediately add replicas. First ask which
limit is critical: CPU, memory, connections, IOPS, quota, queue depth, or downstream
latency. Different limits need different fixes.

### Queue timeline

Use Play or drag the time slider to inspect queue depth and message age. A growing queue
is not automatically bad: buffering is its job. It becomes dangerous when depth never
recovers, age violates the business deadline, TTL expires messages, or storage saturates.

A queue graph is a story. Rising depth says "producers are winning." Falling depth says
"consumers are catching up." Flat but old messages say "we are not failing fast enough."

### Confidence and calibration

Confidence is based on how much explicit, realistic information the graph provides.
Observed latency and throughput calibrate results. A deterministic estimate is a learning
and comparison tool, not a promise of production performance.

Good engineers say where a number came from. "Measured in production last Tuesday" and
"I guessed based on a blog post" should not carry the same confidence.

### Baseline comparison

Select **Save baseline**, change the design, and simulate again. The comparison shows
absolute and percentage changes in throughput, latency, CPU, memory, dropped events, and
bottleneck location.

> Optimization is successful only when the system-level tradeoff improves. Removing one
> bottleneck often moves it downstream.

Teaching habit: save a baseline before every change. Then your explanation becomes
"this change moved p95 down and database utilization up," not "I think it feels better."

---

## 15. Validation: what the editor protects you from

Validation is the editor acting like a careful teammate. It cannot tell you whether the
business idea is good, but it can catch contradictions before you trust a simulation.

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

Read warnings out loud. "This edge has no matching contract" or "these percentages do
not add to 100" is not a software complaint; it is a design review question.

---

## 16. Guided learning labs

Labs are the fastest way to learn because they make the system push back. Do not rush to
the "correct" answer. Run the broken version first, describe what breaks, then make the
smallest fix you can defend.

### Lab A — Find a throughput bottleneck

1. Load the Bottleneck example and run it unchanged.
2. Find the node with utilization above 100%.
3. Save the result as a baseline.
4. Increase only that node’s capacity and simulate again.
5. Observe whether the bottleneck disappears or moves.

**Lesson:** system capacity is constrained by the narrowest relevant stage.

Teacher prompt: before changing anything, guess the bottleneck and write it down. Then
let the simulation correct you.

### Lab B — Cache effectiveness

1. Put Redis before a database.
2. Test hit rates of 0, 0.5, 0.75, and 0.95.
3. Compare database operations and end-to-end latency.
4. Reduce Redis max memory or increase TTL and item size.

**Lesson:** hit rate, working-set size, and eviction behavior belong in the same design
conversation.

Teacher prompt: test a cold cache, not only a warm one. Many real incidents begin right
after deploys, invalidations, or traffic shifts.

### Lab C — Queue during an outage

1. Connect Event Source → RabbitMQ → Worker.
2. Schedule the Worker offline during peak traffic.
3. Watch queue depth and message age.
4. Increase worker replicas until the queue drains after recovery.
5. Compare the oldest message age with the queue TTL.

**Lesson:** a queue buys time; consumers still need enough recovery capacity.

Teacher prompt: measure oldest message age, not only queue depth. A small queue can still
violate a business deadline if the work is old.

### Lab D — Retry storm

1. Connect a Worker to an External API.
2. Raise API failure rate and retry count.
3. Compare attempted work, rejection, and capacity.
4. Add or tune a Circuit Breaker.

**Lesson:** retries improve individual success probability while increasing system load.

Teacher prompt: count attempts, not just successful events. Retry storms hide inside
"we only had normal user traffic."

### Lab E — Cross-region payloads

1. Select an edge and add a network policy.
2. Increase base latency and reduce connection reuse.
3. Compare a 1 KB payload with a 5 MB payload.
4. Restore bandwidth, then restore latency, one at a time.

**Lesson:** small request/response traffic is latency-sensitive; large transfers are
often bandwidth-sensitive.

Teacher prompt: change latency and bandwidth separately. If you change both, you cannot
tell which one taught you the lesson.

### Lab F — Scale-out delay

1. Enable Worker autoscaling.
2. Select the Traffic spike preset.
3. Compare scaling delay + cold start with burst duration.
4. Change minimum replicas and save a baseline.

**Lesson:** autoscaling reacts after demand arrives; warm capacity handles sudden spikes.

Teacher prompt: compare minimum replicas against cold start. Sometimes the cheapest
system on an idle chart is the most expensive system during an incident.

---

## 17. Modeling advice

Modeling is storytelling with constraints. A useful model does not include everything.
It includes the important promises, the risky assumptions, and enough numbers to test a
claim.

### Start with the business event

Define what moves through the system before selecting infrastructure. A purchase, chat
message, image upload, and search query have different durability, ordering, latency,
and fan-out needs.

Say the event in plain language first: "A customer placed an order." Then name the
contract: `OrderPlaced`. Only after that choose HTTP, Kafka, RabbitMQ, or a database.

### Use realistic ranges, then test extremes

Begin with measured or defensible values. Then test 2× traffic, a cold cache, a failed
primary, a slow dependency, and reduced bandwidth. Resilient designs are understood at
their boundaries, not only at the happy-path average.

If you do not know the real number, choose a range and label it as an assumption. The
honesty matters more than pretending precision.

### Separate capacity from latency

A service may be fast but unable to handle enough concurrent work. Another may have high
capacity but unacceptable per-request latency. Tune the metric related to the requirement.

Restaurant example: one chef can make a dish in one minute, but only one dish at a time.
Ten slower chefs may serve the room faster. Latency and capacity are related, not equal.

### Do not count replicas twice

Replica counts improve capacity only where the node’s simulation says they do. A Kafka
replica protects durability; it is not another partition. A database read replica helps
reads, not writes.

Ask: "Replica of what, for what purpose?" Backup copies, failover copies, and parallel
work lanes are different ideas.

### Prefer comparisons over false precision

“Design B reduces p95 by 30% in this model” is more useful than “production p95 will be
exactly 84 ms.” Save baselines and make one meaningful change at a time.

The best sentence after a simulation is not "we are done." It is "now we know which
assumption to measure next."

---

## 18. System design concepts

Everything above teaches the editor. This part teaches the engineering behind it —
the concepts interviewers ask about and production systems live or die by. Each
topic follows the same shape: what it is, why it exists, when to use it, when not
to, what goes wrong in production, and how to explore it in the editor.

Read it in order the first time; afterwards, jump straight to what you need.

Imagine a student asks, "How do I design YouTube?" A teacher does not start with
Kubernetes. A teacher asks: upload or watch? live or recorded? public or private?
strong consistency or eventual? The sections below teach that questioning pattern.

---

## 19. APIs and communication styles

APIs are how software makes promises. Before choosing REST, RPC, WebSockets, or events,
ask what promise the caller needs: an answer now, a command accepted, or updates over
time.

### What an API really is

An API is a **contract**: an agreed shape of request and response between two
programs. The contract — not the code behind it — is what callers depend on. That
is why System Flow treats data contracts as the primary object: change a contract
carelessly and every consumer breaks at once.

Teacher example: a waiter does not need to know how the kitchen cooks. They need a clear
menu, clear order format, and clear answer. That is an API.

### Synchronous vs. asynchronous

The most important architectural decision on any edge:

| | Synchronous (request/response) | Asynchronous (queue/event) |
|---|---|---|
| Caller waits? | Yes — its latency includes yours | No — hands off and moves on |
| Failure coupling | Your outage is their outage | Buffered; consumer can be down briefly |
| Consistency | Immediate answer | Eventual — reply arrives later or never |
| Use for | Reads, anything a user is waiting on | Emails, exports, side effects, fan-out |

Rule of thumb: **if the user needs the answer to continue, stay synchronous. If
they only need confirmation that work was accepted, go asynchronous.** A checkout
must synchronously reserve payment, but the receipt email belongs on a queue.

### REST, RPC, and when it matters

- **REST** models resources (`GET /orders/42`). Predictable, cacheable, ideal for
  public APIs.
- **RPC (e.g. gRPC)** models actions (`ChargePayment()`). Compact and fast,
  ideal for internal service-to-service calls.
- The choice matters far less than the sync/async decision above. Interviewers
  care whether you know *why* you chose, not which acronym you chose.

### WebSockets vs. polling

Polling asks "anything new?" repeatedly; WebSockets hold one connection open and
push. Polling is simpler and stateless; WebSockets scale to instant updates but
make servers stateful — every open connection consumes memory and must survive
deploys and failovers. Start with polling; move to WebSockets when update
frequency or connection count makes polling wasteful.

### Reverse proxies vs. load balancers

Both sit in front of your servers; the difference is intent. A **load balancer**
spreads traffic across identical replicas. A **reverse proxy** is the general
tool: TLS termination, compression, routing by path, caching, hiding internal
topology. In practice one component (nginx, Envoy, an ALB) often plays both roles.

**Common production mistakes**

- No timeout on a synchronous call — one slow dependency freezes every thread.
- Treating POST retries as safe — duplicate orders appear under load.
- Polling every second from a million clients when a 30-second cadence would do.

**Interview questions to be ready for**

- "When would you *not* use a message queue between two services?"
- "How do you version an API without breaking existing clients?"
- "What happens to in-flight WebSocket connections during a deploy?"

**Try it:** connect an HTTP Endpoint to a slow External API, set the edge
interaction to request-response, and watch caller latency inherit the provider's
latency. Then decouple them with a RabbitMQ Queue and compare.

---

## 20. Caching

Caching is one of the first topics that feels like magic, so remove the magic: a cache
keeps a copy close to the caller and hopes the copy is still useful.

### Why caching exists

Most systems read the same data far more often than they change it. A cache
stores answers close to the asker so repeated questions never reach the expensive
source. It is the highest-leverage performance tool in backend engineering — and
the source of the industry's favorite joke about the two hard problems: naming
things, cache invalidation, and off-by-one errors.

### Where caches live

| Layer | Example | Typical latency |
|---|---|---|
| Browser / client | HTTP cache headers | 0 ms (local) |
| CDN edge | CloudFront, Fastly | 5–30 ms |
| Application cache | Redis, Memcached | 0.5–5 ms |
| Database internal | Buffer pool, query cache | already counted in query time |

### The strategies that matter

- **Cache-aside (lazy)** — app checks cache, on miss reads the database and
  fills the cache. The default; simple, but the first request after expiry is slow.
- **Write-through** — writes go to cache and database together. Reads are always
  warm; writes pay double cost.
- **Write-behind** — write to cache now, flush to the database later. Fast and
  dangerous: a crash loses the unflushed writes.
- **TTL (time-to-live)** — every entry expires. Short TTL = fresher data, lower
  hit rate. Long TTL = better hit rate, staler data. There is no free lunch.

### The failure everyone hits: cache stampede

A popular key expires; ten thousand concurrent requests all miss and all hit the
database at once. Mitigations: staggered (jittered) TTLs, request coalescing
(only one request refills, the rest wait), or refreshing hot keys ahead of expiry.

### Redis specifics worth knowing

Redis is single-threaded per shard — one slow command (like `KEYS *`) blocks
everything. Eviction policy decides behavior at the memory limit: `allkeys-lru`
quietly drops cold data (right for caches); `noeviction` fails writes (right for
data you cannot lose — which means it should probably not be in Redis).

**When not to cache:** data read once, data where staleness is unacceptable
(account balances at the moment of withdrawal), or as a bandage over a missing
database index — fix the index first.

**Common production mistakes**

- Caching without measuring the hit rate. Below ~50%, the cache adds complexity
  and little else.
- Forgetting to invalidate on write, then debugging "phantom" stale reads.
- Sizing the cache by guess: hit rate climbs with memory only until the working
  set fits, then flattens.

**Interview questions to be ready for**

- "How would you keep the cache consistent with the database?"
- "What is a cache stampede and how do you prevent one?"
- "Cache-aside vs. write-through — when does each win?"

**Try it:** [Lab B](#16-guided-learning-labs) drops the Redis Cache hit rate
from 75% to 0% and shows what a cold cache does to the database behind it.

---

## 21. Databases: indexes, replication, and sharding

Databases teach humility. Most backend designs eventually become database designs,
because truth, concurrency, and durability concentrate there.

### Indexes — the first performance tool

An index is a sorted lookup structure the database maintains next to your table.
Without one, a query scans every row (O(n)); with one, it seeks (O(log n)). The
difference at a million rows is a full second versus a millisecond — the single
most common cause of "the site got slow as we grew" is a missing index.

The cost: every write must also update every index. Index the columns you filter
and join on; do not index everything.

### Transactions and contention

A transaction groups statements so they commit or fail together, holding locks
while it runs. Long transactions on hot rows serialize your throughput: if every
order update locks the same inventory row for 15 ms, you cannot exceed ~66
updates/second on that row no matter how many servers you add. Keep transactions
short; never call external APIs inside one.

### Replication — copies for reads and survival

One **primary** takes writes; **replicas** copy its change log and serve reads.
Two motivations: read scaling and failover.

The catch is **replication lag**. A user updates their profile (write to
primary), the next page reads a replica that has not caught up, and their change
"disappears." Fixes: read your own writes from the primary for a few seconds, or
route session-critical reads to the primary permanently.

Failover is not free either: promoting a replica takes seconds during which
writes fail — design the caller side (retries, queues) for that window.

### Sharding — the last resort that scales writes

Replication scales reads; **sharding** scales writes by splitting data across
independent databases: users A–M here, N–Z there (or, better, by hash of user id).

- Choose a shard key with even spread and one that appears in most queries.
  A bad key creates a **hot shard** that melts while the others idle.
- Cross-shard queries and transactions become application problems. That is the
  price; pay it only when a single primary genuinely cannot keep up.
- Shard too early and you carry the operational cost for years before needing it.

### SQL vs. NoSQL in one honest paragraph

Relational databases give you joins, constraints, and transactions — use them by
default. Document stores (MongoDB) trade schema rigidity for flexibility. Wide-
column stores (Cassandra) trade query flexibility for massive write throughput.
Key-value stores (DynamoDB) trade almost everything for predictable latency at
any scale. Choosing NoSQL because it is "webscale" — rather than because a
specific access pattern demands it — is a classic résumé-driven mistake.

**Common production mistakes**

- The N+1 query: fetching a list, then one query per item. ORMs make this easy
  to write and easy to miss until the list grows.
- Connection pool math: 50 replicas × 20 connections = 1,000 connections against
  a database that allows 300.
- Adding read replicas to fix a write bottleneck (they only help reads).

**Interview questions to be ready for**

- "How do you choose a shard key, and what happens with a bad one?"
- "A user complains their update vanished. Walk me through replication lag."
- "When does an index hurt you?"

**Try it:** on a Database node, uncheck **Index used** and watch query time in
the simulation. Then add a Read Replica node and see reads move off the primary.

---

## 22. Consistency, CAP, and distributed coordination

This section is about promises under stress. The easy version of a system works when
every network call succeeds. The real version has duplicate messages, stale replicas,
timeouts, and partial failure.

### The CAP theorem, minus the mythology

When a network partition splits your nodes (and eventually it will), you must
choose: refuse requests to stay **consistent** (CP), or keep answering with
possibly stale data to stay **available** (AP). That is the entire theorem —
"pick 2 of 3" is misleading because partition tolerance is not optional in a
distributed system.

The real-world reading: banks pick CP for balances (better to error than to be
wrong); social feeds pick AP (better slightly stale than down). Most systems mix
both, per feature.

### Eventual consistency

An AP system promises that if writes stop, all replicas *eventually* agree.
"Eventually" is usually milliseconds — but your design must tolerate the window:
a like count that differs briefly between two users is fine; two users buying
the last concert ticket is not. Ask of every piece of data: **what breaks if
this read is three seconds old?** The answer sorts your data into strict and
relaxed piles, and the relaxed pile is where scale comes from.

### Idempotency — the retry-safety property

An operation is idempotent when doing it twice equals doing it once. Retries,
queue redeliveries, and duplicate clicks are facts of distributed life, so any
handler that charges, creates, or sends must be idempotent. The standard trick:
client sends a unique key (`idempotency-key: abc123`); server records completed
keys and returns the stored result for duplicates. Stripe's API works this way.

### Distributed locks — coordination of last resort

Sometimes exactly one worker may act (issue invoice #1000, run the nightly
settlement). A distributed lock (Redis `SET NX` with expiry, or ZooKeeper/etcd)
grants exclusive access. The subtleties are brutal: locks must expire (holders
crash), but expiry means a slow holder may act *after* losing the lock — so
pair locks with fencing tokens, or better, redesign so uniqueness is enforced by
the database (unique constraint) or the queue (single consumer per partition).

**Common production mistakes**

- Assuming exactly-once delivery exists. Queues promise at-least-once; your
  handler's idempotency turns it into effectively-once.
- Testing only with everything healthy — partitions and lag appear only in chaos.
- Global locks around hot paths, quietly serializing a "distributed" system.

**Interview questions to be ready for**

- "Explain CAP with a concrete example of a CP choice and an AP choice."
- "How would you prevent double-charging when clients retry payments?"
- "Design a distributed lock. Now tell me why it is still not safe."

**Try it:** set a Database node's **Failover time** to 30 s, take the primary
offline with an availability policy, and watch what callers experience during
promotion — that window is CAP made visible.

---

## 23. Messaging, queues, and event-driven architecture

Messaging is a design style, not a personality trait. Use it when it improves coupling,
durability, or flow control. Do not use it just because "event-driven" sounds modern.

### Why queues exist

A queue turns "you must handle this now" into "handle this when you can." That
buys you: survival of consumer outages (messages wait), smoothing of traffic
spikes (the queue absorbs the burst), and independent scaling of producers and
consumers. The price: eventual consistency and a new component to operate.

### Queues vs. event streams

| | Queue (RabbitMQ, SQS) | Stream / log (Kafka) |
|---|---|---|
| Message after consumption | Deleted | Retained; consumers keep their own offset |
| Consumers | Compete for each message | Each group reads the full stream independently |
| Replay history | No | Yes — rewind and reprocess |
| Best for | Work distribution (jobs, tasks) | Event broadcast, pipelines, audit, analytics |

Shortcut: **"do this work once" → queue. "This happened; anyone may care" →
stream.**

### Ordering, partitions, and the parallelism trade

Global ordering and parallelism are enemies. Kafka's compromise: order is
guaranteed only *within* a partition, so key related events together (all events
for order #42 share a partition) and scale across partitions. Consumers in a
group split partitions between them — which means partitions, not consumers, cap
your parallelism.

### Dead-letter queues

After N failed attempts, a message moves to a DLQ instead of blocking the queue
or being dropped. A DLQ is a safety net **plus an obligation**: monitor it, alert
on growth, diagnose entries, and replay them after the fix — slowly, because the
original failure may still be fragile. An unmonitored DLQ is just a place data
goes to die quietly.

### Event-driven architecture, honestly

Publishing events ("OrderPlaced") instead of calling services directly decouples
teams beautifully: the fraud checker, the email sender, and the analytics
pipeline subscribe without the order service knowing they exist. The costs are
real too: no single place shows the flow end-to-end, debugging requires
correlation IDs and tracing, and "eventual" sometimes means "not yet, and you
don't know why." The **outbox pattern** solves the classic dual-write bug —
write the event into the database in the same transaction as the data, and let a
relay publish it — so you never commit the order but lose the event.

**Common production mistakes**

- Queue depth growing forever because consumers are permanently slower than
  producers — a queue buffers bursts, it does not create capacity.
- Retrying poison messages endlessly with no DLQ, blocking everything behind them.
- Fan-out amplification: one event triggers five consumers that each publish
  more events, and a single user click becomes 200 messages.

**Interview questions to be ready for**

- "Kafka vs. RabbitMQ — how do you choose?"
- "How do you preserve order for one customer while processing customers in
  parallel?"
- "What is the outbox pattern and what bug does it fix?"

**Try it:** [Lab C](#16-guided-learning-labs) takes a Worker offline and shows
the queue absorbing messages, then draining after recovery. [Lab D](#16-guided-learning-labs)
shows a retry storm amplifying load against a failing dependency.

---

## 24. Authentication, sessions, and JWT

Auth is the front desk of your system. Authentication asks for identity.
Authorization asks what that identity may do. Keep those separate and many security
bugs become easier to spot.

### Authentication vs. authorization

**Authentication (authn)**: who are you? **Authorization (authz)**: what may you
do? Login is authentication; "only admins can delete" is authorization. Keep
them separate in your head and your code — most access-control bugs come from
blurring them, usually as authenticated-but-unauthorized access (user A reading
user B's documents by changing an ID in the URL).

### Sessions — the stateful classic

On login the server stores a session record and gives the browser an opaque
cookie. Every request looks up the session.

- **Instant revocation**: delete the record, the user is out.
- **Cost**: every request pays a session-store lookup, and that store (usually
  Redis) must scale with your traffic and survive failures.

### JWT — the stateless alternative

A JWT carries the user's claims *in the token itself*, signed by the server. Any
service can verify the signature locally — no lookup, no shared session store.
That is why microservices like JWTs.

The trade: **a JWT cannot be revoked before it expires** without reintroducing
the very state you removed (a blocklist). Standard compromise: short-lived
access tokens (minutes) plus a long-lived refresh token that *is* checked
against the database — instant-ish revocation, cheap verification on the hot
path.

Practical rules: never put secrets in the payload (it is readable by anyone,
only *tamper-proof*), always validate expiry and algorithm server-side, and
store tokens where XSS cannot easily reach them.

### Where auth lives in an architecture

Terminate authentication once at the edge (API gateway or auth middleware), pass
verified identity inward. Internal services trust the gateway's assertion —
which is also why the gateway must be the *only* way in.

**Common production mistakes**

- 24-hour JWTs with no refresh flow: a stolen token works for a day and support
  cannot kill it.
- Sessions in local server memory behind a load balancer without sticky
  sessions: users log out at random as requests move between replicas.
- Authorization checks in the UI only — the API happily serves anyone who skips
  the frontend.

**Interview questions to be ready for**

- "Sessions vs. JWT — walk me through when each wins."
- "How do you log a user out everywhere, instantly, with JWTs?"
- "Where do you enforce authorization in a microservices system?"

**Try it:** toggle **Requires auth** off on a public POST HTTP Endpoint and run
the architecture Review — the security rules flag it.

---

## 25. Resilience patterns

The resilience toolkit is one idea in five shapes: **assume dependencies fail,
and fail small instead of failing everywhere.**

Teacher example: if checkout cannot reach recommendations, checkout should still work.
If checkout cannot reach payment, it should stop clearly. Resilience starts by knowing
which parts are optional and which parts are the business.

### Timeouts — the foundation

Every remote call needs a deadline. Without one, a hung dependency collects your
threads until nothing else can run. Set timeouts above the dependency's p99 (not
its average), and remember timeout ≠ failure handled — you still need a fallback.

### Retries — helpful, then catastrophic

Retries fix transient blips and amplify real outages: 3 retries = up to 4× load
on a dependency that is *already drowning*. The civilized retry: limited
attempts, **exponential backoff** (wait 1 s, 2 s, 4 s…), **jitter** (randomize
waits so a thousand clients do not synchronize into waves), and only for
idempotent operations.

### Circuit breakers — stop calling the sick

Track the failure rate; past a threshold, **open** the circuit and fail fast
without calling. After a cool-down, let a few probes through (**half-open**);
success closes the circuit. This protects both sides: callers stop wasting
time on doomed calls, and the struggling dependency gets room to recover.

### Bulkheads — contain the blast

Cap concurrent calls per dependency (separate pools/semaphores), named after
ship compartments. If the recommendation service hangs, it exhausts *its* 20
slots — not every thread in the process. Checkout survives.

### Rate limiting and load shedding — the front door

Rate limiting rejects excess *per client* (fairness, abuse, protecting a quota);
load shedding rejects excess *in total* when you are near collapse. A fast,
clear 429 is kinder than a 30-second timeout: serving 80% of users well beats
serving 100% terribly. Token bucket allows honest bursts; sliding window smooths
edges — the strategy matters less than having one at all.

### Graceful degradation — the goal of all of it

Decide *in advance* what turns off first. Netflix without personalized rows
falls back to generic ones; a product page without reviews still sells. The
pattern: identify the critical path (browse → cart → pay), guard everything
off-path with fallbacks, and make sure degradation is visible in metrics so it
never becomes the silent permanent state.

**Common production mistakes**

- Retry storms: retries at three layers (client, gateway, service) multiply into
  dozens of attempts per user action.
- Timeouts longer downstream than upstream — the caller gives up before the
  callee, wasting all completed work.
- A circuit breaker with no fallback: failing fast is still failing, just faster.

**Interview questions to be ready for**

- "Walk through what happens when a downstream service becomes slow — layer by
  layer."
- "Why do retries need jitter?"
- "Circuit breaker vs. bulkhead vs. rate limiter — which problem does each solve?"

**Try it:** [Lab D](#16-guided-learning-labs) builds a retry storm against a
failing External API; raise the Circuit Breaker's observed failures past its
threshold to watch it trip and shed the load.

---

## 26. Scaling: monoliths, microservices, and horizontal growth

Scaling is not "make everything bigger." Scaling is finding the scarce thing and giving
that exact thing more room. Sometimes that means more replicas. Sometimes it means one
index, one cache key, one queue, or one deleted feature.

### Vertical vs. horizontal

**Vertical** scaling buys a bigger machine: zero code changes, but a hard
ceiling and a single point of failure. **Horizontal** scaling adds machines:
near-limitless, but demands that your services be **stateless** — any replica
can serve any request because state lives outside (database, Redis, object
storage). Statelessness is the entry fee for everything else in this section;
sticky sessions and local file uploads are how you fail to pay it.

### Autoscaling and its physics

Autoscaling reacts to load with a delay: detect (metrics lag ~1 min) + decide +
boot (cold start). During that gap, existing capacity eats the spike — which is
why the target is ~70% utilization, not 95%, and why predictable spikes
(9 a.m. login, Black Friday) deserve pre-warmed capacity instead of faith in
reaction time. Set max replicas: your database has a connection ceiling, and
"autoscale until the database dies" is a real incident pattern.

### Monolith vs. microservices — the honest ledger

| | Monolith | Microservices |
|---|---|---|
| Deploy | One unit — simple, but all-or-nothing | Independent per service |
| Data | One database, real transactions | Per-service databases, eventual consistency |
| Failure | Process dies → everything dies | Isolated — if you did the resilience work |
| Debugging | Stack trace | Distributed tracing across services |
| Team fit | One team, shared codebase | Many teams, clear ownership boundaries |
| Ops cost | Low | High: gateways, discovery, tracing, CI × N |

The uncomfortable truth: microservices are primarily an **organizational**
technology. They let fifty teams deploy independently; they do not make a
five-person startup faster — they usually make it slower. The default path:
start with a **modular monolith** (clean internal boundaries, one deploy), and
extract a service only when a specific pressure demands it — a component
needing independent scale, a team blocked on deploys, a bounded context with
different availability needs. Bad boundaries are far more expensive than late
boundaries: a "distributed monolith" (microservices that must deploy together)
combines the costs of both worlds with the benefits of neither.

**Common production mistakes**

- Splitting into services along technical layers (API-service, DB-service)
  instead of business capabilities (orders, payments, inventory).
- Two services sharing one database table — you now have a distributed monolith.
- Scaling stateless app servers while the shared database stays fixed: the
  bottleneck just moves and gains company.

**Interview questions to be ready for**

- "When would you advise a startup to use microservices from day one?" (Almost
  never — know why.)
- "What breaks when you make a stateful service horizontally scalable?"
- "How do you split a monolith? Where do you cut first?"

**Try it:** [Lab F](#16-guided-learning-labs) demonstrates scale-up delay — the
queue that builds while autoscaling boots is the physics above, on screen.

---

## 27. CDNs, object storage, and the edge

The edge is about distance and heavy bytes. If your app ships images, video, downloads,
or static assets, users should not wait for your central region every time.

### Object storage — files as a service

Databases store records; **object storage** (S3, GCS, R2) stores files: each
object gets a key, replication across zones gives ~eleven nines of durability,
and capacity is effectively infinite. It is the default home for uploads,
images, video, backups, logs, and static builds. The trade: latency is tens of
milliseconds and there are no partial updates — you replace objects whole.

The pattern that matters: **presigned URLs**. Instead of streaming uploads
through your API (paying its bandwidth and memory twice), the API hands the
client a short-lived signed URL and the client talks to storage directly. Your
API stays in control of *authorization* without touching the *bytes*.

### CDN — cache at the edge of the world

A CDN keeps copies of content in hundreds of locations near users. Physics is
the reason: São Paulo to Frankfurt is ~200 ms round-trip no matter how fast your
servers are; São Paulo to a São Paulo edge node is ~10 ms. Effects: latency
drops worldwide, your origin sheds most of its traffic, and traffic spikes hit
the CDN's capacity instead of yours.

Static assets (images, JS, video) are the easy win — cache-hit rates above 90%.
The subtle art is **invalidation**: fingerprinted filenames (`app.3f9a2c.js`)
for assets, so deploys are instant and cache-safe; short TTLs or explicit purge
for HTML and APIs.

### The standard media pipeline

Upload via presigned URL → object storage event triggers a Worker → Worker
generates thumbnails/transcodes → results land back in storage → users download
via CDN. Every piece is a node type in this editor; it is worth building once to
see how little your API servers actually touch.

**Common production mistakes**

- Serving user uploads from application servers' local disks — files vanish
  behind the load balancer and on every redeploy.
- Caching personalized or authenticated responses at the edge (the classic
  "user A sees user B's account" incident).
- Forgetting that a CDN protects *reads* only — your write path still hits
  origin at full force.

**Interview questions to be ready for**

- "Design an image-upload flow for a mobile app." (Presigned URLs are the
  expected answer.)
- "How do you deploy new JS without users receiving stale bundles?"
- "What belongs in object storage vs. the database?"

**Try it:** put a CDN node in front of an Object Storage node, set cache hit
rate to 90%, and compare origin traffic with and without the CDN under load.

---

## 28. Observability: logging, metrics, and tracing

Observability is how you teach the system to explain itself. Without it, every outage is
a guessing game. With it, you can ask better questions while users are still affected.

### The three pillars, and what each answers

- **Logs** — "what happened here?" A structured record of one event
  (`{"level":"error","route":"/pay","order":42,...}`). Searchable JSON beats
  prose; log *events*, not narration.
- **Metrics** — "how is the system doing?" Cheap aggregated numbers over time
  (request rate, error rate, latency percentiles). Metrics feed dashboards and
  alerts; they tell you *that* something is wrong.
- **Traces** — "where did this request spend its time?" One request's journey
  across services, timed span by span. Traces tell you *where* it is wrong —
  in a distributed system, they are the only sane answer to "why was this slow?"

The glue is a **correlation ID**: generated at the edge, passed through every
call and queue message, attached to every log line. Without it, debugging a
distributed flow is archaeology.

### Percentiles, not averages

Average latency is a lie of comfort: 99 requests at 10 ms and one at 5 s
average to ~60 ms while a user stares at a spinner. Watch **p95/p99** — the
experience of your unluckiest users, and usually your heaviest ones (largest
carts, most data). This is why every latency figure in this editor's simulation
reports percentiles.

The workhorse dashboard is **RED** per service: **R**ate, **E**rrors,
**D**uration percentiles. For machines, **USE**: Utilization, Saturation, Errors.

### Alerting that people don't mute

Alert on **symptoms** (users failing: error rate, p99, queue age) and page
someone only for what is *urgent and actionable*. Alert on every cause (CPU
spikes, single pod restarts) and you breed alert fatigue — the real outage gets
muted along with the noise. **SLOs** formalize this: define a target (99.9% of
requests under 500 ms), spend the error budget consciously, and alert when the
budget burns too fast.

**Common production mistakes**

- Adding observability *after* the incident that needed it.
- Unstructured logs (`"something went wrong"`) that cannot be searched or counted.
- Dashboards nobody looks at plus alerts everybody ignores — observability as
  decoration.

**Interview questions to be ready for**

- "Logs vs. metrics vs. traces — when do you reach for each?"
- "Why is p99 more useful than average latency?"
- "How do you debug one slow request across six services?"

**Try it:** attach a Logger/Metrics node with a sample rate of 1.0 to a
high-traffic flow and check its resource cost in the simulation — then try 0.1
and see why sampling exists.

---

## 29. High availability and disaster recovery

Availability is not a badge. It is a promise about user experience when parts fail.
Disaster recovery is the same promise when the failure is bigger than one component.

### The arithmetic of nines

| Availability | Downtime per year |
|---|---|
| 99% | ~3.7 days |
| 99.9% | ~8.8 hours |
| 99.99% | ~53 minutes |
| 99.999% | ~5 minutes |

Two lessons hide in this table. First, each nine costs roughly 10× the
engineering effort. Second, **serial dependencies multiply**: five 99.9%
services in a request chain yield 99.5% (~44 h/year). Long synchronous chains
are availability poison — which is one more argument for queues.

### High availability = no single point of failure

The recipe is redundancy plus automatic failover: multiple replicas behind a
load balancer with health checks, a database replica promoted when the primary
dies, everything spread across availability zones so one data-center power event
is a non-event. Two rules keep it honest:

- **N+1 sizing** — survive one instance dying *at peak load*, not at average.
- **Failover you haven't tested is failover you don't have.** Promotion scripts
  rot; test them on purpose, in daylight, before 3 a.m. tests them for you.

### Disaster recovery — when the region burns

HA handles component failure; **DR** handles losing everything in a region. Two
numbers define your strategy: **RPO** (how much data may be lost — your backup/
replication frequency) and **RTO** (how long recovery may take). The menu, in
ascending cost: backups + restore (hours of RTO), pilot light (data replicated,
minimal services warm), warm standby (scaled-down copy running), active-active
(both regions serve; RTO ≈ 0, complexity ≈ maximum). Choose per system — the
payments ledger and the avatar thumbnails do not deserve the same RPO.

And the rule that survives every audit: **a backup you have never restored is a
hope, not a backup.**

### Failure recovery as a designed behavior

Availability during *partial* failure is designed, not hoped for: queues let
work wait out an outage, circuit breakers plus fallbacks keep the critical path
alive, idempotent handlers make retry-after-recovery safe, and **backpressure**
(rejecting early at the front door) keeps a degraded system from being buried by
its own backlog the moment it stands up.

**Common production mistakes**

- Redundant app servers in front of a single-instance database — HA theater.
- Failover automation that has never run against production data volumes.
- DR plans that assume the people who wrote them are awake and reachable.

**Interview questions to be ready for**

- "Design for 99.99%. What does the last nine cost you?"
- "RPO vs. RTO — define them and design a system for RPO = 0."
- "What happens in the first 60 seconds after your primary database dies?"

**Try it:** [Lab C](#16-guided-learning-labs) rehearses an outage with recovery;
schedule a Database node offline and watch the queue, the failover window, and
the drain — then compare designs that survive it against ones that don't.

---

## 30. Testing and evaluating architectures

Testing turns opinions into evidence. A design review without tests is a debate.
A design review with baselines, failure scenarios, and measurements becomes a decision.

### What to measure

Six numbers describe almost any backend's health. For each, know what "bad"
looks like and what it implies:

| Metric | Question it answers | The trap |
|---|---|---|
| Throughput | How much work per second? | Rising throughput with rising errors is collapse, not success |
| Latency p50/p95/p99 | How long do users wait? | Averages hide the tail — see [§28](#28-observability-logging-metrics-and-tracing) |
| Error rate | What fraction fails? | Timeouts count; a 30-s timeout is worse than a fast error |
| Queue depth & age | Is work piling up? | Stable depth is buffering; *growing* depth is falling behind |
| Utilization (CPU/mem/conn/IOPS) | How close to the ceiling? | The system dies at whichever ceiling is nearest, not the one you watch |
| Cache hit ratio | Is the cache earning its keep? | Every point of hit rate lost lands directly on the database |

### The load-testing family

- **Load test** — expected traffic. Do we meet the SLO at normal and peak load?
- **Stress test** — increase until failure. Where is the ceiling, *which
  component is it*, and does the system degrade gracefully or collapse?
- **Spike test** — sudden jumps (the push-notification effect). Ramp-ups hide
  what real spikes reveal: autoscaling reaction time, connection storms,
  thundering herds.
- **Soak test** — normal load for hours or days. Finds what only time finds:
  memory leaks, connection leaks, disks filling with logs.
- **Chaos test** — inject failure (kill instances, add latency, partition the
  network) and verify the resilience patterns of [§25](#25-resilience-patterns)
  actually fire. Netflix's Chaos Monkey made this a discipline: run it first in
  staging, then in production during business hours — an untested failover is
  fiction.

### How engineers read the results

The craft is interpretation, and it follows a loop:

1. **Find the knee.** Latency vs. load is flat until utilization approaches a
   ceiling, then curves sharply upward. The knee is your true capacity;
   production should live left of it.
2. **Identify the bottleneck at the knee.** One component pegs first — that is
   the constraint. The others' headroom is irrelevant until it moves.
3. **Fix the constraint, not the symptom.** Slow queries at 100% DB CPU: adding
   app servers *worsens* it (more connections, same DB). An index, a cache, or
   a replica moves the constraint; then re-test and find the next one.
4. **Change one thing at a time**, against a saved baseline — otherwise you
   cannot attribute the improvement. This is exactly what the editor's baseline
   comparison exists for.

Two readings that save incidents: **retry amplification** (error rate rising
*with* offered load rising faster than user traffic = your own retries attacking
you — see [Lab D](#16-guided-learning-labs)), and **recovery shape** (after a
failure clears, does the backlog drain or does the recovering service get
trampled by it?).

### Capacity planning in one paragraph

Estimate demand (peak RPS × payload size), measure single-instance capacity at
the knee, divide, add N+1 and ~30% headroom, and re-measure after every
meaningful change. Back-of-envelope first, load test to confirm — in that
order, both in interviews and in production.

**Try it:** this is the editor's home game — run a baseline, save it, raise
traffic until a node saturates, find the knee, fix the constraint, and compare.
Labs A through F in [§16](#16-guided-learning-labs) are each one iteration of
the loop above.

---

## 31. System design interviews: putting it together

For interviews and real reviews, the winning move is to slow down. Requirements first,
numbers second, boxes third. If you jump straight to Kafka, Kubernetes, or sharding, you
skip the part where architecture earns its shape.

A repeatable structure for "design X," and for real design reviews:

1. **Requirements (5 min).** Functional (what must it do) and non-functional
   (scale, latency, availability, consistency). Ask about read/write ratio and
   peak traffic — the answers choose half your architecture.
2. **Estimation (5 min).** Users → RPS → storage growth. Only an order of
   magnitude: 1M daily users ≈ ~12 RPS average, ~10× at peak. The point is
   demonstrating you know *why* the numbers matter.
3. **API and data model (10 min).** Core endpoints and entities. Flag what
   needs transactions (strict pile) vs. what tolerates lag (relaxed pile) —
   that is [§22](#22-consistency-cap-and-distributed-coordination) earning its keep.
4. **High-level design (10 min).** Boxes and arrows: entry, LB, services,
   database, cache, queue for anything async. Say the sync/async decision out
   loud for each edge; interviewers listen for exactly that.
5. **Scale and harden (15 min).** Find the bottleneck (usually the database),
   apply the ladder — cache → replicas → sharding — add resilience patterns on
   external calls, observability, and name the failure modes before being asked.

Signals that separate candidates: driving the conversation with trade-offs
("sessions would be simpler, but at three services JWTs avoid the shared
lookup"), numbers attached to claims, and naming what breaks first under 10×
load. Red flags: jumping to microservices before requirements, "just add a
cache/shard it" without invalidation or key reasoning, and silence about failure.

Every section of this handbook maps to a step above; the editor is the practice
field. Design something, simulate 10× traffic, break a dependency, and explain
the result out loud — that explanation *is* the interview.

Teacher practice: after each design, give yourself a two-minute oral explanation:
"The user does X, the system emits Y, this path is synchronous because Z, this path is
async because W, and the first bottleneck under 10x traffic is V."

---

## 32. Glossary

Use the glossary as a translation table. If you cannot explain one of these terms in a
plain sentence, build a small flow that demonstrates it.

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

## 33. What System Flow can and cannot prove

System Flow is a practice lab and review tool. It is strongest when you use it to
compare designs under the same assumptions, not when you ask it for exact production
predictions.

Teacher framing: the simulator is a flight simulator, not the sky. It lets you practice
controls and failure response safely. You still need real flights, real instruments, and
real maintenance before carrying passengers.

### Strong uses

Use the editor with confidence for:

- **Contract safety:** whether connected components agree on the data type that moves
  between them.
- **Structural review:** missing nodes, impossible cycles, invalid configs, unreachable
  work, and suspicious routing.
- **Capacity comparison:** which component becomes the bottleneck when traffic,
  payloads, replicas, queue size, IOPS, or quota changes.
- **Failure rehearsal:** what happens when a node, dependency, region, worker pool, or
  queue consumer is unavailable or degraded.
- **Trade-off learning:** whether a cache, queue, read replica, load balancer,
  circuit breaker, or autoscaler improves the system-level outcome.
- **Communication:** exporting a graph and result so another engineer can see the
  assumptions instead of reverse-engineering a drawing.

### Weak uses

Do not treat the simulator as proof of:

- Exact production latency, cost, availability, or cloud-region behavior.
- Packet-level networking, kernel scheduling, TCP congestion, broker internals, or
  database query plans.
- Application code correctness, data migration safety, security controls, or incident
  response maturity.
- Real RabbitMQ, Kafka, Redis, database, or load balancer configuration correctness.
- Business logic hidden inside a service. Conditions are documented as architecture
  intent; the editor does not execute arbitrary code.

### The right workflow

Use System Flow before and after real tests:

1. Model the architecture and name the assumptions.
2. Simulate normal load, peak load, and one failure.
3. Run a real load test or small production measurement.
4. Enter observed latency or throughput where you have it.
5. Simulate again and explain what changed.

The model gets more useful as the numbers become less imaginary. The goal is not to be
perfect on day one; it is to know which assumptions deserve measurement next.

Good habit: every time you export a flow, include one sentence that starts with "We are
least confident about..." That sentence is your next engineering task.

---

## 34. Practice curriculum

This project is for learning by building cases. Reading a section should lead to a
small experiment in the editor.

Treat these cases like exercises with a teacher beside you. Do not only build the happy
path. Break the path, watch the result, and explain why the system behaved that way.

### Practice loop

For every case:

1. Define one business event, such as `OrderPlaced`, `ImageUploaded`, or
   `ChatMessageSent`.
2. Build the simplest flow that handles it.
3. Validate the graph.
4. Run a baseline simulation.
5. Break one assumption: traffic, dependency health, payload size, queue consumer
   capacity, cache hit rate, database IOPS, or network latency.
6. Save the result and explain the trade-off in one paragraph.

### Case 1: checkout command path

Build:

`HTTP Endpoint -> Function / Service -> Database -> RabbitMQ Queue -> Worker -> External API`

Practice questions:

- What should stay synchronous so the customer gets a useful response?
- Which work can move behind the queue?
- What happens when the external payment or email API becomes slow?
- Does retrying help, or does it attack the downstream dependency?

Teacher story: a customer only cares that payment and order creation are clear. They do
not need to wait for analytics, recommendation refreshes, or a receipt email if those
can happen safely after the order is accepted.

### Case 2: product browsing path

Build:

`CDN -> HTTP Endpoint -> Redis Cache -> Database -> Read Replica`

Practice questions:

- How much does cache hit rate reduce database pressure?
- What happens when TTL is too low during peak traffic?
- Which reads can tolerate replica lag?
- Is the database still the bottleneck after adding cache and replicas?

Teacher story: browsing is usually forgiving. Slightly stale product recommendations are
acceptable. Wrong price or wrong inventory at checkout is not.

### Case 3: media upload path

Build:

`HTTP Endpoint -> Object Storage -> RabbitMQ Queue -> Worker -> Search Engine`

Practice questions:

- Which part is latency-sensitive to the user?
- Which part can be asynchronous?
- How does payload size change network and storage pressure?
- What happens when indexing workers fall behind?

Teacher story: the API should authorize the upload, not carry every byte if object
storage can do that job directly.

### Case 4: chat or realtime notification path

Build:

`Event Source -> Kafka Topic -> Stream Processor -> WebSocket Gateway`

Practice questions:

- What happens when one consumer cannot keep up?
- Where does ordering matter?
- How does partition count change throughput?
- What happens to user impact during a gateway outage?

Teacher story: realtime systems feel simple until users reconnect together. Model
connection count and message fan-out, not only message creation.

### Case 5: regional failover path

Build two regions with similar ingress, service, queue, and data nodes. Add a failure
scenario that makes one region unavailable.

Practice questions:

- Which region, dependency, or network edge fails first?
- Does failover protect users or only move the bottleneck?
- How long does recovery take after traffic returns?
- Which data could be stale or lost?

Teacher story: failover is not done when traffic moves. It is done when users can still
complete the important action and the data story is honest.

---

## 35. RabbitMQ practice guide

RabbitMQ is best understood as a work buffer with delivery rules. It is not just a box
between services.

Explain RabbitMQ to yourself like this: "Producers should not have to know whether
consumers are ready right now." That sentence is the benefit. Then ask who owns delay,
duplicates, retries, and dead letters. That is the cost.

### Concepts to practice

| Concept | Plain meaning | How to explore it |
|---|---|---|
| Exchange | Receives published messages and routes them | Change exchange type and routing shape |
| Queue | Stores messages until consumers receive them | Watch depth and oldest age in the timeline |
| Binding/routing key | Rule connecting exchange output to a queue | Use edge conditions and branches to document intent |
| Acknowledgement | Consumer says work is safely handled | Compare worker failure and retry settings |
| Prefetch | Limit of unacknowledged messages per consumer | Raise or lower it with worker concurrency |
| Durability | Broker persists queue/message state | Compare persistence latency and storage pressure |
| Dead-letter queue | Holds terminal failures for inspection | Enable DLQ and force failures with low downstream capacity |

### RabbitMQ drills

1. **Slow consumer:** keep producer traffic high and lower worker capacity. The queue
   should grow. Add replicas and see whether it drains.
2. **Poison message:** raise malformed or failure rate and enable retries. Watch when
   work should move to a DLQ instead of blocking healthy messages.
3. **Ordering vs. parallelism:** keep ordering required, then increase partitions or
   consumers. Notice where strict ordering limits throughput.
4. **TTL pressure:** shorten message TTL during an outage. A queue can absorb downtime
   only until age exceeds the business deadline.

Questions to answer after each drill: what is the maximum safe queue age, who owns DLQ
replay, and what alert fires before customers notice?

Teacher checkpoint: after a RabbitMQ exercise, you should be able to say whether the
queue is smoothing a burst or hiding a permanent capacity problem.

---

## 36. Database practice guide

Databases are usually the most important bottleneck because they combine state,
durability, query shape, concurrency, and consistency.

Teach databases by asking what truth the business cannot afford to lose. That one answer
decides transactions, indexes, backups, consistency, replicas, and failover.

### Concepts to practice

| Concept | Why it matters | Editor control to inspect |
|---|---|---|
| Index | Turns a scan into a targeted lookup | Index used, average query, IOPS per operation |
| Connection pool | Limits concurrent database work | Connection pool and max connections |
| Read/write split | Reads and writes scale differently | Read percentage, max reads, max writes |
| Replication lag | Replicas can be stale | Read Replica lag and freshness expectations |
| Contention | Hot rows or locks reduce useful capacity | Contention and average transaction time |
| IOPS | Storage has a work ceiling | Storage IOPS and IOPS per operation |

### Database drills

1. **Missing index:** turn index usage off or raise query time. Find the point where the
   database becomes the system bottleneck.
2. **Connection exhaustion:** increase service or worker concurrency without increasing
   database capacity. More callers can make the system worse.
3. **Read replica trade-off:** add replicas for a read-heavy path. Confirm write
   throughput does not improve.
4. **Cache before database:** add Redis and vary hit rate. Decide whether the cache is
   reducing real pressure or just adding another moving part.
5. **Primary failure:** schedule a database outage and configure failover. Compare
   dropped work, queue age, and recovery time.

The learning goal is to say which resource is scarce: CPU, IOPS, locks, connections,
write capacity, read freshness, or operator recovery time.

Teacher checkpoint: "the database is slow" is not a diagnosis. "Writes are blocked by
connection pool saturation during failover" is a diagnosis.

---

## 37. Load balancer practice guide

A load balancer is a traffic decision point. It improves availability only when there
are healthy targets and a clear health-check strategy.

Teach load balancing with one question: "If this target is sick, how quickly do we stop
sending users there?" The answer depends on health checks, routing policy, and whether
the remaining targets have enough capacity.

### Concepts to practice

| Concept | Plain meaning | Modeling hint |
|---|---|---|
| L4 vs. L7 | Transport routing vs. request-aware routing | Use edge notes and node labels to document the layer |
| Health check | Decides whether a target should receive traffic | Simulate unhealthy downstream nodes |
| Algorithm | How requests are spread | Try weighted or round-robin edge routing |
| Sticky session | Same client returns to same target | Document when stateful sessions require it |
| TLS termination | Secure connection ends at the balancer | Add edge TLS and connection reuse policies |
| Failover | Send traffic to another target when primary fails | Use priority routing and a failure scenario |

### Load balancer drills

1. **One bad target:** route traffic to two services, make one degraded, and confirm the
   design does not keep sending equal traffic to the failing path.
2. **Session state:** model a stateful service behind the balancer. Decide whether to
   add shared session storage, sticky routing, or a stateless token.
3. **TLS overhead:** compare high and low connection reuse on a public ingress edge.
4. **Regional failover:** place load balancers in two regions and simulate one region
   offline. Watch whether the database, queue, or network path becomes the new limit.

The common mistake is believing a load balancer creates capacity by itself. It only
distributes work across capacity that already exists.

Teacher checkpoint: after a load balancer drill, name the next bottleneck. If traffic
moves successfully but the database saturates, the load balancer did its job and exposed
the real limit.

---

## 38. Where to go next

Build a small flow around one business event. Validate it, simulate it, save a baseline,
and break one dependency on purpose. The most valuable question in System Flow is not
“Does this diagram look right?” It is:

> **What assumption does this design make, and what happens when that assumption stops
> being true?**

Then answer it like a teacher: show the graph, name the assumption, run the baseline,
break the assumption, compare the result, and explain the trade-off in plain language.
