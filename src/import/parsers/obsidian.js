import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateContent } from '../../extract/secrets.js';

/**
 * Common Obsidian vault locations
 */
const VAULT_SEARCH_DIRS = [
  os.homedir(),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Notes'),
  path.join(os.homedir(), 'Obsidian')
];

/**
 * Detect Obsidian vaults by looking for .obsidian directories
 */
export function detect(options = {}) {
  const searchDirs = options.vaultPaths || VAULT_SEARCH_DIRS;
  const vaults = [];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const obsidianDir = path.join(dir, entry.name, '.obsidian');
        if (fs.existsSync(obsidianDir)) {
          vaults.push(path.join(dir, entry.name));
        }
      }
    } catch {
      // Permission denied or other error, skip
    }
  }

  return { found: vaults.length > 0, path: vaults[0] || null, vaults };
}

/**
 * Parse Obsidian vaults for notes tagged with #engram or in a specific folder
 */
export async function parse(options = {}) {
  const result = { source: 'obsidian', memories: [], skipped: [], warnings: [] };

  const detection = detect(options);
  const vaults = options.vaultPaths || detection.vaults || [];

  if (vaults.length === 0) {
    result.warnings.push('No Obsidian vaults found');
    return result;
  }

  const tag = options.tag || '#engram';
  const folder = options.folder || 'engram';
  const maxNotes = options.maxNotes || 50;

  let notesProcessed = 0;

  for (const vaultPath of vaults) {
    if (notesProcessed >= maxNotes) break;

    // Look for notes with #engram tag
    const taggedNotes = findTaggedNotes(vaultPath, tag, maxNotes - notesProcessed);
    for (const note of taggedNotes) {
      processNote(note, result);
      notesProcessed++;
    }

    // Look for notes in engram/ folder
    const folderPath = path.join(vaultPath, folder);
    if (fs.existsSync(folderPath)) {
      const folderNotes = findNotesInFolder(folderPath, maxNotes - notesProcessed);
      for (const note of folderNotes) {
        processNote(note, result);
        notesProcessed++;
      }
    }
  }

  if (result.memories.length === 0) {
    result.warnings.push(`No notes found with tag "${tag}" or in "${folder}/" folder`);
  }

  return result;
}

/**
 * Find markdown files containing a specific tag
 */
function findTaggedNotes(vaultPath, tag, maxResults) {
  const notes = [];
  const tagPattern = tag.startsWith('#') ? tag : `#${tag}`;

  function walk(dir, depth = 0) {
    if (depth > 5 || notes.length >= maxResults) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (notes.length >= maxResults) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          walk(fullPath, depth + 1);
        } else if (entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes(tagPattern)) {
              notes.push({ path: fullPath, content, name: entry.name });
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walk(vaultPath);
  return notes;
}

/**
 * Find markdown files in a specific folder
 */
function findNotesInFolder(folderPath, maxResults) {
  const notes = [];

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (notes.length >= maxResults) break;

      if (entry.name.endsWith('.md')) {
        const fullPath = path.join(folderPath, entry.name);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          notes.push({ path: fullPath, content, name: entry.name });
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Skip unreadable directories
  }

  return notes;
}

/**
 * Process a single note into memory candidates
 */
function processNote(note, result) {
  const lines = note.content.split('\n');
  let currentHeading = path.basename(note.name, '.md');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Track headings for context
    if (/^#{1,3}\s+/.test(line)) {
      currentHeading = line.replace(/^#{1,3}\s+/, '').trim();
      continue;
    }

    // Skip empty, tags-only, or very short lines
    if (!line || line === '---' || line.startsWith('```')) continue;

    // Strip markdown formatting
    const cleaned = line
      .replace(/^[-*]\s+/, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Inline links
      .replace(/[*_`~]/g, '')                     // Bold, italic, code
      .replace(/#\w+/g, '')                       // Tags
      .trim();

    if (cleaned.length < 15) continue;

    // Validate for secrets
    const validation = validateContent(cleaned, { autoRedact: false });
    if (!validation.valid) {
      result.skipped.push({ content: cleaned.substring(0, 50), reason: 'Contains secrets' });
      continue;
    }

    // Determine category from content
    let category = 'fact';
    if (/prefer|like|dislike|always use|never use/i.test(cleaned)) {
      category = 'preference';
    } else if (/decided|chose|switched/i.test(cleaned)) {
      category = 'decision';
    }

    result.memories.push({
      content: `From Obsidian (${currentHeading}): ${cleaned}`,
      category,
      entity: null,
      confidence: 0.75,
      tags: ['obsidian', 'notes'],
      source: 'import:obsidian'
    });
  }
}

export const meta = {
  name: 'obsidian',
  label: 'Obsidian vaults',
  description: 'Notes tagged with #engram or in engram/ folder',
  category: 'fact',
  locations: ['~/Documents/*/engram/', '~/*/.obsidian']
};
