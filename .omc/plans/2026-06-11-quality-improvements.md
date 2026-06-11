# Quality Improvement Plan

**Status**: pending approval  
**Created**: 2026-06-11  
**Scope**: 6 non-urgent quality improvements identified during codebase review

---

## 1. 拆分工作树为独立提交

**Current state**: 17 modified tracked files + 8 untracked paths covering 10+ unrelated areas.

**Acceptance criteria**:
- [ ] Each commit touches files from a single logical concern
- [ ] Each commit passes `pnpm -r typecheck && pnpm -r lint && pnpm -r test`
- [ ] No commit breaks the build when checked out individually

**Implementation steps**:

| # | Commit message | Files |
|---|---|---|
| 1 | `fix(security): correct HTML escaping in session export` | `utils/export.ts` |
| 2 | `fix(security): narrow SSRF guard to cloud metadata endpoints only` | `main/ipc/config.ipc.ts` |
| 3 | `feat(editor): add Monaco editor component for file workspace` | `components/Editor/MonacoEditor.tsx`, `FileWorkspace.tsx`, `FileWorkspace.test.tsx` |
| 4 | `refactor(search): make scanFiles async to avoid main-process blocking` | `file-scanner.ts`, `file-scanner.test.ts` |
| 5 | `feat(skills): add built-in SkillHub fallback when CLI unavailable` | `skillhub-adapter.ts`, `skillhub-adapter.test.ts` |
| 6 | `feat(chat): add model selector to chat view` | `ChatView.tsx` |
| 7 | `perf(chat): memoize MarkdownRenderer and MessageBubble, fix timer cleanup` | `MarkdownRenderer.tsx`, `MessageBubble.tsx` |
| 8 | `feat(sessions): add session export dialog (Markdown/JSON/HTML)` | `SessionExport/SessionExportDialog.tsx`, `SessionCenter.tsx` |
| 9 | `feat(settings): add shortcuts tab, sound/notification controls, system theme` | `SettingsPanel.tsx`, `utils/sounds.ts`, `utils/theme.ts` |
| 10 | `feat(sidebar): add recent workspaces widget` | `RecentWorkspaces/RecentWorkspaces.tsx`, `MiniMaxCodeSidebar.tsx` |
| 11 | `feat(ui): add usage stats panel to right rail` | `RightRail.tsx` |
| 12 | `feat(i18n): add search-history shortcut and system theme locale keys` | `registry.ts`, `en.json`, `zh-CN.json` |
| 13 | `chore: remove stale pi-driver alias from electron-vite config` | `electron.vite.config.ts` |
| 14 | `chore: remove orphaned ThemeToggle component` | deleted `ThemeToggle/ThemeToggle.tsx` |
| 15 | `docs: update AGENTS.md pre-commit hooks and pi-driver reference` | `AGENTS.md` |
| 16 | `docs: add refactor plan for index.ts` | `docs/compose/plans/2026-06-11-refactor-index-ts.md` |

**Risks**: Some files have changes spanning multiple concerns (e.g. `SettingsPanel.tsx` has shortcut + sound + theme changes). Will need `git add -p` to split hunks.

**Mitigation**: If hunk splitting is too complex, group closely related changes (shortcuts + sound + theme → one "settings enhancement" commit).

---

## 2. 添加 Prettier 配置和格式检查

**Current state**: No Prettier config, no format check script, formatting relies on ESLint only.

**Acceptance criteria**:
- [ ] `.prettierrc` exists at project root with sensible defaults
- [ ] `.prettierignore` exists excluding `out/`, `dist/`, `release/`, `node_modules/`
- [ ] `pnpm format:check` script runs Prettier in check mode
- [ ] `pnpm format` script runs Prettier in write mode
- [ ] Lefthook pre-commit hook runs format check (or format + check)
- [ ] Existing code is not reformatted in this task (separate commit later)

**Implementation steps**:

| Step | File | Change |
|------|------|--------|
| 1 | Root `.prettierrc` | Create: `{ "semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100, "tabWidth": 2 }` |
| 2 | Root `.prettierignore` | Create: `out/\ndist/\nrelease/\nnode_modules/\n*.min.js\npnpm-lock.yaml` |
| 3 | Root `package.json` | Add devDeps: `prettier`, add scripts: `"format": "prettier --write .", "format:check": "prettier --check ."` |
| 4 | `apps/desktop/package.json` | Add scripts: `"format": "prettier --write src", "format:check": "prettier --check src"` |
| 5 | `lefthook.yml` | Add `format` command to pre-commit pipeline (parallel with typecheck/lint) |

**Risks**: Prettier `--check .` on existing unformatted code will produce many errors. 

