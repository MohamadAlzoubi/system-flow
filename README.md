# System Flow

A typed backend flow editor and deterministic architecture simulator. Data contracts
are first-class: nodes produce and consume types, while edges describe the data moving
between them.

## Development

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm check
pnpm test
pnpm build
```

## Architecture

- `src/contracts`: Plain TypeScript domain contracts. No framework imports.
- `src/engine`: Pure validation and simulation functions.
- `src/node-registry`: Plugin-style node definitions and Zod schemas.
- `src/examples`: Complete sample `FlowGraph` fixtures.
- `src/store`: Zustand editor state and graph mutations.
- `src/flow-builder`: Canvas, inspector, toolbars, and panels.
- `src/components/ui`: Reusable local UI primitives.
- `src/app`: Application composition and providers.

See [docs/architecture.md](docs/architecture.md) for dependency rules and extension
guides.
