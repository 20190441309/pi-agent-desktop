# Changelog

All notable changes to Pi Desktop will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-06-01

首个公开版本。Windows 10/11 x64.

### Added
- M1 基础: 修 cwd bug + Pi in-process 长连接 + 分层审批 (high-risk 预拦 / file_edit 事后 diff / read 放行)
- M2 上下文: @ 文件引用 (fuzzy 排序) + 图片粘贴 + Ctrl+K CommandPalette (文件/历史/命令 3 模式)
- M3 技能: SkillHub CLI 集成, 市场 tab + 我的 tab + 3 选项创建 (用 Pi 构建/编写/从 GitHub)
- M4 终端: node-pty 真 PTY, 多 tab, xterm.js 6 集成
- M5 工程: electron-updater + GitHub Actions (CI + Release) + ErrorBoundary + 重写 README/CONTRIBUTING
- M6 发布: 写最小 App.tsx + 归档旧 UI 组件 + 真实 NSIS 打包 (101 MB installer)

### Tests
- 107 通过, 2 跳过, 0 失败 (17 test files)

### Known Limitations
- macOS / Linux 不支持 (v1.1)
- 没代码签名 (SmartScreen 警告, v1.1)
- 旧 UI 组件归档, 等 v1.1 重写 ChatView
- 技能格式 adapter (OpenClaw → Pi) v1.1

## [Unreleased] — M1 through M5 in progress

### M5 (in progress)
- TBD

### M4 — Terminal (node-pty)
- Replaced child_process.spawn with node-pty (real PTY, resize works, TUI apps supported)
- Multi-tab TerminalPanel with xterm.js
- PtyManager (TDD, 12 tests)
- terminal.ipc.ts: create / input / resize / close / list
- e2e + manual smoke checklist

### M3 — Skills (SkillHub integration)
- SkillHub CLI adapter (search / install / uninstall / list / check)
- Skills IPC: search, installed, install, uninstall, toggle, github-import
- SkillsStore (Zustand)
- SkillsPanel with 市场 / 我的 tabs
- SkillCard, SkillCreateDropdown (3 options: 用 Pi 构建 / 编写技能 / 从 GitHub 导入)
- PiAPI type extended with all M1+M2+M3 methods (centralized in `types/index.ts`)

### M2 — Context
- File scanner (skip node_modules / .git / hidden)
- Fuzzy match (substring + path-segment + camelcase) — 7 tests
- @ mention parser (cursor tracking, mid-token detection) — 9 tests
- MentionPopover (debounced search, keyboard navigation)
- Image paste handler (FileReader → dataURL → attachments store)
- AttachmentChip (file + image variants)
- CommandPalette modal (Ctrl+K, 3 modes: file / history / cmd)
- useCommandPalette hook (global Ctrl+K)
- attachments-store, types/attachments

### M1 — Foundation (3 critical bugs fixed)
- **Cwd bug fix**: Pi now runs in user's selected workspace path, not Electron's cwd
- **Long-lived Pi sessions**: AgentSession in-process per workspace (replaces one-shot --print)
- **Tiered approval flow**:
  - READ_ONLY → pass through
  - FILE_EDIT → post-hoc diff + undo via `git checkout`
  - HIGH_RISK → modal prompt, session.abort() on deny
- Risk classifier: 16+ patterns (rm -rf, sudo, /etc writes, ~/.ssh, etc.)
- PendingEdits tracker (TDD, 9 tests)
- ApprovalInterceptor + approval-bridge (TDD, 8 tests)
- EventBridge (Pi events → renderer, 6 tests)
- WorkspaceRegistry (TDD, 5 tests)
- shared-types package (events + approval types, 6 tests)
- vitest config + sanity test
- pnpm test, typecheck, lint scripts working

### Housekeeping
- `.codebuddy/`, `app-output.log`, `package-lock.json` removed
- Mockup HTMLs and old design docs archived to `docs/design-archive/`
- Dead `packages/pi-driver` removed
- `.gitignore` refreshed (IDE state, stale artifacts, mockup HTMLs)

## [0.0.0] — initial commit

- Initial scaffold: Electron + React + TypeScript monorepo
- Basic IPC scaffolding
- Old `--print` based chat (replaced by M1)
