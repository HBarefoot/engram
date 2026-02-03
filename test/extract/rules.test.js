import { describe, it, expect } from 'vitest';
import {
  detectCategory,
  extractEntity,
  calculateConfidence,
  extractMemory,
  extractMemories
} from '../../src/extract/rules.js';

describe('Extraction Rules', () => {
  describe('detectCategory', () => {
    it('should detect preference category', () => {
      expect(detectCategory('User prefers Fastify over Express')).toBe('preference');
      expect(detectCategory('I like using Docker for everything')).toBe('preference');
      expect(detectCategory('Never use Bootstrap, always Tailwind')).toBe('preference');
    });

    it('should detect pattern category', () => {
      expect(detectCategory('User typically deploys on Fridays')).toBe('pattern');
      expect(detectCategory('Always runs tests before committing')).toBe('pattern');
      expect(detectCategory('When deploying, then run migration scripts')).toBe('pattern');
    });

    it('should detect decision category', () => {
      expect(detectCategory('Decided to use PostgreSQL because of JSONB support')).toBe('decision');
      expect(detectCategory('Chose React over Vue for this project')).toBe('decision');
      expect(detectCategory('Switched to Vite due to better performance')).toBe('decision');
    });

    it('should detect outcome category', () => {
      expect(detectCategory('Migration to TypeScript improved code quality')).toBe('outcome');
      expect(detectCategory('The refactoring fixed the memory leak')).toBe('outcome');
      expect(detectCategory('Adding indexes solved the performance issue')).toBe('outcome');
    });

    it('should default to fact category', () => {
      expect(detectCategory('Project uses Node.js 20')).toBe('fact');
      expect(detectCategory('Database is PostgreSQL 15')).toBe('fact');
      expect(detectCategory('Server runs on Ubuntu 22.04')).toBe('fact');
    });
  });

  describe('extractEntity', () => {
    it('should extract common tech keywords', () => {
      expect(extractEntity('User prefers Docker for containerization')).toBe('docker');
      expect(extractEntity('Uses PostgreSQL as the database')).toBe('postgresql');
      expect(extractEntity('Deploys with Nginx reverse proxy')).toBe('nginx');
    });

    it('should extract from "uses X" patterns', () => {
      expect(extractEntity('Project uses React for frontend')).toBe('react');
      expect(extractEntity('Built with Fastify framework')).toBe('fastify');
    });

    it('should extract from configuration patterns', () => {
      expect(extractEntity('Docker configuration for development')).toBe('docker');
      expect(extractEntity('Nginx server setup')).toBe('nginx');
    });

    it('should normalize entity names', () => {
      expect(extractEntity('Uses Next.js for SSR')).toBe('nextjs');
      expect(extractEntity('Uses Node.js 20')).toBe('nodejs');
    });

    it('should return null for no clear entity', () => {
      expect(extractEntity('This is a generic statement')).toBeNull();
      expect(extractEntity('The user is happy')).toBeNull();
    });

    it('should filter out stop words', () => {
      // Should not return common words like "the", "a", etc.
      const entity = extractEntity('The user configuration');
      expect(entity).not.toBe('the');
      expect(entity).not.toBe('a');
    });
  });

  describe('calculateConfidence', () => {
    it('should return 1.0 for user explicit context', () => {
      const confidence = calculateConfidence('Any content', { userExplicit: true });
      expect(confidence).toBe(1.0);
    });

    it('should return 0.9 for code/config context', () => {
      const confidence = calculateConfidence('Any content', { fromCode: true });
      expect(confidence).toBe(0.9);
    });

    it('should return 0.9 for explicit user statements', () => {
      const confidence = calculateConfidence('I use Docker for all my projects');
      expect(confidence).toBe(0.9);
    });

    it('should return lower confidence for inferred content', () => {
      const confidence = calculateConfidence('User seems to prefer React');
      expect(confidence).toBeLessThan(0.8);
    });

    it('should return 0.7 for inferred context', () => {
      const confidence = calculateConfidence('Any content', { inferred: true });
      expect(confidence).toBe(0.7);
    });

    it('should return 0.8 as default confidence', () => {
      const confidence = calculateConfidence('Regular statement without signals');
      expect(confidence).toBe(0.8);
    });
  });

  describe('extractMemory', () => {
    it('should extract complete memory with all fields', () => {
      const content = 'User prefers Fastify over Express for Node.js APIs';
      const memory = extractMemory(content);

      expect(memory.content).toBe(content);
      expect(memory.category).toBe('preference');
      expect(memory.entity).toBe('fastify');
      expect(memory.confidence).toBeGreaterThan(0);
      expect(memory.source).toBe('manual');
      expect(memory.namespace).toBe('default');
      expect(memory.tags).toEqual([]);
    });

    it('should use provided options', () => {
      const content = 'Uses PostgreSQL database';
      const memory = extractMemory(content, {
        source: 'import',
        namespace: 'project-api',
        tags: ['database', 'postgres']
      });

      expect(memory.source).toBe('import');
      expect(memory.namespace).toBe('project-api');
      expect(memory.tags).toEqual(['database', 'postgres']);
    });

    it('should trim content', () => {
      const memory = extractMemory('  Content with spaces  ');
      expect(memory.content).toBe('Content with spaces');
    });

    it('should detect category and entity automatically', () => {
      const memory = extractMemory('Decided to use Docker because of portability');

      expect(memory.category).toBe('decision');
      expect(memory.entity).toBe('docker');
    });
  });

  describe('extractMemories', () => {
    it('should extract multiple memories from text', () => {
      const text = `
        User prefers Docker for containerization.
        Project uses PostgreSQL 15 as the database.
        Deployment is done via GitHub Actions.
      `;

      const memories = extractMemories(text);

      expect(memories.length).toBeGreaterThan(0);
      expect(memories.length).toBeLessThanOrEqual(3);
      expect(memories.every(m => m.content && m.category)).toBe(true);
    });

    it('should filter out generic content', () => {
      const text = `
        Okay.
        User prefers PostgreSQL over MySQL.
        Thanks!
      `;

      const memories = extractMemories(text);

      // Should only extract the meaningful sentence
      expect(memories.length).toBe(1);
      expect(memories[0].content).toContain('PostgreSQL');
    });

    it('should filter out short sentences', () => {
      const text = 'Yes. User uses Docker. No. PostgreSQL is the database.';

      const memories = extractMemories(text);

      // Should filter out "Yes" and "No"
      expect(memories.every(m => m.content.length > 20)).toBe(true);
    });

    it('should apply options to all extracted memories', () => {
      const text = 'Uses Docker. Uses PostgreSQL.';

      const memories = extractMemories(text, {
        namespace: 'test-project',
        source: 'import'
      });

      expect(memories.every(m => m.namespace === 'test-project')).toBe(true);
      expect(memories.every(m => m.source === 'import')).toBe(true);
    });

    it('should handle empty text', () => {
      const memories = extractMemories('');
      expect(memories.length).toBe(0);
    });

    it('should only extract memories with entity or non-fact category', () => {
      const text = `
        Generic statement without entity.
        User prefers Docker for containerization.
        Another generic statement.
        Decided to use PostgreSQL for the database.
      `;

      const memories = extractMemories(text);

      // Should only extract meaningful memories
      expect(memories.every(m => m.entity || m.category !== 'fact')).toBe(true);
    });
  });
});
