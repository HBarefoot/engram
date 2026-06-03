# Smithery — listing draft

Smithery is an MCP server registry with discovery + one-click install tooling. Listing requires (a) a `smithery.yaml` in the repo root and (b) signing in to Smithery to claim the listing.

## Step 1 — `smithery.yaml` (commit to repo root when ready)

```yaml
startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      namespace:
        type: string
        default: default
        description: Memory namespace (project or scope). Use "default" for general memories.
      port:
        type: number
        default: 3838
        description: REST API + dashboard port (only used if --mcp-only is dropped).
  commandFunction: |-
    (config) => ({
      command: "npx",
      args: ["-y", "@hbarefoot/engram", "start", "--mcp-only"]
    })
```

## Step 2 — listing cover page copy

| Field | Value |
|---|---|
| **Display name** | Engram |
| **Slug** | `engram` |
| **Tagline** | Persistent memory for AI agents. In-process. No infra. |
| **Logo** | `engram-logo.png` from repo root |
| **GitHub** | https://github.com/HBarefoot/engram |
| **Homepage** | https://github.com/HBarefoot/engram |
| **Categories** | Memory, Knowledge Management |
| **Tags** | mcp, memory, local-first, sqlite, embeddings, claude, cursor |

### Overview paragraph

Engram gives your AI agent the memory of a colleague who's worked with you for years — without cloud, API keys, or Docker. It runs as a regular npm package inside your agent's process: no separate server to deploy, no IPC overhead, nothing to fork. Storage is local SQLite + bundled embeddings (~23 MB), so the system works fully offline.

### Features list

- 6 MCP tools: `engram_remember`, `engram_recall`, `engram_forget`, `engram_feedback`, `engram_context`, `engram_status`
- Hybrid search: FTS5 + vector similarity, scored together
- Automatic secret detection on every write (API keys, private keys, connection strings, JWTs blocked before storage)
- Built-in React dashboard at `localhost:3838` — browse, search, resolve contradictions
- Document import wizard for `.cursorrules`, `.claude`, `package.json`, `gitconfig`, SSH config, Obsidian, shell history
- Native macOS desktop app (Tauri menu-bar) for users who prefer GUI
- v1.4.x, MIT, 213 tests passing, zero lint errors

## Step 3 — submission checklist

- [ ] Commit `smithery.yaml` to repo root
- [ ] Sign in at https://smithery.ai/
- [ ] Add Engram via their "Add Server" flow (they pick up the `smithery.yaml`)
- [ ] Upload `engram-logo.png` as the cover image
- [ ] Verify the auto-generated install command works (`npx -y @sunriselabs/smithery-cli install engram --client claude`)
