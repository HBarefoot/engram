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
 * @param {string[]} [options.paths] - Additional directories to scan
 * @returns {{ found: boolean, path: string|null, paths: string[] }}
 */
export function detect(options = {}) {
  const cwd = options.cwd || process.cwd();
  const foundPaths = [];
  const seen = new Set();

  // Check cwd
  for (const loc of CURSORRULES_LOCATIONS) {
    const fullPath = path.resolve(cwd, loc);
    if (!seen.has(fullPath) && fs.existsSync(fullPath)) {
      seen.add(fullPath);
      foundPaths.push(fullPath);
    }
  }

  // Check home directory
  const homePath = path.resolve(os.homedir(), '.cursorrules');
  if (!seen.has(homePath) && fs.existsSync(homePath)) {
    seen.add(homePath);
    foundPaths.push(homePath);
  }

  // Check additional paths
  if (options.paths && Array.isArray(options.paths)) {
    for (const dir of options.paths) {
      for (const loc of CURSORRULES_LOCATIONS) {
        const fullPath = path.resolve(dir, loc);
        if (!seen.has(fullPath) && fs.existsSync(fullPath)) {
          seen.add(fullPath);
          foundPaths.push(fullPath);
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
