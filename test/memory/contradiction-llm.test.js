import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory } from '../../src/memory/store.js';
import { detectContradictionsForMemory } from '../../src/memory/consolidate.js';
import { getStats, reset } from '../../src/llm/stats.js';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});
beforeEach(() => reset());

const ollamaCfg = { llm: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2:3b' } };
const reply = (obj) => async () => ({ ok: true, json: async () => ({ message: { content: JSON.stringify(obj) } }) });

function freshDb() {
  const tmp = path.join(os.tmpdir(), 'engram-contra-llm-' + Date.now() + '-' + Math.floor(performance.now()));
  fs.mkdirSync(tmp, { recursive: true });
  const db = initDatabase(path.join(tmp, 'memory.db'));
  return { db, tmp };
}

function seedPair(db) {
  // Version-mismatch triggers the heuristic (seemsContradictory) at 0.85.
  createMemory(db, { content: 'The database runs version 14.', entity: 'database', namespace: 'default' });
  const fresh = createMemory(db, { content: 'The database runs version 15.', entity: 'database', namespace: 'default' });
  return fresh;
}

describe('LLM contradiction confirmation instrumentation', () => {
  it('CONFIRMED: model says contradicts → contradiction kept + stats', async () => {
    const { db } = freshDb();
    const fresh = seedPair(db);
    global.fetch = vi.fn(reply({ contradicts: true }));
    const created = await detectContradictionsForMemory(db, fresh, ollamaCfg);
    expect(created.length).toBe(1);
    const s = getStats();
    expect(s.contradictionsConfirmed).toBe(1);
    expect(s.recentEvents[0]).toMatchObject({ op: 'contradiction', outcome: 'confirmed' });
    db.close();
  });

  it('FILTERED: model says no contradiction → dropped (false positive) + stats', async () => {
    const { db } = freshDb();
    const fresh = seedPair(db);
    global.fetch = vi.fn(reply({ contradicts: false }));
    const created = await detectContradictionsForMemory(db, fresh, ollamaCfg);
    expect(created.length).toBe(0); // filtered out
    const s = getStats();
    expect(s.contradictionsFiltered).toBe(1);
    expect(s.recentEvents[0]).toMatchObject({ op: 'contradiction', outcome: 'filtered' });
    db.close();
  });

  it('DISABLED: heuristic still flags, no LLM call, no stats', async () => {
    const { db } = freshDb();
    const fresh = seedPair(db);
    global.fetch = vi.fn();
    const created = await detectContradictionsForMemory(db, fresh, null);
    expect(created.length).toBe(1); // heuristic kept it
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getStats().calls).toBe(0);
    db.close();
  });
});
