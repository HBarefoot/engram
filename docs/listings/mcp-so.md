# mcp.so — listing draft

mcp.so is a community directory. Submission is typically through their web form or a GitHub-based PR (check at submission time).

## Fields

| Field | Value |
|---|---|
| **Name** | Engram |
| **Slug** | `engram` |
| **GitHub URL** | https://github.com/HBarefoot/engram |
| **npm** | @hbarefoot/engram |
| **License** | MIT |
| **Category** | Memory |
| **Tags** | memory, sqlite, embeddings, local-first, mcp, ai-agents, claude, cursor |
| **Tagline** | Persistent memory for AI agents. In-process. No infra. |

## Short description

Engram is persistent memory for AI agents — runs in-process as an npm package. Local SQLite + bundled embeddings (~23 MB), zero external services, MCP-native. Six focused tools, automatic secret detection on every write, built-in dashboard for browsing memories and resolving contradictions. Works fully offline. MIT-licensed.

## Featured capabilities

- Hybrid recall (FTS5 + vector embeddings, fused score)
- Confidence-weighted memory with built-in feedback loop
- Automatic deduplication on insert (0.92 similarity threshold)
- Contradiction detection with side-by-side resolution UI
- Document import from .cursorrules, .claude, package.json, gitconfig, SSH config, Obsidian, shell history
- macOS native desktop app (Tauri menu-bar)
- v1.4.x, 213 tests passing, MIT-clean dependency audit

## Quick install

```bash
npm install -g @hbarefoot/engram
engram start --mcp-only
```

Then in your MCP client config:

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
- [ ] mcp.so submission form completed with the values above
