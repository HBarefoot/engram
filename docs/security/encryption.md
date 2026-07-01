# Encryption at rest (opt-in)

Engram can encrypt its SQLite database (`memory.db`) at rest using AES-256
(SQLCipher-compatible, via wxSQLite3). It is **off by default** — default
installs are byte-for-byte unchanged and add zero footprint.

## Threat model

Encryption at rest protects your memories **on disk**: a stolen laptop, a
backed-up disk image, or a copied `memory.db` file cannot be read without the
key. It does **not** protect a running process — once Engram is started with the
key, anything that can talk to the MCP/REST server can read memories, and the
key lives in that process's memory. It is not a substitute for OS-level access
control.

Only `memory.db` is encrypted. The embedding model cache in `~/.engram/models`
is public model data (not sensitive) and is left as-is.

## Prerequisites

The cipher is provided by an **optional** dependency that is not installed by
default (so it never bloats the zero-config install):

```bash
npm i better-sqlite3-multiple-ciphers
```

This is an API-compatible fork of `better-sqlite3` that bundles wxSQLite3. Engram
loads it lazily — only when a key is configured. If a key is set but the module
is missing, Engram fails with a clear message telling you to install it.

## Key management

The raw key is **never** stored in `config.json` (which is plaintext). Engram
resolves the key in this order when `security.encryption.enabled` is true:

1. `ENGRAM_DB_KEY` environment variable (preferred — CI/container friendly)
2. `security.encryption.keyFile` — a path to a file containing the key (chmod `600`)

If encryption is enabled but no key is found, Engram refuses to start rather than
silently writing an unencrypted database.

> **Losing the key means losing the database.** There is no recovery. Store it in
> a password manager / secret store.

## Enabling encryption on an existing database

```bash
export ENGRAM_DB_KEY='your-strong-passphrase'
engram encrypt
```

`engram encrypt` backs up the plaintext database first (a timestamped
`memory.db.engram-backup-…` via `VACUUM INTO`), rewrites the database under the
key in place, and sets `security.encryption.enabled = true` in your config.
Delete the plaintext backup once you've confirmed the encrypted database opens.

From then on, every entry point (`engram start`, the MCP server, the REST server,
all CLI commands) needs `ENGRAM_DB_KEY` (or the key file) present.

## Rotating the key

```bash
export ENGRAM_DB_KEY='current-passphrase'
engram rekey 'new-passphrase'
# then update ENGRAM_DB_KEY to the new passphrase everywhere
```

## Configuration

```jsonc
// ~/.engram/config.json
{
  "security": {
    "encryption": {
      "enabled": false,      // opt-in
      "keyFile": null,       // optional path; ENGRAM_DB_KEY wins
      "kdfIterations": 256000 // wxSQLite3 default
    }
  }
}
```

## Backups

`engram purge` and `engram audit --fix` (and `engram encrypt`) take a timestamped
backup via `VACUUM INTO` before mutating. On an encrypted database the backup is
written with the **same key** — treat backup files with the same care as the live
database. `VACUUM INTO` produces a single consistent file, so there are no
`-wal`/`-shm` sidecars to copy.

## Wrong-key behavior

Opening an encrypted database with a wrong or missing key surfaces a clear error
— *"Database is encrypted — wrong or missing ENGRAM_DB_KEY"* — rather than a raw
SQLite stack trace.

## Roadmap

- OS-keychain key storage (`keySource: "keychain"`) as an optional convenience
  layer. It is intentionally **not** the default, because binding Engram to a
  platform credential store (macOS Keychain / libsecret / Windows Credential
  Manager) would undercut the cross-platform, single-binary, offline guarantee.
