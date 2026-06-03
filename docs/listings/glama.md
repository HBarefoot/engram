# Glama — listing draft

Glama is an MCP discovery platform. Submission is typically via their web form / GitHub OAuth flow.

## Fields

| Field | Value |
|---|---|
| **Name** | Engram |
| **Slug** | `engram` |
| **Author / Org** | Henry Barefoot (@HBarefoot) |
| **GitHub** | https://github.com/HBarefoot/engram |
| **npm** | @hbarefoot/engram |
| **License** | MIT |
| **Category** | Memory / Knowledge Management |
| **Tags** | memory, mcp, local-first, sqlite, embeddings, claude, cursor, windsurf |

## Short description (under 200 chars)

Persistent memory for AI agents. In-process npm package, SQLite + local embeddings, fully offline. MCP-native with six tools, automatic secret detection, built-in dashboard.

## Long description

Engram is a persistent memory layer for AI agents that runs in-process as an npm package. No cloud, no Docker, no API keys. The MCP server exposes six focused tools — `remember`, `recall`, `forget`, `feedback`, `context`, `status` — over stdio, and a parallel REST API at `localhost:3838` powers a built-in React dashboard for browsing memories and resolving contradictions side-by-side.

Storage is local SQLite at `~/.engram/`. Embeddings come from bundled all-MiniLM-L6-v2 (~23 MB, downloaded once on first use). The entire system works fully offline after that. Every write passes through pattern-based secret detection — API keys, private keys, connection strings, JWTs are blocked before reaching the database.

Currently at v1.4.x. Pure OSS under MIT. No paywalls, no usage caps.

## Install command

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

## Submission checklist

- [ ] Engram is published at v1.4.6+ on npm
- [ ] Hero GIF embedded in README
- [ ] Glama account created (if needed)
- [ ] Submit via their web form with the values above
