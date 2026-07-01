import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  recordCall,
  recordEvent,
  recordSkippedConfirmations,
  getStats,
  reset,
  initStats
} from '../../src/llm/stats.js';
import { llmComplete } from '../../src/llm/index.js';
import { extractMemoryLLM } from '../../src/extract/llm.js';
import { resetBreaker } from '../../src/llm/breaker.js';
import { initDatabase } from '../../src/memory/store.js';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
  initStats(null); // unbind so the in-memory suites stay isolated
});
beforeEach(() => {
  initStats(null);
  reset();
  resetBreaker();
});

const ollamaCfg = { llm: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2:3b' } };
const mockFetch = (h) => (global.fetch = vi.fn(h));
const ollamaReply = (content) => async () => ({ ok: true, json: async () => ({ message: { content } }) });

describe('stats tracker', () => {
  it('starts empty', () => {
    const s = getStats();
    expect(s.calls).toBe(0);
    expect(s.recentEvents).toEqual([]);
    expect(s.avgLatencyMs).toBe(0);
  });

  it('counts calls, failures, timeouts and computes avg latency', () => {
    recordCall({ latencyMs: 100, status: 'ok' });
    recordCall({ latencyMs: 300, status: 'ok' });
    recordCall({ latencyMs: 50, status: 'timeout' });
    recordCall({ latencyMs: 0, status: 'error', error: 'boom' });
    const s = getStats();
    expect(s.calls).toBe(4);
    expect(s.timeouts).toBe(1);
    expect(s.failures).toBe(1);
    expect(s.avgLatencyMs).toBe(Math.round((100 + 300 + 50 + 0) / 4));
    expect(s.lastError.message).toBe('boom');
  });

  it('bumps op counters and pushes events (most-recent-first)', () => {
    recordEvent({ op: 'extract', outcome: 'enhanced', latencyMs: 10 });
    recordEvent({ op: 'contradiction', outcome: 'filtered', latencyMs: 20 });
    const s = getStats();
    expect(s.extractionsEnhanced).toBe(1);
    expect(s.contradictionsFiltered).toBe(1);
    expect(s.recentEvents[0].outcome).toBe('filtered');
    expect(s.recentEvents[1].outcome).toBe('enhanced');
  });

  it('caps the ring buffer at 50', () => {
    for (let i = 0; i < 60; i++) recordEvent({ op: 'extract', outcome: 'enhanced' });
    expect(getStats().recentEvents.length).toBe(50);
  });

  it('reset() clears everything', () => {
    recordCall({ latencyMs: 5, status: 'ok' });
    recordEvent({ op: 'extract', outcome: 'enhanced' });
    reset();
    const s = getStats();
    expect(s.calls).toBe(0);
    expect(s.recentEvents).toEqual([]);
    expect(s.extractionsEnhanced).toBe(0);
  });
});

describe('instrumentation outcomes', () => {
  it('DISABLED records nothing and makes no network call', async () => {
    global.fetch = vi.fn();
    await extractMemoryLLM('User prefers Fastify', { source: 't' }, null);
    expect(global.fetch).not.toHaveBeenCalled();
    const s = getStats();
    expect(s.calls).toBe(0);
    expect(s.recentEvents).toEqual([]);
  });

  it('records "enhanced" + a call on success', async () => {
    mockFetch(ollamaReply('{"category":"decision","entity":"x","confidence":0.9}'));
    await extractMemoryLLM('we chose fastify', { source: 't' }, ollamaCfg);
    const s = getStats();
    expect(s.extractionsEnhanced).toBe(1);
    expect(s.calls).toBe(1);
    expect(s.recentEvents[0]).toMatchObject({ op: 'extract', outcome: 'enhanced' });
  });

  it('records "fallback" + a failure when the call errors', async () => {
    mockFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    await extractMemoryLLM('we chose fastify', { source: 't' }, ollamaCfg);
    const s = getStats();
    expect(s.extractionsFallback).toBe(1);
    expect(s.failures).toBe(1);
    expect(s.recentEvents.some((e) => e.outcome === 'fallback')).toBe(true);
  });

  it('records a timeout counter on abort', async () => {
    mockFetch(
      (url, opts) =>
        new Promise((_res, rej) => opts.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          rej(e);
        }))
    );
    const r = await llmComplete({ llm: { provider: 'ollama', timeoutMs: 20 } }, { prompt: 'hi' });
    expect(r).toBeNull();
    expect(getStats().timeouts).toBe(1);
  });
});

describe('DB-backed stats (cross-process)', () => {
  let dir;
  let dbPath;
  let writer;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-stats-'));
    dbPath = path.join(dir, 'memory.db');
    writer = initDatabase(dbPath);
    initStats(writer); // simulate the MCP (writer) process
  });

  afterEach(() => {
    initStats(null);
    if (writer) writer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists counters so a second handle (the REST process) sees them', () => {
    recordCall({ latencyMs: 200, status: 'ok', model: 'qwen3:1.7b' });
    recordEvent({ op: 'extract', outcome: 'enhanced', latencyMs: 200, model: 'qwen3:1.7b' });

    // Reader = a *different* DB handle on the same file (the REST process).
    const reader = initDatabase(dbPath);
    initStats(reader);
    const s = getStats();
    expect(s.calls).toBe(1);
    expect(s.extractionsEnhanced).toBe(1);
    expect(s.avgLatencyMs).toBe(200);
    expect(s.recentEvents[0]).toMatchObject({ op: 'extract', outcome: 'enhanced' });
    reader.close();
  });

  it('keeps recentEvents newest-first and bounded to 50', () => {
    for (let i = 0; i < 60; i++) {
      recordEvent({ op: 'extract', outcome: i % 2 ? 'enhanced' : 'fallback' });
    }
    const s = getStats();
    expect(s.recentEvents.length).toBe(50);
    // the very last event recorded was i=59 (odd) → 'enhanced'
    expect(s.recentEvents[0].outcome).toBe('enhanced');
    const rowCount = writer.prepare('SELECT COUNT(*) AS n FROM llm_events').get().n;
    expect(rowCount).toBe(50);
  });

  it('accumulates skipped-confirmation counts', () => {
    recordSkippedConfirmations(3);
    recordSkippedConfirmations();
    expect(getStats().contradictionsConfirmSkipped).toBe(4);
  });

  it('reset() clears both the tables and memory', () => {
    recordCall({ latencyMs: 5, status: 'ok' });
    recordEvent({ op: 'extract', outcome: 'enhanced' });
    reset();
    const s = getStats();
    expect(s.calls).toBe(0);
    expect(s.recentEvents).toEqual([]);
    expect(writer.prepare('SELECT COUNT(*) AS n FROM llm_events').get().n).toBe(0);
  });
});
