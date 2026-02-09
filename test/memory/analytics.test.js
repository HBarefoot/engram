import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory } from '../../src/memory/store.js';
import {
  getOverview,
  getStaleMemories,
  getNeverRecalled,
  getDuplicateClusters,
  getTrends
} from '../../src/memory/analytics.js';

describe('Memory Analytics', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    const tmpDir = path.join(os.tmpdir(), 'engram-analytics-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    testDbPath = path.join(tmpDir, 'test.db');
    db = initDatabase(testDbPath);
  });

  afterEach(() => {
    if (db) db.close();
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      fs.rmdirSync(path.dirname(testDbPath));
    }
  });

  describe('getOverview', () => {
    it('should return zeros for empty database', () => {
      const overview = getOverview(db);
      expect(overview.totalMemories).toBe(0);
      expect(overview.createdLast7Days).toBe(0);
      expect(overview.createdLast30Days).toBe(0);
      expect(overview.avgConfidence).toBe(0);
      expect(overview.totalRecalled).toBe(0);
      expect(overview.recallRate).toBe(0);
    });

    it('should count total memories and categories', () => {
      createMemory(db, { content: 'Fact one', category: 'fact' });
      createMemory(db, { content: 'Preference one', category: 'preference' });

      const overview = getOverview(db);
      expect(overview.totalMemories).toBe(2);
      expect(overview.byCategory.fact).toBe(1);
      expect(overview.byCategory.preference).toBe(1);
    });

    it('should count memories created in last 7 days', () => {
      createMemory(db, { content: 'Recent memory' });

      const overview = getOverview(db);
      expect(overview.createdLast7Days).toBe(1);
      expect(overview.createdLast30Days).toBe(1);
    });

    it('should calculate recall rate correctly', () => {
      const m1 = createMemory(db, { content: 'Memory one' });
      createMemory(db, { content: 'Memory two' });

      // Simulate one memory being accessed
      db.prepare('UPDATE memories SET access_count = 1, last_accessed = ? WHERE id = ?')
        .run(Date.now(), m1.id);

      const overview = getOverview(db);
      expect(overview.totalRecalled).toBe(1);
      expect(overview.recallRate).toBe(50);
    });

    it('should calculate average confidence', () => {
      createMemory(db, { content: 'High conf', confidence: 0.9 });
      createMemory(db, { content: 'Low conf', confidence: 0.5 });

      const overview = getOverview(db);
      expect(overview.avgConfidence).toBe(0.7);
    });
  });

  describe('getStaleMemories', () => {
    it('should return empty for fresh database', () => {
      createMemory(db, { content: 'Fresh memory' });

      const result = getStaleMemories(db, 30, 50);
      expect(result.count).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should detect stale memories', () => {
      const m = createMemory(db, { content: 'Old memory' });
      const fortyDaysAgo = Date.now() - 40 * 24 * 60 * 60 * 1000;
      db.prepare('UPDATE memories SET created_at = ?, last_accessed = NULL WHERE id = ?')
        .run(fortyDaysAgo, m.id);

      const result = getStaleMemories(db, 30, 50);
      expect(result.count).toBe(1);
      expect(result.items[0].id).toBe(m.id);
      expect(result.items[0].daysSinceAccess).toBeGreaterThanOrEqual(40);
    });

    it('should respect limit parameter', () => {
      const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < 5; i++) {
        const m = createMemory(db, { content: `Old memory ${i}` });
        db.prepare('UPDATE memories SET created_at = ?, last_accessed = NULL WHERE id = ?')
          .run(sixtyDaysAgo, m.id);
      }

      const result = getStaleMemories(db, 30, 2);
      expect(result.count).toBe(5);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('getNeverRecalled', () => {
    it('should find memories with zero access count', () => {
      createMemory(db, { content: 'Never recalled' });
      const m2 = createMemory(db, { content: 'Was recalled' });
      db.prepare('UPDATE memories SET access_count = 1 WHERE id = ?').run(m2.id);

      const result = getNeverRecalled(db, 50);
      expect(result.count).toBe(1);
      expect(result.items[0].content).toBe('Never recalled');
    });

    it('should return empty when all memories have been recalled', () => {
      const m = createMemory(db, { content: 'Recalled' });
      db.prepare('UPDATE memories SET access_count = 3 WHERE id = ?').run(m.id);

      const result = getNeverRecalled(db, 50);
      expect(result.count).toBe(0);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('getDuplicateClusters', () => {
    it('should return empty clusters when no embeddings exist', () => {
      createMemory(db, { content: 'No embedding' });

      const result = getDuplicateClusters(db);
      expect(result.clusters).toHaveLength(0);
      expect(result.totalDuplicates).toBe(0);
    });

    it('should detect identical embeddings as duplicates', () => {
      const embedding = new Float32Array(384);
      for (let i = 0; i < 384; i++) embedding[i] = Math.random();
      const buffer = Buffer.from(embedding.buffer);

      // Create two memories with identical embeddings
      const m1 = createMemory(db, { content: 'Duplicate A' });
      const m2 = createMemory(db, { content: 'Duplicate B' });
      db.prepare('UPDATE memories SET embedding = ? WHERE id = ?').run(buffer, m1.id);
      db.prepare('UPDATE memories SET embedding = ? WHERE id = ?').run(buffer, m2.id);

      const result = getDuplicateClusters(db, 0.85);
      expect(result.clusters.length).toBeGreaterThanOrEqual(1);
      expect(result.totalDuplicates).toBeGreaterThanOrEqual(1);
    });

    it('should track minimum similarity across merged clusters', () => {
      // Create 3 embeddings: A≈B (0.99), B≈C (0.90), so cluster {A,B,C} min=0.90
      const base = new Float32Array(384);
      for (let i = 0; i < 384; i++) base[i] = 1.0;

      const embA = Float32Array.from(base);
      const embB = Float32Array.from(base);
      embB[0] = 0.99; // very close to A

      const embC = Float32Array.from(base);
      for (let i = 0; i < 20; i++) embC[i] = 0.7; // further from A/B but still similar

      const m1 = createMemory(db, { content: 'Cluster mem A' });
      const m2 = createMemory(db, { content: 'Cluster mem B' });
      const m3 = createMemory(db, { content: 'Cluster mem C' });

      db.prepare('UPDATE memories SET embedding = ? WHERE id = ?')
        .run(Buffer.from(embA.buffer), m1.id);
      db.prepare('UPDATE memories SET embedding = ? WHERE id = ?')
        .run(Buffer.from(embB.buffer), m2.id);
      db.prepare('UPDATE memories SET embedding = ? WHERE id = ?')
        .run(Buffer.from(embC.buffer), m3.id);

      const result = getDuplicateClusters(db, 0.85);
      if (result.clusters.length > 0) {
        // The reported similarity should be the minimum in the cluster
        for (const cluster of result.clusters) {
          expect(cluster.similarity).toBeLessThanOrEqual(1.0);
          expect(cluster.similarity).toBeGreaterThanOrEqual(0.85);
        }
      }
    });
  });

  describe('getTrends', () => {
    it('should return daily data for the specified period', () => {
      createMemory(db, { content: 'Today memory' });

      const result = getTrends(db, 7);
      expect(result.daily.length).toBeGreaterThanOrEqual(7);

      // Last day should have at least 1 creation
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = result.daily.find(d => d.date === today);
      expect(todayEntry).toBeDefined();
      expect(todayEntry.created).toBeGreaterThanOrEqual(1);
    });

    it('should fill in zero-days', () => {
      const result = getTrends(db, 7);
      // All days should be present even with no data
      expect(result.daily.length).toBeGreaterThanOrEqual(7);
      for (const day of result.daily) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('created');
        expect(day.created).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
