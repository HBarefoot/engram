import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateContent } from '../../extract/secrets.js';

const GITCONFIG_LOCATIONS = [
  path.join(os.homedir(), '.gitconfig'),
  path.join(os.homedir(), '.config/git/config')
];

/**
 * Detect if git config exists
 * @param {Object} [options] - Detection options
 * @param {string[]} [options.paths] - Additional directories to scan for gitconfig
 * @returns {{ found: boolean, path: string|null, paths: string[] }}
 */
export function detect(options = {}) {
  const foundPaths = [];
  const seen = new Set();

  for (const loc of GITCONFIG_LOCATIONS) {
    const resolved = path.resolve(loc);
    if (!seen.has(resolved) && fs.existsSync(resolved)) {
      seen.add(resolved);
      foundPaths.push(resolved);
    }
  }

  // Check additional paths for gitconfig files
  if (options.paths && Array.isArray(options.paths)) {
    for (const dir of options.paths) {
      for (const name of ['.gitconfig', '.config/git/config']) {
        const loc = path.join(dir, name);
        const resolved = path.resolve(loc);
        if (!seen.has(resolved) && fs.existsSync(resolved)) {
          seen.add(resolved);
          foundPaths.push(resolved);
        }
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
 * Parse ~/.gitconfig into memory candidates
 */
export async function parse(options = {}) {
  const result = { source: 'git', memories: [], skipped: [], warnings: [] };

  // If explicit filePath, parse just that one (backward compat)
  if (options.filePath) {
    parseOneGitconfig(options.filePath, result);
    return result;
  }

  const detected = detect(options);
  if (!detected.found) {
    result.warnings.push('No .gitconfig found');
    return result;
  }

  for (const filePath of detected.paths) {
    parseOneGitconfig(filePath, result);
  }

  return result;
}

/**
 * Parse a single .gitconfig file and accumulate results
 */
function parseOneGitconfig(filePath, result) {
  if (!filePath || !fs.existsSync(filePath)) {
    result.warnings.push('No .gitconfig found');
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const sections = parseIniFile(content);

  // Extract user info
  if (sections.user) {
    if (sections.user.name) {
      result.memories.push({
        content: `Git user name: ${sections.user.name}`,
        category: 'fact',
        entity: 'git',
        confidence: 1.0,
        tags: ['gitconfig', 'user-info'],
        source: 'import:git'
      });
    }

    if (sections.user.email) {
      // Validate — email itself isn't a secret, but check anyway
      const validation = validateContent(sections.user.email, { autoRedact: false });
      if (validation.valid) {
        result.memories.push({
          content: `Git user email: ${sections.user.email}`,
          category: 'fact',
          entity: 'git',
          confidence: 1.0,
          tags: ['gitconfig', 'user-info'],
          source: 'import:git'
        });
      }
    }

    if (sections.user.signingkey) {
      // Don't extract the actual key, just note that signing is configured
      result.memories.push({
        content: 'Git commit signing is configured',
        category: 'fact',
        entity: 'git',
        confidence: 1.0,
        tags: ['gitconfig', 'security'],
        source: 'import:git'
      });
    }
  }

  // Extract core settings
  if (sections.core) {
    const coreSettings = [];
    if (sections.core.editor) coreSettings.push(`editor: ${sections.core.editor}`);
    if (sections.core.autocrlf) coreSettings.push(`autocrlf: ${sections.core.autocrlf}`);
    if (sections.core.pager) coreSettings.push(`pager: ${sections.core.pager}`);

    if (coreSettings.length > 0) {
      result.memories.push({
        content: `Git core settings: ${coreSettings.join(', ')}`,
        category: 'preference',
        entity: 'git',
        confidence: 0.9,
        tags: ['gitconfig', 'preferences'],
        source: 'import:git'
      });
    }
  }

  // Extract aliases
  if (sections.alias) {
    const aliases = Object.entries(sections.alias);
    if (aliases.length > 0) {
      const aliasStr = aliases
        .slice(0, 10) // Limit to 10 most relevant
        .map(([name, cmd]) => `${name}="${cmd}"`)
        .join(', ');

      result.memories.push({
        content: `Git aliases: ${aliasStr}`,
        category: 'pattern',
        entity: 'git',
        confidence: 0.85,
        tags: ['gitconfig', 'aliases'],
        source: 'import:git'
      });
    }
  }

  // Extract default branch
  if (sections.init?.defaultBranch) {
    result.memories.push({
      content: `Git default branch: ${sections.init.defaultBranch}`,
      category: 'preference',
      entity: 'git',
      confidence: 1.0,
      tags: ['gitconfig', 'preferences'],
      source: 'import:git'
    });
  }

  // Extract merge/diff tool preferences
  if (sections.merge?.tool || sections.diff?.tool) {
    const tools = [];
    if (sections.merge?.tool) tools.push(`merge tool: ${sections.merge.tool}`);
    if (sections.diff?.tool) tools.push(`diff tool: ${sections.diff.tool}`);

    result.memories.push({
      content: `Git ${tools.join(', ')}`,
      category: 'preference',
      entity: 'git',
      confidence: 0.9,
      tags: ['gitconfig', 'tools'],
      source: 'import:git'
    });
  }
}

/**
 * Simple INI file parser for git config format
 */
function parseIniFile(content) {
  const sections = {};
  let currentSection = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    // Section header [section] or [section "subsection"]
    const sectionMatch = line.match(/^\[([^\s\]]+)(?:\s+"([^"]+)")?\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[2]
        ? `${sectionMatch[1]}.${sectionMatch[2]}`
        : sectionMatch[1];
      currentSection = sectionName;
      if (!sections[currentSection]) sections[currentSection] = {};
      continue;
    }

    // Key = value
    if (currentSection) {
      const kvMatch = line.match(/^(\w+)\s*=\s*(.*)$/);
      if (kvMatch) {
        sections[currentSection][kvMatch[1]] = kvMatch[2].trim();
      }
    }
  }

  return sections;
}

export const meta = {
  name: 'git',
  label: 'git config',
  description: 'Name, email, aliases, and preferences from git configuration',
  category: 'fact',
  locations: GITCONFIG_LOCATIONS.map(p => p.replace(os.homedir(), '~'))
};
