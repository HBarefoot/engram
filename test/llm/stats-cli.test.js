import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase } from '../../src/memory/store.js';
import { initStats, recordEvent, getStats, reset } from '../../src/llm/stats.js';

/**
 * Regression for the F3 CLI gap: one-shot CLI commands (remember, consolidate, …)
 * open their own DB and must call initStats(db) so LLM activity is written to the
 * shared llm_stats / llm_events tables. Otherwise events go to the in-memory
 * fallback and vanish on process exit — the desktop AI-Enhancement panel (a
 * separate process reading the DB) would never see them.
 *
 * We simulate the two processes with two independent DB handles to one file:
 * the "CLI" handle writes, the "panel" handle reads.
 */
describe('F3 CLI stats persistence (CLI-writes / panel-reads)', () => {
  let dir;
  let dbPath;
  let cliDb;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-stats-cli-'));
    dbPath = path.join(dir, 'memory.db');
    cliDb = initDatabase(dbPath);
    initStats(cliDb); // this is exactly what the CLI command actions now do
  });

  afterEach(() => {
    initStats(null);
    reset();
    if (cliDb) cliDb.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('an extraction event recorded by the CLI is visible to a separate reader', () => {
    recordEvent({ op: 'extract', outcome: 'enhanced', model: 'engram-extract' });

    // A second handle to the same file = the desktop panel's process.
    const panelDb = initDatabase(dbPath);
    initStats(panelDb);
    const stats = getStats();
    expect(stats.extractionsEnhanced).toBe(1);
    expect(stats.recentEvents[0]).toMatchObject({ op: 'extract', outcome: 'enhanced' });
    panelDb.close();
  });

  it('llm_events never exceeds MAX_EVENTS (50)', () => {
    for (let i = 0; i < 65; i++) {
      recordEvent({ op: 'extract', outcome: i % 2 ? 'enhanced' : 'fallback' });
    }
    expect(getStats().recentEvents.length).toBe(50);
    const rowCount = cliDb.prepare('SELECT COUNT(*) AS n FROM llm_events').get().n;
    expect(rowCount).toBe(50);
  });
});
