# `awesome-mcp-servers` — listing draft

## Where it goes

The most-starred community list lives at https://github.com/punkpeye/awesome-mcp-servers. Engram fits under the **🧠 Memory** category (which is already a section in their README).

Submission = a small PR adding one alphabetized bullet to that section.

## PR title

```
Add Engram — local-first persistent memory (SQLite, in-process, MCP-native)
```

## README line to add

Under the **🧠 Memory** section, alphabetized:

```markdown
- [Engram](https://github.com/HBarefoot/engram) 🐍 ☁️ 🍎 🪟 - Persistent memory for AI agents. In-process npm package, local SQLite + embeddings (~23 MB), no infra. Six tools, automatic secret detection, built-in dashboard. MIT.
```

Note: `awesome-mcp-servers` uses emoji legend for platform/runtime — check their current key. Common ones:
- 🐍 / 📇 — Python/TypeScript
- 🏠 / ☁️ — local/cloud
- 🍎 / 🪟 / 🐧 — macOS/Windows/Linux

Engram is a Node.js (TypeScript-ish — plain JS / ESM) package, runs locally on macOS, Windows, and Linux. Adjust the emojis to match their convention exactly at submission time.

## PR body

```markdown
## Adds: Engram

**One-line:** Persistent memory for AI agents. In-process npm install, local SQLite, MCP-native. No cloud, no Docker, no API keys.

**Category:** 🧠 Memory

**License:** MIT

### Why it belongs on the list

- Pure local-first (works fully offline once installed)
- MCP-native (stdio transport, six MCP tools, configured directly in Claude Code / Desktop / Cursor / Windsurf / Cline configs)
- Production-stable (v1.4.x, 213 tests passing, 0 lint errors)
- Practical guardrails: automatic secret detection on every write, side-by-side contradiction-resolution UI, dependency-license audit clean (MIT/Apache/BSD only)
- Built-in React dashboard at `localhost:3838` for browsing memories, resolving conflicts, importing from .cursorrules / .claude / gitconfig / SSH config

### Links

- GitHub: https://github.com/HBarefoot/engram
- npm: https://www.npmjs.com/package/@hbarefoot/engram
- BUSINESS_MODEL.md (commitments): https://github.com/HBarefoot/engram/blob/main/BUSINESS_MODEL.md
```

## Submission checklist before opening the PR

- [ ] Confirm the **Memory** section still exists in their README at submission time
- [ ] Match their emoji legend exactly (it shifts as their conventions evolve)
- [ ] Read their CONTRIBUTING.md — they sometimes require maintainership claims or a working demo link
