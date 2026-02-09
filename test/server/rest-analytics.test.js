import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory } from '../../src/memory/store.js';
import { createRESTServer } from '../../src/server/rest.js';

describe('REST Analytics Endpoints', () => {
  let fastify;
  let seedDb;
  let baseUrl;
  let tmpDir;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), 'engram-rest-analytics-test-' + Date.now());
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });

    // Pre-seed the database at the path createRESTServer will look for
    const dbPath = path.join(tmpDir, 'memory.db');
    seedDb = initDatabase(dbPath);

    createMemory(seedDb, { content: 'Test fact one', category: 'fact', confidence: 0.9 });
    createMemory(seedDb, { content: 'Test preference', category: 'preference', confidence: 0.7 });
    const m3 = createMemory(seedDb, { content: 'Recalled memory', category: 'pattern', confidence: 0.8 });
    seedDb.prepare('UPDATE memories SET access_count = 3, last_accessed = ? WHERE id = ?')
      .run(Date.now(), m3.id);

    // Close seed connection so createRESTServer can open its own
    seedDb.close();
    seedDb = null;

    // Create server with config pointing to our temp dir
    fastify = createRESTServer({ dataDir: tmpDir });
    await fastify.listen({ port: 0, host: '127.0.0.1' });
    const address = fastify.server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (fastify) await fastify.close();
    if (seedDb) seedDb.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('GET /api/analytics/overview should return health data', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/overview`);
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data.totalMemories).toBe(3);
    expect(data.healthScore).toBeGreaterThanOrEqual(0);
    expect(data.healthScore).toBeLessThanOrEqual(100);
    expect(data.byCategory).toBeDefined();
    expect(data.recallRate).toBeDefined();
    expect(data.avgConfidence).toBeGreaterThan(0);
  });

  it('GET /api/analytics/stale should return stale memories', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/stale?days=30&limit=10`);
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('GET /api/analytics/never-recalled should return unaccessed memories', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/never-recalled?limit=10`);
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('count');
    // Two of our three test memories have never been recalled
    expect(data.count).toBe(2);
  });

  it('GET /api/analytics/duplicates should return clusters', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/duplicates`);
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data).toHaveProperty('clusters');
    expect(data).toHaveProperty('totalDuplicates');
    expect(Array.isArray(data.clusters)).toBe(true);
  });

  it('GET /api/analytics/trends should return daily data', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/trends?days=7`);
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data).toHaveProperty('daily');
    expect(Array.isArray(data.daily)).toBe(true);
    expect(data.daily.length).toBeGreaterThanOrEqual(7);

    for (const day of data.daily) {
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('created');
    }
  });

  it('POST /api/memories/bulk-delete should delete specified memories', async () => {
    // Create a memory via the API
    const createRes = await fetch(`${baseUrl}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'To be deleted', category: 'fact' })
    });
    const { memory } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/memories/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [memory.id] })
    });
    expect(res.ok).toBe(true);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deleted).toBe(1);
  });

  it('POST /api/memories/bulk-delete should reject empty ids', async () => {
    const res = await fetch(`${baseUrl}/api/memories/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] })
    });
    expect(res.status).toBe(400);
  });
});
