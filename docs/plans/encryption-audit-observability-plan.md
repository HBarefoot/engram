# Implementation Plan — Encryption at Rest, Audit/Purge, Cross-Process Observability

Status: proposed · Target: post-1.9.1 · Author: planning session 2026-07-01

Three independent features. Each ships on its own branch and can merge separately.
All three respect the invariants: zero-config default, works fully offline, no
telemetry, single-binary/embeddable, MIT.

---

## Feature 1 — SQLCipher encryption at rest (opt-in)

### Design decision — binding + key model

**Binding: `better-sqlite3-multiple-ciphers` (lazy, not a hard dependency).**
It is a drop-in, API-compatible fork of `better-sqlite3` that bundles wxSQLite3
(AES-256, SQLCipher-compatible) and includes FTS5. Because it is API-identical,
`initDatabase` needs no rewrite — only the constructor import and a `PRAGMA key`
change. We do **not** add it to `dependencies` (that would inflate every install
and dent the "single-binary, embeddable" wedge). Instead:

- Default installs keep `better-sqlite3` exactly as today — zero change, zero
  footprint added.
- When (and only when) a key is configured, `initDatabase` does a dynamic
  `import('better-sqlite3-multiple-ciphers')`. If the module is absent, fail with
  a clear, actionable message: *"Encryption requires the cipher build: run
  `npm i better-sqlite3-multiple-ciphers`."*
- Document it in the README encryption section + `docs/security/encryption.md`.

**Key model: opt-in passphrase, OFF by default — RECOMMENDED (you asked which).**

Rationale for choosing passphrase over OS-keychain:
- Preserves the zero-config default (nothing changes for the 99% who don't opt in).
- Keeps the embeddable/offline/cross-platform story intact. OS-keychain binds
  Engram to a platform-specific credential store (macOS Keychain / libsecret /
  Windows Credential Manager) — exactly the kind of platform dependency that
  fights "runs anywhere, single binary." That is the differentiator we protect.
- Passphrase-via-env is the standard for embedded encrypted SQLite and is
  CI/container friendly.

Key source precedence (never store the raw key in `config.json` plaintext):
1. `ENGRAM_DB_KEY` env var (preferred).
2. `security.encryption.keyFile` — path to a file containing the key (0600).
3. Interactive prompt (`engram` TTY commands only) if `security.encryption.enabled`
   is true and no key is found.

OS-keychain stays on the roadmap as an **optional convenience layer later**
(`security.encryption.keySource: "keychain"`), not v1.

### Config additions (`src/config/index.js`)

```js
security: {
  secretDetection: true,
  auditLog: false,
  encryption: {
    enabled: false,      // opt-in
    keyFile: null,       // optional; env var wins
    kdfIterations: 256000 // wxSQLite3 default is fine; expose for tuning
  }
}
```

### Files to change

- `src/config/index.js` — add the `security.encryption` block + a
  `resolveEncryptionKey(config)` helper (env → keyFile → prompt) that returns the
  key or null. Never log it.
- `src/memory/store.js` — `initDatabase(dbPath, { encryptionKey } = {})`:
  - if `encryptionKey`, `const Database = (await import('better-sqlite3-multiple-ciphers')).default`
    (makes `initDatabase` async — see ripple below), else current sync
    `better-sqlite3`.
  - immediately after open, before any query:
    `db.pragma("cipher='sqlcipher'"); db.pragma(\`key='\${key}'\`);` then the
    existing `journal_mode = WAL` / `foreign_keys = ON`.
  - wrap the first read (e.g. `db.pragma('user_version')`) in try/catch to turn a
    wrong-key `SQLITE_NOTADB` into a friendly *"database is encrypted — wrong or
    missing ENGRAM_DB_KEY"* error instead of a stack trace.
- **Ripple: `initDatabase` becomes async only in the encrypted path.** Simplest:
  keep it sync for the default path and add `initDatabaseAsync` used by the entry
  points (`bin/engram.js`, `server/mcp.js`, `server/rest.js`) that reads the key
  and picks the binding. All call sites already `await` around startup, so the
  change is contained to the ~6 `initDatabase(getDatabasePath(config))` spots.
- `docs/security/encryption.md` — new: threat model (protects data at rest / stolen
  disk; does NOT protect a running process), setup, key rotation, backup caveats.

### New command — `engram encrypt` / `engram rekey`

wxSQLite3 rekey path for migrating an existing plaintext DB:
- `engram encrypt` — plaintext → encrypted: back up first (see Feature 2 backup
  helper), then `ATTACH DATABASE 'memory.enc.db' AS enc KEY '<key>'; SELECT
  sqlcipher_export('enc'); DETACH enc;`, swap files atomically.
- `engram rekey` — change key on an already-encrypted DB:
  `db.pragma("rekey='<newkey>'")`.
- Both print the "store your key safely — losing it means losing the DB" warning.

### Tests (`test/security/encryption.test.js`)

- open+write+reopen with correct key round-trips.
- reopen with wrong/no key throws the friendly error.
- unencrypted default path is byte-identical behavior (regression guard).
- `sqlcipher_export` migration preserves row counts + FTS search results.
- skip the suite cleanly if the cipher module isn't installed (CI matrix: one leg
  with it, one without).

