# Changelog

All notable changes to Engram are documented here. Versions follow [Semantic Versioning](https://semver.org/).

Versions marked *(unpublished)* exist in git history but were never released to npm — the next release rolled them up cumulatively. Both lines are kept so the git log and the published release history stay legible.

## [Unreleased]

## [1.6.6] - 2026-06-27

### Changed

- **Enriched MCP tool definitions for clarity and tool-selection reliability.** Rewrote the
  descriptions and parameter docs for all six tools (`engram_remember/recall/forget/feedback/context/status`)
  to document return shapes, edge cases (dedup outcomes, FTS fallback, empty results), and
  when-to-use guidance, and added `minimum`/`maximum` annotations on numeric params. No behavioral
  or schema change — parameter names, types, enums, defaults, and `required` arrays are unchanged.
  Improves Glama's Tool Definition Quality Score and helps agents pick the right tool. (`src/server/mcp.js`, PR #44.)

## [1.6.5] - 2026-06-26

### Added

- **Live menu-bar tray status.** The tray dropdown's "Status" and "Memories" items (and the tray
  tooltip) now update with the real sidecar state and memory count on the existing 30s health-check
  loop, instead of showing a hardcoded "Status: Running" / "Memories: ...". Reflects
  Running/Starting/Stopped/Crashed and the live count. (`desktop/src-tauri/src/tray.rs`,
  `desktop/src-tauri/src/sidecar.rs`.)

### Fixed

- **Desktop onboarding "seed" step now actually imports.** The wizard's claude-files / git-config /
  package.json checkboxes were collected but ignored by the backend, so they did nothing. Completing
  onboarding now runs the selected sources through the existing REST import flow
  (`/api/import/scan` + `/api/import/commit`) and seeds the chosen memories. Also removed the dead
  `SeedOptions` Rust struct and the unused `update_tray_status` function (clears the two build-time
  dead-code warnings). (`desktop/src/pages/Onboarding.tsx`, `desktop/src-tauri/src/commands.rs`,
  `desktop/src-tauri/src/tray.rs`.)

## [1.6.4] - 2026-06-26

### Fixed

- **Desktop app now discovers the server's actual port instead of assuming 3838.** The bundled sidecar
  starts on 3838 but falls back to 3839–3842 when that port is busy (`findAvailablePort` in
  `src/server/rest.js`), and the Tauri shell never reported the chosen port back to the UI — so every
  tab showed "Load failed" and the status read "Disconnected" whenever the fallback fired. The desktop
  frontend now probes the 3838–3842 range on startup and re-discovers on any failed health poll.
  (`desktop/src/lib/api.ts`, `desktop/src/components/Sidebar.tsx`.)
- **Removed the editable "REST API Port" field from desktop Settings.** The bundled sidecar always
  launches on 3838 (ignoring this preference), so a stale/custom value here pointed the UI at a dead
  port and produced the same "Load failed" on every tab — with no indication why. The field is now a
  read-only display of the auto-detected port; the app finds the live server on its own.
  (`desktop/src/pages/Preferences.tsx`, `desktop/src/lib/api.ts`.)
