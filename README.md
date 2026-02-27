# AlmostNode Web Editor

Initial implementation scaffold for a low-memory, fast-loading web editor for Node projects.

## Locked stack

- React + Vite
- Monaco editor (lazy-loaded)
- pnpm-first workflow
- Single-user MVP
- Import/export included in MVP

## Start

```bash
pnpm install
pnpm dev
```

## Current state

- Workspace shell with files panel, editor panel, and terminal output panel.
- In-memory virtual filesystem with IndexedDB-backed persistence and snapshots.
- Lazy Monaco editor load for startup performance.
- Git URL import flow with branch/ref support and clearer API error handling.
- Export downloads the current project as a `.zip` file.
- `AlmostNodeRuntime` wired with boot/shutdown/restart lifecycle, sync cleanup, and command execution guards.

## Next implementation targets

1. Add command queue + concurrency controls around runtime commands.
2. Add a dedicated problems/diagnostics panel.
3. Add performance metrics dashboard and memory budget enforcement.
4. Expand pnpm-first workflow helpers in terminal/command palette.