### Risks / notes
- WAL + encryption: the `-wal`/`-shm` sidecar files are encrypted too; backup logic
  (Feature 2) must copy all three or checkpoint first.
- Embedding model cache in `~/.engram/models` is NOT encrypted (not sensitive) —
  document that only `memory.db` is encrypted.

---

## Feature 2 — `engram audit` + `engram purge` safety commands

### `engram audit` (read-only, CI-friendly)

Reuses existing machinery — no new detection logic.

Behavior:
- Runs `detectSecrets()` (`src/extract/secrets.js`) over every memory's `content`
  to catch anything stored before detection existed or via `force: true`.
- Reports, per section: total memories + breakdown by namespace/category (reuse
  `getStats`), stale memories (low confidence + old `last_accessed`),
  never-recalled (`access_count = 0`), duplicate clusters (reuse
  `/api/analytics/duplicates` logic), unresolved contradiction count, DB size,
  and encryption status (encrypted? yes/no).
- Flags: `--json` (machine output), `--namespace <n>` (scope), `--fix` (redact
  detected secrets in place via `redactSecrets` + flag the row; requires the same
  backup-first guard as purge).
- **Exit code non-zero when secrets are found** so it can gate CI / pre-commit.

New code:
- `src/memory/audit.js` — `runAudit(db, { namespace })` returns a structured
  report object (pure, testable).
- `bin/engram.js` — `.command('audit')` → format with `cli-table3` (already a dep)
  or emit `--json`.
- Optional: `GET /api/audit` in `src/server/rest.js` reusing `runAudit` for the
  dashboard "Health" page.

### `engram purge` (destructive, guarded)

Schema note: memory says `--project=X`; the column is `namespace`. Ship
`--namespace` as canonical with `--project` as an alias.

Guard sequence (Quality Rule #8 — back up before modifying):
1. Resolve target set (`--namespace <n>` | `--stale` | `--before <date>` |
   `--all`) and **count** it.
2. **Dry-run is the default.** Print exactly what would be deleted; require an
   explicit `--yes` (or interactive: type the namespace name to confirm) to
   proceed.
3. Timestamped backup: copy `memory.db` (+ `-wal`/`-shm`, or checkpoint first) to
   `memory.db.engram-backup-<ISO>` before any delete. Shared helper
   `src/utils/backup.js#backupDatabase(config)` — also used by `audit --fix` and
   `encrypt`.
4. `DELETE FROM memories WHERE namespace = ?` — feedback + contradiction rows
   cascade via existing FKs (`ON DELETE CASCADE` / `SET NULL`). FTS stays in sync
   via existing triggers.
5. Report deleted counts + backup path.

New code:
- `src/memory/store.js` — `deleteMemoriesByNamespace(db, ns)`,
  `deleteStaleMemories(db, { before, minConfidence })`, each returning counts.
- `src/utils/backup.js` — `backupDatabase(config)`.
- `bin/engram.js` — `.command('purge')` with the guard sequence above.

### Tests
- `test/memory/audit.test.js` — planted secret is detected + non-zero exit; clean
  store exits 0; `--json` shape.
- `test/cli/purge.test.js` — dry-run deletes nothing; `--yes` deletes only the
  target namespace and leaves others intact; backup file is created; cascade
  removes dependent feedback/contradiction rows.

---

## Feature 3 — Cross-process LLM observability fix

### Problem (confirmed in code)
`src/llm/stats.js` is an in-memory singleton, one per Node process. `engram start`
runs REST/dashboard in one process; agents' real memory writes (and thus real
LLM extractions) happen in a **separate** MCP stdio process. The dashboard's
`GET /api/llm/stats` reads the REST process's singleton, so agent-side extractions
never appear — the AI Enhancement panel shows calls from local probes only and
0 enhanced extractions even when the layer is working.

