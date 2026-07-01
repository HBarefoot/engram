# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Engram** is a lightweight, embeddable memory layer that gives AI agents persistent, cross-session memory. It's designed as "SQLite for agent state" - any agent framework can plug into it.

**Core Concept:** Engram is NOT a RAG system, vector database, or chatbot. It answers "what does this specific person need me to know right now, given everything I've learned about how they work?" - like a colleague who's worked with you for years.

## Tech Stack

- **Runtime:** Node.js 20+ (ESM modules)
- **Database:** better-sqlite3 (synchronous, embedded, zero-config)
- **Embeddings:** all-MiniLM-L6-v2 via @xenova/transformers (~23MB, CPU-only)
- **MCP Server:** @modelcontextprotocol/sdk (primary interface)
- **REST API:** Fastify
- **CLI:** Commander.js
- **Dashboard:** React 18 + Tailwind CSS 3 + Vite
- **Testing:** Vitest

**Critical Constraints:**
- Plain JavaScript only (no TypeScript in v1)
- No Express (use Fastify)
- No ORMs (raw SQL with better-sqlite3)
- No cloud dependencies, Docker requirements, or Python dependencies
- Must work fully offline

## Architecture

Three-layer architecture:

```
INTERFACES: MCP Server (primary) | REST API | CLI | GUI
     ↓
CORE ENGINE: extract/ | memory/ | embed/
     ↓
STORAGE: ~/.engram/memory.db (SQLite) | config.json | models/
```

### Core Components

