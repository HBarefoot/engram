import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateContent } from '../../extract/secrets.js';

/**
 * Known locations for .cursorrules files
 */
const CURSORRULES_LOCATIONS = [
  '.cursorrules',
  '.cursor/rules'
];

/**
 * Detect if .cursorrules exists
 * @param {Object} options
 * @param {string} [options.cwd] - Working directory to scan
 * @returns {Object} Detection result
 */
export function detect(options = {}) {
  const cwd = options.cwd || process.cwd();

  for (const loc of CURSORRULES_LOCATIONS) {
    const fullPath = path.resolve(cwd, loc);
    if (fs.existsSync(fullPath)) {
      return { found: true, path: fullPath };
    }
  }

  // Also check home directory
  const homePath = path.join(os.homedir(), '.cursorrules');
  if (fs.existsSync(homePath)) {
    return { found: true, path: homePath };
  }

  return { found: false, path: null };
}

/**
 * Parse .cursorrules file into memory candidates
 * @param {Object} options
 * @param {string} [options.cwd] - Working directory
 * @param {string} [options.filePath] - Explicit file path
 * @returns {Object} Parse result with memories, skipped, warnings
 */
export async function parse(options = {}) {
  const result = { source: 'cursorrules', memories: [], skipped: [], warnings: [] };

  const filePath = options.filePath || (() => {
    const detected = detect(options);
    return detected.path;
  })();

  if (!filePath || !fs.existsSync(filePath)) {
    result.warnings.push('No .cursorrules file found');
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) {
    result.warnings.push('.cursorrules file is empty');
    return result;
  }

  const lines = content.split('\n');
  let currentSection = null;
  let currentBlock = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines between blocks
    if (!line) {
      if (currentBlock.length > 0) {
        flushBlock(currentBlock, currentSection, result);
        currentBlock = [];
      }
      continue;
    }

    // Detect section headers (markdown-style or YAML-style)
    if (/^#{1,3}\s+/.test(line)) {
      if (currentBlock.length > 0) {
        flushBlock(currentBlock, currentSection, result);
        currentBlock = [];
      }
      currentSection = line.replace(/^#{1,3}\s+/, '').trim();
      continue;
    }

    // YAML-style top-level key
    if (/^[a-zA-Z_-]+:\s*$/.test(line)) {
      if (currentBlock.length > 0) {
        flushBlock(currentBlock, currentSection, result);
        currentBlock = [];
      }
      currentSection = line.replace(':', '').trim();
      continue;
    }

    // Collect content lines (strip list markers)
    const cleaned = line.replace(/^[-*]\s+/, '').replace(/^-\s+/, '').trim();
    if (cleaned.length > 10) {
      currentBlock.push(cleaned);
    }
  }

  // Flush remaining block
  if (currentBlock.length > 0) {
    flushBlock(currentBlock, currentSection, result);
  }

  return result;
}

/**
 * Convert a block of lines into memory candidates
 */
function flushBlock(lines, section, result) {
  for (const line of lines) {
    // Run secret detection
    const validation = validateContent(line, { autoRedact: false });
    if (!validation.valid) {
      result.skipped.push({ content: line, reason: 'Contains secrets' });
      result.warnings.push('Skipped rule containing sensitive data');
      continue;
    }

    // Build memory content with section context
    const content = section
      ? `Cursor rule (${section}): ${line}`
      : `Cursor rule: ${line}`;

    if (content.length < 20) continue;

    result.memories.push({
      content,
      category: 'preference',
      entity: null,
      confidence: 0.85,
      tags: ['cursorrules', 'coding-style'],
      source: 'import:cursorrules'
    });
  }
}

export const meta = {
  name: 'cursorrules',
  label: '.cursorrules',
  description: 'Coding preferences and style rules from Cursor',
  category: 'preference',
  locations: CURSORRULES_LOCATIONS
};
