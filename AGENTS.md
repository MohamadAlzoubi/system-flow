# AGENTS.md

This file defines the working agreement for AI coding agents in this repository.

## Product Intent

System Flow is a typed backend architecture editor and simulator. Data contracts are
the primary domain object. Nodes create, transform, queue, cache, persist, broadcast,
or reject data; typed edges describe what moves between nodes.

Do not turn the product into a generic diagramming tool.

## Required Workflow

1. Read `README.md` and `docs/architecture.md` before structural changes.
2. Inspect nearby modules and follow existing patterns.
3. Keep changes scoped to the requested behavior.
4. Add or update tests for engine and validation behavior.
5. Run `pnpm check`, `pnpm test`, and `pnpm build` before finishing.
6. Report any command that could not be run.

## Architecture Boundaries

- `src/contracts` contains framework-free TypeScript types.
- `src/engine` contains pure, deterministic domain logic.
- `src/node-registry` contains one folder per node type.
- `src/store` owns canonical editor state.
- `src/flow-builder` contains product UI by feature.
- `src/components/ui` contains reusable local primitives.
- `src/app` only composes features and providers.

Never import React, Zustand, React Flow, or browser APIs into `contracts`, `engine`, or
node simulation logic.

## Implementation Conventions

- Use TypeScript strict mode; do not introduce `any`.
- Validate graph/config boundaries with Zod.
- Keep simulation deterministic and side-effect free.
- Use Zustand selectors instead of subscribing to the whole store.
- Use React Hook Form for non-trivial forms.
- Use TanStack Query only for server state.
- Prefer named exports except for the root `App` component.
- Use kebab-case folders and PascalCase React component files.
- Use Lucide icons for interface actions.
- Use semantic CSS variables rather than hardcoded theme colors.
- Keep files focused; split files that mix domain logic, state, and rendering.

## Node Checklist

Every new node must provide:

- Stable namespaced `type`
- User-facing `label` and `category`
- Accepted input and produced output types
- Realistic `defaultConfig`
- Zod `configSchema`
- Deterministic `simulate`
- Registry entry
- Tests for new simulation behavior

An `execute` function is optional and must not be called by the simulator.

## Commands

```bash
pnpm dev
pnpm check
pnpm check:write
pnpm test
pnpm build
```

Use pnpm. Do not add npm or Yarn lockfiles.
