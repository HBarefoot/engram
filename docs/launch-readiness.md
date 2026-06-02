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
- ⬜ **P4 — Cold install dry-run.** Fresh tmpdir → `npm i -g @hbarefoot/engram` → `engram start` → Claude Code connect → all 6 MCP tools round-trip. Document rough edges in this file.

**Test/lint baseline (2026-06-02 after P1–P3):** 209/209 tests pass, 0 lint errors, 19 pre-existing warnings.

## Code quirks surfaced during testing

- **`resolveContradiction` returns `null` for `keep_first` / `keep_second`** (`src/memory/store.js:805`). The `contradictions` table has `ON DELETE CASCADE` on both memory FKs, so when the resolve action deletes one of the memories, the contradiction row is also cascaded away. The function's final `getContradiction(db, id)` then returns null even though the side effect succeeded. The REST endpoint at `POST /api/contradictions/:id/resolve` (`src/server/rest.js:509`) should be reviewed to confirm it handles the null return correctly — otherwise the caller sees a misleading 404-like response on a successful resolve. Not a hard bug but worth a follow-up. Tests document the current behavior.

## Business model decision (Days 4–5)

- ⬜ Pick: pure OSS / open-core / dual-license. Document in `BUSINESS_MODEL.md`.

## Analytics groundwork (Days 5–7)

- ⬜ Weekly npm download snapshot (script writing to CSV).
- ⬜ GitHub Insights traffic baseline (today, pre-README change).
- ⬜ UTM tags on every link from README / Notion / launch posts.

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

## Cold-install dry-run notes

_To be filled during P4. Document anything that surprises a first-time installer._

## Competitive intel (surfaced during name hunt)

- **`sunriselabs/engrams`** (npm: `engrams@0.5.1`, james@sunriselabs.ai) — direct competitor, MCP memory layer, active. Worth a 15-min scout to understand architecture before the Phase 1.5 comparison table is finalized; if they're also in-process zero-infra the wedge needs to shift.
