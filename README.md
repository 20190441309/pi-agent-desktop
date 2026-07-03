# Pi Desktop

Pi Desktop is a Windows desktop client for the [Pi CLI](https://github.com/earendil-works/pi-coding-agent). It packages the agent into a desktop workflow with chat, workspace routing, approvals, tools, settings, terminal tabs, and a GitHub Releases based updater.

## Who This Repository Is For

- Developers who want to run Pi through a native Windows desktop UI
- Maintainers who need to build, sign, publish, and verify Windows releases
- Contributors who want the current project layout, verification flow, and release expectations in one place

## Current Status

As of 2026-06-27, the checked-in application version is `1.0.12` in both the workspace root and the desktop package.

Current release snapshot:

| Item | Status |
| --- | --- |
| Source version | `1.0.12` |
| Desktop package version | `1.0.12` |
| Remote default branch | `master` |
| Repository visibility | `public` |
| Latest remote Git tag | `v1.0.12` |
| Published GitHub Releases | `v1.0.12` stable release |
| Release assets | `Pi-Desktop-1.0.12-setup.exe`, `Pi-Desktop-1.0.12-setup.exe.blockmap`, `latest.yml` |
| Release published at | `2026-06-27 15:59:59Z` |
| GitHub release page | `https://github.com/ChisaAlter/pi-agent-desktop/releases/tag/v1.0.12` |
| In-app updater runtime | implemented, packaged, and wired to GitHub Releases |
| Real updater result today | a real packaged `1.0.11` build discovered, downloaded, and installed the live `v1.0.12` release from GitHub Releases |

The important distinction is this:

- `1.0.12` is the current source and packaging version in this repository
- `v1.0.12` is also the newest GitHub tag and the current published stable release
- the GitHub release now carries the installer, blockmap, and `latest.yml` required by `electron-updater`
- the repository is public, so `releases.atom` and `latest.yml` are reachable without GitHub authentication

The release line is now consistent end to end: package version, installer naming, updater metadata, GitHub tag, and published release assets all point at the same `1.0.12` version family.

## What Pi Desktop Does

- Runs long-lived Pi sessions per workspace
- Routes tool approvals through a desktop review flow
- Provides file references, terminal tabs, workspace switching, session history, and settings
- Uses typed IPC across main, preload, and renderer
- Supports GitHub Releases based application updates for signed Windows release builds

## Documentation Map

- [Release and auto-update guide](docs/RELEASE-AND-AUTO-UPDATE.md): what the current version is, how releases are published, what artifacts are required, and how the updater behaves
- [Contributing guide](CONTRIBUTING.md): local development workflow and contribution conventions
- [Design system](DESIGN.md): chat, settings, and desktop-surface spacing, tokens, motion, and running-state rules
- [Milestone archive](docs/RELEASE-NOTES-M1-M5.md): historical M1-M5 implementation report

## Quick Start

### Prerequisites

- Windows 10 or Windows 11
- Node.js `>= 22.19.0`
- pnpm `>= 9`
- Pi CLI installed and available on `PATH`

### Install and run

```bash
git clone https://github.com/ChisaAlter/pi-agent-desktop.git
cd pi-desktop
pnpm install
pnpm --filter @pi-desktop/desktop dev
```

### Verification commands

Use this order before pushing code:

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm --filter @pi-desktop/desktop build
```

For renderer, chat runtime, settings, overlay, or other desktop-surface changes, do not stop at repo gates. Run the matching real Electron Playwright acceptance and capture fresh screenshots in `docs/compose/acceptance/`.

Examples:

```bash
pnpm --filter @pi-desktop/desktop exec playwright test e2e/overlay-anchors.spec.ts
pnpm --filter @pi-desktop/desktop exec playwright test e2e/generated-ui-v1-acceptance.spec.ts
pnpm --filter @pi-desktop/desktop exec playwright test e2e/running-control.spec.ts
```

For updater work or release work, also build a packaged Windows artifact:

```bash
$env:PI_DESKTOP_ENABLE_AUTO_UPDATE='1'
pnpm --filter @pi-desktop/desktop package
```

## Release Model

Pi Desktop publishes Windows releases from Git tags matching `v*.*.*`.

The release pipeline is designed around these constraints:

- updater code is enabled only when the desktop main bundle is built with `PI_DESKTOP_ENABLE_AUTO_UPDATE=1`
- signed Windows publishing is mandatory for updater-enabled releases
- the GitHub release must ship the installer, installer blockmap, and `latest.yml`
- the app checks silently on startup and every 6 hours, but download and install remain explicit user actions

The operational details live in the release guide:

- [Release and auto-update guide](docs/RELEASE-AND-AUTO-UPDATE.md)

## Repository Layout

```text
pi-desktop/
|-- apps/desktop/          Electron app (main, preload, renderer)
|-- packages/shared-types/ Shared IPC and state types
|-- docs/                  Specs, release notes, release guide, screenshots
`-- .github/workflows/     CI and release automation
```

## Architecture

Pi Desktop is split into three processes:

- Main process: application lifecycle, IPC handlers, updater, sessions, approvals
- Preload: typed bridge exposed to the renderer
- Renderer: React UI, stores, settings window, terminal surfaces

The updater follows the same model:

- main process owns the single source of truth
- preload exposes typed updater APIs
- renderer consumes a single state object instead of stitching multiple event channels together

## Packaging and Updating

Windows packaging uses NSIS through `electron-builder`.

Updater-enabled release artifacts must include:

- `Pi-Desktop-<version>-setup.exe`
- `Pi-Desktop-<version>-setup.exe.blockmap`
- `latest.yml`

Packaged installs also carry `app-update.yml`, which is what `electron-updater` reads at runtime to locate GitHub release metadata.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
