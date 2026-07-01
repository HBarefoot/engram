# Engram v1.10.0 — Release notes

A hardening release: **opt-in encryption at rest**, **audit/purge safety commands**,
and a fix that makes the desktop **AI-Enhancement panel report real cross-process
activity**. Everything here is additive or opt-in — the default behavior and the
disabled-LLM path are unchanged.

## Added

### 🔐 Encryption at rest (opt-in, off by default)

- Encrypt the memory database with **AES-256**. Off by default; the default path is
  byte-identical to before (no key = no cipher, no behavior change).
- Enable via `security.encryption`. The key is read from the **`ENGRAM_DB_KEY`** env
  var (or a `keyFile`) — never stored in plaintext in `config.json`.
- New commands: **`engram encrypt`** (encrypt an existing plaintext DB, backs up
  first) and **`engram rekey`** (rotate the key in place).
- Encryption uses the drop-in `better-sqlite3-multiple-ciphers` build, loaded lazily
  **only when a key is set**. It's an opt-in dependency — install it with
  `npm i better-sqlite3-multiple-ciphers`; a clear message tells you if it's missing.
- A wrong or missing key surfaces a friendly "database is encrypted" error, not a
  stack trace. Only `memory.db` is encrypted (not the model cache).
- Docs: `docs/security/encryption.md` (threat model, setup, key rotation, backups).

### 🧹 `engram audit` + `engram purge` (safety commands)

- **`engram audit`** — read-only health + safety scan. Re-runs secret detection over
  every stored memory (catches anything saved before detection existed or via
  `force`), plus a rollup of stale / never-recalled / duplicate memories,
  contradiction count, DB size, and encryption status. Supports `--json` and `--fix`,
  and **exits non-zero when secrets are found** (usable as a CI gate).
- **`engram purge`** — guarded bulk delete. **Dry-run by default**, requires `--yes`,
  and **backs up the database first**. Target with `--namespace` (alias `--project`),
  `--stale`, `--before <date>`, or `--all`. Dependent feedback/contradiction rows
  clean up automatically via existing foreign keys.
- New shared `backupDatabase` helper (uses SQLite `VACUUM INTO`).

### 📊 Cross-process LLM observability (fix)

- The optional LLM layer's stats now persist to the database (`llm_stats` +
  `llm_events`) instead of a per-process in-memory counter. The desktop
  **AI-Enhancement** panel now reflects extractions performed by the **MCP server**
  and CLI — previously it only saw activity from its own process, so agent-driven
  extractions never showed up.
- `initStats(db)` is bound across the MCP server, REST server, and all one-shot CLI
  commands, so terminal-driven activity is counted too. The `getStats()` contract is
  unchanged; with no DB bound (embedded/tests) it falls back to in-memory.

## Notes

- All three features are **opt-in or additive**. If you don't set an encryption key,
  don't run the new commands, and don't enable the LLM layer, nothing changes.
- Encryption protects data **at rest** (stolen disk / backup). It does not protect a
  running process, and losing your key means losing the database — store it safely.

## Upgrade

```
npm install -g @hbarefoot/engram@1.10.0
```

Existing databases open unchanged. To adopt encryption on an existing DB:
`npm i better-sqlite3-multiple-ciphers`, set `ENGRAM_DB_KEY`, then `engram encrypt`.
