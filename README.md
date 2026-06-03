# ![Engram](https://raw.githubusercontent.com/HBarefoot/engram/main/engram-logo.png) Engram

**Persistent memory for AI agents. In-process. No infra.**

> Give your AI agent the memory of a colleague who's worked with you for years — without cloud, API keys, or Docker.

[![CI](https://github.com/HBarefoot/engram/actions/workflows/ci.yml/badge.svg)](https://github.com/HBarefoot/engram/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hbarefoot/engram)](https://www.npmjs.com/package/@hbarefoot/engram)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

```bash
npm install -g @hbarefoot/engram
engram start
```

Your AI agent now has long-term memory. Two minutes, no setup, no cloud.

- 🧠 **In-process** — runs inside your agent's stack. No separate server to deploy, no IPC overhead, nothing to fork.
- 📴 **Offline** — local SQLite + bundled embeddings (~23 MB). No API keys, no data leaving your machine.
- 🔌 **MCP-native** — first-class Model Context Protocol integration with Claude Desktop, Claude Code, Cursor, Windsurf, and Cline.
- 🔐 **Safety by default** — automatic secret detection on every write. API keys, private keys, connection strings, JWTs blocked before they hit the database.

---

## Why Engram?

Most agent-memory products are services you run alongside your agent — Postgres, Docker, cloud accounts, API keys. Engram embeds *inside* your agent's process: a focused, stable npm package with practical guardrails.

| | **Engram** | **Lodis** | **Mem0 / OpenMemory** | **Zep** | **Letta** |
|---|---|---|---|---|---|
| **Maturity** | v1.4.x, stable | v0.5.x, early | mature / SaaS | v0.x | v0.x |
| **Infra to operate** | None (npm package) | None (npx package) | Cloud account *or* multi-container Docker | Docker + Postgres + Graphiti | Docker + Postgres |
| **Install footprint** | ~23 MB | ~22 MB | Hundreds of MB containers (self-hosted) | Hundreds of MB | Hundreds of MB |
| **Works offline** | ✅ | ✅ | ❌ Cloud / ✅ if self-hosted | ❌ External embed provider | ❌ External LLM provider |
| **MCP-native** | ✅ Primary | ✅ Primary | 🟡 OpenMemory ships an MCP server | ❌ REST/SDK | ❌ REST/SDK |
| **REST API alongside MCP** | ✅ | ❌ MCP-only | ✅ Cloud | ✅ | ✅ |
| **Surface area** | 6 tools, 5 categories | 40 tools, 14 entity types + 4 permanence tiers + temporal supersession | varies | varies | varies |
| **Automatic secret detection** | ✅ Blocks on every write | 🟡 `memory_scrub` opt-in tool | 🟡 Not first-class | 🟡 Not first-class | 🟡 Not first-class |
| **Agent auto-discovery** | ✅ Dashboard Integration Wizard | ❌ Manual config | ❌ | ❌ | ❌ |
| **Desktop app** | ✅ macOS Tauri menu bar | ❌ | ❌ | ❌ | ❌ |
| **LLM-powered extraction** | ❌ Rule-based (Layer 1 hook documented) | ❌ LLM-free read/write | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| **Feedback / contradiction workflow** | ✅ Side-by-side conflict-resolution UI + feedback loop | 🟡 Programmatic correct/confirm/supersede tools | 🟡 No first-class feedback | 🟡 | 🟡 |

*Sources: [@sunriselabs/lodis](https://www.npmjs.com/package/@sunriselabs/lodis), [Sunrise-Labs-Dot-AI/engrams](https://github.com/Sunrise-Labs-Dot-AI/engrams), [mem0.ai](https://mem0.ai/), [github.com/getzep/zep](https://github.com/getzep/zep), [github.com/letta-ai/letta](https://github.com/letta-ai/letta). See [`docs/competitive-intel.md`](docs/competitive-intel.md) for the full breakdown. Where competitors lead — LLM-powered extraction in Mem0/Zep/Letta, broader feature surface in Lodis — we list it honestly. Engram's `llm.*` config block is the documented hook for opt-in LLM extraction; the default zero-config path uses rule-based extraction so the package stays offline and infra-free.*

**TL;DR — when each one fits.** Pick **Engram** if you want a focused, stable memory layer with practical guardrails (secret detection, agent auto-discovery, desktop app) and a simple 5-category mental model. Pick **Lodis** if you want a knowledge-graph-style memory with 14 entity types and temporal supersession. Pick **Mem0/Zep/Letta** if you need LLM-powered extraction and don't mind operating infrastructure for it.

---

## Quickstart

<a id="quickstart"></a>

### 1. Install

```bash
npm install -g @hbarefoot/engram
```

### 2. Start the server

```bash
engram start             # MCP + REST + Dashboard on localhost:3838
engram start --mcp-only  # MCP server only, stdio mode (for agent integration)
```

### 3. Connect your AI agent

**Claude Code:**

```bash
claude mcp add engram -- engram start --mcp-only
```

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "engram": {
      "command": "engram",
      "args": ["start", "--mcp-only"]
    }
  }
}
```

**Cline / Cursor / Windsurf** — add the same `mcpServers` block to your editor's MCP config. The built-in dashboard at [http://localhost:3838](http://localhost:3838) has an **Integration Wizard** that auto-detects your installed agents and generates the config for you.

### 4. Use it

```
You:    "Remember that our API uses JWT tokens with 24-hour expiry."
Claude: (stores via engram_remember)

You:    (next day) "What authentication approach are we using?"
Claude: (recalls via engram_recall) — "JWT tokens, 24-hour expiry."
```

Memories persist across sessions, machine restarts, and even between different AI clients sharing the same Engram instance.

---

## Memory that improves over time

Most memory systems are append-only stores: write once, retrieve forever, hope for the best. Engram learns.

- **Feedback loop** (`engram_feedback`) — when an agent recalls a memory, you or the agent can vote it helpful or unhelpful. Memories accumulate a score in `[-1, 1]`; consistently-unhelpful memories see their confidence decay automatically.
- **Contradiction detection** — when two memories conflict ("prefers Fastify" vs "switched to Express"), the consolidation engine flags them. The dashboard's **Conflicts** tab shows them side-by-side with four resolution actions: keep A, keep B, keep both, or dismiss.
- **Deduplication on insert** — identical memories (≥0.95 cosine similarity) are rejected. Near-duplicates (0.92–0.95) absorb the new content into the existing record. The store stays clean without manual pruning.
- **Decay** — memories that aren't recalled lose confidence over time and stop polluting future results.

The longer you use Engram, the sharper its recall gets.

---

## MCP Tools

Engram exposes 6 tools to AI agents over stdio:

| Tool | Description |
|---|---|
| `engram_remember` | Store a memory with category, entity, confidence, namespace, tags. Auto-runs secret detection. |
| `engram_recall` | Hybrid semantic + FTS5 search. Supports `category`, `namespace`, `threshold`, and `time_filter`. |
| `engram_forget` | Delete a specific memory by ID. |
| `engram_feedback` | Vote a memory helpful/unhelpful. Drives the feedback loop above. |
| `engram_context` | Pre-formatted context block (`markdown` / `xml` / `json` / `plain`) with a token budget for system-prompt injection. |
| `engram_status` | Health check: memory count, model status, configuration. |

### Memory categories

- **fact** — Objective truths about setup, architecture, or configuration.
- **preference** — User likes, dislikes, style choices.
- **pattern** — Recurring workflows and habits.
- **decision** — Choices made and the reasoning behind them.
- **outcome** — Results of actions taken.

---

## CLI Reference

```bash
engram start                       # Start MCP + REST + dashboard
engram start --mcp-only            # MCP server only (stdio mode)
engram start --port 3838           # Custom REST port

engram remember "<content>"        # Store a memory   (-c category -e entity -n namespace --confidence)
engram recall "<query>"            # Search memories  (-l limit -c category -n namespace --threshold)
engram forget <id>                 # Delete by ID
engram list                        # List memories    (-l limit --offset -c category -n namespace)
engram status                      # Health check

engram consolidate                 # Deduplicate, detect contradictions, decay
                                   # (--no-duplicates / --no-contradictions / --no-decay / --cleanup-stale)
engram conflicts                   # List unresolved contradictions
engram export-context              # Export curated context block
                                   # (-o file -f markdown|claude|txt|json -c categories --min-confidence ...)
engram import                      # Import from local sources
                                   # (-s cursorrules|claude|package|git|ssh|shell|obsidian|env --dry-run)
```

Run `engram --help` for the full flag list.

---

## REST API

The REST API runs on `http://localhost:3838` by default.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/api/status` | System status + stats |
| GET | `/api/installation-info` | Detected agents, runtime, install location |
| POST | `/api/memories` | Create a memory |
| GET | `/api/memories` | List with pagination + filters |
| POST | `/api/memories/search` | Semantic search |
| GET | `/api/memories/:id` | Read a single memory |
| DELETE | `/api/memories/:id` | Delete by ID |
| POST | `/api/memories/bulk-delete` | Bulk-delete by ID list |
| POST | `/api/consolidate` | Run consolidation pipeline |
| GET | `/api/conflicts` | Legacy tag-based conflict view |
| GET | `/api/contradictions` | Unresolved contradictions |
| POST | `/api/contradictions/:id/resolve` | Resolve (keep_first / keep_second / keep_both / dismiss) |
| GET | `/api/contradictions/count` | Unresolved count (for badge) |
| GET | `/api/analytics/overview` | Memory health dashboard data |
| GET | `/api/analytics/stale` | Memories with no recent recall |
| GET | `/api/analytics/never-recalled` | Memories never returned by any query |
| GET | `/api/analytics/duplicates` | Detected near-duplicates |
| GET | `/api/analytics/trends` | Time-series creation/recall trends |
| POST | `/api/export/static` | Export context block as a static file |
| GET | `/api/import/sources` | List importable local sources |
| POST | `/api/import/scan` | Two-phase import: preview extracted memories |
| POST | `/api/import/commit` | Two-phase import: commit selected memories |

---

## Web Dashboard

A built-in React dashboard at [http://localhost:3838](http://localhost:3838):

- **Dashboard** — Memory stats, recent activity, health gauge.
- **Memories** — Browse, filter, inline-edit, bulk-delete.
- **Search** — Semantic search with score breakdown.
- **Statistics** — Charts by category, namespace, and time.
- **Health** — Stale, never-recalled, low-feedback memories with one-click cleanup.
- **Conflicts** — Side-by-side contradiction resolution.
- **Agents** — Integration wizard that auto-detects installed AI clients and writes their MCP configs (with timestamped backups).
- **Import** — Wizard for cursorrules, .claude files, package.json, git config, SSH config, shell history, Obsidian, and .env.

---

## How it works

1. **Store**: `engram_remember` runs content through secret detection, then embeds it locally using [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (~23 MB, CPU-only, downloaded once and cached at `~/.engram/models/`). The embedding and metadata land in SQLite at `~/.engram/memory.db`.
2. **Recall**: `engram_recall` embeds the query, fetches candidates via FTS5 + in-namespace embeddings, and scores them as `(similarity × 0.45) + (recency × 0.15) + (confidence × 0.15) + (access × 0.05) + (feedback × 0.10) + fts_boost`. Top results are returned and their access stats updated.
3. **Deduplicate**: on insert, identical memories (≥0.95 similarity) are rejected; near-duplicates (0.92–0.95) absorb new content into the existing row.
4. **Learn**: `engram_feedback` adjusts a memory's `feedback_score` and — after 5+ votes — bumps the confidence score up or down.
5. **Protect**: every write passes through pattern-based secret detection (OpenAI/Stripe/AWS/GitHub/Slack/Google keys, private keys, connection strings, JWTs, high-entropy strings). Detected secrets either reject the memory or redact the secret portion.

---

## Configuration

Engram stores everything under `~/.engram/`:

```
~/.engram/
├── memory.db          # SQLite database (memories + embeddings + FTS5 index)
├── config.json        # Server configuration
└── models/            # Cached embedding model
```

Defaults work out of the box. To customize:

```json
{
  "port": 3838,
  "dataDir": "~/.engram",
  "defaults": {
    "namespace": "default",
    "recallLimit": 5,
    "confidenceThreshold": 0.3,
    "tokenBudget": 500,
    "maxRecallResults": 20
  },
  "embedding": {
    "provider": "local",
    "model": "Xenova/all-MiniLM-L6-v2"
  },
  "consolidation": {
    "enabled": true,
    "intervalHours": 24,
    "duplicateThreshold": 0.92,
    "decayEnabled": true
  },
  "security": {
    "secretDetection": true,
    "auditLog": false
  }
}
```

An `llm.*` block is reserved for opt-in Layer 1 LLM enhancement (Ollama, LM Studio, OpenAI-compatible endpoints) — unused by the default zero-config path.

---

## Advanced usage

### Namespace isolation

```bash
engram remember "Uses Next.js 14 app router" -n my-saas
engram remember "WordPress multisite + Redis" -n client-site

engram recall "what framework?" -n my-saas
```

### Temporal queries

Time-range filtering is available via MCP and REST. Agents pass a `time_filter` object to `engram_recall`:

```json
{
  "query": "deployment changes",
  "time_filter": { "after": "last week" }
}
```

```json
{
  "query": "API decisions",
  "time_filter": { "after": "2026-01-01", "before": "2026-06-01" }
}
```

Supported shapes: `after` / `before` (ISO date or relative string like `"3 days ago"`), or `period` shorthand (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `this_year`, `last_year`).

### Export context for documentation

```bash
engram export-context -f markdown -n my-project -o PROJECT_CONTEXT.md
engram export-context -f claude -o CLAUDE.md
```

---

## Programmatic usage

Engram also works as a library inside your Node.js app:

```javascript
import {
  loadConfig,
  getDatabasePath,
  getModelsPath,
  initDatabase,
  createMemory,
  recallMemories
} from '@hbarefoot/engram';

const config = loadConfig();
const db = initDatabase(getDatabasePath(config));

createMemory(db, {
  content: 'User prefers Fastify over Express',
  category: 'preference',
  confidence: 0.9
});

const results = await recallMemories(
  db,
  'preferred web framework',
  { limit: 5 },
  getModelsPath(config)
);
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, the versioning policy (npm + desktop bump together), and the release checklist. The project's licensing and sustainability stance is in [BUSINESS_MODEL.md](BUSINESS_MODEL.md) — short version: pure OSS, MIT forever, no paywalls.

```bash
git clone https://github.com/HBarefoot/engram.git
cd engram
npm install
npm run dev
```

If Engram is useful to you, here's how to help:

- ⭐ **Star the repo** — the loudest signal that this is worth continuing.
- 🐛 **Open an issue** — bug, feature request, or "we use Engram at \<company\> for \<thing\>" stories all welcome.
- 💬 **Start a [discussion](https://github.com/HBarefoot/engram/discussions)** — design questions, integration ideas, "how would I…" — all good.
- ❤️ **[Sponsor on GitHub](https://github.com/sponsors/HBarefoot)** — low-pressure way to support continued development. No tier-locked features; sponsorship goes straight to keeping the project shipping.

---

## License

MIT © 2026 [HBarefoot](https://github.com/HBarefoot)
