# Feature parity — Web dashboard vs macOS desktop app

Engram ships two front-ends: the **web dashboard** (Vite + React 18, served by Fastify at `localhost:3838`) and the **macOS desktop app** (Tauri v2 menu-bar accessory wrapping the same npm sidecar). Both read and write the same `~/.engram/memory.db`, so memories shared between them stay in sync. The user interfaces are not identical, though, and this document explains why — and tracks the planned convergence work.

## Why two front-ends at all?

The web dashboard is what every user gets the moment they run `engram start`. It's the cross-platform surface, the lowest-friction entry point, and what shows up when an evaluator clicks through from npm or GitHub. The macOS desktop app is the always-on companion for users who use Engram daily: it lives in the menu bar, has global keyboard shortcuts, and starts on login. They are not redundant — they are different shapes of the same tool.

Some features genuinely cannot exist in a browser. Other features just happened to be built in one place first. This file separates the two cases.

## Parity matrix

### Native-only (won't ever come to the web — intentional)

These features require macOS APIs that browsers don't have. They are the *reason* the desktop app exists.

| Feature | Web | Desktop |
|---|---|---|
| Menu-bar tray icon (`ActivationPolicy::Accessory`, no Dock entry) | ❌ | ✅ |
| Global keyboard shortcuts (Cmd+D, Cmd+Shift+M, Cmd+,, Cmd+Q) | ❌ | ✅ |
| Start at login (macOS LaunchAgent plist) | ❌ | ✅ |
| Sidecar lifecycle management (spawn the npm server, auto-restart on crash, TCP port conflict detection) | ❌ | ✅ |
| System-level sound feedback ("sound on save" preference) | ❌ | ✅ |
| ChatGPT detection (reads `/Applications/ChatGPT.app`) | ❌ | ✅ |
| Tauri "Quick Add Memory" floating dialog | ❌ | ✅ |

### Desktop-first; should port to web (gap to close)

These work fine in a browser and the divergence is just "built there first." Tracked as parity backlog.

| Feature | Web | Desktop |
|---|---|---|
| Onboarding wizard (Welcome → Detect Agents → Seed Memory → Complete) | ❌ | ✅ |
| Preferences > Storage tab (export to JSON file, import from file, reset DB with two-click confirm) | ❌ | ✅ |
| Preferences > Advanced tab (REST port config, log level selector, enable/disable REST API toggle) | ❌ | ✅ |
| Cmd+K-style command palette for "Quick Add Memory" | ❌ | (via global shortcut) |

### Web-first; should port to desktop (gap to close)

These exist in the web dashboard but the desktop menu-bar doesn't surface them.

| Feature | Web | Desktop |
|---|---|---|
| Side-by-side Contradiction resolution UI (keep_first / keep_second / keep_both / dismiss) | ✅ | ❌ |
| Memory Health page with bulk-delete for never-recalled memories | ✅ | ❌ |
| Import Wizard with two-phase scan/commit flow | ✅ | ❌ |
| Statistics page with TrendsChart (recharts) | ✅ | ❌ |
| Analytics endpoints (`/api/analytics/*`) surfaced as UI | ✅ | ❌ |

### Already at parity

| Feature | Web | Desktop |
|---|---|---|
| Memory list, browse, filter | ✅ | ✅ |
| Search (hybrid semantic + FTS) | ✅ | ✅ |
| Dashboard overview / summary | ✅ | ✅ |
| Agent Integrations page (modulo source-field fix in v1.5.1) | ✅ | ✅ |
| Inline memory edit / delete | ✅ | ✅ |

## Roadmap

In rough priority order. Items get pulled from this list into specific session plans based on user feedback and acquisition signals.

**Higher leverage — close the desktop→web gap:**

1. **Onboarding wizard on web.** Lands on first visit to `localhost:3838` if `~/.engram/memory.db` has zero memories (or a `.onboarding-completed` flag is missing). Same 4 steps the desktop app uses; same REST endpoints to detect agents and seed memories.
2. **Preferences > Storage on web.** Export to JSON, import from file, reset DB — all already exposed via REST endpoints; just needs UI.
3. **Preferences > Advanced on web.** Editing REST port matters more on web than on desktop (the user is already in the browser when they want to change it).

**Higher leverage — close the web→desktop gap:**

4. **Contradiction resolution in the tray menu.** Show a count badge for unresolved contradictions; click → opens the dashboard's Conflicts page in the embedded webview.
5. **Memory Health in the tray menu.** Same pattern — count badge for never-recalled / low-confidence memories; click → opens the dashboard page.

**Lower priority:**

6. Cross-platform desktop (Windows / Linux) — separate scope; tracked in the Notion DB but not started.
7. Statistics page in the desktop window (redundant if the user can open the dashboard easily from the tray).

## How to contribute

If you're building on the parity items, please:

1. Keep the underlying REST/MCP API as the single source of truth. Both front-ends consume the same endpoints; don't add UI-only logic that would diverge them.
2. When porting a feature, leave a note in this file (move the row from "should port" to "already at parity").
3. The Tauri app source is at `desktop/`; the web dashboard at `dashboard/`. They share no React code today and that's fine — the components are small enough that duplication is cheaper than a shared package.

---

*Last updated: 2026-06-03. Maintained alongside `docs/launch-readiness.md`.*
