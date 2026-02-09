# <img src="https://raw.githubusercontent.com/HBarefoot/engram/main/engram-logo.png" alt="Engram" width="32" height="32" style="vertical-align: middle;" /> Engram

[![CI](https://github.com/HBarefoot/engram/actions/workflows/ci.yml/badge.svg)](https://github.com/HBarefoot/engram/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@hbarefoot/engram)](https://www.npmjs.com/package/@hbarefoot/engram)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

**Give your AI agents persistent memory. Zero cloud. Zero API keys. Two-minute setup.**

Engram is a local-first memory server that lets AI agents like Claude, Cursor, Cline, and Windsurf remember things across sessions. It runs entirely on your machine — no external services, no data leaving your device, no monthly bills.

```bash
npm install -g @hbarefoot/engram
engram start
```

That's it. Your AI agent now has long-term memory.

---

## Why Engram?

Most AI memory solutions require cloud infrastructure, API keys, and external vector databases. Engram takes a different approach:

| | **Engram** | **Mem0** | **Zep** |
|---|---|---|---|
| **Setup time** | 2 minutes | Requires API keys + cloud setup | Requires Docker + API keys |
| **Dependencies** | None — SQLite + local embeddings | OpenAI API, vector DB (Qdrant/Pinecone) | PostgreSQL, OpenAI API |
| **Data location** | Your machine only | Cloud (or self-hosted with infra) | Cloud (or self-hosted with infra) |
| **Cost** | Free forever | Pay per API call | Pay per API call |
| **Privacy** | Complete — nothing leaves your device | Data sent to external APIs | Data sent to external APIs |
| **MCP native** | ✅ First-class | ❌ REST only | ❌ REST only |

Engram is built for developers who want AI memory without the overhead.

---

## Features

- 🔒 **Fully Local** — SQLite database + local embeddings ([all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2), 23 MB). No network calls, ever
- 🤖 **MCP Native** — First-class Model Context Protocol integration. Works with Claude Desktop, Claude Code, Cline, Cursor, Windsurf, and any MCP client
- 🔍 **Hybrid Search** — Combines vector similarity with full-text search (FTS5) for accurate recall
- 🧹 **Smart Deduplication** — Automatically detects and merges similar memories (>0.92 similarity threshold)
- 📊 **Feedback Loop** — Rate memory usefulness to improve future recall accuracy
- 🔐 **Secret Detection** — Automatically blocks API keys, passwords, and tokens from being stored
- ⏰ **Temporal Queries** — Filter memories by time: "last week", "3 days ago", or exact dates
- 📦 **Namespace Isolation** — Organize memories by project, client, or any scope you need
- 🌐 **REST API** — Full HTTP API with CORS support for custom integrations
- 🖥️ **Web Dashboard** — React-based UI for browsing, searching, and managing memories
- 💾 **Export** — Export memories to Markdown, JSON, or plain text for documentation

---

## Quick Start

### 1. Install

```bash
npm install -g @hbarefoot/engram
```

### 2. Start the server

```bash
engram start
```

### 3. Connect to your AI agent

Add Engram to your MCP client config:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

**Claude Code:**

```bash
claude mcp add engram -- engram start --mcp-only
```

**Cline / Cursor / Windsurf:** Add the same MCP config to your editor's settings. Engram's built-in Integration Wizard can auto-detect your setup:

```bash
engram connect
```

### 4. Use it

Once connected, your AI agent can store and recall memories naturally:

> **You:** "Remember that our API uses JWT tokens with 24-hour expiry"
>
> **Claude:** *stores the memory via `engram_remember`*
>
> **You:** (next day) "What authentication approach are we using?"
>
> **Claude:** *recalls via `engram_recall`* — "Your API uses JWT tokens with 24-hour expiry."

Memories persist across sessions, restarts, and even different AI clients sharing the same Engram instance.

---

## MCP Tools

Engram exposes 6 tools to AI agents via the Model Context Protocol:

| Tool | Description |
|---|---|
| `engram_remember` | Store a memory with category, entity, confidence, namespace, and tags |
| `engram_recall` | Retrieve relevant memories by semantic query with optional filters |
| `engram_forget` | Delete a specific memory by ID |
| `engram_feedback` | Rate a memory as helpful or unhelpful to improve future recall |
| `engram_context` | Generate a pre-formatted context block (markdown/xml/json) with token budget |
| `engram_status` | Health check with memory count, model status, and configuration info |

### Memory Categories

Memories are organized by type for better retrieval:

- **fact** — Objective truths about setup, architecture, or configuration
- **preference** — User likes, dislikes, and style choices
- **pattern** — Recurring workflows and habits
- **decision** — Choices made and the reasoning behind them
- **outcome** — Results of actions taken

---

## CLI Reference

```bash
engram start                    # Start MCP + REST server
engram start --mcp-only         # MCP server only (for agent integration)
engram start --port 3838        # Custom port for REST API

engram remember "content"       # Store a memory from the command line
engram recall "query"           # Search memories
engram forget <id>              # Delete a memory
engram list                     # List all memories
engram status                   # Health check and stats

engram export                   # Export memories to JSON
engram import <file>            # Import memories from file
engram consolidate              # Run deduplication and cleanup

engram agents                   # List detected AI agents on your system
engram connect                  # Interactive setup wizard for MCP clients
```

---

## REST API

The REST API runs on `http://localhost:3838` by default.

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/api/status` | GET | System status with stats |
| `/api/memories` | POST | Create a memory |
| `/api/memories` | GET | List memories (with pagination, category/namespace filters) |
| `/api/memories/search` | POST | Semantic search |
| `/api/memories/:id` | GET | Get a single memory |
| `/api/memories/:id` | DELETE | Delete a memory |
| `/api/consolidate` | POST | Run deduplication and cleanup |
| `/api/conflicts` | GET | Get detected memory conflicts |

---

## Web Dashboard

Engram includes a built-in web dashboard at `http://localhost:3838` when running the full server:

- **Dashboard** — Overview of memory stats and recent activity
- **Memory Browser** — Browse, filter, and manage all stored memories
- **Search** — Semantic search with similarity scores
- **Statistics** — Charts and breakdowns by category, namespace, and time
- **Agents** — Integration hub with a setup wizard for connecting MCP clients

---

## How It Works

1. **Store**: When an AI agent calls `engram_remember`, the memory text is embedded locally using [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (a 23 MB model that runs on CPU). The embedding and metadata are stored in a local SQLite database at `~/.engram/memory.db`.

2. **Recall**: When `engram_recall` is called, the query is embedded with the same model and matched against stored memories using cosine similarity. FTS5 keyword matching runs in parallel, and results are merged using a hybrid scoring algorithm.

3. **Deduplicate**: Before storing, Engram checks existing memories for similarity. Exact duplicates (>0.95) are rejected. Near-duplicates (0.92–0.95) are merged intelligently.

4. **Learn**: The `engram_feedback` tool lets agents mark memories as helpful or unhelpful. This adjusts confidence scores and influences future recall ranking.

5. **Protect**: Every memory passes through secret detection before storage. API keys, passwords, tokens, and other sensitive data are automatically blocked.

---

## Configuration

Engram stores its data and config in `~/.engram/`:

```
~/.engram/
├── memory.db          # SQLite database (memories + embeddings)
├── config.json        # Server configuration
└── models/            # Cached embedding model (~23 MB)
```

Default settings work out of the box. To customize:

```json
// ~/.engram/config.json
{
  "port": 3838,
  "defaultNamespace": "default",
  "recallLimit": 5,
  "confidenceThreshold": 0.3,
  "secretDetection": true
}
```

---

## Advanced Usage

### Namespace Isolation

Organize memories by project or client:

```bash
# Store memories in different namespaces
engram remember "Uses Next.js 14 with app router" --namespace my-saas
engram remember "WordPress multisite with Redis cache" --namespace client-site

# Recall searches within a namespace
engram recall "what framework?" --namespace my-saas
```

AI agents can use namespaces automatically — just include the namespace parameter in `engram_remember` and `engram_recall` calls.

### Temporal Queries

Filter memories by time:

```bash
engram recall "deployment changes" --after "last week"
engram recall "API decisions" --after "2025-01-01" --before "2025-06-01"
```

### Export for Documentation

Export your project's memory as documentation:

```bash
engram export --format markdown --namespace my-project > PROJECT_CONTEXT.md
engram export --format json > memories-backup.json
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

```bash
git clone https://github.com/HBarefoot/engram.git
cd engram
npm install
npm run dev
```

---

## License

MIT © 2026 [HBarefoot](https://github.com/HBarefoot)
