import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initDatabase,
  createMemory
} from '../../src/memory/store.js';
import { recallMemories, formatRecallResults } from '../../src/memory/recall.js';

describe('Memory Recall', () => {
  let db;
  let testDbPath;
  let modelsPath;

  beforeEach(() => {
    // Create temporary database and models directory
    const tmpDir = path.join(os.tmpdir(), 'engram-recall-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    testDbPath = path.join(tmpDir, 'test.db');
    modelsPath = path.join(tmpDir, 'models');
    fs.mkdirSync(modelsPath, { recursive: true });

    db = initDatabase(testDbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      if (fs.existsSync(modelsPath)) {
        fs.rmSync(modelsPath, { recursive: true, force: true });
      }
      fs.rmdirSync(path.dirname(testDbPath));
    }
  });

  describe('recallMemories', () => {
    it('should fall back to FTS when embeddings fail', async () => {
      // Create some memories without embeddings
      createMemory(db, {
        content: 'User prefers Docker for containerization',
        category: 'preference',
        entity: 'docker'
      });

      createMemory(db, {
        content: 'Project uses PostgreSQL database',
        category: 'fact',
        entity: 'postgresql'
      });

      // Recall should fall back to FTS search
      const results = await recallMemories(db, 'Docker', {}, modelsPath);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('Docker');
      expect(results[0].score).toBeDefined();
    });

    it('should filter by category', async () => {
      createMemory(db, {
        content: 'User prefers React over Vue',
        category: 'preference'
      });

      createMemory(db, {
        content: 'Project uses Node.js 20',
        category: 'fact'
      });

      const results = await recallMemories(db, 'React', { category: 'preference' }, modelsPath);

      expect(results.every(m => m.category === 'preference')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Create multiple memories
      for (let i = 0; i < 10; i++) {
        createMemory(db, {
          content: `Memory number ${i} about Docker and containers`,
          category: 'fact'
        });
      }

      const results = await recallMemories(db, 'Docker', { limit: 3 }, modelsPath);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should update access stats for recalled memories', async () => {
      const memory = createMemory(db, {
        content: 'Test memory for access tracking',
        category: 'fact'
      });

      expect(memory.access_count).toBe(0);

      await recallMemories(db, 'Test memory', {}, modelsPath);

      // Re-fetch the memory to check updated access count
      const updated = db.prepare('SELECT * FROM memories WHERE id = ?').get(memory.id);
      expect(updated.access_count).toBe(1);
      expect(updated.last_accessed).toBeDefined();
    });

    it('should return empty array when no matches found', async () => {
      createMemory(db, {
        content: 'Something completely unrelated',
        category: 'fact'
      });

      const results = await recallMemories(db, 'nonexistentkeyword123', {}, modelsPath);

      expect(results).toEqual([]);
    });

    it('should filter by namespace', async () => {
      createMemory(db, {
        content: 'Memory in project-a',
        namespace: 'project-a'
      });

      createMemory(db, {
        content: 'Memory in project-b',
        namespace: 'project-b'
      });

      const results = await recallMemories(db, 'Memory', { namespace: 'project-a' }, modelsPath);

      expect(results.every(m => m.namespace === 'project-a')).toBe(true);
    });

    it('should apply threshold filtering', async () => {
      createMemory(db, {
        content: 'Exact match for Docker containers',
        entity: 'docker'
      });

      createMemory(db, {
        content: 'Unrelated content about databases',
        entity: 'postgresql'
      });

      const results = await recallMemories(db, 'Docker', { threshold: 0.5 }, modelsPath);

      // All results should have score >= threshold
      expect(results.every(m => m.score >= 0.5)).toBe(true);
    });
  });

  describe('formatRecallResults', () => {
    it('should format empty results', () => {
      const formatted = formatRecallResults([]);
      expect(formatted).toContain('No relevant memories found');
    });

    it('should format single result', () => {
      const memories = [{
        id: 'abc-123-def-456',
        content: 'Test memory content',
        category: 'fact',
        confidence: 0.9,
        score: 0.85
      }];

      const formatted = formatRecallResults(memories);

      expect(formatted).toContain('Found 1 relevant memory');
      expect(formatted).toContain('Test memory content');
      expect(formatted).toContain('fact');
      expect(formatted).toContain('0.90');
      expect(formatted).toContain('abc-123');
    });

    it('should format multiple results', () => {
      const memories = [
        {
          id: 'memory-1',
          content: 'First memory',
          category: 'preference',
          confidence: 0.95,
          score: 0.9
        },
        {
          id: 'memory-2',
          content: 'Second memory',
          category: 'fact',
          confidence: 0.85,
          score: 0.8
        }
      ];

      const formatted = formatRecallResults(memories);

      expect(formatted).toContain('Found 2 relevant memories');
      expect(formatted).toContain('[1]');
      expect(formatted).toContain('[2]');
      expect(formatted).toContain('First memory');
      expect(formatted).toContain('Second memory');
    });
  });
});
