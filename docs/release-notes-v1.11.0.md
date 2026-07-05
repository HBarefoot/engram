# Engram v1.11.0 — Release notes

A distribution release: Engram now ships the **judgment layer**, not just the
capability. The MCP server has always given agents memory *tools*; the new bundled
`engram-memory` skill teaches them how to use those tools well. Everything here is
additive and opt-in — nothing installs unless you ask for it.

## Added

### 🧠 `engram-memory` agent skill

- A vendored skill (`skills/engram-memory/SKILL.md`) that teaches an agent the
  *judgment* to use Engram, not just the tools: **recall before acting** at the start
  of a session, **store durable knowledge** as it appears (decisions with their why,
  corrections, preferences, setup/infra facts, outcomes), and **write results back**
  at the end.
- Covers the practical craft: choosing the right **category**
  (`preference` / `fact` / `pattern` / `decision` / `outcome`), `entity`, `confidence`
  and `tags`; using **namespaces** (per-project vs `default`); closing the loop with
  `engram_feedback`; and never storing secrets.
- The skill lives **in the package**, so it versions with Engram — updates ship with
  each release and land on the next `engram skill install`.

### 🛠️ `engram skill install` / `engram skill uninstall`

- **`engram skill install`** copies the skill into an AI assistant's skill directory:
  - default → `~/.claude/skills/engram-memory/`
  - `--project` → `./.claude/skills/engram-memory/` (prints a `git add` hint so teams
    can commit it)
  - `--platform agents` → `~/.agents/skills/engram-memory/`, the cross-framework
    [Agent Skills](https://github.com/anthropics/skills) location (also composes with
    `--project`)
- **Idempotent** — re-running with unchanged content is a no-op. When a differing
  previous version exists, it's **backed up first** (`engram-memory.engram-backup-<ISO>`)
  before the new one is written. Other skills are never touched.
- **`engram skill uninstall`** removes exactly the `engram-memory` directory — backups
  and sibling skills are left alone.
- **Explicit opt-in only** — nothing is installed during `npm install` or
  `engram start`.

### Elsewhere

- The dashboard's Integration wizard now surfaces a one-liner + copy button for
  `engram skill install` alongside the MCP config generator.
- README gains a "Teach your agent to use Engram" section and a CLI-reference entry.

## Notes

- Pure filesystem work, **no new dependencies**. The default and disabled-LLM paths are
  byte-identical to 1.10.0.
- Works in Claude Code, Claude Desktop, Cowork, or any framework that reads the
  `.agents/skills` spec.

## Upgrade

```
npm install -g @hbarefoot/engram@1.11.0
```

Then, once your agent is connected to Engram over MCP:

```
engram skill install
```

Restart your AI assistant to pick up the skill.
