import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory, deleteMemory, createContradiction } from '../../src/memory/store.js';
import { runAudit } from '../../src/memory/audit.js';

describe('runAudit', () => {
  let db;
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-audit-'));
    db = initDatabase(path.join(dir, 'memory.db'));
  });

  afterEach(() => {
    if (db) db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports hasSecrets=false for a clean store', () => {
    createMemory(db, { content: 'User prefers Fastify over Express', namespace: 'proj' });
    const report = runAudit(db);
    expect(report.hasSecrets).toBe(false);
    expect(report.secrets.count).toBe(0);
    expect(report.stats.total).toBe(1);
  });

  it('flags a memory whose content contains a secret', () => {
    createMemory(db, { content: 'safe memory', namespace: 'proj' });
    createMemory(db, {
      content: `leaked key sk-${'a'.repeat(40)} do not store`,
      namespace: 'proj'
    });
    const report = runAudit(db);
    expect(report.hasSecrets).toBe(true);
    expect(report.secrets.count).toBe(1);
    expect(report.secrets.findings[0].types.length).toBeGreaterThan(0);
  });

  it('scopes the secret scan to a namespace', () => {
    createMemory(db, { content: `sk-${'b'.repeat(40)}`, namespace: 'leaky' });
    createMemory(db, { content: 'clean', namespace: 'other' });
    expect(runAudit(db, { namespace: 'other' }).hasSecrets).toBe(false);
    expect(runAudit(db, { namespace: 'leaky' }).hasSecrets).toBe(true);
  });

  it('tolerates contradictions with null memory refs (SET NULL history)', () => {
    const a = createMemory(db, { content: 'uses postgres 14', entity: 'db' });
    const b = createMemory(db, { content: 'uses postgres 15', entity: 'db' });
    createContradiction(db, {
      memory1_id: a.id,
      memory2_id: b.id,
      confidence: 0.6,
      reason: 'version conflict',
      category: 'fact',
      entity: 'db'
    });
    deleteMemory(db, a.id); // FK SET NULL — contradiction row survives with a null ref

    const report = runAudit(db);
    expect(() => report).not.toThrow();
    expect(report.unresolvedContradictions).toBe(1);
    expect(report.stats.total).toBe(1);
  });

  it('includes DB size + encryption status when config is provided', () => {
    createMemory(db, { content: 'hi' });
    const report = runAudit(db, { config: { dataDir: dir } });
    expect(report.dbSizeBytes).toBeGreaterThan(0);
    expect(report.encrypted).toBe(false);
  });
});
