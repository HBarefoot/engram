import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase } from '../../src/memory/store.js';
import { maybeShowNudge } from '../../src/utils/nudge.js';

const NUDGE_KEY = 'feedback_nudge_shown_v1';

function fakeStream(isTTY) {
  const writes = [];
  return {
    isTTY,
    writes,
    write(s) {
      writes.push(s);
      return true;
    }
  };
}

describe('maybeShowNudge', () => {
  let tmpDir;
  let db;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), 'engram-nudge-test-' + Date.now() + '-' + Math.floor(performance.now() * 1000));
    fs.mkdirSync(tmpDir, { recursive: true });
    db = initDatabase(path.join(tmpDir, 'memory.db'));
  });

  afterEach(() => {
    if (db) db.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fires once on a fresh DB and never again', () => {
    const stream = fakeStream(true);
    const first = maybeShowNudge(db, { stream, env: {} });

    expect(first).toBe(true);
    expect(stream.writes.join('')).toContain('https://github.com/HBarefoot/engram/discussions');
    expect(db.prepare('SELECT value FROM meta WHERE key = ?').get(NUDGE_KEY)).toBeTruthy();

    // Second call: marker already set → nothing printed.
    const stream2 = fakeStream(true);
    const second = maybeShowNudge(db, { stream: stream2, env: {} });
    expect(second).toBe(false);
    expect(stream2.writes).toHaveLength(0);
  });

  it('is suppressed on a non-TTY stream (piped / MCP stdio)', () => {
    const stream = fakeStream(false);
    const result = maybeShowNudge(db, { stream, env: {} });

    expect(result).toBe(false);
    expect(stream.writes).toHaveLength(0);
    // No marker written, so it stays eligible for a real interactive run later.
    expect(db.prepare('SELECT value FROM meta WHERE key = ?').get(NUDGE_KEY)).toBeUndefined();
  });

  it('is suppressed by the ENGRAM_NO_NUDGE env flag', () => {
    const stream = fakeStream(true);
    const result = maybeShowNudge(db, { stream, env: { ENGRAM_NO_NUDGE: '1' } });

    expect(result).toBe(false);
    expect(stream.writes).toHaveLength(0);
    expect(db.prepare('SELECT value FROM meta WHERE key = ?').get(NUDGE_KEY)).toBeUndefined();
  });

  it('is suppressed in CI', () => {
    const stream = fakeStream(true);
    const result = maybeShowNudge(db, { stream, env: { CI: 'true' } });

    expect(result).toBe(false);
    expect(stream.writes).toHaveLength(0);
  });
});
