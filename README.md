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
- In-memory virtual filesystem with local persistence.
- Lazy Monaco editor load for startup performance.
- Git URL import-first flow (public GitHub repo URL).
- Export downloads the current project as a `.zip` file.
- `AlmostNodeRuntime` wired with `createContainer`, file sync, and command execution.

## Next implementation targets

1. Add full git import support (branches/private repos/auth, not just public main/master fallback).
2. Move localStorage persistence to IndexedDB with versioned snapshots.
3. Add command queue and robust runtime lifecycle controls.
4. Replace basic terminal output with streaming process logs.
