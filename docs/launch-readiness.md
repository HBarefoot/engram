# Launch readiness — pre-flight & Phase 1 tracker

Single source of truth for the next-30-days work from the Engram growth plan. Update statuses as items close.

## npm name decision — RESOLVED (2026-06-02)

**Chosen unscoped name:** `memgram`

- ✅ Placeholder `memgram@0.0.1` published 2026-06-02. https://www.npmjs.com/package/memgram
- ✅ Source for the placeholder package: `/Users/henrybarefoot/repos-and-projects/memgram/`
- 🟡 `engram` reclaim attempt — draft email at `/Users/henrybarefoot/repos-and-projects/memgram/.engram-reclaim-email.draft.md`. Plan: email Tom Merrihew (`tom.merrihew@gmail.com`) directly first, wait 2 weeks, then escalate to npm support if no response.

Investigation summary (full details in plan file):
- `engram` — 4-year zombie (merrihew, 2022). Reclaim attempt is non-blocking.
- `engrams` — taken AND active (sunriselabs, MCP memory layer, last update 2026-05-08). Direct competitor; **avoid one-letter collision**.
- `ngrams` — unpublish-hold until ~2027-03-15. Also NLP SEO collision.
- `ngram` — taken zombie + NLP collision.
- `enmem`, `memgram` — both free. Chose `memgram` for brand continuity.

## Pre-flight hardening (Days 1–7)

- 🟡 **P1 — Version drift fix.** Staged: ✅ `package.json` bumped 1.4.2 → 1.4.6, ✅ `CONTRIBUTING.md` versioning policy added ("npm + desktop together, dashboard decoupled"). ⬜ Pending: publish `@hbarefoot/engram@1.4.6` to npm (needs 2FA from owner).
- ✅ **P2 — Ghost reference grep.** Fixed: `src/server/mcp.js:19` (4→6 tools), `docs/ARCHITECTURE.md:314` (4→6 tools), `docs/api.md:242` (recall formula updated to `0.45/0.15/0.15/0.05 + 0.10 feedback + fts_boost`). `CLAUDE.md` was already synced earlier. README.md / examples/ checked — no stale references found. Notion pages still need pruning (out-of-repo task).
- ✅ **P3 — Minimum MCP server tests.** Added: `test/server/mcp.test.js` (18 tests across all 6 MCP tools), `test/memory/feedback.test.js` (20), `test/memory/context.test.js` (16), `test/memory/contradiction.test.js` (16). Pattern: tmpdir-per-test, model cache seeded from `node_modules/@xenova/transformers/.cache`. Test count: 139 → 209.
- ✅ **P4 — Cold install dry-run.** Executed 2026-06-03 in two passes. See "Cold-install dry-run notes" section below. Net result: install + boot + dashboard + HTTP endpoints all work cleanly. Surfaced and fixed one launch blocker (root `npm install` did not auto-install dashboard deps, so `prepublishOnly` failed on fresh checkouts) and two non-blocking observations (ignored `ENGRAM_DATA_DIR`, 615 kB JS bundle).

**Test/lint baseline (2026-06-02 after P1–P3):** 209/209 tests pass, 0 lint errors, 19 pre-existing warnings.

## Code quirks surfaced during testing

- **`resolveContradiction` returns `null` for `keep_first` / `keep_second`** (`src/memory/store.js:805`). The `contradictions` table has `ON DELETE CASCADE` on both memory FKs, so when the resolve action deletes one of the memories, the contradiction row is also cascaded away. The function's final `getContradiction(db, id)` then returns null even though the side effect succeeded. The REST endpoint at `POST /api/contradictions/:id/resolve` (`src/server/rest.js:509`) should be reviewed to confirm it handles the null return correctly — otherwise the caller sees a misleading 404-like response on a successful resolve. Not a hard bug but worth a follow-up. Tests document the current behavior.

## Business model decision (Days 4–5)

- ⬜ Pick: pure OSS / open-core / dual-license. Document in `BUSINESS_MODEL.md`.

## Analytics groundwork (Days 5–7)

- ✅ Weekly npm download snapshot — `scripts/track-downloads.sh` writes to `stats/downloads.csv`. Manual run for now; wire to cron in a later session.
- ✅ GitHub Insights traffic baseline — captured in `stats/baseline-2026-06-02.json` (4 stars, 1 fork, 29 weekly downloads, v1.4.2 on npm at snapshot time).
- ⬜ UTM tags — deferred. README has few attribution-worthy outbound links; UTM strategy is more useful for launch posts (Show HN, Reddit, etc.) in Phase 2.2.

## Phase 1 — Positioning

