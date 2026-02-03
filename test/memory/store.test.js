import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initDatabase,
  createMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  listMemories,
  searchMemories,
  getMemoriesWithEmbeddings,
  updateAccessStats,
  getStats
} from '../../src/memory/store.js';

describe('Memory Store', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    // Create a temporary database for testing
    const tmpDir = path.join(os.tmpdir(), 'engram-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    testDbPath = path.join(tmpDir, 'test.db');
    db = initDatabase(testDbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      fs.rmdirSync(path.dirname(testDbPath));
    }
  });

  describe('Database Initialization', () => {
    it('should create database with correct tables', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all();

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('memories');
      expect(tableNames).toContain('meta');
      expect(tableNames).toContain('memories_fts');
    });

    it('should enable WAL mode', () => {
      const result = db.pragma('journal_mode', { simple: true });
      expect(result).toBe('wal');
    });
  });

  describe('createMemory', () => {
    it('should create a memory with all fields', () => {
      const memory = createMemory(db, {
        content: 'Test memory content',
        category: 'fact',
        entity: 'test',
        confidence: 0.9,
        namespace: 'test-namespace',
        tags: ['tag1', 'tag2']
      });

      expect(memory).toBeDefined();
      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Test memory content');
      expect(memory.category).toBe('fact');
      expect(memory.entity).toBe('test');
      expect(memory.confidence).toBe(0.9);
      expect(memory.namespace).toBe('test-namespace');
      expect(memory.tags).toEqual(['tag1', 'tag2']);
      expect(memory.created_at).toBeDefined();
      expect(memory.updated_at).toBeDefined();
    });

    it('should use default values when not provided', () => {
      const memory = createMemory(db, {
        content: 'Minimal memory'
      });

      expect(memory.category).toBe('fact');
      expect(memory.confidence).toBe(0.8);
      expect(memory.namespace).toBe('default');
      expect(memory.tags).toEqual([]);
      expect(memory.source).toBe('manual');
      expect(memory.decay_rate).toBe(0.01);
    });

    it('should store embedding as buffer', () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const memory = createMemory(db, {
        content: 'Memory with embedding',
        embedding
      });

      expect(memory.embedding).toBeDefined();
      expect(memory.embedding.length).toBe(4);
      // Use toBeCloseTo for floating point comparisons
      expect(memory.embedding[0]).toBeCloseTo(0.1);
      expect(memory.embedding[1]).toBeCloseTo(0.2);
      expect(memory.embedding[2]).toBeCloseTo(0.3);
      expect(memory.embedding[3]).toBeCloseTo(0.4);
    });
  });

  describe('getMemory', () => {
    it('should retrieve existing memory by ID', () => {
      const created = createMemory(db, {
        content: 'Test retrieval',
        entity: 'test'
      });

      const retrieved = getMemory(db, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.content).toBe('Test retrieval');
    });

    it('should return null for non-existent ID', () => {
      const retrieved = getMemory(db, 'non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateMemory', () => {
    it('should update memory fields', async () => {
      const memory = createMemory(db, {
        content: 'Original content',
        category: 'fact',
        confidence: 0.8
      });

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = updateMemory(db, memory.id, {
        content: 'Updated content',
        confidence: 0.95
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.confidence).toBe(0.95);
      expect(updated.category).toBe('fact'); // Unchanged
      expect(updated.updated_at).toBeGreaterThan(memory.updated_at);
    });

    it('should return null for non-existent memory', () => {
      const result = updateMemory(db, 'non-existent-id', { content: 'test' });
      expect(result).toBeNull();
    });

    it('should update tags', () => {
      const memory = createMemory(db, {
        content: 'Test',
        tags: ['old']
      });

      const updated = updateMemory(db, memory.id, {
        tags: ['new1', 'new2']
      });

      expect(updated.tags).toEqual(['new1', 'new2']);
    });
  });

  describe('deleteMemory', () => {
    it('should delete existing memory', () => {
      const memory = createMemory(db, { content: 'To be deleted' });

      const deleted = deleteMemory(db, memory.id);
      expect(deleted).toBe(true);

      const retrieved = getMemory(db, memory.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent memory', () => {
      const deleted = deleteMemory(db, 'non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('listMemories', () => {
    beforeEach(() => {
      // Create test memories
      createMemory(db, { content: 'Memory 1', category: 'fact', namespace: 'ns1' });
      createMemory(db, { content: 'Memory 2', category: 'preference', namespace: 'ns1' });
      createMemory(db, { content: 'Memory 3', category: 'fact', namespace: 'ns2' });
    });

    it('should list all memories', () => {
      const memories = listMemories(db);
      expect(memories.length).toBe(3);
    });

    it('should filter by namespace', () => {
      const memories = listMemories(db, { namespace: 'ns1' });
      expect(memories.length).toBe(2);
      expect(memories.every(m => m.namespace === 'ns1')).toBe(true);
    });

    it('should filter by category', () => {
      const memories = listMemories(db, { category: 'fact' });
      expect(memories.length).toBe(2);
      expect(memories.every(m => m.category === 'fact')).toBe(true);
    });

    it('should respect limit and offset', () => {
      const page1 = listMemories(db, { limit: 2, offset: 0 });
      const page2 = listMemories(db, { limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(1);
    });
  });

  describe('searchMemories', () => {
    beforeEach(() => {
      createMemory(db, { content: 'User prefers Docker for containerization' });
      createMemory(db, { content: 'Uses PostgreSQL for database' });
      createMemory(db, { content: 'Deploys to AWS using GitHub Actions' });
    });

    it('should find memories by keyword', () => {
      const results = searchMemories(db, 'Docker');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('Docker');
    });

    it('should return empty array for no matches', () => {
      const results = searchMemories(db, 'nonexistentkeyword123');
      expect(results.length).toBe(0);
    });
  });

  describe('getMemoriesWithEmbeddings', () => {
    it('should return only memories with embeddings', () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);

      createMemory(db, { content: 'With embedding', embedding });
      createMemory(db, { content: 'Without embedding' });

      const results = getMemoriesWithEmbeddings(db);
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('With embedding');
      expect(results[0].embedding).toBeDefined();
    });

    it('should filter by namespace', () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);

      createMemory(db, { content: 'NS1', namespace: 'ns1', embedding });
      createMemory(db, { content: 'NS2', namespace: 'ns2', embedding });

      const results = getMemoriesWithEmbeddings(db, 'ns1');
      expect(results.length).toBe(1);
      expect(results[0].namespace).toBe('ns1');
    });
  });

  describe('updateAccessStats', () => {
    it('should update last_accessed and access_count', () => {
      const m1 = createMemory(db, { content: 'Memory 1' });
      const m2 = createMemory(db, { content: 'Memory 2' });

      const beforeAccess = Date.now();
      updateAccessStats(db, [m1.id, m2.id]);

      const updated1 = getMemory(db, m1.id);
      const updated2 = getMemory(db, m2.id);

      expect(updated1.last_accessed).toBeGreaterThanOrEqual(beforeAccess);
      expect(updated1.access_count).toBe(1);
      expect(updated2.last_accessed).toBeGreaterThanOrEqual(beforeAccess);
      expect(updated2.access_count).toBe(1);
    });

    it('should increment access_count on multiple calls', () => {
      const memory = createMemory(db, { content: 'Test' });

      updateAccessStats(db, [memory.id]);
      updateAccessStats(db, [memory.id]);
      updateAccessStats(db, [memory.id]);

      const updated = getMemory(db, memory.id);
      expect(updated.access_count).toBe(3);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);

      createMemory(db, { content: 'Fact 1', category: 'fact', namespace: 'ns1' });
      createMemory(db, { content: 'Fact 2', category: 'fact', namespace: 'ns1', embedding });
      createMemory(db, { content: 'Pref 1', category: 'preference', namespace: 'ns2' });
    });

    it('should return correct statistics', () => {
      const stats = getStats(db);

      expect(stats.total).toBe(3);
      expect(stats.byCategory.fact).toBe(2);
      expect(stats.byCategory.preference).toBe(1);
      expect(stats.byNamespace.ns1).toBe(2);
      expect(stats.byNamespace.ns2).toBe(1);
      expect(stats.withEmbeddings).toBe(1);
    });
  });
});
