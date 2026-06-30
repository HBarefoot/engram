import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRESTServer } from '../../src/server/rest.js';

describe('REST /api/llm/status + /api/llm/stats', () => {
  let fastify;
  let tmpDir;
  const realFetch = global.fetch;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), 'engram-llm-stats-test-' + Date.now());
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });
    fastify = createRESTServer({ dataDir: tmpDir });
    await fastify.ready();
  });
  afterAll(async () => {
    await fastify.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
  afterEach(() => {
    global.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it('status reports disabled with no network call when llm is off', async () => {
    global.fetch = vi.fn();
    const res = await fastify.inject({ method: 'GET', url: '/api/llm/status' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ enabled: false, reachable: false, latencyMs: null, checkedAt: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stats returns the counter + recent-events contract', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/llm/stats' });
    const body = res.json();
    for (const k of [
      'enabled', 'calls', 'failures', 'timeouts',
      'extractionsEnhanced', 'extractionsFallback',
      'contradictionsConfirmed', 'contradictionsFiltered',
      'avgLatencyMs', 'recentEvents'
    ]) {
      expect(body).toHaveProperty(k);
    }
    expect(Array.isArray(body.recentEvents)).toBe(true);
  });

  it('status reachability is throttled/cached (one probe across rapid polls)', async () => {
    // Enable the layer, then mock the probe; two quick GETs should only fetch once.
    await fastify.inject({
      method: 'PUT',
      url: '/api/config/llm',
      payload: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2:3b' }
    });
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: 'ok' } }) }));

    const a = (await fastify.inject({ method: 'GET', url: '/api/llm/status' })).json();
    const b = (await fastify.inject({ method: 'GET', url: '/api/llm/status' })).json();

    expect(a.enabled).toBe(true);
    expect(a.reachable).toBe(true);
    expect(b.reachable).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1); // cached, not re-probed
  });
});
