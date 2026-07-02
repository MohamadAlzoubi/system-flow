# Architecture

## Dependency Direction

Dependencies point inward:

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

`contracts` and `engine` must never import React, React Flow, Zustand, or browser APIs.
This keeps simulation usable from the browser, a future API, CLI, or CI process.

## State Ownership

- React Flow owns transient interaction details such as handles and viewport behavior.
- Zustand owns the canonical graph, selection, dirty state, validation issues, and
  simulation results.
- TanStack Query is reserved for remote flows and projects. Do not mirror remote cache
  state into Zustand.
- React Hook Form owns inspector drafts. A valid Zod result is committed to Zustand.

## Adding a Node

1. Create `src/node-registry/<node-name>/index.ts`.
2. Export one `NodeDefinition` using `defineNode`.
3. Include realistic defaults and a strict Zod schema.
4. Keep `simulate` deterministic and free of side effects.
5. Register the definition in `src/node-registry/index.ts`.
6. Add engine tests for any new warning or capacity behavior.

The UI discovers registered nodes automatically.

## Simulation Rules

- Simulation receives a `FlowGraph` and a registry.
- Inputs and outputs are plain serializable objects.
- Results must be deterministic for the same graph and profile.
- Heuristics should be understandable and documented in code when non-obvious.
- Real infrastructure clients belong behind future runtime adapters, never in
  simulation definitions.
- The engine traverses reachable nodes in topological order; array order is not
  execution order.
- Multiple outgoing edges broadcast by default. Percentage-based routing must be
  explicit and total 100 percent.
- Arbitrary edge conditions are never evaluated as JavaScript.
- Every edge declares an explicit interaction type. Synchronous interactions
  (request-response, database-operation) propagate latency to the caller;
  asynchronous interactions (async-command, published-event, stream,
  batch-transfer, realtime-push) end caller latency at the boundary.

See [simulation-roadmap.md](simulation-roadmap.md) for result semantics, UX goals, and
the staged implementation plan.

See [outage-simulation.md](outage-simulation.md) for shared online, offline, degraded,
and scheduled availability semantics.

## UI Rules

- Keep workflow components focused on one area.
- Put reusable controls in `src/components/ui`.
- Use CSS variables for semantic colors and theme support.
- Keep graph/business decisions out of JSX.
- New remote operations go through TanStack Query hooks.
