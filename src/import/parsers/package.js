import fs from 'fs';
import path from 'path';

/**
 * Detect if package.json exists
 * @param {Object} [options] - Detection options
 * @param {string} [options.cwd] - Working directory to scan
 * @param {string[]} [options.paths] - Additional directories to scan
 * @returns {{ found: boolean, path: string|null, paths: string[] }}
 */
export function detect(options = {}) {
  const cwd = options.cwd || process.cwd();
  const foundPaths = [];
  const seen = new Set();

  // Check cwd
  const filePath = path.resolve(cwd, 'package.json');
  if (fs.existsSync(filePath)) {
    seen.add(filePath);
    foundPaths.push(filePath);
  }

  // Check additional paths
  if (options.paths && Array.isArray(options.paths)) {
    for (const dir of options.paths) {
      const p = path.resolve(dir, 'package.json');
      if (!seen.has(p) && fs.existsSync(p)) {
        seen.add(p);
        foundPaths.push(p);
      }
    }
  }

  return {
    found: foundPaths.length > 0,
    path: foundPaths[0] || null,
    paths: foundPaths
  };
}

/**
 * Parse package.json into memory candidates
 */
export async function parse(options = {}) {
  const result = { source: 'package', memories: [], skipped: [], warnings: [] };
  const cwd = options.cwd || process.cwd();
  const filePath = options.filePath || path.resolve(cwd, 'package.json');

  if (!fs.existsSync(filePath)) {
    result.warnings.push('No package.json found');
    return result;
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    result.warnings.push('Failed to parse package.json');
    return result;
  }

  // Project name and description
  if (pkg.name) {
    const desc = pkg.description ? ` — ${pkg.description}` : '';
    result.memories.push({
      content: `Project "${pkg.name}" (v${pkg.version || '0.0.0'})${desc}`,
      category: 'fact',
      entity: pkg.name,
      confidence: 1.0,
      tags: ['package-json', 'project-info'],
      source: 'import:package'
    });
  }

  // Module type
  if (pkg.type) {
    result.memories.push({
      content: `Project uses ${pkg.type === 'module' ? 'ESM (ES modules)' : 'CommonJS'} module system`,
      category: 'fact',
      entity: 'modules',
      confidence: 1.0,
      tags: ['package-json', 'module-system'],
      source: 'import:package'
    });
  }

  // Engines
  if (pkg.engines) {
    const engines = Object.entries(pkg.engines)
      .map(([name, version]) => `${name} ${version}`)
      .join(', ');
    result.memories.push({
      content: `Project requires: ${engines}`,
      category: 'fact',
      entity: 'runtime',
      confidence: 1.0,
      tags: ['package-json', 'engines'],
      source: 'import:package'
    });
  }

  // Scripts (key developer commands)
  if (pkg.scripts) {
    const importantScripts = ['start', 'dev', 'build', 'test', 'lint', 'deploy'];
    const relevantScripts = Object.entries(pkg.scripts)
      .filter(([key]) => importantScripts.some(s => key.includes(s)));

    if (relevantScripts.length > 0) {
      const scriptList = relevantScripts
        .map(([key, cmd]) => `"${key}": ${cmd}`)
        .join('; ');
      result.memories.push({
        content: `Project npm scripts: ${scriptList}`,
        category: 'fact',
        entity: 'npm',
        confidence: 0.95,
        tags: ['package-json', 'scripts'],
        source: 'import:package'
      });
    }
  }

  // Key dependencies (frameworks, databases, etc.)
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };

  if (Object.keys(allDeps).length > 0) {
    // Categorize notable dependencies
    const frameworks = [];
    const databases = [];
    const tools = [];
    const testing = [];

    const categories = {
      frameworks: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'fastify', 'koa', 'hapi', 'nest', 'electron', 'tauri'],
      databases: ['better-sqlite3', 'sqlite3', 'pg', 'mysql2', 'mongoose', 'prisma', 'sequelize', 'typeorm', 'drizzle', 'redis', 'ioredis'],
      tools: ['typescript', 'vite', 'webpack', 'rollup', 'esbuild', 'tailwindcss', 'eslint', 'prettier', 'commander', 'inquirer'],
      testing: ['vitest', 'jest', 'mocha', 'chai', 'cypress', 'playwright']
    };

    for (const dep of Object.keys(allDeps)) {
      const base = dep.replace(/^@[^/]+\//, '');
      if (categories.frameworks.some(f => base.includes(f))) frameworks.push(dep);
      else if (categories.databases.some(d => base.includes(d))) databases.push(dep);
      else if (categories.testing.some(t => base.includes(t))) testing.push(dep);
      else if (categories.tools.some(t => base.includes(t))) tools.push(dep);
    }

    if (frameworks.length > 0) {
      result.memories.push({
        content: `Project frameworks/libraries: ${frameworks.join(', ')}`,
        category: 'fact',
        entity: 'tech-stack',
        confidence: 1.0,
        tags: ['package-json', 'frameworks'],
        source: 'import:package'
      });
    }

    if (databases.length > 0) {
      result.memories.push({
        content: `Project database dependencies: ${databases.join(', ')}`,
        category: 'fact',
        entity: 'database',
        confidence: 1.0,
        tags: ['package-json', 'databases'],
        source: 'import:package'
      });
    }

    if (testing.length > 0) {
      result.memories.push({
        content: `Project testing tools: ${testing.join(', ')}`,
        category: 'fact',
        entity: 'testing',
        confidence: 1.0,
        tags: ['package-json', 'testing'],
        source: 'import:package'
      });
    }

    if (tools.length > 0) {
      result.memories.push({
        content: `Project dev tools: ${tools.join(', ')}`,
        category: 'fact',
        entity: 'tooling',
        confidence: 1.0,
        tags: ['package-json', 'dev-tools'],
        source: 'import:package'
      });
    }
  }

  return result;
}

export const meta = {
  name: 'package',
  label: 'package.json',
  description: 'Tech stack, scripts, and dependencies',
  category: 'fact',
  locations: ['package.json']
};
