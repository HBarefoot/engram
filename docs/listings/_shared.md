# Shared listing copy

Canonical messaging that gets adapted across the six directory submissions. **Edit this file first**, then refresh the per-platform drafts so the positioning stays consistent everywhere.

---

## Elevator pitch (50 words)

> Engram is persistent memory for AI agents — runs in-process, ships as a single `npm install`. Local SQLite + bundled embeddings, zero external services, MCP-native for Claude Code, Cursor, Windsurf, Cline. Six focused tools, automatic secret detection on every write, side-by-side contradiction-resolution UI. Pure OSS, MIT licensed.

## Tagline (under 100 chars)

> Persistent memory for AI agents. In-process. No infra. One `npm install`.

## Long description (200 words)

Engram gives your AI agent the memory of a colleague who's worked with you for years — without cloud, API keys, or Docker. It runs as a regular npm package inside your agent's process: no separate server to deploy, no IPC overhead, nothing to fork. Storage is local SQLite at `~/.engram/`; embeddings come from bundled all-MiniLM-L6-v2 (~23 MB, downloaded once); the entire system works fully offline.

The MCP server exposes six focused tools — `engram_remember`, `engram_recall`, `engram_forget`, `engram_feedback`, `engram_context`, `engram_status` — and a parallel REST API at `localhost:3838` powers a built-in React dashboard for browsing memories, resolving contradictions, and managing imports from .cursorrules, .claude files, package.json, gitconfig, SSH config, and more.

Engram blocks secrets automatically on every write (API keys, private keys, connection strings, JWTs — pattern-detected and rejected before they hit the database). Memories improve over time via a feedback loop, deduplication on insert, and a consolidation pipeline that surfaces contradictions side-by-side for one-click resolution.

Currently at v1.4.x. Purely OSS under MIT. No paywalls, no usage caps, no feature gates planned.

## When does Engram fit vs. the alternatives?

- **Engram** — focused, stable, in-process memory with practical guardrails (automatic secret detection, agent auto-discovery, desktop app). Smaller surface area (6 tools, 5 categories) than the graph-database alternatives.
- **Lodis** (`@sunriselabs/lodis`) — knowledge-graph-style memory with 14 entity types and temporal supersession. Earlier-stage (v0.5.x) but broader feature surface.
- **Mem0 / OpenMemory** — cloud SaaS or self-hosted Docker stack. LLM-powered extraction. Best when you want a managed service or LLM-augmented extraction quality.
- **Zep, Letta** — self-hosted servers with Postgres + Graphiti/LLM. Best when you're already operating that infra and want deep integration.

## Installation command

```bash
npm install -g @hbarefoot/engram
```

## MCP client config

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

## Repository

- **GitHub:** https://github.com/HBarefoot/engram
- **npm:** https://www.npmjs.com/package/@hbarefoot/engram
- **License:** MIT
- **Categories:** memory, knowledge-graph (light), agent-state, mcp-server, local-first

## Maintainer

- **Henry Barefoot** — [@HBarefoot](https://github.com/HBarefoot)
