import fs from 'fs';
import path from 'path';

/**
 * Detect if .env.example exists
 */
export function detect(options = {}) {
  const candidates = ['.env.example', '.env.sample', '.env.template'];
  const baseDir = options.cwd || process.cwd();

  for (const name of candidates) {
    const filePath = path.resolve(baseDir, name);
    if (fs.existsSync(filePath)) {
      return { found: true, path: filePath };
    }
  }

  return { found: false, path: null };
}

/**
 * Parse .env.example for environment variable NAMES only.
 * NEVER extracts actual values — only variable names and comments.
 */
export async function parse(options = {}) {
  const result = { source: 'env', memories: [], skipped: [], warnings: [] };

  const filePath = options.filePath || (() => {
    const detected = detect(options);
    return detected.path;
  })();

  if (!filePath || !fs.existsSync(filePath)) {
    result.warnings.push('No .env.example file found');
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const variables = [];
  let currentComment = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Track comments as context
    if (line.startsWith('#')) {
      currentComment = line.replace(/^#+\s*/, '').trim();
      continue;
    }

    if (!line) {
      currentComment = null;
      continue;
    }

    // Parse KEY=value (only extract KEY)
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      variables.push({
        name: match[1],
        comment: currentComment
      });
      currentComment = null;
    }
  }

  if (variables.length === 0) {
    result.warnings.push('.env.example has no variables');
    return result;
  }

  // Group variables by prefix for cleaner memories
  const groups = {};
  for (const v of variables) {
    const prefix = v.name.split('_')[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(v);
  }

  // Create summary memory with all variable names
  const varNames = variables.map(v => v.name);
  result.memories.push({
    content: `Project environment variables (names only): ${varNames.join(', ')}`,
    category: 'fact',
    entity: 'environment',
    confidence: 0.9,
    tags: ['env-example', 'configuration'],
    source: 'import:env'
  });

  // Create grouped memories for larger variable sets
  for (const [prefix, vars] of Object.entries(groups)) {
    if (vars.length >= 2) {
      const names = vars.map(v => v.name).join(', ');
      const comments = vars
        .filter(v => v.comment)
        .map(v => `${v.name}: ${v.comment}`)
        .join('; ');

      const content = comments
        ? `Environment config group "${prefix}": ${names}. ${comments}`
        : `Environment config group "${prefix}": ${names}`;

      result.memories.push({
        content,
        category: 'fact',
        entity: 'environment',
        confidence: 0.85,
        tags: ['env-example', 'configuration'],
        source: 'import:env'
      });
    }
  }

  // Security warning
  result.warnings.push('Only variable NAMES were extracted — no values or secrets');

  return result;
}

export const meta = {
  name: 'env',
  label: '.env.example',
  description: 'Environment variable names only (NEVER values)',
  category: 'fact',
  locations: ['.env.example', '.env.sample', '.env.template']
};
