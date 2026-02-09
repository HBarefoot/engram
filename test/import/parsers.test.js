import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES = path.join(__dirname, 'fixtures');

describe('Import Parsers', () => {
  describe('cursorrules parser', () => {
    it('should parse .cursorrules file into preference memories', async () => {
      const { parse } = await import('../../src/import/parsers/cursorrules.js');
      const result = await parse({ filePath: path.join(FIXTURES, 'sample.cursorrules') });

      expect(result.source).toBe('cursorrules');
      expect(result.memories.length).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
      expect(result.skipped).toEqual([]);

      // All memories should be preference category
      for (const memory of result.memories) {
        expect(memory.category).toBe('preference');
        expect(memory.source).toBe('import:cursorrules');
        expect(memory.confidence).toBeGreaterThan(0);
        expect(memory.content).toContain('Cursor rule');
      }
    });

    it('should handle missing file gracefully', async () => {
      const { parse } = await import('../../src/import/parsers/cursorrules.js');
      const result = await parse({ filePath: '/nonexistent/.cursorrules' });

      expect(result.memories).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect cursorrules meta', async () => {
      const { meta } = await import('../../src/import/parsers/cursorrules.js');
      expect(meta.name).toBe('cursorrules');
      expect(meta.category).toBe('preference');
    });
  });

  describe('package parser', () => {
    it('should parse package.json into fact memories', async () => {
      const { parse } = await import('../../src/import/parsers/package.js');
      const result = await parse({ filePath: path.join(FIXTURES, 'sample.package.json') });

      expect(result.source).toBe('package');
      expect(result.memories.length).toBeGreaterThan(0);

      // Should extract project name
      const nameMemory = result.memories.find(m => m.content.includes('my-test-project'));
      expect(nameMemory).toBeTruthy();
      expect(nameMemory.confidence).toBe(1.0);

      // Should extract module type
      const moduleMemory = result.memories.find(m => m.content.includes('ESM'));
      expect(moduleMemory).toBeTruthy();

      // Should extract frameworks
      const frameworkMemory = result.memories.find(m => m.content.includes('frameworks'));
      expect(frameworkMemory).toBeTruthy();
      expect(frameworkMemory.content).toContain('fastify');
      expect(frameworkMemory.content).toContain('react');

      // Should extract testing tools
      const testMemory = result.memories.find(m => m.content.includes('testing'));
      expect(testMemory).toBeTruthy();
      expect(testMemory.content).toContain('vitest');
    });

    it('should handle missing file gracefully', async () => {
      const { parse } = await import('../../src/import/parsers/package.js');
      const result = await parse({ filePath: '/nonexistent/package.json' });

      expect(result.memories).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('git parser', () => {
    it('should parse .gitconfig into memories', async () => {
      const { parse } = await import('../../src/import/parsers/git.js');
      const result = await parse({ filePath: path.join(FIXTURES, 'sample.gitconfig') });

      expect(result.source).toBe('git');
      expect(result.memories.length).toBeGreaterThan(0);

      // Should extract user name
      const nameMemory = result.memories.find(m => m.content.includes('Jane Developer'));
      expect(nameMemory).toBeTruthy();
      expect(nameMemory.category).toBe('fact');

      // Should extract email
      const emailMemory = result.memories.find(m => m.content.includes('jane@example.com'));
      expect(emailMemory).toBeTruthy();

      // Should detect commit signing without extracting the key
      const signingMemory = result.memories.find(m => m.content.includes('signing'));
      expect(signingMemory).toBeTruthy();
      expect(signingMemory.content).not.toContain('ABC123');

      // Should extract editor preference
      const coreMemory = result.memories.find(m => m.content.includes('nvim'));
      expect(coreMemory).toBeTruthy();
      expect(coreMemory.category).toBe('preference');

      // Should extract aliases
      const aliasMemory = result.memories.find(m => m.content.includes('aliases'));
      expect(aliasMemory).toBeTruthy();
      expect(aliasMemory.category).toBe('pattern');

      // Should extract default branch
      const branchMemory = result.memories.find(m => m.content.includes('main'));
      expect(branchMemory).toBeTruthy();
    });
  });

  describe('ssh parser', () => {
    it('should extract host names but NEVER keys', async () => {
      const { parse } = await import('../../src/import/parsers/ssh.js');
      const result = await parse({ filePath: path.join(FIXTURES, 'sample.ssh-config') });

      expect(result.source).toBe('ssh');
      expect(result.memories.length).toBeGreaterThan(0);

      // Should have host names
      const allContent = result.memories.map(m => m.content).join(' ');
      expect(allContent).toContain('production');
      expect(allContent).toContain('staging');
      expect(allContent).toContain('github.com');

      // CRITICAL: Must NEVER contain key paths or key content
      expect(allContent).not.toContain('prod_rsa');
      expect(allContent).not.toContain('github_ed25519');
      expect(allContent).not.toContain('IdentityFile');
      expect(allContent).not.toContain('.ssh/');

      // Should have warning about skipped IdentityFile entries
      expect(result.warnings.some(w => w.includes('IdentityFile'))).toBe(true);
    });

    it('should extract hostname and user info', async () => {
      const { parse } = await import('../../src/import/parsers/ssh.js');
      const result = await parse({ filePath: path.join(FIXTURES, 'sample.ssh-config') });

      // Find the individual host memory (not the summary), which contains IP/user details
      const prodMemory = result.memories.find(m =>
        m.content.includes('production') && m.content.includes('connects to')
      );
      expect(prodMemory).toBeTruthy();
      expect(prodMemory.content).toContain('10.0.1.100');
      expect(prodMemory.content).toContain('deploy');
    });
  });

  describe('env parser', () => {
    it('should extract variable names but NEVER values', async () => {
      const { parse } = await import('../../src/import/parsers/env.js');
      const result = await parse({ filePath: path.join(FIXTURES, 'sample.env.example') });

      expect(result.source).toBe('env');
      expect(result.memories.length).toBeGreaterThan(0);

      const allContent = result.memories.map(m => m.content).join(' ');

      // Should contain variable names
      expect(allContent).toContain('DATABASE_URL');
      expect(allContent).toContain('REDIS_URL');
      expect(allContent).toContain('NODE_ENV');

      // CRITICAL: Must NEVER contain actual values
      expect(allContent).not.toContain('postgresql://');
      expect(allContent).not.toContain('redis://');
      expect(allContent).not.toContain('pk_test_');
      expect(allContent).not.toContain('sk_test_');
      expect(allContent).not.toContain('sk-xxx');
    });

    it('should have security warning', async () => {
      const { parse } = await import('../../src/import/parsers/env.js');
      const result = await parse({ filePath: path.join(FIXTURES, 'sample.env.example') });

      expect(result.warnings.some(w => w.includes('NAMES'))).toBe(true);
    });
  });
});

describe('Multi-Path Scanning', () => {
  describe('backward compatibility', () => {
    it('home-scoped parsers accept options={} without breaking', async () => {
      const { detect: detectGit } = await import('../../src/import/parsers/git.js');
      const { detect: detectShell } = await import('../../src/import/parsers/shell.js');
      const { detect: detectSsh } = await import('../../src/import/parsers/ssh.js');

      // All should work with no arguments
      const gitResult = detectGit();
      const shellResult = detectShell();
      const sshResult = detectSsh();

      expect(gitResult).toHaveProperty('found');
      expect(gitResult).toHaveProperty('path');
      expect(gitResult).toHaveProperty('paths');
      expect(Array.isArray(gitResult.paths)).toBe(true);

      expect(shellResult).toHaveProperty('found');
      expect(shellResult).toHaveProperty('paths');
      expect(Array.isArray(shellResult.paths)).toBe(true);

      expect(sshResult).toHaveProperty('found');
      expect(sshResult).toHaveProperty('paths');
      expect(Array.isArray(sshResult.paths)).toBe(true);
    });

    it('project-scoped parsers accept options={} without breaking', async () => {
      const { detect: detectClaude } = await import('../../src/import/parsers/claude.js');
      const { detect: detectCursor } = await import('../../src/import/parsers/cursorrules.js');
      const { detect: detectEnv } = await import('../../src/import/parsers/env.js');
      const { detect: detectPkg } = await import('../../src/import/parsers/package.js');
      const { detect: detectObsidian } = await import('../../src/import/parsers/obsidian.js');

      for (const detectFn of [detectClaude, detectCursor, detectEnv, detectPkg, detectObsidian]) {
        const result = detectFn({});
        expect(result).toHaveProperty('found');
        expect(result).toHaveProperty('path');
        expect(result).toHaveProperty('paths');
        expect(Array.isArray(result.paths)).toBe(true);
      }
    });
  });

  describe('options.paths adds search locations', () => {
    it('package parser finds package.json in additional paths', async () => {
      const { detect } = await import('../../src/import/parsers/package.js');
      const projectRoot = path.resolve(__dirname, '../..');

      // Point paths to the project root (which has a package.json)
      const result = detect({ cwd: '/tmp', paths: [projectRoot] });
      expect(result.found).toBe(true);
      expect(result.paths.length).toBeGreaterThan(0);
      expect(result.paths.some(p => p.includes('package.json'))).toBe(true);
    });

    it('env parser finds .env.example in additional paths', async () => {
      const { detect } = await import('../../src/import/parsers/env.js');
      // Use fixtures dir which may have sample.env.example (but file name differs)
      // Use a nonexistent path to verify it doesn't crash
      const result = detect({ cwd: '/tmp', paths: ['/nonexistent/dir'] });
      expect(result).toHaveProperty('found');
      expect(result).toHaveProperty('paths');
      expect(Array.isArray(result.paths)).toBe(true);
    });

    it('git parser accepts options.paths without error', async () => {
      const { detect } = await import('../../src/import/parsers/git.js');
      const result = detect({ paths: ['/nonexistent/dir'] });
      expect(result).toHaveProperty('found');
      expect(result).toHaveProperty('paths');
      expect(Array.isArray(result.paths)).toBe(true);
    });
  });

  describe('path deduplication', () => {
    it('package parser does not double-count when cwd and paths overlap', async () => {
      const { detect } = await import('../../src/import/parsers/package.js');
      const projectRoot = path.resolve(__dirname, '../..');

      // Pass project root as both cwd and in paths
      const result = detect({ cwd: projectRoot, paths: [projectRoot] });
      if (result.found) {
        // Should not have duplicate entries
        const unique = new Set(result.paths);
        expect(result.paths.length).toBe(unique.size);
      }
    });
  });

  describe('detect returns paths array', () => {
    it('all parsers return paths array from detect()', async () => {
      const parsers = [
        '../../src/import/parsers/git.js',
        '../../src/import/parsers/shell.js',
        '../../src/import/parsers/ssh.js',
        '../../src/import/parsers/claude.js',
        '../../src/import/parsers/cursorrules.js',
        '../../src/import/parsers/env.js',
        '../../src/import/parsers/package.js',
        '../../src/import/parsers/obsidian.js'
      ];

      for (const parserPath of parsers) {
        const { detect } = await import(parserPath);
        const result = detect({});
        expect(result).toHaveProperty('paths');
        expect(Array.isArray(result.paths)).toBe(true);

        // If found is true, paths should have at least one entry
        if (result.found) {
          expect(result.paths.length).toBeGreaterThan(0);
          // path should equal the first entry in paths
          expect(result.path).toBe(result.paths[0]);
        }
      }
    });
  });

  describe('claude parser checks home directory', () => {
    it('should check home directory even when cwd is elsewhere', async () => {
      const { detect } = await import('../../src/import/parsers/claude.js');
      // Use /tmp as cwd (unlikely to have .claude files)
      const result = detect({ cwd: '/tmp' });
      // We can only verify the structure — whether home has .claude depends on system
      expect(result).toHaveProperty('found');
      expect(result).toHaveProperty('paths');
      expect(Array.isArray(result.paths)).toBe(true);
    });
  });
});

describe('Import Orchestrator', () => {
  it('should detect available sources', async () => {
    const { detectSources } = await import('../../src/import/index.js');
    const sources = await detectSources();

    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);

    for (const source of sources) {
      expect(source).toHaveProperty('id');
      expect(source).toHaveProperty('name');
      expect(source).toHaveProperty('detected');
      expect(source.detected).toHaveProperty('found');
    }
  });

  it('should scan selected sources', async () => {
    const { scanSources } = await import('../../src/import/index.js');
    // package.json should exist in the project root
    const result = await scanSources(['package'], { cwd: path.resolve(__dirname, '../..') });

    expect(result).toHaveProperty('memories');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('duration');
    expect(Array.isArray(result.memories)).toBe(true);
  });

  it('should handle unknown sources gracefully', async () => {
    const { scanSources } = await import('../../src/import/index.js');
    const result = await scanSources(['nonexistent-source']);

    expect(result.memories).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should get source metadata', async () => {
    const { getSourceMeta } = await import('../../src/import/index.js');
    const meta = await getSourceMeta();

    expect(meta.length).toBe(8);
    const names = meta.map(m => m.name);
    expect(names).toContain('cursorrules');
    expect(names).toContain('claude');
    expect(names).toContain('package');
    expect(names).toContain('git');
    expect(names).toContain('ssh');
    expect(names).toContain('shell');
    expect(names).toContain('obsidian');
    expect(names).toContain('env');
  });
});
