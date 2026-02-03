/**
 * Export memories to static context files
 * Generates files for .md, .txt, or .claude formats
 */

import { listMemories } from '../memory/store.js';
import * as logger from '../utils/logger.js';

/**
 * Export memories to a static context format
 * @param {Database} db - SQLite database instance
 * @param {Object} options - Export options
 * @param {string} options.namespace - Namespace to export from
 * @param {string} [options.format='markdown'] - Output format
 * @param {string[]} [options.categories] - Filter by categories
 * @param {number} [options.minConfidence=0.5] - Minimum confidence
 * @param {number} [options.minAccess=0] - Minimum access count
 * @param {boolean} [options.includeLowFeedback=false] - Include low feedback memories
 * @param {string} [options.groupBy='category'] - Grouping method
 * @param {string} [options.header] - Custom header text
 * @param {string} [options.footer] - Custom footer text
 * @returns {Object} Export result with content and metadata
 */
export function exportToStatic(db, options = {}) {
  const {
    namespace,
    format = 'markdown',
    categories,
    minConfidence = 0.5,
    minAccess = 0,
    includeLowFeedback = false,
    groupBy = 'category',
    header,
    footer
  } = options;

  if (!namespace) {
    throw new Error('Namespace is required for export');
  }

  logger.info('Exporting memories to static context', { namespace, format, minConfidence });

  // Fetch all memories from namespace
  let memories = listMemories(db, {
    namespace,
    limit: 1000,
    sort: 'confidence DESC, access_count DESC'
  });

  // Apply filters
  memories = memories.filter(m => m.confidence >= minConfidence);
  memories = memories.filter(m => m.access_count >= minAccess);

  if (!includeLowFeedback) {
    memories = memories.filter(m => (m.feedback_score || 0) >= -0.3);
  }

  if (categories && categories.length > 0) {
    memories = memories.filter(m => categories.includes(m.category));
  }

  // Deduplicate similar memories (keep highest confidence version)
  memories = deduplicateMemories(memories);

  // Sort by relevance within groups
  memories.sort((a, b) => {
    const scoreA = (a.confidence || 0.8) * (a.access_count + 1);
    const scoreB = (b.confidence || 0.8) * (b.access_count + 1);
    return scoreB - scoreA;
  });

  // Generate content
  let content;
  let filename;

  switch (format) {
    case 'markdown':
      content = generateMarkdown(memories, namespace, { header, footer, groupBy });
      filename = `${namespace}-context.md`;
      break;
    case 'claude':
      content = generateClaudeFormat(memories, namespace, { header, footer });
      filename = '.claude';
      break;
    case 'txt':
      content = generatePlainText(memories, namespace, { header, footer, groupBy });
      filename = `${namespace}-context.txt`;
      break;
    case 'json':
      content = generateJSON(memories, namespace, { categories, minConfidence });
      filename = `${namespace}-context.json`;
      break;
    default:
      content = generateMarkdown(memories, namespace, { header, footer, groupBy });
      filename = `${namespace}-context.md`;
  }

  // Warn if content is very large
  const sizeKB = Buffer.byteLength(content, 'utf8') / 1024;
  if (sizeKB > 50) {
    logger.warn('Export content is large', { sizeKB: sizeKB.toFixed(1) });
  }

  const stats = {
    totalExported: memories.length,
    byCategory: groupMemoriesBy(memories, 'category'),
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    sizeKB: sizeKB.toFixed(1)
  };

  logger.info('Export complete', stats);

  return {
    content,
    filename,
    stats
  };
}

/**
 * Deduplicate similar memories (basic content comparison)
 */
