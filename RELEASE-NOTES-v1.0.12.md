# Pi Desktop v1.0.12

Pi Desktop v1.0.12 closes the GitHub updater loop for Windows releases and is now published on GitHub as the current stable Windows build.

## Release status

As of 2026-06-27:

- source version is `1.0.12`
- remote tag is `v1.0.12`
- repository visibility is `public`
- GitHub stable release `v1.0.12` is published
- published assets are:
  - `Pi-Desktop-1.0.12-setup.exe`
  - `Pi-Desktop-1.0.12-setup.exe.blockmap`
  - `latest.yml`
- release page: `https://github.com/ChisaAlter/pi-agent-desktop/releases/tag/v1.0.12`
- anonymous release feed URLs now return `200`, which is required for end-user `electron-updater` checks

## Included in this release

- GitHub Releases based updater state model shared across main, preload, and renderer
- Settings > About update card with:
  - check for updates
  - download update
  - restart to install
  - progress display
  - visible disabled and error states
  - GitHub Releases fallback button
- Dedicated updater IPC handlers and renderer store
- Packaged updater error normalization so production errors stay readable
- Release workflow signing guard and corrected artifact upload paths
- Release workflow short-path packaging fix for GitHub Windows runners, including NSIS include restoration and mirrored short-workspace packaging
- Repository visibility correction so GitHub `releases.atom` and `latest.yml` are reachable without maintainer authentication
- CI and release `pnpm` version alignment with the repository `packageManager`
- Installer naming aligned with `latest.yml`

## Published release assets

- `Pi-Desktop-1.0.12-setup.exe`
- `Pi-Desktop-1.0.12-setup.exe.blockmap`
- `latest.yml`

## Verification

- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r test`
- `PI_DESKTOP_ENABLE_AUTO_UPDATE=1 pnpm --filter @pi-desktop/desktop build`
- `PI_DESKTOP_ENABLE_AUTO_UPDATE=1 pnpm --filter @pi-desktop/desktop package`
- real packaged acceptance: `1.0.11` updater state discovered `1.0.12`, downloaded the installer, and the installed app came up as `1.0.12`

## Notes

This release is the first Pi Desktop stable release where the GitHub updater contract is closed end to end: source version, packaged app metadata, signed Windows release asset, public GitHub release feed, blockmap, and `latest.yml` are all aligned on `1.0.12`.
