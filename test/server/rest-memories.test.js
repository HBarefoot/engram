import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory } from '../../src/memory/store.js';
import { createRESTServer } from '../../src/server/rest.js';

/**
 * Regression tests for the `source` field being dropped from memory
 * endpoint responses. The dashboard's Agent Integrations page relies on
 * `memory.source` to categorize memories by which agent/tool stored them.
 * If any endpoint omits `source` the page shows "Unknown" for everything.
 */
describe('REST memory endpoints — source field', () => {
  let fastify;
  let baseUrl;
  let tmpDir;
  let seedIds = {};

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), 'engram-rest-memories-test-' + Date.now());
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });

    const dbPath = path.join(tmpDir, 'memory.db');
    const seedDb = initDatabase(dbPath);

    // Seed memories with distinct sources matching the values actually used
    // in production: 'mcp' (MCP server writes), 'cli' (engram remember),
    // 'api' (POST /api/memories), 'import:claude' (import wizard), 'manual'
    // (default).
    seedIds.mcp = createMemory(seedDb, {
      content: 'A memory written via MCP',
      category: 'fact',
      source: 'mcp'
    }).id;
    seedIds.cli = createMemory(seedDb, {
      content: 'A memory written via CLI',
      category: 'preference',
      source: 'cli'
    }).id;
    seedIds.importClaude = createMemory(seedDb, {
      content: 'A memory imported from .claude',
      category: 'fact',
      source: 'import:claude'
    }).id;

    seedDb.close();

    fastify = createRESTServer({ dataDir: tmpDir });
    await fastify.listen({ port: 0, host: '127.0.0.1' });
    const address = fastify.server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (fastify) await fastify.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('GET /api/memories returns the source field for every memory', async () => {
    const res = await fetch(`${baseUrl}/api/memories`);
    expect(res.ok).toBe(true);
    const data = await res.json();

    expect(data.memories.length).toBeGreaterThanOrEqual(3);
    // Every memory must have a `source` key (not undefined)
    for (const m of data.memories) {
      expect(m).toHaveProperty('source');
      expect(typeof m.source).toBe('string');
    }

    // The actual seeded sources must be present
    const sources = new Set(data.memories.map(m => m.source));
    expect(sources.has('mcp')).toBe(true);
    expect(sources.has('cli')).toBe(true);
    expect(sources.has('import:claude')).toBe(true);
  });

  it('GET /api/memories/:id returns the source field', async () => {
    const res = await fetch(`${baseUrl}/api/memories/${seedIds.mcp}`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.memory.source).toBe('mcp');
  });

  it('POST /api/memories/search returns the source field', async () => {
    const res = await fetch(`${baseUrl}/api/memories/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'memory', limit: 10, threshold: 0.0 })
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data.memories)).toBe(true);
    if (data.memories.length > 0) {
      for (const m of data.memories) {
        expect(m).toHaveProperty('source');
        expect(typeof m.source).toBe('string');
      }
    }
  });

  it('POST /api/memories sets source="api" and returns it in the response', async () => {
    const res = await fetch(`${baseUrl}/api/memories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: 'A memory written via the REST POST endpoint',
        category: 'fact'
      })
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.memory.source).toBe('api');
  });
});
