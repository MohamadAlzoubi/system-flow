# System Flow

System Flow is a typed backend architecture editor and deterministic simulator for
learning, practicing, and reviewing system design decisions.

It is not a generic diagramming tool. The primary object is the data contract: nodes
create, transform, queue, cache, persist, broadcast, reject, or observe data, and typed
edges describe what moves between those responsibilities.

## What This Project Helps You Practice

System Flow is built for people who want to reason about backend architecture before
production mistakes become expensive. It helps answer questions such as:

- What data moves through this system, and who owns each contract?
- Which node becomes the bottleneck under normal, peak, or burst traffic?
- What happens when a worker, queue, database, dependency, network path, or region fails?
- Which assumptions are measured, and which are still guesses?
- Does a queue, cache, read replica, load balancer, rate limiter, or circuit breaker
  improve the whole system or only move the bottleneck?
- What evidence can be shared with another engineer, reviewer, or AI coding agent
  without relying on screenshots?

## Core Capabilities

- Typed backend flow editor with React Flow
- Data contract workspace for schema-first architecture modeling
- Node registry for backend components such as HTTP endpoints, RabbitMQ, Kafka, Redis,
  databases, read replicas, object storage, CDNs, load balancers, workers, external APIs,
  rate limiters, circuit breakers, observability, and autoscaling
- Deterministic simulation engine for throughput, latency, capacity, queue behavior,
  resource pressure, retries, and failure scenarios
- Validation engine for graph structure, configuration, type compatibility, routing,
  ownership, interaction, and failure modeling
- Scenario Lab for comparing baseline and failure scenarios side by side
- Region modeling and network policy controls
- Architecture review, decision records, assumptions, and production-readiness handoff
  pack generation
- Education page for learning system design concepts through practical exercises

## What It Can and Cannot Prove

Use System Flow confidently for comparative architecture reasoning:

- contract compatibility
- routing and topology validation
- capacity and bottleneck comparison
- queue growth and recovery behavior
- failure rehearsal
- deterministic scenario comparison
- communication of design assumptions

Do not treat it as proof of exact production behavior. It does not simulate packet-level
networking, cloud-provider internals, SQL query plans, broker implementation details,
application code correctness, security posture, or real production latency. It is a
practice lab and review tool, not a replacement for load tests, telemetry, chaos drills,
or production measurements.

## Quick Start

Prerequisites:

- Node.js compatible with the project toolchain
- pnpm 10.12.1, preferably via Corepack

Install dependencies:

```bash
pnpm install
```

Start the local editor:

```bash
pnpm dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173/
```

Open the education handbook:

```text
http://localhost:5173/education
```

## Common Workflow

1. Load an example or create a new flow.
2. Define the business event and data contract.
3. Add nodes that represent real backend responsibilities.
4. Connect nodes with typed edges.
5. Configure capacity, latency, routing, network, and failure assumptions.
6. Validate the graph.
7. Run a baseline simulation.
8. Break one assumption, such as traffic, dependency health, queue consumers, cache hit
   rate, database IOPS, or network latency.
9. Compare the result and record the decision.
10. Export the flow or generate a handoff pack.

## Example Systems to Model

- Checkout command path:
  `HTTP Endpoint -> Function / Service -> Database -> RabbitMQ Queue -> Worker -> External API`
- Product browsing path:
  `CDN -> HTTP Endpoint -> Redis Cache -> Database -> Read Replica`
- Media upload path:
  `HTTP Endpoint -> Object Storage -> RabbitMQ Queue -> Worker -> Search Engine`
- Realtime chat path:
  `Event Source -> Kafka Topic -> Stream Processor -> WebSocket Gateway`
- Regional failover path:
  two region containers with ingress, services, queues, data nodes, and a region outage
  scenario

## Architecture

The project keeps domain logic separate from UI and browser concerns.

```text
app / flow-builder
        |
        v
store / examples / node-registry
        |
        v
engine
        |
        v
contracts
```

Key boundaries:

- `src/contracts`: framework-free TypeScript domain types
- `src/engine`: pure deterministic validation, simulation, rules, review, and blueprint
  logic
- `src/node-registry`: one folder per backend node type, including config schemas and
  deterministic simulation behavior
- `src/store`: canonical editor state and graph mutations
- `src/flow-builder`: product UI by feature
- `src/components/ui`: reusable local primitives
- `src/education`: education page shell
- `src/app`: application composition and providers

Read [docs/architecture.md](docs/architecture.md) before structural changes.

## Available Scripts

```bash
pnpm dev
pnpm check
pnpm check:write
pnpm test
pnpm build
```

Script purpose:

- `pnpm dev`: start the Vite development server
- `pnpm check`: run Biome formatting and lint checks
- `pnpm check:write`: apply Biome fixes where safe
- `pnpm test`: run the Vitest suite
- `pnpm build`: run TypeScript project build and Vite production build

Use pnpm. Do not add npm or Yarn lockfiles.

## Testing and Quality

Before finishing a code change, run:

```bash
pnpm check
pnpm test
pnpm build
```

Engine, validation, simulation, scenario, review, blueprint, region layout, store, and
export behavior are covered by focused tests. UI-only documentation changes may not need
new engine tests, but engine and validation behavior changes should add or update tests.

## Documentation

- [Architecture](docs/architecture.md): dependency rules, state ownership, and extension
  boundaries
- [Milestone V4](docs/milestone-v4.md): production readiness lab roadmap
- [Simulation Roadmap](docs/simulation-roadmap.md): result semantics and simulation
  direction
- [Outage Simulation](docs/outage-simulation.md): shared availability semantics
- [Education Handbook](education.md): practical system design guide used by the
  `/education` route

## Adding a Node Type

Every new node should provide:

- stable namespaced `type`
- user-facing `label` and `category`
- accepted input and produced output types
- realistic `defaultConfig`
- strict Zod `configSchema`
- deterministic `simulate`
- registry entry
- tests for new simulation, capacity, validation, or warning behavior

Simulation logic must stay deterministic and side-effect free. Real infrastructure
clients belong behind future runtime adapters, not inside the simulator.

## Technology Stack

- TypeScript
- React
- React Flow
- Zustand
- React Hook Form
- Zod
- TanStack Query
- Vite
- Vitest
- Biome
- Tailwind CSS
- Lucide React

## Repository Keywords

Suggested repository topics:

```text
system-design, backend-architecture, architecture-simulator, distributed-systems,
typescript, react, react-flow, simulation, rabbitmq, kafka, redis, databases,
load-balancing, resilience, observability, education
```

## What Usually Belongs in a Professional README

A strong README usually answers these questions quickly:

- What is the project?
- Who is it for?
- What problem does it solve?
- What can it do?
- What can it not do?
- How do I install and run it?
- How do I test and build it?
- How is the code organized?
- Where is the deeper documentation?
- How should contributors make safe changes?
- What is the license or usage status?

This README follows that structure so a new contributor, reviewer, or AI coding agent can
understand the project without reverse-engineering the repository.

## License

No license file is currently included. Treat the repository as private/proprietary unless
a license is added by the project owner.
