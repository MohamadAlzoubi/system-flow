# CLAUDE.md

Follow `AGENTS.md` as the repository-wide source of truth. Read
`docs/architecture.md` before changing module boundaries.

## Claude-Specific Working Notes

- Begin by locating the owning module; avoid adding behavior to `src/app/App.tsx`.
- Preserve the inward dependency direction documented in `docs/architecture.md`.
- Do not place simulation heuristics in React components or Zustand actions.
- Do not combine multiple node definitions in one file. Each node is a plugin-style
  folder under `src/node-registry`.
- When changing a contract, search all examples, engine functions, registry
  definitions, store actions, and tests for affected consumers.
- Prefer small edits with explicit tests over broad rewrites.
- Do not replace local UI primitives with a second component library.
- Do not introduce Redux, Next.js, or monorepo tooling without an explicit decision.

Before declaring work complete, run:

```bash
pnpm check
pnpm test
pnpm build
```