### Design decision — persist stats to SQLite (RECOMMENDED)

Chosen over IPC or MCP→REST HTTP push because it is local-first, needs no network
(push would break the offline/embeddable guarantee and assumes REST is running),
works regardless of which process is up, and survives restarts. Atomic
`UPDATE ... SET n = n + 1` on a counters table gives correct global totals across
both processes for free.

### Schema (migration in `src/memory/store.js#runMigrations`)

```sql
CREATE TABLE IF NOT EXISTS llm_stats (
  key   TEXT PRIMARY KEY,   -- 'calls','failures','timeouts','extractionsEnhanced',...
  value INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS llm_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  op        TEXT,           -- 'extract' | 'contradiction' | 'call'
  outcome   TEXT,           -- 'enhanced'|'fallback'|'confirmed'|'filtered'|'timeout'|'error'
  latencyMs INTEGER,
  model     TEXT
);
-- keep the ring bounded: after insert, delete rows beyond the newest MAX_EVENTS
```

Also store `avgLatency` inputs (`totalLatencyMs`, reuse `calls`) and `lastError`
as rows in `llm_stats` (JSON string for lastError).

### Files to change
- `src/llm/stats.js` — add `initStats(db)` to bind a DB handle. `recordCall` /
  `recordEvent` / `recordSkippedConfirmations` write-through: bump `llm_stats`
  counters (UPSERT `+1`), insert into `llm_events`, prune to `MAX_EVENTS`.
  `getStats()` reads from the DB. If no DB bound (unit tests, embedded lib use
  without a db), fall back to the current in-memory behavior — keep both paths so
  existing tests pass.
- `src/server/mcp.js` and `src/server/rest.js` — call `initStats(db)` at startup
  after `initDatabase`, so both processes point stats at the same file.
- `src/server/rest.js` `GET /api/llm/stats` — unchanged contract; now returns
  DB-backed numbers (dashboard "just works").

### Tests (`test/llm/stats.test.js`)
- with a DB bound, `recordEvent({outcome:'enhanced'})` in "process A" (one db
  handle) is visible via `getStats()` opened on a second handle to the same file
  — simulates the MCP-writes / REST-reads split.
- `llm_events` never exceeds `MAX_EVENTS`.
- no-DB fallback preserves current in-memory semantics.

### Nice-to-have follow-on
Once stats are DB-backed, the Command Center "Live Agent Activity" feed can read
`llm_events` directly — the ring buffer was already designed to be serializable
for exactly this.

---

## Suggested sequencing

1. **Feature 3 (observability)** — smallest, unblocks trustworthy metrics, no new
   deps, low risk. Do first.
2. **Feature 2 (audit/purge)** — pure JS, reuses secrets + FK cascades; the
   `backupDatabase` helper it introduces is needed by Feature 1's `encrypt`.
3. **Feature 1 (encryption)** — largest surface (async DB init ripple + optional
   native module + migration command); lands last, depends on #2's backup helper.

## Explicitly out of scope (roadmap, not now)
- OS-keychain key storage (Feature 1 later).
- Per-field / embedding encryption (only `memory.db` at rest).
- Remote/multi-node stats aggregation (single-machine only, by design).

## Honest priority note
Per the traction memory (~1.6k weekly downloads, ramping), distribution + product
polish still have more leverage than these hardening items. Feature 3 has the best
user-visible payoff of the three because it makes an existing shipped panel tell
the truth. Encryption is the biggest effort and mostly matters for enterprise /
design-partner conversations — sequence it accordingly.
