# `modelcontextprotocol/servers` — listing draft

## Where it goes

The official MCP servers list lives at https://github.com/modelcontextprotocol/servers in `README.md`, under the **🌎 Community Servers** section (third-party, organized alphabetically). Submission = a small PR adding one alphabetized bullet.

## PR title

```
Add Engram — persistent memory for AI agents (in-process, no infra)
```

## README line to add

Insert alphabetically (between any "E…" entries currently in the Community list):

```markdown
- **[Engram](https://github.com/HBarefoot/engram)** — Persistent memory for AI agents. SQLite + local embeddings, in-process via npm, MCP-native. Six tools (`remember`, `recall`, `forget`, `feedback`, `context`, `status`), automatic secret detection, built-in dashboard. Works fully offline.
```

## PR body

```markdown
## What this adds

Engram is a persistent memory layer for AI agents that runs in-process as an npm package. It uses local SQLite plus the all-MiniLM-L6-v2 embedding model (bundled, ~23 MB) — no external services, no Docker, no cloud account.

The MCP server exposes six focused tools and is MCP-native rather than MCP-as-an-add-on. It's been used in production by the maintainer for ~4 months across Claude Code, Claude Desktop, Cursor, Windsurf, and Cline.

## Quick verification

```bash
npm install -g @hbarefoot/engram
engram start --mcp-only        # MCP server over stdio
engram status                  # health check
```

MCP client config: `{ "mcpServers": { "engram": { "command": "engram", "args": ["start", "--mcp-only"] } } }`

## Project links

- GitHub: https://github.com/HBarefoot/engram
- npm: https://www.npmjs.com/package/@hbarefoot/engram
- License: MIT
- Tests: 213 passing, 0 lint errors
```

## Submission checklist before opening the PR

- [ ] Engram is published at v1.4.6 or later on npm (so the install line works)
- [ ] README hero GIF is in place (reviewers click through)
- [ ] CI is green on `HBarefoot/engram` main
