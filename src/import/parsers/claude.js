import fs from 'fs';
import path from 'path';
import { validateContent } from '../../extract/secrets.js';

const CLAUDE_LOCATIONS = [
  '.claude',
  'CLAUDE.md',
  '.claude/settings.json',
  '.claude/commands'
];

/**
 * Detect if .claude project files exist
 */
export function detect(options = {}) {
  const cwd = options.cwd || process.cwd();

  for (const loc of CLAUDE_LOCATIONS) {
    const fullPath = path.resolve(cwd, loc);
    if (fs.existsSync(fullPath)) {
      return { found: true, path: path.resolve(cwd) };
    }
  }

  return { found: false, path: null };
}

/**
 * Parse .claude project files into memory candidates
 */
export async function parse(options = {}) {
  const result = { source: 'claude', memories: [], skipped: [], warnings: [] };
  const cwd = options.cwd || process.cwd();

  // Parse CLAUDE.md
  const claudeMdPath = path.resolve(cwd, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    parseClaudeMd(claudeMdPath, result);
  }

  // Parse .claude/settings.json
  const settingsPath = path.resolve(cwd, '.claude/settings.json');
  if (fs.existsSync(settingsPath)) {
    parseClaudeSettings(settingsPath, result);
  }

  // Parse .claude/commands directory
  const commandsPath = path.resolve(cwd, '.claude/commands');
  if (fs.existsSync(commandsPath) && fs.statSync(commandsPath).isDirectory()) {
    parseClaudeCommands(commandsPath, result);
  }

  if (result.memories.length === 0) {
    result.warnings.push('No .claude project files found or no extractable content');
  }

  return result;
}

/**
 * Parse CLAUDE.md into structured memories
 */
function parseClaudeMd(filePath, result) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let currentSection = null;
  let currentBlock = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Section headers
    if (/^#{1,3}\s+/.test(line)) {
      if (currentBlock.length > 0) {
        flushClaudeBlock(currentBlock, currentSection, result);
        currentBlock = [];
      }
      currentSection = line.replace(/^#{1,3}\s+/, '').trim();
      continue;
    }

    // Skip empty lines
    if (!line) {
      if (currentBlock.length > 0) {
        flushClaudeBlock(currentBlock, currentSection, result);
        currentBlock = [];
      }
      continue;
    }

    // Skip code blocks (fences)
    if (line.startsWith('```')) continue;

    // Collect content
    const cleaned = line.replace(/^[-*]\s+/, '').trim();
    if (cleaned.length > 15) {
      currentBlock.push(cleaned);
    }
  }

  if (currentBlock.length > 0) {
    flushClaudeBlock(currentBlock, currentSection, result);
  }
}

function flushClaudeBlock(lines, section, result) {
  // Group related lines into single memories when they're short
  const grouped = [];
  let current = [];

  for (const line of lines) {
    if (line.length > 100) {
      // Long lines become individual memories
      if (current.length > 0) {
        grouped.push(current.join('. '));
        current = [];
      }
      grouped.push(line);
    } else {
      current.push(line);
      if (current.join('. ').length > 150) {
        grouped.push(current.join('. '));
        current = [];
      }
    }
  }
  if (current.length > 0) grouped.push(current.join('. '));

  for (const text of grouped) {
    const validation = validateContent(text, { autoRedact: false });
    if (!validation.valid) {
      result.skipped.push({ content: text, reason: 'Contains secrets' });
      result.warnings.push('Skipped CLAUDE.md section containing sensitive data');
      continue;
    }

    const content = section
      ? `Claude project context (${section}): ${text}`
      : `Claude project context: ${text}`;

    if (content.length < 25) continue;

    result.memories.push({
      content,
      category: 'fact',
      entity: null,
      confidence: 0.9,
      tags: ['claude-project', 'project-context'],
      source: 'import:claude'
    });
  }
}

/**
 * Parse .claude/settings.json
 */
function parseClaudeSettings(filePath, result) {
  try {
    const settings = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (settings.permissions?.allow) {
      const content = `Claude project allows these tool permissions: ${settings.permissions.allow.join(', ')}`;
      result.memories.push({
        content,
        category: 'fact',
        entity: 'claude-code',
        confidence: 0.9,
        tags: ['claude-project', 'permissions'],
        source: 'import:claude'
      });
    }
  } catch {
    result.warnings.push('Failed to parse .claude/settings.json');
  }
}

/**
 * Parse .claude/commands directory
 */
function parseClaudeCommands(dirPath, result) {
  try {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const name = path.basename(file, '.md');
      const content = `Claude project has custom command: /${name}`;
      result.memories.push({
        content,
        category: 'fact',
        entity: 'claude-code',
        confidence: 0.9,
        tags: ['claude-project', 'custom-commands'],
        source: 'import:claude'
      });
    }
  } catch {
    result.warnings.push('Failed to read .claude/commands directory');
  }
}

export const meta = {
  name: 'claude',
  label: '.claude files',
  description: 'Project context and instructions from Claude Code',
  category: 'fact',
  locations: CLAUDE_LOCATIONS
};
