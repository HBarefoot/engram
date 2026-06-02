import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory } from '../../src/memory/store.js';
import { generateContext } from '../../src/memory/context.js';

describe('Context Generation', () => {
  let db;
  let testDbPath;
  let modelsPath;

  beforeEach(() => {
    const tmpDir = path.join(os.tmpdir(), 'engram-context-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    testDbPath = path.join(tmpDir, 'test.db');
    modelsPath = path.join(tmpDir, 'models');
    fs.mkdirSync(modelsPath, { recursive: true });
    db = initDatabase(testDbPath);

    // Seed default-namespace memories across categories
    createMemory(db, {
      content: 'Prefers Fastify over Express',
      category: 'preference',
      namespace: 'default'
    });
    createMemory(db, {
      content: 'Uses PostgreSQL 15 in production',
      category: 'fact',
      namespace: 'default'
    });
    createMemory(db, {
      content: 'Deploys via GitHub Actions to main',
      category: 'pattern',
      namespace: 'default'
    });
    createMemory(db, {
      content: 'Other namespace memory',
      category: 'fact',
      namespace: 'other'
    });
  });

  afterEach(() => {
    if (db) db.close();
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.rmSync(path.dirname(testDbPath), { recursive: true, force: true });
    }
  });

  describe('format outputs (no query path)', () => {
    it('should produce markdown by default', async () => {
      const r = await generateContext(db, { namespace: 'default', format: 'markdown' }, modelsPath);
      expect(r.content).toContain('## User Context from Memory');
      expect(r.content).toContain('Fastify');
      expect(r.metadata.count).toBe(3);
      expect(r.metadata.format).toBe('markdown');
    });

    it('should produce XML', async () => {
      const r = await generateContext(db, { namespace: 'default', format: 'xml' }, modelsPath);
      expect(r.content).toContain('<engram_context');
      expect(r.content).toContain('count="3"');
      expect(r.content).toContain('<preferences>');
      expect(r.content).toContain('</preferences>');
      expect(r.content).toContain('</engram_context>');
    });

    it('should produce parseable JSON', async () => {
      const r = await generateContext(db, { namespace: 'default', format: 'json' }, modelsPath);
      const parsed = JSON.parse(r.content);
      expect(parsed.namespace).toBe('default');
      expect(parsed.count).toBe(3);
      expect(parsed.memories.preference[0].content).toContain('Fastify');
    });

    it('should produce plain text without markup', async () => {
      const r = await generateContext(db, { namespace: 'default', format: 'plain' }, modelsPath);
      expect(r.content).toContain('Fastify');
      expect(r.content).toContain('PostgreSQL');
      expect(r.content).not.toContain('<');
      expect(r.content).not.toContain('##');
    });

    it('should fall back to markdown for unknown format', async () => {
      const r = await generateContext(db, { namespace: 'default', format: 'invalid' }, modelsPath);
      expect(r.content).toContain('## User Context from Memory');
    });
  });

  describe('filters', () => {
    it('should filter by namespace', async () => {
      const r = await generateContext(db, { namespace: 'other' }, modelsPath);
      expect(r.metadata.count).toBe(1);
      expect(r.content).toContain('Other namespace');
      expect(r.content).not.toContain('Fastify');
    });

    it('should filter by categories', async () => {
      const r = await generateContext(db, {
        namespace: 'default',
        categories: ['preference']
      }, modelsPath);
      expect(r.metadata.count).toBe(1);
      expect(r.content).toContain('Fastify');
      expect(r.content).not.toContain('PostgreSQL');
    });

    it('should exclude memories with feedback_score <= -0.3', async () => {
      db.prepare("UPDATE memories SET feedback_score = -0.5 WHERE content LIKE '%Fastify%'").run();
      const r = await generateContext(db, { namespace: 'default' }, modelsPath);
      expect(r.content).not.toContain('Fastify');
      expect(r.metadata.count).toBe(2);
    });

    it('should handle empty namespace gracefully', async () => {
      const r = await generateContext(db, { namespace: 'no-such-ns' }, modelsPath);
      expect(r.metadata.count).toBe(0);
      expect(r.content).toContain('No memories found');
    });
  });

  describe('token budget', () => {
    it('should truncate memories to fit max_tokens budget', async () => {
      // Each memory ≈ estimateTokens(content)+20; budget reserves 100 for headers.
      // 130-token budget should keep only ~1 memory.
      const r = await generateContext(db, {
        namespace: 'default',
        max_tokens: 130
      }, modelsPath);
      expect(r.metadata.count).toBeLessThan(3);
    });

    it('should keep all memories when budget is generous', async () => {
      const r = await generateContext(db, {
        namespace: 'default',
        max_tokens: 10000
      }, modelsPath);
      expect(r.metadata.count).toBe(3);
    });
  });

  describe('metadata inclusion', () => {
    it('should include id and confidence in markdown when include_metadata=true', async () => {
      const r = await generateContext(db, {
        namespace: 'default',
        format: 'markdown',
        include_metadata: true
      }, modelsPath);
      expect(r.content).toContain('confidence:');
      expect(r.content).toContain('id:');
    });

    it('should include id attribute in xml when include_metadata=true', async () => {
      const r = await generateContext(db, {
        namespace: 'default',
        format: 'xml',
        include_metadata: true
      }, modelsPath);
      expect(r.content).toMatch(/<memory id="[a-f0-9-]+" confidence=/);
    });
  });

  describe('XML escaping', () => {
    it('should escape XML special characters in content', async () => {
      createMemory(db, {
        content: 'a < b & c > d',
        category: 'fact',
        namespace: 'xml-test'
      });
      const r = await generateContext(db, { namespace: 'xml-test', format: 'xml' }, modelsPath);
      expect(r.content).toContain('&lt;');
      expect(r.content).toContain('&amp;');
      expect(r.content).toContain('&gt;');
    });
  });

  describe('metadata block', () => {
    it('should return generation metadata', async () => {
      const r = await generateContext(db, { namespace: 'default' }, modelsPath);
      expect(r.metadata.namespace).toBe('default');
      expect(r.metadata.estimatedTokens).toBeGreaterThan(0);
      expect(r.metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Array.isArray(r.metadata.categories)).toBe(true);
    });
  });
});