- ✅ **1.1 — README rewrite** (2026-06-02). New headline ("Persistent memory for AI agents. In-process. No infra."), three-bullet wedge, "Memory that improves over time" section promoted to first screen, comparison table expanded to include Letta + OpenMemory with sourced rows, all ghost CLI commands removed (`engram agents` / `connect` / `export` plain), REST endpoint table now matches actual surface (added contradictions / analytics / import endpoints), config schema corrected to match `~/.engram/config.json` defaults, programmatic-usage example added.
- ⬜ **1.3 — Directory listings** (Days 8–10). modelcontextprotocol/servers, awesome-mcp-servers, mcpservers.org, Smithery, Glama, mcp.so.
- ⬜ **1.4 — Quickstart GIF** (Days 10–13). asciinema/vhs → GIF for README.
- ⬜ **1.5 — Comparison table** folded into 1.1.

## Directory submission tracker

| Directory | Status | URL / PR | Notes |
|---|---|---|---|
| modelcontextprotocol/servers | not started | | |
| awesome-mcp-servers | not started | | |
| mcpservers.org | not started | | |
| Smithery | not started | | |
| Glama | not started | | |
| mcp.so | not started | | |

## Cold-install dry-run notes (2026-06-03)

Two passes from a fresh `mktemp` directory.

### Pass A — `npm install @hbarefoot/engram@1.4.2` (what npm serves today)

- ✅ Install in 18s. No errors. `node_modules/.bin/engram` symlinked correctly.
- ✅ `engram --version` → `1.4.2`. `engram --help` shows 10 real commands; no ghost commands (`agents`, `connect`, `audit`, `purge`, `seed`, `review`) — the spec's phantom commands were never in the actual CLI binary.
- ✅ `engram start --port <free>` boots in <0.5s. Model loads from cache in ~2s.
- ✅ `GET /health` and `GET /api/status` return well-formed JSON with version, uptime, memory counts, model status.
- 🟡 **Observation — `ENGRAM_DATA_DIR` env var is ignored.** Setting `ENGRAM_DATA_DIR=/tmp/foo` before `engram start` did NOT redirect data to that path; engram continued to use `~/.engram/memory.db`. There's no env-var or CLI flag to override `dataDir` at startup; you must write a custom `config.json` and pass `--config`. This is a usability gap for evaluators sandboxing the package. Not launch-blocking but worth a quick `--data-dir <path>` flag in a future patch.

### Pass B — local `npm pack` (what would publish as v1.4.6)

- 🔴 **BLOCKER (now fixed in `fix/build-auto-install-dashboard-deps`).** Root `npm install` does NOT auto-install the dashboard subdirectory's dependencies. `npm run build` (and therefore `prepublishOnly`) fails on a fresh checkout with `ERR_MODULE_NOT_FOUND: Cannot find package '@vitejs/plugin-react'`. CI works around this by explicitly running `npm ci` in `dashboard/` before building. Local publish would fail on a fresh clone. Fix: changed the `build` script to `cd dashboard && (test -d node_modules || npm install --no-audit --no-fund) && npm run build`. Verified: clean build 2.6s, cached build 1.25s.
- ✅ After the fix: `npm pack` succeeds, produces `hbarefoot-engram-1.4.6.tgz` with 39 files including the freshly-built `dashboard/dist/`.
- ✅ Tarball installs into a fresh tmpdir, `engram --version` returns `1.4.6`, boots cleanly on a custom port, `/health` and `/api/status` return v1.4.6, dashboard HTML serves at `/`.
- 🟡 **Observation — JS bundle is 615 kB (176 kB gzipped).** Vite warns: "chunks larger than 500 kB after minification." Code-splitting via dynamic `import()` would help, but not launch-blocking.

### Net launch posture

Once the dashboard-deps build fix lands, the cold-install path is clean. New users can `npm install -g @hbarefoot/engram@1.4.6`, run `engram start`, get a working dashboard + REST + MCP server on first try.

## Competitive intel

Full breakdown at [`docs/competitive-intel.md`](competitive-intel.md). Headline finding from session 3:

**The `engrams` package was renamed to `@sunriselabs/lodis`** (v0.6.0). The competitor we were worried about *is also in-process npx*, uses the same SQLite + all-MiniLM-L6-v2 stack, and ships 40 MCP tools to Engram's 6. The "in-process, no infra" wedge is no longer unique — Engram's honest differentiation now lives in:

- **Stability** (v1.4.x vs Lodis v0.5.x)
- **Automatic secret detection on every write** (Lodis has `memory_scrub` as an opt-in tool only)
- **Agent auto-discovery + Integration Wizard** (Lodis has manual config)
- **REST API alongside MCP** (Lodis is MCP-only)
- **macOS Tauri desktop app**
- **Smaller surface area** — 6 tools, 5 categories; easier to learn

Comparison table in `README.md` updated 2026-06-02 to reflect this honestly.
