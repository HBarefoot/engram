# mcpservers.org — listing draft

## Submission

mcpservers.org is a directory site. Submission is typically a web-form on their site OR a PR to a generated source repo (varies — check their footer or about page at submission time).

## Fields

| Field | Value |
|---|---|
| **Name** | Engram |
| **Tagline** | Persistent memory for AI agents. In-process. No infra. |
| **Short description (140 chars)** | SQLite + local embeddings memory layer for AI agents. In-process npm install, MCP-native. Works fully offline, MIT-licensed. |
| **Long description** | *(see "Long description" below)* |
| **GitHub URL** | https://github.com/HBarefoot/engram |
| **npm package** | @hbarefoot/engram |
| **License** | MIT |
| **Categories** | Memory, Agent State, Local-First, Knowledge Management |
| **Tags** | mcp, memory, ai-agents, sqlite, embeddings, local-first, claude, cursor, windsurf, cline |
| **Install command** | `npm install -g @hbarefoot/engram` |
| **MCP transport** | stdio |
| **Number of tools** | 6 |
| **Tool names** | engram_remember, engram_recall, engram_forget, engram_feedback, engram_context, engram_status |
| **Platforms** | macOS, Windows, Linux (Node.js 20+) |
| **Cloud required?** | No |
| **Authentication required?** | No |
| **Maintainer** | Henry Barefoot (@HBarefoot) |

## Long description

Engram gives your AI agent the memory of a colleague who's worked with you for years — without cloud, API keys, or Docker. It runs as a regular npm package inside your agent's process: no separate server to deploy, no IPC overhead, nothing to fork. Storage is local SQLite at `~/.engram/`; embeddings come from bundled all-MiniLM-L6-v2 (~23 MB, downloaded once); the entire system works fully offline.

The MCP server exposes six focused tools and a parallel REST API at `localhost:3838` powers a built-in React dashboard for browsing memories, resolving contradictions, and managing imports.

Engram blocks secrets automatically on every write (API keys, private keys, connection strings, JWTs — pattern-detected and rejected). Memories improve over time via a feedback loop and consolidation pipeline.

Currently at v1.4.x. Pure OSS under MIT. No paywalls, no usage caps, no feature gates planned.

## Screenshots / GIF

- Hero GIF: `docs/quickstart.gif` (record via `vhs docs/quickstart.tape`)
- Dashboard screenshot: take after Sponsor enrollment / launch GIF is ready

## Submission checklist

- [ ] Engram published at v1.4.6+ on npm
- [ ] Hero GIF embedded in README
- [ ] mcpservers.org account created (if needed)
- [ ] Submission form filled with the values above
