# Competitive intel — AI agent memory layer

> Living document. Update when a competitor releases a major version or shifts positioning.
> Last refreshed: 2026-06-02.

## TL;DR

The "in-process, no-infra, MCP-native" wedge that Engram's README leans on **is not unique anymore.** Lodis (`@sunriselabs/lodis`, formerly published as `engrams`) ships the same architecture: in-process npx, SQLite, local all-MiniLM-L6-v2, MCP stdio. The honest differentiation now lives at the surface-area, safety, and stability axes — not at the architecture axis.

| Where Engram leads | Where competitors lead |
|---|---|
| Stable v1.4.x release line (Lodis is v0.5.x; Mem0/Zep/Letta require infra) | Lodis: knowledge graph, entity types, temporal supersession, 40 tools |
| Automatic secret detection on every write | Mem0/Zep/Letta: LLM-powered extraction quality |
| Agent auto-discovery + Integration Wizard (dashboard) | All except Engram: more established marketing presence |
| Desktop Tauri app (macOS) | Mem0: cloud SaaS option |
| REST API alongside MCP | Mem0/Zep/Letta: hosted team-sharing offerings |

---

## Lodis (formerly `engrams`)

- **npm package:** [`@sunriselabs/lodis`](https://www.npmjs.com/package/@sunriselabs/lodis) (current), [`engrams`](https://www.npmjs.com/package/engrams) (frozen at v0.5.1, redirected)
- **GitHub:** [`Sunrise-Labs-Dot-AI/engrams`](https://github.com/Sunrise-Labs-Dot-AI/engrams) (monorepo, `packages/mcp-server`)
- **Maintainer:** james@sunriselabs.ai
- **Last update:** 2026-05-08 (v0.5.1)
- **License:** MIT
- **Stage:** v0.5.1 — actively shipping, recent rename suggests still finding identity

### Architecture (verified from their published tarball + README)

- **Runtime:** in-process via `npx -y @sunriselabs/lodis` (same shape as Engram's `npm install -g`)
- **Storage:** SQLite/libSQL via `@libsql/client`, at `~/.lodis/lodis.db`
- **Search:** FTS5 + `sqlite-vec` extension + Reciprocal Rank Fusion (more sophisticated than Engram's weighted-sum)
- **Embeddings:** `all-MiniLM-L6-v2` via `@xenova/transformers` (~22 MB — same model Engram uses)
- **Transport:** MCP stdio
- **LLM dependency:** explicitly LLM-free on read/write paths; calling agent does semantic reasoning

### Surface area

- **40 MCP tools** vs Engram's 6. Major categories:
  - Search/read: `memory_search`, `memory_get`, `memory_find`, `memory_context`, `memory_rate_context`, `memory_briefing`
  - Write/lifecycle: `memory_write`, `memory_bulk_upload`, `memory_update`, `memory_confirm`, `memory_correct`, `memory_flag_mistake`, `memory_remove`, `memory_remove_bulk`, `memory_pin`, `memory_archive`
  - Graph: `memory_connect`, `memory_connect_batch`, `memory_propose_connections`, `memory_get_connections`
  - Classification: `memory_split`, `memory_classify`, `memory_list_entities`, `memory_list`, `memory_list_domains`
  - Permission/security: `memory_set_permissions`, `memory_scrub`
  - Progress events: `memory_write_snippet`, `memory_query_progress`, `memory_progress_summary`, `memory_register_domain`, `memory_archive_domain`
  - Onboarding/import: `memory_onboard`, `memory_interview`, `memory_import`, `memory_export`
  - Indexing: `memory_index`, `memory_index_status`
  - Misc: `memory_migrate`, `memory_tutorial`

### Data model

- **14 entity types**: person, organization, place, project, preference, event, goal, fact, lesson, routine, skill, resource, decision, snippet
- **4 permanence tiers**: canonical, active, ephemeral (TTL), archived
- **Temporal supersession**: `valid_from`, `valid_to`, `superseded_by` on facts
- **Typed relationships** between memories (true knowledge-graph layer)
- **Confidence scoring** with decay, corrections, confirmations, mistakes

### Dashboard

- Built with Next.js 15 + Tailwind v4 (Engram uses Vite + React 18)
- Runs at `localhost:3838` (same port as Engram — collision risk if a user installs both!)
- Features: memory browser with filtering, detail view with provenance + connections, inline editing, knowledge-graph visualization, cleanup/dedup, archive, entity profile pages, settings

### Distribution

- Ships as a **Claude Code plugin** at `Sunrise-Labs-Dot-AI/lodis` — installs the MCP server AND four memory skills (`/lodis:memory-retrieval`, `/lodis:memory-capture`, `/lodis:onboarding`, `/lodis:session-wrap`)
- Has a landing page at `getengrams.com` (predates the rename)

### Where they lead Engram

- Knowledge graph + entity types + temporal supersession (Engram has flat memories + contradiction-flagging only)
- 40 tools vs 6 — broader feature surface (also a weakness — more to learn)
- RRF over sqlite-vec (more principled than Engram's weighted-sum scoring)
- Claude Code plugin distribution (Engram has no plugin yet)
- Document indexing from Drive, Notion, filesystem (Engram imports from local sources only)
- Onboarding tool that scans the user's connected tools

### Where Engram leads Lodis

- **Stable v1.4.x** vs Lodis v0.5.1 alpha
- **Automatic secret detection on every write** — Engram blocks API keys/private keys/connection strings/JWTs by default; Lodis has `memory_scrub` as an opt-in tool
- **Agent auto-discovery** via the dashboard Integration Wizard
- **Desktop Tauri app** for macOS users who want a menu-bar memory layer
- **REST API** alongside MCP (Lodis is MCP-primary)
- **Simpler model** — 5 categories vs 14 entity types + 4 tiers + temporal logic. Easier to learn for users who don't need graph semantics.
- **First-class contradiction-resolution UI** with keep_first/keep_second/keep_both/dismiss workflow (Lodis has correction/supersede tools but no dedicated side-by-side conflict resolution dashboard)

### Threats / watch items

- Lodis is shipping fast and is more ambitious. The rename suggests they're still iterating brand and feature set — they could close the gap on Engram's lead axes (especially secret detection) easily.
- If users install both Engram and Lodis, they conflict on **localhost:3838** (both default to that port). Worth flagging in Engram's troubleshooting docs.
- Their Claude Code plugin distribution mechanism is a stronger discovery channel than just npm — Engram should consider publishing a similar plugin.

---

## Mem0 / OpenMemory MCP

- **Cloud SaaS:** [mem0.ai](https://mem0.ai/) — paid, $24M Series A
- **Self-hostable:** [OpenMemory](https://mem0.ai/blog/introducing-openmemory-mcp) — Docker Compose stack
- **GitHub:** [`mem0ai/mem0`](https://github.com/mem0ai/mem0) — 48k+ stars

### Architecture

- **Cloud:** their API + their infra
- **OpenMemory (self-hosted):** Docker Compose, ships an MCP server alongside
- **Stack:** typically requires Postgres + a vector DB (Qdrant / Pinecone) for self-hosted

### Where they lead Engram

- LLM-powered memory extraction
- Cloud-hosted option for users who don't want any local infra
- Established brand, large community
- Production-ready scale

### Where Engram leads Mem0

- No cloud account, no API keys
- No Docker, no Postgres
- Offline-capable
- ~23 MB footprint vs hundreds of MB of containers

*Note: not personally verified this round; carry-over from README comparison. Verify if Mem0 ships a major release before Engram's launch.*

---

## Zep

- **GitHub:** [`getzep/zep`](https://github.com/getzep/zep)
- **License:** Apache 2.0 (older versions) / commercial
- Requires Postgres + Graphiti for knowledge-graph features
- LLM-augmented memory layer with reranking

*Not personally verified this round; carry-over from README comparison.*

---

## Letta (formerly MemGPT)

- **GitHub:** [`letta-ai/letta`](https://github.com/letta-ai/letta)
- Requires Postgres + Redis-like infra
- LLM-managed memory paradigm

*Not personally verified this round; carry-over from README comparison.*

---

## Revised positioning for Engram

The README's "in-process, no infra" headline needs softening — Lodis matches it. Two viable framings:

1. **"Focused"**: Engram is the smaller, lean alternative for users who want a memory layer without a knowledge graph. 6 tools, 5 categories. Easy to learn, easy to compose, easy to outgrow.
2. **"Practical with guardrails"**: Engram ships secret detection, agent auto-discovery, REST API, and a desktop app out of the box. Production touches Lodis hasn't built yet.

Both are honest. The README comparison table should pivot toward feature/safety rows where Engram leads, away from architecture rows where the two now tie.

## Action items

- ✅ Add Lodis as a column in the README comparison table (session 3 commit `d505068`)
- ✅ Mitigate the localhost:3838 port collision — `startRESTServer` now auto-falls back to the next available port in `[port, port+4]` and logs the chosen port loudly. CLI prints a yellow warning when fallback fires. See `src/server/rest.js` `findAvailablePort` helper (session 4).
- ⬜ Watch Lodis releases — if they add automatic secret detection or an Integration Wizard, refresh this doc
- ⬜ Consider shipping a Claude Code plugin for Engram (parallel to Lodis's `lodis@lodis-official` plugin) — Phase 2 work