function deduplicateMemories(memories) {
  const seen = new Map();

  for (const memory of memories) {
    // Simple dedup: normalize content and check for similar strings
    const normalized = memory.content.toLowerCase().trim();
    const key = normalized.substring(0, 50); // First 50 chars as key

    if (!seen.has(key)) {
      seen.set(key, memory);
    } else {
      // Keep the one with higher confidence
      const existing = seen.get(key);
      if (memory.confidence > existing.confidence) {
        seen.set(key, memory);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Group memories by a field
 */
function groupMemoriesBy(memories, field) {
  const groups = {};
  for (const memory of memories) {
    const key = memory[field] || 'other';
    if (!groups[key]) groups[key] = 0;
    groups[key]++;
  }
  return groups;
}

/**
 * Generate Markdown format
 */
function generateMarkdown(memories, namespace, options = {}) {
  const { header, footer, groupBy } = options;
  const lines = [];

  // Header
  lines.push(header || '# Project Context');
  lines.push('');
  lines.push(`> Auto-generated from Engram memory on ${new Date().toISOString().split('T')[0]}`);
  lines.push(`> Namespace: ${namespace} | Memories: ${memories.length}`);
  lines.push('');

  // Group and output memories
  if (groupBy === 'category') {
    const groups = {};
    for (const m of memories) {
      const cat = m.category || 'fact';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    }

    const categoryOrder = ['fact', 'preference', 'pattern', 'decision', 'outcome'];
    for (const cat of categoryOrder) {
      if (groups[cat] && groups[cat].length > 0) {
        lines.push(`## ${capitalizeFirst(cat)}s`);
        lines.push('');

        // Sub-group by entity if available
        const byEntity = {};
        for (const m of groups[cat]) {
          const entity = m.entity || 'General';
          if (!byEntity[entity]) byEntity[entity] = [];
          byEntity[entity].push(m);
        }

        for (const [entity, entityMemories] of Object.entries(byEntity)) {
          if (Object.keys(byEntity).length > 1) {
            lines.push(`### ${capitalizeFirst(entity)}`);
          }
          for (const m of entityMemories) {
            lines.push(`- ${m.content}`);
          }
          lines.push('');
        }
      }
    }
  } else if (groupBy === 'entity') {
    const groups = {};
    for (const m of memories) {
      const entity = m.entity || 'General';
      if (!groups[entity]) groups[entity] = [];
      groups[entity].push(m);
    }

    for (const [entity, entityMemories] of Object.entries(groups)) {
      lines.push(`## ${capitalizeFirst(entity)}`);
      lines.push('');
      for (const m of entityMemories) {
        lines.push(`- ${m.content}`);
      }
      lines.push('');
    }
  } else {
    // No grouping
    for (const m of memories) {
      lines.push(`- ${m.content}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(footer || `*Exported from Engram v1.0.0*`);

  return lines.join('\n');
}

/**
 * Generate Claude Code format (.claude file)
 */
function generateClaudeFormat(memories, namespace, options = {}) {
  const { header, footer } = options;
  const lines = [];

  lines.push(header || '# Project Memory');
  lines.push('');
  lines.push('This file contains accumulated knowledge about this project from Engram.');
  lines.push('');

  // Group by category
  const groups = {};
  for (const m of memories) {
    const cat = m.category || 'fact';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(m);
  }

  // Key Facts first
  if (groups['fact'] && groups['fact'].length > 0) {
    lines.push('## Key Facts');
    lines.push('');
    for (const m of groups['fact'].slice(0, 10)) {
      lines.push(`- ${m.content}`);
    }
    lines.push('');
  }

  // Development Preferences
  if (groups['preference'] && groups['preference'].length > 0) {
    lines.push('## Development Preferences');
    lines.push('');
    for (const m of groups['preference'].slice(0, 10)) {
      lines.push(`- ${m.content}`);
    }
    lines.push('');
  }

  // Common Patterns
  if (groups['pattern'] && groups['pattern'].length > 0) {
    lines.push('## Common Patterns');
    lines.push('');
    for (const m of groups['pattern'].slice(0, 10)) {
      lines.push(`- ${m.content}`);
    }
    lines.push('');
  }

  // Decisions
  if (groups['decision'] && groups['decision'].length > 0) {
    lines.push('## Key Decisions');
    lines.push('');
    for (const m of groups['decision'].slice(0, 10)) {
      lines.push(`- ${m.content}`);
    }
    lines.push('');
  }

  // Metadata comment
  lines.push(`<!-- engram:exported:${new Date().toISOString()}:${namespace}:${memories.length} -->`);
  if (footer) {
    lines.push('');
    lines.push(footer);
  }

  return lines.join('\n');
}

/**
 * Generate plain text format
 */
function generatePlainText(memories, namespace, options = {}) {
  const { header, footer, groupBy } = options;
  const lines = [];

  if (header) {
    lines.push(header);
    lines.push('');
  }

  lines.push(`Engram Memory Export - ${namespace}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Memories: ${memories.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (groupBy === 'category') {
    const groups = {};
    for (const m of memories) {
      const cat = m.category || 'fact';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    }

    for (const [cat, catMemories] of Object.entries(groups)) {
      lines.push(`[${cat.toUpperCase()}S]`);
      for (const m of catMemories) {
        lines.push(`* ${m.content}`);
      }
      lines.push('');
    }
  } else {
    for (const m of memories) {
      lines.push(`* ${m.content}`);
    }
  }

  if (footer) {
    lines.push('');
    lines.push(footer);
  }

  return lines.join('\n');
}

/**
 * Generate JSON format
 */
function generateJSON(memories, namespace, options = {}) {
  const { categories, minConfidence } = options;

  const groups = {};
  for (const m of memories) {
    const cat = m.category || 'fact';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({
      id: m.id,
      content: m.content,
      entity: m.entity,
      confidence: m.confidence,
      access_count: m.access_count
    });
  }

  return JSON.stringify({
    exported_at: new Date().toISOString(),
    namespace,
    filters: {
      min_confidence: minConfidence,
      categories: categories || 'all'
    },
    memories: groups,
    stats: {
      total_exported: memories.length,
      by_category: Object.fromEntries(
        Object.entries(groups).map(([k, v]) => [k, v.length])
      )
    }
  }, null, 2);
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
