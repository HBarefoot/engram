import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory, getMemory } from '../../src/memory/store.js';

function tmpPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-extmethod-'));
  return path.join(dir, 'memory.db');
}

describe('extraction_method column + migration', () => {
  it('createMemory marks llm vs rules', () => {
    const db = initDatabase(tmpPath());
    const llm = createMemory(db, { content: 'a', category: 'fact', extraction_method: 'llm' });
    const rules = createMemory(db, { content: 'b', category: 'fact' });
    expect(getMemory(db, llm.id).extraction_method).toBe('llm');
    expect(getMemory(db, rules.id).extraction_method).toBe('rules');
    db.close();
  });

  it('only "llm" is honored; anything else stores rules', () => {
    const db = initDatabase(tmpPath());
    const m = createMemory(db, { content: 'c', extraction_method: 'something-else' });
    expect(getMemory(db, m.id).extraction_method).toBe('rules');
    db.close();
  });

  it('migration is idempotent (re-opening the same DB does not throw)', () => {
    const p = tmpPath();
    const db1 = initDatabase(p);
    createMemory(db1, { content: 'd' });
    db1.close();
    // Re-running migrations on an existing DB must not throw on the duplicate ALTER.
    const db2 = initDatabase(p);
    const cols = db2.prepare("PRAGMA table_info('memories')").all().map((c) => c.name);
    expect(cols.filter((c) => c === 'extraction_method').length).toBe(1);
    db2.close();
  });

  it('pre-existing rows (inserted without the column) read as "rules"', () => {
    const db = initDatabase(tmpPath());
    const now = Date.now();
    // Simulate a legacy write that omits extraction_method; DEFAULT backfills it.
    db.prepare(
      `INSERT INTO memories (id, content, category, confidence, source, namespace, tags, created_at, updated_at)
       VALUES (?, ?, 'fact', 0.8, 'manual', 'default', '[]', ?, ?)`
    ).run('legacy-1', 'legacy memory', now, now);
    expect(getMemory(db, 'legacy-1').extraction_method).toBe('rules');
    db.close();
  });
});
