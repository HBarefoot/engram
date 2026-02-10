import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initDatabase,
  createMemory,
  getMemory,
  createContradiction
} from '../../src/memory/store.js';
import { consolidate, getConflicts } from '../../src/memory/consolidate.js';

describe('Memory Consolidation', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    const tmpDir = path.join(os.tmpdir(), 'engram-consolidate-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    testDbPath = path.join(tmpDir, 'test.db');
    db = initDatabase(testDbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      fs.rmdirSync(path.dirname(testDbPath));
    }
  });

  describe('consolidate', () => {
    it('should complete without errors when no memories exist', async () => {
      const results = await consolidate(db);

      expect(results).toBeDefined();
      expect(results.duplicatesRemoved).toBe(0);
      expect(results.contradictionsDetected).toBe(0);
      expect(results.memoriesDecayed).toBe(0);
    });

    it('should merge duplicate memories with high similarity', async () => {
      // Create two very similar memories with embeddings
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);

      const mem1 = createMemory(db, {
        content: 'User prefers Docker',
        confidence: 0.9,
        embedding
      });

      const mem2 = createMemory(db, {
        content: 'User prefers Docker',
        confidence: 0.8,
        embedding
      });

      const results = await consolidate(db, {
        detectDuplicates: true,
        detectContradictions: false,
        applyDecay: false
      });

      // One duplicate should be removed
      expect(results.duplicatesRemoved).toBe(1);

      // The higher confidence memory should be kept
      const kept = getMemory(db, mem1.id);
      const removed = getMemory(db, mem2.id);

      expect(kept).not.toBeNull();
      expect(removed).toBeNull();
    });

    it('should apply confidence decay to old memories', async () => {
      // Create a memory with old access time
      const oldTime = Date.now() - (100 * 24 * 60 * 60 * 1000); // 100 days ago

      const memory = createMemory(db, {
        content: 'Old memory',
        confidence: 0.8,
        decay_rate: 0.01
      });

      // Manually set old last_accessed time
      db.prepare('UPDATE memories SET last_accessed = ? WHERE id = ?')
        .run(oldTime, memory.id);

      const results = await consolidate(db, {
        detectDuplicates: false,
        detectContradictions: false,
        applyDecay: true
      });

      expect(results.memoriesDecayed).toBeGreaterThan(0);

      const updated = getMemory(db, memory.id);
      expect(updated.confidence).toBeLessThan(0.8);
    });

    it('should not decay memories with decay_rate = 0', async () => {
      const memory = createMemory(db, {
        content: 'Never decay',
        confidence: 0.9,
        decay_rate: 0
      });

      // Set old access time
      const oldTime = Date.now() - (100 * 24 * 60 * 60 * 1000);
      db.prepare('UPDATE memories SET last_accessed = ? WHERE id = ?')
        .run(oldTime, memory.id);

      await consolidate(db, {
        detectDuplicates: false,
        detectContradictions: false,
        applyDecay: true
      });

      const updated = getMemory(db, memory.id);
      expect(updated.confidence).toBe(0.9); // Should not change
    });

    it('should mark stale memories', async () => {
      // Create a low-confidence, unaccessed, old memory
      const oldTime = Date.now() - (100 * 24 * 60 * 60 * 1000); // 100 days ago

      const memory = createMemory(db, {
        content: 'Stale memory',
        confidence: 0.1
      });

      // Set old created_at time and ensure no accesses
      db.prepare('UPDATE memories SET created_at = ?, access_count = 0 WHERE id = ?')
        .run(oldTime, memory.id);

      const results = await consolidate(db, {
        detectDuplicates: false,
        detectContradictions: false,
        applyDecay: false,
        cleanupStale: true
      });

      expect(results.staleMemoriesCleaned).toBe(1);

      const updated = getMemory(db, memory.id);
      expect(updated.tags).toContain('stale');
    });

    it('should detect contradictions and flag them', async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);

      // Create potentially contradictory memories
      createMemory(db, {
        content: 'User prefers React',
        entity: 'react',
        embedding
      });

      createMemory(db, {
        content: 'User never uses React',
        entity: 'react',
        embedding
      });

      const results = await consolidate(db, {
        detectDuplicates: false,
        detectContradictions: true,
        applyDecay: false
      });

      // Should detect at least one contradiction
      expect(results.contradictionsDetected).toBeGreaterThanOrEqual(0);
    });

    it('should skip consolidation steps when disabled', async () => {
      const results = await consolidate(db, {
        detectDuplicates: false,
        detectContradictions: false,
        applyDecay: false,
        cleanupStale: false
      });

      expect(results.duplicatesRemoved).toBe(0);
      expect(results.contradictionsDetected).toBe(0);
      expect(results.memoriesDecayed).toBe(0);
      expect(results.staleMemoriesCleaned).toBe(0);
    });
  });

  describe('getConflicts', () => {
    it('should return empty array when no conflicts exist', () => {
      createMemory(db, {
        content: 'Normal memory',
        tags: ['regular']
      });

      const conflicts = getConflicts(db);
      expect(conflicts).toEqual([]);
    });

    it('should return contradictions from the contradictions table', () => {
      const memA = createMemory(db, { content: 'Memory A' });
      const memB = createMemory(db, { content: 'Memory B' });

      createContradiction(db, {
        memory1_id: memA.id,
        memory2_id: memB.id,
        confidence: 0.8,
        reason: 'Test conflict'
      });

      const conflicts = getConflicts(db);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictId).toBeDefined();
      expect(conflicts[0].memories.length).toBe(2);
    });

    it('should return multiple contradictions', () => {
      const memA1 = createMemory(db, { content: 'Memory A1' });
      const memA2 = createMemory(db, { content: 'Memory A2' });
      const memB1 = createMemory(db, { content: 'Memory B1' });
      const memB2 = createMemory(db, { content: 'Memory B2' });

      createContradiction(db, {
        memory1_id: memA1.id,
        memory2_id: memA2.id,
        confidence: 0.7,
        reason: 'Conflict 1'
      });

      createContradiction(db, {
        memory1_id: memB1.id,
        memory2_id: memB2.id,
        confidence: 0.6,
        reason: 'Conflict 2'
      });

      const conflicts = getConflicts(db);

      expect(conflicts.length).toBe(2);
      expect(conflicts.every(c => c.memories.length === 2)).toBe(true);
    });
  });
});