**Mitigation**: Run `pnpm format` as a separate formatting commit after adding config, NOT as part of this task. The task only adds the config and CI check; bulk formatting is a follow-up.

---

## 3. 添加 Vitest 覆盖率门槛

**Current state**: 83 test files, 735 tests passing, but no coverage config or thresholds.

**Acceptance criteria**:
- [ ] `vitest.config.ts` has `coverage` provider configured (`v8`)
- [ ] Coverage reporters: `text`, `lcov`
- [ ] Coverage thresholds set at conservative levels: branches 40%, functions 40%, lines 50%, statements 50%
- [ ] `pnpm test:coverage` script runs tests with coverage
- [ ] CI pipeline runs coverage (optional, separate PR)

**Implementation steps**:

| Step | File | Change |
|------|------|--------|
| 1 | `apps/desktop/package.json` | Add devDep: `@vitest/coverage-v8`, add script: `"test:coverage": "vitest --coverage"` |
| 2 | `apps/desktop/vitest.config.ts` | Add `coverage` block: `provider: 'v8', reporter: ['text', 'lcov'], include: ['src/**/*.{ts,tsx}'], exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'], thresholds: { branches: 40, functions: 40, lines: 50, statements: 50 }` |
| 3 | Root `package.json` | Add script: `"test:coverage": "pnpm -r test:coverage"` |
| 4 | `.gitignore` | Add `coverage/` |

**Risks**: Current coverage may be below 40%/50% thresholds, causing CI to fail.

**Mitigation**: Start with very low thresholds (40/50) and raise incrementally. Add `thresholdAutoUpdate: true` initially so thresholds auto-adjust to current levels, then lock them once baseline is established.

---

## 4. 减少 IPC 边界类型断言，配合 Zod 双向验证

**Current state**: 42 `as Promise<...>` assertions in preload, 25/97 IPC channels have Zod validation, 72 channels lack validation.

**Acceptance criteria**:
- [ ] Preload `as Promise<...>` assertions reduced by at least 50% (from 42 to ≤21)
- [ ] Zod validation coverage increased from 25 to at least 50 channels
- [ ] All new Zod schemas added to `schemas.ts`
- [ ] Existing tests still pass

**Implementation steps**:

This is a large, incremental task. Split into phases:

### Phase 1: Add Zod schemas for high-value unvalidated channels (channels that accept user input)

| Step | Channel | Schema name | IPC file |
|------|---------|-------------|----------|
| 1 | `workspace:delete` | `workspaceDeleteSchema` | `workspace.ipc.ts` |
| 2 | `workspace:select` | `workspaceSelectSchema` | `workspace.ipc.ts` |
| 3 | `config:save-models` | `configSaveModelsSchema` | `config.ipc.ts` |
| 4 | `config:save-auth` | `configSaveAuthSchema` | `config.ipc.ts` |
| 5 | `config:save-settings` | `configSaveSettingsSchema` | `config.ipc.ts` |
| 6 | `config:save-raw` | `configSaveRawSchema` | `config.ipc.ts` |
| 7 | `config:import` | `configImportSchema` | `config.ipc.ts` |
| 8 | `session:create` | `sessionCreateSchema` | `sessions.ipc.ts` |
| 9 | `session:rename` | `sessionRenameSchema` | `sessions.ipc.ts` |
| 10 | `session:delete` | `sessionDeleteSchema` | `sessions.ipc.ts` |
| 11 | `skills:install` | `skillInstallSchema` | `skills.ipc.ts` |
| 12 | `skills:uninstall` | `skillUninstallSchema` | `skills.ipc.ts` |
| 13 | `skills:toggle` | `skillToggleSchema` | `skills.ipc.ts` |
| 14 | `skills:github-import` | `skillGithubImportSchema` | `skills.ipc.ts` |
| 15 | `agents:prompt` | `agentPromptSchema` | `agents.ipc.ts` |

### Phase 2: Type-safe preload wrappers

Create `apps/desktop/src/preload/ipc-helpers.ts` with a generic `invoke<T>` function that uses the existing Zod schemas on the main side for runtime validation, reducing the need for `as` assertions:

```ts
// Replace: ipcRenderer.invoke("channel", args) as Promise<T>
// With:    invoke<T>("channel", args)
```

The `invoke` function doesn't change runtime behavior but centralizes the assertion point and makes it easier to add logging/telemetry later.

**Risks**: Touching 15+ IPC files across preload and main is error-prone.

**Mitigation**: Do one IPC file per commit. Run full test suite after each file. Phase 1 and Phase 2 are separate PRs.

---

## 5. 启用 ESLint type-aware 规则

**Current state**: ESLint 9 flat config, `typescript-eslint` recommended rules only, no type-aware rules.

