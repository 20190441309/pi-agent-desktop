# AGENTS.md

> Compact guide for AI agents working in Pi Desktop. Focus: what you'd miss without help.

## Project Overview

Pi Desktop is an Electron 41 + React 19 + TypeScript 5 desktop GUI wrapping the [Pi CLI](https://github.com/earendil-works/pi-coding-agent) AI coding agent. Windows-only (v1.0).

## Monorepo Structure

```
pi-desktop/
├── apps/desktop/          # Main Electron app (3 processes: main, preload, renderer)
│   ├── src/main/          # Electron main process (Node.js)
│   ├── src/preload/       # Secure IPC bridge (contextBridge)
│   └── src/renderer/      # React UI (Vite + Tailwind CSS 4)
├── packages/shared-types/ # Cross-process TypeScript types (@shared alias)
└── docs/                  # Specs, plans, spike notes
```

## Critical Path Aliases

These aliases are defined in **both** `tsconfig.base.json` and `electron.vite.config.ts`:

- `@shared` → `packages/shared-types/src`
- `@/` → `apps/desktop/src/renderer/src/`
- `@pi-desktop/*` → `packages/*/src`

**Gotcha**: Vite doesn't read tsconfig paths. When adding new aliases, update both files.

## Commands

### Root Level (run all packages)

```bash
pnpm install --frozen-lockfile  # Install deps (use --frozen-lockfile in CI)
pnpm -r build                   # Build all packages
pnpm -r typecheck               # Typecheck all packages
pnpm -r lint                    # Lint all packages
pnpm -r test                    # Run all tests
```

### Desktop App Only

```bash
pnpm --filter @pi-desktop/desktop dev          # Start dev mode (hot reload)
pnpm --filter @pi-desktop/desktop build        # Build for production
pnpm --filter @pi-desktop/desktop test         # Run tests (vitest)
pnpm --filter @pi-desktop/desktop typecheck    # Typecheck
pnpm --filter @pi-desktop/desktop lint         # ESLint 9 flat config
pnpm --filter @pi-desktop/desktop e2e          # Playwright E2E tests
pnpm --filter @pi-desktop/desktop package      # Build Windows installer
```

### Run Single Test File

```bash
pnpm --filter @pi-desktop/desktop test src/path/to/file.test.ts
```

## CI Pipeline Order

GitHub Actions (`.github/workflows/ci.yml`) runs on `windows-latest`:

1. `pnpm install --frozen-lockfile`
2. `pnpm -r typecheck` (fail-fast)
3. `pnpm -r lint` (fail-fast)
4. `pnpm -r test` (fail-fast)
5. `pnpm --filter @pi-desktop/desktop build`

**Always verify locally in this order before pushing**: typecheck → lint → test

## Architecture: Three Processes

```
┌─────────────────────────────────────────┐
│ Renderer (React 19 + Zustand 5)         │
│  - Components, stores, hooks             │
│  - Communicates via window.piAPI         │
└────────────────┬────────────────────────┘
                 │ typed IPC (contextBridge)
┌────────────────┴────────────────────────┐
│ Main Process (Electron + Node.js)        │
│  - IPC handlers in src/main/ipc/*.ipc.ts │
│  - Services in src/main/services/        │
│  - Pi CLI integration via pi-driver.ts    │
└────────────────┬────────────────────────┘
                 │ in-process
┌────────────────┴────────────────────────┐
│ Pi CLI (via @earendil-works/pi-coding-agent) │
└─────────────────────────────────────────┘
```

## Key Files

- **Main entry**: `apps/desktop/src/main/index.ts`
- **Preload bridge**: `apps/desktop/src/preload/index.ts`
- **Renderer entry**: `apps/desktop/src/renderer/src/App.tsx`
- **Shared types**: `packages/shared-types/src/index.ts`
- **IPC Zod schemas**: `apps/desktop/src/main/ipc/schemas.ts`
- **Vitest config**: `apps/desktop/vitest.config.ts`
- **Electron Vite config**: `apps/desktop/electron.vite.config.ts`
- **Smoke test**: `scripts/smoke-main-runtime.cjs` — verifies main process IPC setup without launching full app

## Testing Conventions

- **Framework**: Vitest 4 + @testing-library/react
- **Test location**: `__tests__/` directories next to source files
- **File naming**: `*.test.ts` or `*.test.tsx`
- **Setup**: `apps/desktop/src/test/setup.ts` sets `NODE_ENV=test` and locale to `zh-CN`
- **I18n**: Tests assume `zh-CN` locale (hardcoded in setup). Use `zh-CN.json` locale strings in assertions.
- **tsconfig excludes `__tests__`** from typecheck, but vitest includes them via its own config

### Test Aliases (vitest.config.ts)

```typescript
"@": resolve(__dirname, "src/renderer/src"),
"@shared": resolve(__dirname, "../../packages/shared-types/src"),
```

## Code Style

- **TypeScript**: Strict mode enabled (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`)
- **ESLint**: ESLint 9 flat config, `@typescript-eslint/no-explicit-any` is error (except tests)
- **Imports**: ESM, no `.js` extensions needed
- **Styling**: Tailwind CSS 4 (utility-first, no CSS modules)
- **State**: Zustand 5 stores in `src/renderer/src/stores/`
- **React hooks**: `react-hooks/rules-of-hooks` is error, `exhaustive-deps` is warn

## Electron Specifics

- **Electron version**: 41 (Node.js runtime)
- **Build tool**: electron-vite 5
- **Package manager**: pnpm 9
- **Native modules**: `node-pty` for terminal, `sharp` for images
- **Auto-update**: electron-updater (GitHub Releases)
- **`__APP_VERSION__`**: Injected from `package.json` version into renderer via electron-vite `define`

## IPC Communication

- **Main → Renderer**: `ipcMain.handle()` + `ipcRenderer.invoke()`
- **Renderer → Main**: `ipcRenderer.send()` + `ipcMain.on()`
- **Preload**: Exposes `window.piAPI` and `window.nodeAPI` via `contextBridge`
- **Types**: All IPC payloads typed in `packages/shared-types/src/index.ts`
- **Error pattern**: IPC handlers return `ipcError()` from `@shared` (structured error object), not thrown exceptions
- **Validation**: IPC args validated with Zod schemas in `apps/desktop/src/main/ipc/schemas.ts`

## Common Patterns

### Adding a New IPC Handler

1. Define types in `packages/shared-types/src/index.ts`
2. Add handler in `apps/desktop/src/main/ipc/*.ipc.ts`
3. Expose in preload: `apps/desktop/src/preload/index.ts`
4. Use in renderer via `window.piAPI`

### Adding a New Zustand Store

1. Create store in `apps/desktop/src/renderer/src/stores/`
2. Export `use*Store` hook
3. Import in components

### Adding a New Service

1. Create in `apps/desktop/src/main/services/`
2. Follow existing patterns (class-based or functional)
3. Add IPC handlers to expose to renderer

## Environment

- **Node.js**: >= 22.19.0
- **pnpm**: >= 9.0.0
- **OS**: Windows 10/11 (v1.0)
- **Pi CLI**: Must be installed and on PATH

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope):` new feature
- `fix(scope):` bug fix
- `chore(scope):` tooling/cleanup
- `refactor(scope):` no behavior change
- `test(scope):` tests only
- `docs(scope):` docs only

## Branch Naming

- `master` — stable, always green
- `feature/mN-*` — per-milestone work
- `fix/<issue>` — bug fixes
- `chore/<topic>` — maintenance

## Important Notes

1. **Windows-only**: v1.0 targets Windows only. macOS/Linux planned for v1.1+
2. **Pi CLI dependency**: App requires Pi CLI installed globally (`@earendil-works/pi-coding-agent`)
3. **i18n**: Currently zh-CN only, but i18next is set up for easy addition. Two locale files: `src/renderer/src/i18n/locales/{zh-CN,en}.json`
4. **E2E tests**: Playwright tests require built app (`e2e:build` script)
5. **Native modules**: `node-pty` requires build tools (node-gyp, Python, Visual Studio on Windows)
6. **Pre-commit hooks**: Lefthook runs `typecheck` and `lint` in parallel on commit (see `lefthook.yml`). Run `typecheck → lint → test` manually before pushing if hooks are skipped.
7. **Release**: Triggered by pushing a `v*.*.*` tag. Builds NSIS Windows installer via `.github/workflows/release.yml`

## Quick Verification

Before claiming work is done:

```bash
# From repo root
pnpm -r typecheck && pnpm -r lint && pnpm -r test
```

If any step fails, fix before committing.