- **memory/store.js** - SQLite CRUD operations
- **memory/recall.js** - Hybrid search (embedding similarity + FTS + recency)
- **memory/consolidate.js** - Duplicate detection, decay, contradiction flagging
- **extract/rules.js** - Zero-dependency rule-based fact extraction
- **extract/secrets.js** - Secret/sensitive data detection (CRITICAL: never store API keys)
- **embed/index.js** - Embedding generation + model management (lazy download)
- **memory/feedback.js** - Per-memory helpful/unhelpful votes; derives `feedback_score`, may auto-adjust confidence
- **memory/context.js** - Backs the `engram_context` MCP tool; markdown/xml/json/plain output with token budgeting
- **memory/health.js**, **memory/analytics.js** - Back the dashboard Health/Statistics pages and `/api/analytics/*` endpoints
- **server/mcp.js** - MCP server with 6 tools (remember, recall, forget, feedback, context, status)
- **server/rest.js** - Fastify REST API + dashboard serving
- **import/** - Document import: `wizard.js`, `index.js`, and 8 parsers under `parsers/` (cursorrules, claude, package, git, ssh, shell, obsidian, env)

Agent auto-discovery is **not** in `src/discover/` — it lives in the dashboard (`IntegrationWizard`, `PlatformSelector`, `ConfigGenerator`) and is served by the REST endpoint `GET /api/installation-info` plus the `/api/import/*` flow.

## Development Commands

### Setup & Running
```bash
npm install                   # Install dependencies
npm start                     # Start Engram (MCP + REST + Dashboard)
npm run mcp                   # Start MCP server only (stdio mode)
npm run dev                   # Dev mode (server + dashboard hot reload)
```

### Building & Testing
```bash
npm run build                 # Build React dashboard to dashboard/dist/
npm test                      # Run tests in watch mode
npm run test:run              # Run tests once
npm run lint                  # Lint source files
```

### CLI Commands (after build)
```bash
engram start                  # Start server
engram start --mcp-only       # MCP server only
engram start --port 3838      # Custom port

engram remember "content"     # Store a memory (-c category -e entity --confidence -n namespace)
engram recall "query"         # Recall memories (-l limit -c category -n namespace --threshold)
engram forget <id>            # Delete a memory
engram list                   # List all memories (-l limit --offset -c category -n namespace)
engram status                 # Health check

engram consolidate            # Run consolidation (--no-duplicates|--no-contradictions|--no-decay|--cleanup-stale)
engram conflicts              # List unresolved contradictions
engram audit                  # Read-only health + secret scan (-n namespace --json --fix); exits non-zero if secrets found
engram purge                  # Bulk delete, dry-run by default (--namespace/--project --stale --before <date> --all --yes; backs up first)
engram encrypt                # Encrypt memory.db at rest (opt-in; needs ENGRAM_DB_KEY + the cipher build; backs up plaintext first)
engram rekey <newKey>         # Rotate the encryption key (current key in ENGRAM_DB_KEY)
engram export-context         # Export a curated context block (-o -f markdown|claude|txt|json -c --min-confidence ...)
engram import                 # Import from local sources (-s source --dry-run -n namespace -p paths)
```

Agent connection (`engram agents` / `engram connect <agent-id>`) is **not** a CLI subcommand — drive it from the dashboard's Agents/Import pages or the REST `/api/import/*` endpoints.

## Database Schema

Located at `~/.engram/memory.db` (WAL mode, foreign keys on).

```sql
memories (
  id TEXT PRIMARY KEY,              -- UUIDv4
  content TEXT NOT NULL,            -- Memory text
  entity TEXT,                      -- What/who this is about
  category TEXT NOT NULL DEFAULT 'fact', -- preference|fact|pattern|decision|outcome
  confidence REAL NOT NULL DEFAULT 0.8,  -- 0.0 to 1.0
  embedding BLOB,                   -- Float32Array as Buffer
  source TEXT DEFAULT 'manual',     -- Which agent/source created this
  namespace TEXT DEFAULT 'default', -- Project/scope isolation
  tags TEXT DEFAULT '[]',           -- JSON array
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL,
  last_accessed INTEGER,
  access_count INTEGER DEFAULT 0,
  decay_rate REAL DEFAULT 0.01,
  feedback_score REAL DEFAULT 0.0,  -- Aggregated helpful/unhelpful score, [-1, 1]
  extraction_method TEXT DEFAULT 'rules' -- 'rules' | 'llm' (which extractor produced category/entity)
)

memory_feedback (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,          -- FK → memories.id ON DELETE CASCADE
  helpful INTEGER NOT NULL,         -- 1 = helpful, 0 = unhelpful
  context TEXT,
  created_at INTEGER NOT NULL
)

contradictions (
  id TEXT PRIMARY KEY,
  memory1_id TEXT NOT NULL,         -- FK → memories.id ON DELETE CASCADE
  memory2_id TEXT NOT NULL,         -- FK → memories.id ON DELETE CASCADE
  confidence REAL NOT NULL DEFAULT 0.5,
  reason TEXT,
  category TEXT,
  entity TEXT,
  status TEXT NOT NULL DEFAULT 'unresolved', -- unresolved|resolved|dismissed
  detected_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution_action TEXT            -- keep_first|keep_second|keep_both|dismiss
)

meta (
  key TEXT PRIMARY KEY,             -- kv table for one-shot migration flags
  value TEXT                        --   e.g. 'contradictions_migrated' -> ISO date
)
```

Uses FTS5 (`memories_fts` contentless mirror over content/entity/tags) with three triggers (`memories_ai/ad/au`) that keep the index in sync on insert/delete/update.

Nine indexes on `memories` (category, entity, namespace, confidence, created_at, last_accessed, feedback_score, namespace+created_at composite, plus feedback FK) and four on `contradictions` (status, memory1, memory2, detected_at).

A one-shot migration (`migrateTagConflicts` in `memory/store.js`) rolls legacy `conflict_*` tag pairs into the `contradictions` table on first run, gated by the `meta` table.

## Memory Categories

- **preference** - User likes/dislikes (e.g., "prefers Fastify over Express")
- **fact** - Objective truth about setup (e.g., "uses PostgreSQL 15")
- **pattern** - Recurring workflow (e.g., "deploys via GitHub Actions")
- **decision** - Choice made and rationale (e.g., "switched to ESM because...")
- **outcome** - Result of an action (e.g., "migration to Vite improved build time")

## Recall Algorithm

Hybrid scoring system (`src/memory/recall.js`):
1. Generate embedding for query
2. Fetch candidates (FTS5 top 20 ∪ all in-namespace embeddings, optionally filtered by `time_filter`)
3. Score each: `(similarity×0.45) + (recency×0.15) + (confidence×0.15) + (access×0.05) + (feedback×0.10) + fts_boost`
   - `similarity` = cosine of query embedding vs memory embedding
   - `recency` = `1 / (1 + days_since_last_access × decay_rate)`
   - `access` = `min(access_count / 10, 1)`
   - `feedback` = `memory.feedback_score` (raw `[-1, 1]`) normalized to `[0, 1]` via `(x+1)/2`
   - `fts_boost` = 0.1 if the memory also appeared in the FTS top-20, else 0
4. Filter by category (if given) and by `threshold` (default 0.3)
5. Sort descending, return top N (default 5)
6. Update `last_accessed` and `access_count` for returned memories

Graceful fallback: if embedding generation fails, recall falls back to FTS-only with a position-based score. Returned arrays carry ad-hoc `timeRange` and `totalInRange` properties when a `time_filter` was applied.

## Implementation Order (historical)

The original phased build plan (Phase 1 Core → Phase 6 Polish) has been delivered. The project is now in post-1.4 maintenance: feedback loop, contradiction detection + resolution UI, analytics endpoints, health dashboard, import wizard with 8 parsers, and a Tauri desktop wrapper have all shipped on top of the original scope. Treat this section as context for "why is the code laid out this way", not as a TODO.

## Contradictions

When two memories about the same entity/category conflict, consolidation writes a row into the `contradictions` table rather than tagging memories with a `conflict_*` tag (legacy approach). The dashboard "Conflicts" page surfaces unresolved rows and lets the user resolve each one:

- `keep_first` — delete `memory2`, mark contradiction `resolved`
- `keep_second` — delete `memory1`, mark contradiction `resolved`
- `keep_both` — leave both memories, mark contradiction `resolved`
- `dismiss` — leave both, mark contradiction `dismissed`

`resolveContradiction` in `memory/store.js` performs the side-effect deletes. The MCP server itself does **not** expose contradiction resolution — drive it from the dashboard or `POST /api/contradictions/:id/resolve`.

## REST API Surface (`src/server/rest.js`)

Fastify, mounted at `localhost:3838` by default. Endpoints (paths only; see file for schemas):

- **System**: `GET /health`, `GET /api/status`, `GET /api/installation-info`
- **Memories CRUD**: `POST /api/memories`, `GET /api/memories`, `POST /api/memories/search`, `GET /api/memories/:id`, `DELETE /api/memories/:id`, `POST /api/memories/bulk-delete`
- **Maintenance**: `POST /api/consolidate`, `GET /api/conflicts` (legacy tag-based view)
- **Contradictions**: `GET /api/contradictions`, `POST /api/contradictions/:id/resolve`, `GET /api/contradictions/count`
- **LLM layer**: `GET/PUT /api/config/llm` (apiKey redacted to `hasApiKey` on GET), `POST /api/llm/test`, `GET /api/llm/status` (live reachability/model/latency; throttled ≤1 probe/30s), `GET /api/llm/stats` (counters + recent-events feed from `src/llm/stats.js`)
- **Analytics**: `GET /api/analytics/{overview,stale,never-recalled,duplicates,trends}`
- **Export**: `POST /api/export/static`
- **Import**: `GET /api/import/sources`, `POST /api/import/scan`, `POST /api/import/commit`
- **Static**: dashboard served from `dashboard/dist` via `@fastify/static`

## Critical Quality Rules

1. **Zero external network calls** - Must work fully offline by default
2. **Never store secrets** - Run secret detection on EVERY memory (security-critical)
3. **Never crash the MCP server** - Wrap all tool handlers in try/catch
4. **Conservative memory extraction** - Better 10 high-confidence than 200 noisy memories
5. **Token budget discipline** - Default recall returns max 5 memories (~500 tokens)
6. **Graceful degradation** - If embeddings fail → FTS → basic LIKE query
7. **Idempotent operations** - Check for duplicates (>0.92 similarity) before insert
8. **Back up before modifying** - Always create timestamped backup when writing agent configs
9. **Clean, readable code** - Flat modules, exported functions, JSDoc comments
10. **Tests for core logic** - Memory store, recall, secret detection, extraction MUST have tests

## MCP Server Details

Primary interface for AI agents. Implements 6 tools via stdio transport (`src/server/mcp.js`):

- **engram_remember** — Store a memory with `content`, optional `category|entity|confidence|namespace|tags|force`. Runs secret detection (`validateContent`), auto-extracts category/entity if missing, generates an embedding, then `createMemoryWithDedup` which can return `created`, `merged` (≥0.92 cosine), or `duplicate` (≥0.95 cosine, rejected unless `force: true`).
- **engram_recall** — Retrieve relevant memories by semantic query. Supports `query|limit|category|namespace|threshold|time_filter` (the latter accepts `after`/`before` ISO or relative strings, or a `period` shorthand like `last_week`).
- **engram_forget** — Delete a memory by ID.
- **engram_feedback** — Vote on a recalled memory's helpfulness (`memory_id` + `helpful: boolean` + optional `context`). Updates `feedback_score`; may adjust the memory's `confidence`.
- **engram_context** — Pre-formatted context block for system-prompt injection. Supports `query?|namespace|limit|format: markdown|xml|json|plain|include_metadata|categories|max_tokens`.
- **engram_status** — Health check + stats (memory counts by category/namespace, model status, config summary).

Every handler is wrapped in a single outer try/catch that converts thrown errors into `{ content: [{ type: 'text', text: 'Error: …' }] }` rather than crashing the server. Tool responses always follow that MCP `content` shape. `SIGINT`/`SIGTERM` close the DB and exit cleanly.

## Secret Detection

The extract/secrets.js module MUST reject:
- API keys (patterns: sk-, pk_, AKIA, ghp_, xoxb-, etc.)
- Passwords and tokens
- Private keys (BEGIN RSA/EC/OPENSSH PRIVATE KEY)
- Connection strings with credentials
- AWS credentials, GCP service account keys
- .env values that look like secrets

Reject memory entirely or redact secret portions. Log warnings.

## Agent Auto-Discovery

Implemented in the dashboard (`dashboard/src/components/IntegrationWizard.jsx`, `PlatformSelector.jsx`, `ConfigGenerator.jsx`, with platform data in `dashboard/src/data/platformConfigs.js`) and served by the REST endpoints `GET /api/installation-info` and `POST /api/import/{scan,commit}`. There is **no** `src/discover/agents.js`.

Detects and connects to:
- Claude Code (~/.claude/mcp.json)
- Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json)
- Cursor (~/.cursor/mcp.json)
- Windsurf (~/.windsurf/mcp.json)
- n8n (REST adapter, port 5678)
- Ollama (REST adapter, port 11434)

Connection flow:
1. Read existing MCP config
2. Create backup: config.json → config.json.engram-backup-{timestamp}
3. Deep-merge engram server entry
4. Write updated config
5. NEVER overwrite/remove existing MCP servers

## File Structure Reference

Key directories:
- `bin/` — CLI entry point (`engram.js`)
- `src/` — Core implementation
  - `server/` — `mcp.js` (6 stdio tools) + `rest.js` (Fastify, serves dashboard static)
  - `memory/` — `store.js`, `recall.js`, `consolidate.js`, `feedback.js`, `context.js`, `health.js`, `analytics.js`
  - `extract/` — `rules.js` (category/entity extraction), `llm.js` (`extractMemoryLLM` wrapper), `secrets.js` (secret detection)
  - `llm/` — `index.js` (opt-in local LLM client: `isLLMEnabled`/`llmComplete`/`testLLM`), `stats.js` (in-process observability tracker)
  - `embed/` — `index.js` (lazy `@xenova/transformers` loader, cosine similarity)
  - `import/` — `index.js`, `wizard.js`, and `parsers/{cursorrules,claude,package,git,ssh,shell,obsidian,env}.js`
  - `export/` — `static.js` (engram-context export)
  - `config/` — Configuration loader
  - `utils/` — `id.js`, `logger.js`, `time.js` (time-filter parser), `format.js`
- `dashboard/` — React 18 + Vite + Tailwind. Pages: Dashboard, MemoryList, SearchMemories, Agents, Statistics, MemoryHealth, Contradictions, Download, ImportWizard. Agent auto-discovery lives here. Styled with the "Cortex" design system (`src/design-system.css` tokens + components, sidebar shell in `App.jsx`, single dark theme).
- `desktop/` — Tauri v2 wrapper (own `package.json`, kept in lockstep with npm at v1.5.3). Cortex tokens in `src/styles/globals.css`.
- `assets/brand/` — canonical brand sources: `engram-mark.svg` (flat), `engram-icon.svg` (gradient tile), and self-hosted `fonts/`. See `DESIGN_SYSTEM.md`.
- `test/` — Vitest tests
- `docs/` — Architecture, API, MCP setup, PM2 deployment guides
- `examples/` — `api-client.js`, `basic-usage.js`
- `scripts/build-sidecar.js` — Tauri sidecar compilation helper
- `scripts/generate-brand.js` — renders the Bloom mark to all icon/favicon/tray rasters + `.icns` (run after editing the brand SVGs)
- `DESIGN_SYSTEM.md` — the Cortex design system (tokens, mark, fonts, category colors, component classes)
- `ecosystem.config.cjs` — PM2 process manager config

## Testing Strategy

- **Core logic tests required:** memory/store, memory/recall, extract/rules, extract/secrets
- **REST endpoint tests required:** server/rest
- **Manual testing acceptable for v1:** UI components, CLI commands
- Use Vitest with ESM-native configuration
- Test fixtures in test/fixtures/

## Configuration

Located at `~/.engram/config.json`. All fields optional with defaults.

Key settings:
- `port` — REST API port (default: 3838)
- `dataDir` — Storage location (default: ~/.engram)
- `defaults.namespace` — Default memory namespace (default: `default`)
- `defaults.recallLimit` — Max recall results (default: 5)
- `defaults.confidenceThreshold` — Minimum confidence (default: 0.3)
- `defaults.tokenBudget` — Soft token budget for context output (default: 500)
- `defaults.maxRecallResults` — Hard upper bound on recall limit (default: 20)
- `embedding.provider` — `local` (the only supported option; uses `@xenova/transformers`)
- `embedding.model` — Embedding model name (default: `Xenova/all-MiniLM-L6-v2`)
- `embedding.endpoint` — Reserved for remote-embedding providers; currently unused
- `consolidation.enabled` — Auto-consolidation toggle (default: true)
- `consolidation.intervalHours` — Consolidation cadence (default: 24)
- `consolidation.duplicateThreshold` — Cosine threshold to treat as duplicate (default: 0.92)
- `consolidation.decayEnabled` — Whether to apply confidence decay (default: true)
- `security.secretDetection` — Secret detection toggle (default: true)
- `security.auditLog` — Audit logging toggle (default: false)
- `security.encryption` — Opt-in at-rest encryption (default `enabled: false`). AES-256 (SQLCipher-compatible) via the **optional** `better-sqlite3-multiple-ciphers` build, loaded lazily only when a key is present — default installs are byte-identical. Key is never stored in config.json; resolved from `ENGRAM_DB_KEY` env var, then `security.encryption.keyFile`. `initDatabase(dbPath, { encryptionKey })` opens the encrypted path; wrong/missing key surfaces a friendly error. `engram encrypt`/`rekey` migrate/rotate. Only `memory.db` is encrypted (not the models cache). See `docs/security/encryption.md`.
- `llm.*` — `provider`, `endpoint`, `model`, `apiKey` (plus optional `timeoutMs`). **Layer 1 of the onion architecture** (opt-in LLM enhancement), now **implemented** and consumed by `src/llm/index.js`. **Off by default** (`provider: null`): when null, code makes zero LLM calls and behaves exactly like the rule-based path. When set to `ollama` (default endpoint `http://localhost:11434`) or `openai-compatible`, the layer is used in two places, each wrapped in a timeout + try/catch that falls back to rules on any failure: (1) extraction — `extractMemoryLLM(content, options, config)` in `src/extract/llm.js` wraps the untouched synchronous `extractMemory` to sharpen `category`/`entity`/`confidence`; (2) contradiction detection — `detectContradictionsForMemory`/`findContradictions` in `src/memory/consolidate.js` take an optional `config` and use the LLM only to *confirm* heuristic hits (drops a flag only when the model explicitly says "not a contradiction"; keeps it on any failure). `config` is threaded through the MCP handler (`this.config`), the REST server (closure `config`), and the CLI. REST surface: `GET/PUT /api/config/llm` (apiKey redacted to `hasApiKey` on GET) and `POST /api/llm/test`. Desktop exposes it under Preferences → "AI Enhancement". Do **not** remove these fields; they are load-bearing. **Observability (v1.8.0):** `src/llm/stats.js` is an in-process singleton (counters + 50-entry recent-events ring buffer; `recordCall`/`recordEvent`/`getStats`/`reset`) written to by `llmComplete` (call/latency/failure/timeout counters), `extractMemoryLLM` (`enhanced`/`fallback` events), and `llmConfirmsContradiction` (`confirmed`/`filtered` events). Surfaced via `GET /api/llm/status` + `GET /api/llm/stats`. All local, no telemetry. When the layer is disabled, nothing is recorded and no network call is made. Each LLM-extracted memory is tagged with the `extraction_method` column (`'rules'` default, `'llm'` when the model's result was used). **Hardening (Unreleased):** a circuit breaker (`src/llm/breaker.js`) opens after 3 consecutive failures/timeouts for 60s (overridable `llm.breakerThreshold`/`llm.breakerCooldownMs`) — while open, `llmComplete` returns null with no network so writes fall to rules instantly; breaker state is in `GET /api/llm/status` (`breakerOpen`, `degraded`). Extraction timeout is 8s, contradiction confirmation 10s (both overridable via `llm.timeoutMs`); no retries. Cost guards: bulk import (`src/import/index.js`) is rule-based and never calls the LLM per item; `findContradictions` caps LLM confirmations per run (default 25, `llm.maxContradictionConfirms`) and keeps heuristic hits beyond the cap. Secret ordering: MCP/REST/CLI all pass `validation.content` (post-secret-scan) to `extractMemoryLLM` — the LLM never sees raw input. Endpoint honesty: `GET /api/llm/status` exposes `isLocalEndpoint`; only a loopback endpoint keeps content on-device, and the desktop warns otherwise. **Small-model tuning (Unreleased):** the layer's two jobs are *classification*, so `llmComplete` takes a `schema` option and sends it as Ollama's structured-output `format` (constrained decoding — the model can't mis-format), with a one-shot degrade to `format: 'json'` if an old Ollama rejects the schema (the robust `isolateJson` parse still recovers it); `extractMemoryLLM` uses `EXTRACTION_SCHEMA` (category enum + nullable entity + 0..1 confidence) + 3 few-shot examples (NOT from the bench fixture, to keep bench honest), and `llmConfirmsContradiction` uses a strict-boolean schema. Ollama requests send `think: false` by default (latency/heat lever; opt in via `llm.think: true`) and `keep_alive` (default `5m`, override `llm.keepAlive`). openai-compatible uses `response_format: { type: 'json_object' }`. The recommended packaged model is **`engram/extract`** (`models/engram-extract.Modelfile`, Apache-2.0 Qwen base, thinking-off, temp 0) — a recommendation, not a lock-in; build with `ollama create engram/extract -f models/engram-extract.Modelfile`; publishing to the Ollama library is a manual step (`docs/llm/recommended-model.md`). `bench/extraction.mjs --models a,b,c` sweeps smallest-first to pick it; `bench/e2e-ollama.mjs` has `--judge-model`/`--think` and both Ollama benches fail loud on bad args (`bench/lib/common.mjs` `validateArgs`). **GUARD RULE:** model output is accepted only after validation (category ∈ enum, confidence ∈ [0,1], bounded entity, strict boolean for contradictions); any future feature where the LLM emits free text that becomes stored memory (e.g. atomic-splitting) MUST re-run `validateContent` (secret detection) + full validation on the model output before storage. Log hygiene: LLM paths log only metadata (op/outcome/latency/model/error class), never content or prompts.

## Common Patterns

### Storing embeddings
```javascript
// Write
const embedding = new Float32Array([...]);
const buffer = Buffer.from(embedding.buffer);
db.prepare('INSERT ... VALUES (?, ...)').run(buffer);

// Read
const buffer = row.embedding;
const embedding = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
```

### Cosine similarity
```javascript
function cosineSimilarity(a, b) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### UUID generation
```javascript
import { randomUUID } from 'crypto';
const id = randomUUID(); // Node.js built-in, no dependency
```

## Success Criteria

- [ ] `npm install -g engram && engram start` works zero-config
- [ ] Claude Code can connect and use all 6 MCP tools (remember, recall, forget, feedback, context, status)
- [ ] Memories persist across sessions
- [ ] Recall returns semantically relevant results
- [ ] Dashboard works at localhost:3838
- [ ] Secret detection blocks API keys/passwords
- [ ] Agent auto-discovery finds local AI agents
- [ ] One-click agent connection writes proper MCP config with backup
- [ ] Runs fully offline, zero internet required
- [ ] Clean, readable, well-documented JavaScript