**Acceptance criteria**:
- [ ] `eslint.config.js` uses `tseslint.configs.recommendedTypeChecked` 
- [ ] `parserOptions.project` set to `./tsconfig.json`
- [ ] Type-aware rules enabled: `no-floating-promises`, `no-misused-promises`, `no-unnecessary-type-assertion`
- [ ] Test files override relaxes type-aware rules where needed
- [ ] `pnpm -r lint` passes with 0 errors (existing violations fixed or suppressed with `eslint-disable`)

**Implementation steps**:

| Step | File | Change |
|------|------|--------|
| 1 | `apps/desktop/eslint.config.js` | Import `tseslint.configs.recommendedTypeChecked`, add `parserOptions.project`, enable type-aware rule subset |
| 2 | Fix violations across codebase | `no-floating-promises` (likely in React effects), `no-misused-promises` (likely in event handlers) |
| 3 | Add targeted `// eslint-disable-next-line` comments | Where fixing is impractical (Electron API quirks) |
| 4 | Run `pnpm -r lint` | Verify 0 errors |

**Risks**: Type-aware linting requires `tsconfig.json` to cover linted files; currently `tsconfig.json` excludes `__tests__`. May need `tsconfig.lint.json` or adjusted includes.

**Mitigation**: Create a `tsconfig.eslint.json` extending the base with test files included, point ESLint to it. Test files get relaxed overrides.

---

## 6. 硬编码中文字符串移入 i18n locale 文件

**Current state**: Multiple new components have hardcoded Chinese strings bypassing the i18n system.

**Files with hardcoded Chinese**:
- `SessionExportDialog.tsx`: ~8 strings
- `RecentWorkspaces.tsx`: ~5 strings
- `SettingsPanel.tsx`: ~25+ strings
- `utils/export.ts`: ~15 strings (non-React, needs different approach)

**Existing i18n pattern**: `useI18n()` hook → `t('key.path', { interpolation })` with `zh-CN.json` and `en.json`.

**Acceptance criteria**:
- [ ] All user-visible Chinese strings in React components use `t()` calls
- [ ] Both `zh-CN.json` and `en.json` have corresponding keys
- [ ] `utils/export.ts` uses locale-aware formatting (passed from caller or non-hook utility)
- [ ] Existing tests still pass

**Implementation steps**:

### Phase A: React components

| Step | Component | New i18n keys | Notes |
|------|-----------|---------------|-------|
| 1 | `SessionExportDialog.tsx` | `export.title`, `export.format`, `export.format.markdown/json/html`, `export.selectSession`, `export.selected`, `export.messages`, `export.cancel`, `export.confirm` | Some keys may already exist as `common.close`, `common.cancel` |
| 2 | `RecentWorkspaces.tsx` | `workspaces.recent`, reuse `common.time.justNow`, `common.time.minutesAgo`, etc. | Time strings already exist in locale |
| 3 | `SettingsPanel.tsx` | `settings.tab.shortcuts`, `settings.tabCaption.shortcuts`, `settings.notifications.title`, `settings.notifications.description`, `settings.notifications.system`, `settings.notifications.systemDesc`, `settings.sound.title`, `settings.sound.description`, `settings.sound.volume`, `settings.shortcuts.*`, plus all config-related strings | Largest scope; ~25 keys |

### Phase B: Non-React utility

| Step | File | Approach | Notes |
|------|------|----------|-------|
| 4 | `utils/export.ts` | Accept `locale` param or `t` function from caller; default to `'zh-CN'` | Cannot use `useI18n` hook. Add `exportSessionAsMarkdown(session, locale)` etc. |

**Risks**: `SettingsPanel.tsx` has many strings and is the most error-prone to migrate.

**Mitigation**: Do `SettingsPanel.tsx` last after establishing patterns with simpler components. Each component migration is a separate commit.

---

## Priority Order

1. **Task 1 (Split commits)** — Do first, before any other changes, to create a clean baseline
2. **Task 2 (Prettier)** — Low risk, high consistency value, blocks nothing
3. **Task 6 (i18n)** — Medium risk, user-facing quality, independent of other tasks
4. **Task 3 (Coverage)** — Low risk, CI improvement, independent
5. **Task 5 (ESLint type-aware)** — Medium risk, may reveal many violations
6. **Task 4 (IPC Zod)** — Highest risk, touches 15+ files, most incremental

---

## Verification Steps

After each task:
1. `pnpm -r typecheck` — 0 errors
2. `pnpm -r lint` — 0 errors
3. `pnpm -r test` — all pass
4. Visual check: `pnpm --filter @pi-desktop/desktop dev` — app launches correctly