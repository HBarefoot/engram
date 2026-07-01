import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import {
  initDatabase,
  createMemory,
  searchMemories,
  getStats,
  encryptDatabase
} from '../../src/memory/store.js';
import { resolveEncryptionKey } from '../../src/config/index.js';

const require = createRequire(import.meta.url);

// The cipher build is an OPTIONAL dependency. Skip the at-rest suite cleanly
// when it isn't installed (matches the "one CI leg without it" matrix).
let cipherAvailable = true;
try {
  require('better-sqlite3-multiple-ciphers');
} catch {
  cipherAvailable = false;
}
const describeCipher = cipherAvailable ? describe : describe.skip;

const KEY = 'correct horse battery staple';

describeCipher('encryption at rest', () => {
  let dir;
  let dbPath;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-enc-'));
    dbPath = path.join(dir, 'memory.db');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a freshly-created encrypted DB with the correct key', () => {
    const db = initDatabase(dbPath, { encryptionKey: KEY });
    createMemory(db, { content: 'user prefers Fastify', entity: 'stack' });
    db.close();

    const reopened = initDatabase(dbPath, { encryptionKey: KEY });
    expect(getStats(reopened).total).toBe(1);
    // FTS still works through the encrypted store.
    expect(searchMemories(reopened, 'Fastify').length).toBe(1);
    reopened.close();
  });

  it('throws a friendly error on a wrong key', () => {
    const db = initDatabase(dbPath, { encryptionKey: KEY });
    createMemory(db, { content: 'secret-ish note' });
    db.close();

    expect(() => initDatabase(dbPath, { encryptionKey: 'wrong-key' })).toThrow(
      /encrypted — wrong or missing ENGRAM_DB_KEY/
    );
  });

  it('cannot be opened as plaintext once encrypted', () => {
    const db = initDatabase(dbPath, { encryptionKey: KEY });
    createMemory(db, { content: 'note' });
    db.close();
    expect(() => initDatabase(dbPath)).toThrow();
  });

  it('encryptDatabase migrates a plaintext DB, preserving rows + FTS', () => {
    // Build a plaintext store first.
    const plain = initDatabase(dbPath);
    createMemory(plain, { content: 'deploys via GitHub Actions', entity: 'ci' });
    createMemory(plain, { content: 'uses PostgreSQL 15', entity: 'db' });
    const before = getStats(plain).total;
    plain.close();

    encryptDatabase(dbPath, KEY);
    // Stale plaintext WAL sidecar was cleaned up by the migration.
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);

    // Plaintext open now fails; keyed open works and data is intact.
    expect(() => initDatabase(dbPath)).toThrow();
    const enc = initDatabase(dbPath, { encryptionKey: KEY });
    expect(getStats(enc).total).toBe(before);
    expect(searchMemories(enc, 'PostgreSQL').length).toBe(1);
    enc.close();
  });
});

describe('resolveEncryptionKey', () => {
  const prev = process.env.ENGRAM_DB_KEY;
  afterEach(() => {
    if (prev === undefined) delete process.env.ENGRAM_DB_KEY;
    else process.env.ENGRAM_DB_KEY = prev;
  });

  it('returns null when encryption is disabled', () => {
    delete process.env.ENGRAM_DB_KEY;
    expect(resolveEncryptionKey({ security: { encryption: { enabled: false } } })).toBeNull();
    expect(resolveEncryptionKey({})).toBeNull();
  });

  it('prefers the ENGRAM_DB_KEY env var', () => {
    process.env.ENGRAM_DB_KEY = 'from-env';
    const key = resolveEncryptionKey({ security: { encryption: { enabled: true } } });
    expect(key).toBe('from-env');
  });

  it('falls back to a key file', () => {
    delete process.env.ENGRAM_DB_KEY;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-keyfile-'));
    const keyFile = path.join(dir, 'db.key');
    fs.writeFileSync(keyFile, 'from-file\n');
    const key = resolveEncryptionKey({ security: { encryption: { enabled: true, keyFile } } });
    expect(key).toBe('from-file');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('throws when enabled but no key is available', () => {
    delete process.env.ENGRAM_DB_KEY;
    expect(() => resolveEncryptionKey({ security: { encryption: { enabled: true } } })).toThrow(
      /no key was found/
    );
  });
});