- **A bare `node bin/engram.js` (no subcommand) now boots the MCP stdio server when stdin is not a
  TTY.** MCP proxies/registries (Glama's introspection, `mcp-proxy`) spawn the entry point with no args
  over a pipe and expect a JSON-RPC server; Commander's default was to print help and exit, which they
  read as "connection closed". Now a non-interactive bare invocation behaves as `start --mcp-only`,
  while an interactive `engram` in a terminal still shows help and explicit subcommands are untouched.
  (`src/utils/mcp-default.js`, tested in `test/cli/mcp-default.test.js`.)

### Changed

- **Desktop release artifacts now ship with every GitHub Release.** `desktop-build.yml` previously
  triggered only on a separate `desktop-v*` tag, which was easy to forget — v1.6.1, v1.6.2, and v1.6.3
  shipped no macOS `.dmg` as a result. It now triggers on `release: published` (the same event as the
  npm `publish.yml`) and attaches both the `.dmg` and the zipped `.app` to the triggering release, so a
  single `vX.Y.Z` release ships npm and desktop together.

## [1.6.3] - 2026-06-24

### Fixed

- **Corrected the MCP server namespace casing to `io.github.HBarefoot/engram`** (was lowercased in
  1.6.2). The MCP Registry derives the publish namespace from the canonical GitHub username and matches
  `mcpName` case-sensitively, so the lowercase `mcpName` in 1.6.2 was rejected on publish. `server.json`
  and `package.json` `mcpName` now use the canonical casing. Metadata only — no runtime change.

## [1.6.2] - 2026-06-23

### Added

- **MCP Registry + Glama launch.** Added `server.json` (the MCP Registry manifest, server name
  `io.github.hbarefoot/engram`), the `mcpName` field in `package.json` (registry npm-ownership
  verification), and an MCP-only stdio `Dockerfile` + `.dockerignore` so the registry and Glama can
  introspect the server via `tools/list`. No runtime code change — packaging/metadata only. Engram is
  now publishable to the [MCP Registry](https://registry.modelcontextprotocol.io) and installable by
  Glama (which boots the stdio server in a clean Linux image — green now that `sharp` is off the boot
  path, see 1.6.1).

## [1.6.1] - 2026-06-23

### Fixed

- **MCP stdio server no longer crashes at startup when `sharp` can't load.** `sharp` is a
  transitive native dependency of `@xenova/transformers` (the embedding library), and a top-level
  `import` in `src/embed/index.js` dragged it onto the MCP boot path (`bin/engram.js` → `mcp.js` →
  `recall`/`context` → `embed`). On platforms where sharp's prebuilt binary won't resolve (clean
  Debian/`trixie-slim`, ARM macOS, Windows, Alpine/musl) the process died with
  *"Cannot find module sharp-linux-x64.node"* before completing the MCP handshake — breaking
  `npx`/install for real users and the Glama listing alike. `@xenova/transformers` is now lazy-loaded
  only when an embedding is actually generated, so the stdio server boots with no image libs on the
  load path; if the embedding stack later fails to load, recall falls back to FTS-only and remember
  stores without an embedding (no crash). Regression-tested in `test/server/mcp-boot-no-sharp.test.js`.

## [1.6.0] - 2026-06-07

First release carrying the **"Cortex" design system** and **"Bloom" logo** to published
artifacts — the redesign was merged after v1.5.3 but never shipped. Both the npm Web UI
and the macOS desktop app now render the new brand.

### Added

- **"Cortex" design system + "Bloom" logo across the web dashboard and desktop app.**
  New single dark theme (deep blue-black surfaces, indigo `#6d7bff` → cyan `#34e0e0`
  gradient accents), Space Grotesk display + IBM Plex Sans/Mono type, a sidebar+topbar
  dashboard shell (replacing the old top-tabs), and centralized category colors. The
  Bloom mark, icon set, favicons, tray icons, and `.icns` are generated from the two
  canonical SVGs in `assets/brand/` via `scripts/generate-brand.js`. Fonts are
  self-hosted (24 woff2) to preserve the zero-network/offline guarantee — no CDN links.
  See [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). [#29](https://github.com/HBarefoot/engram/pull/29)

### Changed

- **Desktop bundle now also emits a `.dmg` installer** (`bundle.targets` =
  `["app", "dmg"]`), alongside the raw `.app`. The app remains unsigned by design — clear
  Gatekeeper after install with `xattr -cr /Applications/Engram.app`.

### Fixed

- **CLA Assistant writes signatures to this repo** instead of a remote, dropping the PAT
  requirement for the contribution flow. [#30](https://github.com/HBarefoot/engram/pull/30)

## [1.5.3] - 2026-06-03

This release bundles three independent improvements (PRs #23, #24, #25). Each was reviewed separately; bundling the version bump keeps the npm release history tidier.

### Added

- **Onboarding wizard on the web dashboard.** First-time visitors (empty database + no `engram.onboarding.completed` localStorage flag) now land on a 4-step wizard — Welcome → Connect your AI agent → Seed a memory → Done — instead of a blank dashboard. Closes the highest-priority gap from `docs/feature-parity.md`. The wizard is lazy-loaded (~8.6 kB chunk); main bundle is unchanged. [#25](https://github.com/HBarefoot/engram/pull/25)
- This `CHANGELOG.md`. Entries for v1.4.x and v1.5.x backfilled from git history; future releases land entries with their PRs. [#23](https://github.com/HBarefoot/engram/pull/23)

### Changed

- **Contradictions FK switched from `ON DELETE CASCADE` to `ON DELETE SET NULL`.** Resolved contradictions now survive in the database after `keep_first` / `keep_second` deletes the not-kept memory — `listContradictions({ status: 'resolved' })` returns real history instead of always-zero. The migration is idempotent (gated by a `contradictions_fk_set_null_v1` meta flag) and uses the standard SQLite table-rebuild dance in a single transaction. [#24](https://github.com/HBarefoot/engram/pull/24)
- **Centralized similarity thresholds.** `src/memory/constants.js` now exports `SIMILARITY_THRESHOLDS = { REDUNDANT: 0.85, MERGE: 0.92, DUPLICATE: 0.95 }`; `store.js`, `analytics.js`, and `consolidate.js` import from it. The threshold-mismatch class of bugs (e.g. the "Merge N duplicates" no-op fixed in v1.5.2) is now structurally prevented — module-local hardcoded thresholds are gone. [#23](https://github.com/HBarefoot/engram/pull/23)

## [1.5.2] - 2026-06-03

### Fixed

- Dashboard folder-icon SVG arc-path was malformed (`h14a 2 0 002-2` missing the ry), throwing `<path> attribute d: Expected arc flag` in the browser console on every dashboard load. [#22](https://github.com/HBarefoot/engram/pull/22)
- "Merge N duplicates" button on the Memory Health page reported "Removed 0" because the merge call ran at threshold 0.92 while the displayed count came from 0.85. Dashboard now passes the matching threshold. [#22](https://github.com/HBarefoot/engram/pull/22)

## [1.5.1] - 2026-06-03 *(unpublished, rolled into 1.5.2)*

### Fixed

- All four memory REST endpoints (`GET /api/memories`, `GET /api/memories/:id`, `POST /api/memories`, `POST /api/memories/search`) were dropping the `source` field from their response payloads. Dashboard's Agent Integrations page therefore showed every memory under "Unknown" instead of grouping by actual source (`import:claude`, `mcp`, `cli`, etc.). [#19](https://github.com/HBarefoot/engram/pull/19)

## [1.5.0] - 2026-06-03 *(unpublished, rolled into 1.5.2)*

### Added

- `--data-dir <path>` CLI flag and `ENGRAM_DATA_DIR` environment variable, recognized by every Engram command that touches the database (`start`, `remember`, `recall`, `forget`, `list`, `status`, `consolidate`, `conflicts`, `export-context`, `import`). Lets evaluators sandbox their first run without writing a custom `config.json`. Override priority: flag > env > `config.json` > default (`~/.engram`). [#18](https://github.com/HBarefoot/engram/pull/18)

### Changed

- Dashboard JavaScript now code-splits per page via `React.lazy()`. Initial JS payload dropped from 615 kB to ~163 kB (4× smaller first paint); Vite's chunk-size-too-large warning is gone. Each page chunk loads on demand. [#18](https://github.com/HBarefoot/engram/pull/18)

### Fixed

- `resolveContradiction` returned `null` for `keep_first` / `keep_second` actions because the `ON DELETE CASCADE` on the contradictions table removed the row before the function could re-query. Now snapshots the contradiction at the top and returns the snapshot with the resolved-state overlaid. The schema-level fix (FK → `ON DELETE SET NULL`) is tracked as a separate follow-up. [#18](https://github.com/HBarefoot/engram/pull/18)

## [1.4.7] - 2026-06-02

### Added

- Website badge in README linking to <https://next.henrybarefoot.com/engram>. [#17](https://github.com/HBarefoot/engram/pull/17)
- Hero quickstart GIF under the install block, recorded via `vhs docs/quickstart.tape`. [#17](https://github.com/HBarefoot/engram/pull/17)

### Changed

- `package.json` `homepage` repointed from the GitHub README to the polished landing page. The npm registry now surfaces the landing page on the package detail view. [#17](https://github.com/HBarefoot/engram/pull/17)
- Applied `npm pkg fix` — `repository.url` normalized to the `git+https://` form, eliminating the warning shown on every publish. [#17](https://github.com/HBarefoot/engram/pull/17)

## [1.4.6] - 2026-06-02

### Added

- `BUSINESS_MODEL.md` documenting the public commitments: MIT forever, no paywalls, no open-core, no usage caps, no telemetry. License-audit results included. [#15](https://github.com/HBarefoot/engram/pull/15)
- `.github/FUNDING.yml` with GitHub Sponsors entry. [#15](https://github.com/HBarefoot/engram/pull/15)
- `docs/competitive-intel.md` — living document covering the Lodis / Mem0 / Zep / Letta landscape with verified architecture details and an honest "where each fits" comparison. [#12](https://github.com/HBarefoot/engram/pull/12)
- Analytics groundwork: `scripts/track-downloads.sh` (per-snapshot CSV) and `stats/baseline-2026-06-02.json` (Phase 1 reference point). [#12](https://github.com/HBarefoot/engram/pull/12)
- `docs/feature-parity.md` — matrix of which features are native-only vs gap-to-close between the web dashboard and the macOS desktop app. [#20](https://github.com/HBarefoot/engram/pull/20)
- Auto-fallback to next free port on REST API startup. If `localhost:3838` is taken, scan `[3838, 3842]` for an available port and bind there. Originally to avoid collision with Lodis (same default port); now general-purpose. [#13](https://github.com/HBarefoot/engram/pull/13)
- Quickstart VHS tape script (`docs/quickstart.tape`) and recording instructions (`docs/quickstart.md`). [#16](https://github.com/HBarefoot/engram/pull/16)
- Six MCP-directory listing drafts under `docs/listings/` for `modelcontextprotocol/servers`, `awesome-mcp-servers`, `mcpservers.org`, Smithery, Glama, and `mcp.so`. [#16](https://github.com/HBarefoot/engram/pull/16)
- Vitest suites for the MCP server (all 6 tools), feedback loop, context generator, and contradiction CRUD/resolve. Test count went from 139 to 209. (multiple PRs)
- README rewrite around the "in-process, no infra" wedge with a Lodis-aware honest comparison table. CLAUDE.md synced to current code reality. [#12](https://github.com/HBarefoot/engram/pull/12)

### Fixed

- Root `npm install` did not auto-install dashboard subdirectory deps; `prepublishOnly` would fail on a fresh clone. Build script now installs dashboard deps lazily if missing. [#14](https://github.com/HBarefoot/engram/pull/14)
- Stale ghost references in source comments and docs (4-tool MCP count, missing `src/discover/agents.js`, old recall scoring weights). All synced to current reality.

### Changed

- Dependency license audit completed: 397 packages, all permissive (MIT 307, Apache-2.0 27, ISC 27, BSD 25, BlueOak 6, plus a few niche permissive). Zero GPL/AGPL/SSPL. Result documented in `BUSINESS_MODEL.md` and `docs/license-audit-2026-06-03.txt`.

## [1.4.2] - 2026-02-11

First public npm release. The development history prior to 1.4.2 is in git but not summarized here.
