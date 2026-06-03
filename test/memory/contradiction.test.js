import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initDatabase,
  createMemory,
  getMemory,
  createContradiction,
  getContradiction,
  listContradictions,
  resolveContradiction,
  contradictionExists,
  countUnresolvedContradictions,
  migrateTagConflicts
} from '../../src/memory/store.js';

describe('Contradictions', () => {
  let db;
  let testDbPath;
  let m1;
  let m2;

  beforeEach(() => {
    const tmpDir = path.join(os.tmpdir(), 'engram-contra-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    testDbPath = path.join(tmpDir, 'test.db');
    db = initDatabase(testDbPath);

    m1 = createMemory(db, {
      content: 'Prefers Fastify',
      category: 'preference',
      entity: 'http-framework'
    });
    m2 = createMemory(db, {
      content: 'Prefers Express',
      category: 'preference',
      entity: 'http-framework'
    });
  });

  afterEach(() => {
    if (db) db.close();
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.rmSync(path.dirname(testDbPath), { recursive: true, force: true });
    }
  });

  describe('createContradiction / getContradiction', () => {
    it('should round-trip a contradiction with joined memory details', () => {
      const created = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.85,
        reason: 'Opposite preferences for same entity',
        category: 'preference',
        entity: 'http-framework'
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe('unresolved');
      expect(created.confidence).toBe(0.85);
      expect(created.reason).toBe('Opposite preferences for same entity');
      expect(created.memory1.id).toBe(m1.id);
      expect(created.memory1.content).toBe('Prefers Fastify');
      expect(created.memory2.id).toBe(m2.id);
      expect(created.memory2.content).toBe('Prefers Express');
    });

    it('should return null for non-existent id', () => {
      expect(getContradiction(db, 'does-not-exist')).toBeNull();
    });
  });

  describe('listContradictions', () => {
    beforeEach(() => {
      createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9,
        reason: 'Test',
        category: 'preference'
      });
    });

    it('should list all contradictions by default', () => {
      const r = listContradictions(db);
      expect(r.total).toBe(1);
      expect(r.items).toHaveLength(1);
    });

    it('should filter by status', () => {
      const r = listContradictions(db, { status: 'resolved' });
      expect(r.total).toBe(0);
    });

    it('should accept status="all" as a no-op filter', () => {
      const r = listContradictions(db, { status: 'all' });
      expect(r.total).toBe(1);
    });

    it('should filter by category', () => {
      const r = listContradictions(db, { category: 'preference' });
      expect(r.total).toBe(1);

      const r2 = listContradictions(db, { category: 'fact' });
      expect(r2.total).toBe(0);
    });

    it('should respect pagination', () => {
      const m3 = createMemory(db, { content: 'Third memory' });
      createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m3.id,
        confidence: 0.7
      });

      const r = listContradictions(db, { limit: 1, offset: 1 });
      expect(r.total).toBe(2);
      expect(r.items).toHaveLength(1);
    });

    it('should reject sort field injection by defaulting to safe order', () => {
      const r = listContradictions(db, { sort: "1; DROP TABLE memories--" });
      expect(r.total).toBe(1);
    });
  });

  describe('resolveContradiction', () => {
    it('keep_first should delete memory2, mark resolved, and survive in the DB', () => {
      const c = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });

      const r = resolveContradiction(db, c.id, 'keep_first');
      // Function returns a snapshot with resolved-state overlaid
      expect(r).not.toBeNull();
      expect(r.id).toBe(c.id);
      expect(r.status).toBe('resolved');
      expect(r.resolution_action).toBe('keep_first');
      expect(r.resolved_at).toBeGreaterThan(0);
      expect(r.memory1.id).toBe(m1.id);
      expect(r.memory2.id).toBe(m2.id);
      // Side effects: memory1 still present, memory2 deleted
      expect(getMemory(db, m1.id)).not.toBeNull();
      expect(getMemory(db, m2.id)).toBeNull();
      // FK SET NULL: contradiction row SURVIVES with memory2_id nulled out
      const persisted = getContradiction(db, c.id);
      expect(persisted).not.toBeNull();
      expect(persisted.status).toBe('resolved');
      expect(persisted.resolution_action).toBe('keep_first');
      expect(persisted.memory1).not.toBeNull();
      expect(persisted.memory2).toBeNull();
    });

    it('keep_second should delete memory1, mark resolved, and survive in the DB', () => {
      const c = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });

      const r = resolveContradiction(db, c.id, 'keep_second');
      expect(r).not.toBeNull();
      expect(r.status).toBe('resolved');
      expect(r.resolution_action).toBe('keep_second');
      expect(getMemory(db, m1.id)).toBeNull();
      expect(getMemory(db, m2.id)).not.toBeNull();
      // Survives with memory1_id nulled out
      const persisted = getContradiction(db, c.id);
      expect(persisted).not.toBeNull();
      expect(persisted.status).toBe('resolved');
      expect(persisted.memory1).toBeNull();
      expect(persisted.memory2).not.toBeNull();
    });

    it('resolved contradictions appear in listContradictions(status="resolved")', () => {
      const c = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });
      resolveContradiction(db, c.id, 'keep_first');

      const resolved = listContradictions(db, { status: 'resolved' });
      expect(resolved.total).toBe(1);
      expect(resolved.items[0].id).toBe(c.id);
      expect(resolved.items[0].memory2).toBeNull(); // deleted memory's row is null
      const unresolved = listContradictions(db, { status: 'unresolved' });
      expect(unresolved.total).toBe(0);
    });

    it('keep_both should leave both memories intact, marked resolved', () => {
      const c = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });

      const r = resolveContradiction(db, c.id, 'keep_both');
      expect(r.status).toBe('resolved');
      expect(getMemory(db, m1.id)).not.toBeNull();
      expect(getMemory(db, m2.id)).not.toBeNull();
    });

    it('dismiss should leave both memories and use dismissed status', () => {
      const c = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });

      const r = resolveContradiction(db, c.id, 'dismiss');
      expect(r.status).toBe('dismissed');
      expect(getMemory(db, m1.id)).not.toBeNull();
      expect(getMemory(db, m2.id)).not.toBeNull();
    });

    it('should return null when resolving a non-existent contradiction', () => {
      expect(resolveContradiction(db, 'no-such-id', 'keep_first')).toBeNull();
    });
  });

  describe('contradictionExists', () => {
    it('should detect existing unresolved contradiction in either direction', () => {
      createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });
      expect(contradictionExists(db, m1.id, m2.id)).toBe(true);
      expect(contradictionExists(db, m2.id, m1.id)).toBe(true);
    });

    it('should ignore resolved contradictions', () => {
      const c = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });
      resolveContradiction(db, c.id, 'keep_both');
      expect(contradictionExists(db, m1.id, m2.id)).toBe(false);
    });

    it('should return false when none exist', () => {
      expect(contradictionExists(db, m1.id, m2.id)).toBe(false);
    });
  });

  describe('countUnresolvedContradictions', () => {
    it('should count only unresolved contradictions', () => {
      const c1 = createContradiction(db, {
        memory1_id: m1.id,
        memory2_id: m2.id,
        confidence: 0.9
      });
      expect(countUnresolvedContradictions(db)).toBe(1);

      resolveContradiction(db, c1.id, 'keep_both');
      expect(countUnresolvedContradictions(db)).toBe(0);
    });

    it('should return 0 when none exist', () => {
      expect(countUnresolvedContradictions(db)).toBe(0);
    });
  });

  describe('migrateTagConflicts', () => {
    it('should migrate legacy tag-based conflicts to the contradictions table', () => {
      const a = createMemory(db, {
        content: 'Legacy A',
        tags: ['conflict_abc']
      });
      const b = createMemory(db, {
        content: 'Legacy B',
        tags: ['conflict_abc']
      });

      const n = migrateTagConflicts(db);
      expect(n).toBe(1);
      expect(contradictionExists(db, a.id, b.id)).toBe(true);
    });

    it('should be idempotent (guarded by meta table)', () => {
      createMemory(db, { content: 'A', tags: ['conflict_xyz'] });
      createMemory(db, { content: 'B', tags: ['conflict_xyz'] });

      const first = migrateTagConflicts(db);
      expect(first).toBe(1);
      const second = migrateTagConflicts(db);
      expect(second).toBe(0);
    });

    it('should skip singleton conflict tags (no pair to migrate)', () => {
      createMemory(db, {
        content: 'Lone conflict',
        tags: ['conflict_singleton']
      });
      const n = migrateTagConflicts(db);
      expect(n).toBe(0);
    });
  });
});
