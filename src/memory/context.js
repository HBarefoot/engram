/**
 * Context generation for AI agents
 * Generates pre-formatted context blocks from memories
 */

import { listMemories, getMemoriesWithEmbeddings, updateAccessStats } from './store.js';
import { generateEmbedding, cosineSimilarity } from '../embed/index.js';
import * as logger from '../utils/logger.js';

/**
 * Estimate token count for text (rough approximation)
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Generate context from memories
 * @param {Database} db - SQLite database instance
 * @param {Object} options - Context generation options
 * @param {string} [options.query] - Optional query to filter relevant memories
 * @param {string} [options.namespace='default'] - Namespace to pull from
 * @param {number} [options.limit=10] - Maximum memories to include
 * @param {string} [options.format='markdown'] - Output format
 * @param {boolean} [options.include_metadata=false] - Include memory IDs and scores
 * @param {string[]} [options.categories] - Filter by categories
 * @param {number} [options.max_tokens=1000] - Token budget
 * @param {string} modelsPath - Path to embedding models
 * @returns {Promise<Object>} Context object with content and metadata
 */
export async function generateContext(db, options = {}, modelsPath) {
  const {
    query,
    namespace = 'default',
    limit = 10,
    format = 'markdown',
    include_metadata = false,
    categories,
    max_tokens = 1000
  } = options;

  logger.info('Generating context', { namespace, limit, format, max_tokens });

  let memories = [];

  if (query) {
    // Query-based context: use semantic search
    memories = await getRelevantMemories(db, query, namespace, categories, modelsPath);
  } else {
    // No query: get top memories by access frequency and recency
    memories = getTopMemories(db, namespace, categories);
  }

  // Limit to max count
  memories = memories.slice(0, Math.min(limit, 25));

  // Sort by category for grouping, then by score/relevance
  memories = sortMemoriesForContext(memories);

  // Truncate to fit token budget
  memories = truncateToTokenBudget(memories, max_tokens);

  // Update access stats
  if (memories.length > 0) {
    updateAccessStats(db, memories.map(m => m.id));
  }

  // Generate output in requested format
  const content = formatContext(memories, format, include_metadata, namespace);

  logger.info('Context generated', {
    memories: memories.length,
    format,
    estimatedTokens: estimateTokens(content)
  });

  return {
    content,
    metadata: {
      namespace,
      count: memories.length,
      format,
      categories: [...new Set(memories.map(m => m.category))],
      estimatedTokens: estimateTokens(content),
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * Get relevant memories using semantic search
 */
async function getRelevantMemories(db, query, namespace, categories, modelsPath) {
  try {
    const queryEmbedding = await generateEmbedding(query, modelsPath);
    let memories = getMemoriesWithEmbeddings(db, namespace);

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      memories = memories.filter(m => categories.includes(m.category));
    }

    // Filter out low feedback memories
    memories = memories.filter(m => (m.feedback_score || 0) >= -0.3);

    // Score and sort by similarity
    const scored = memories.map(memory => {
      const similarity = memory.embedding
        ? cosineSimilarity(queryEmbedding, memory.embedding)
        : 0;
      const relevanceScore = calculateRelevanceScore(memory, similarity);
      return { ...memory, relevanceScore, similarity };
    });

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scored;
  } catch (error) {
    logger.warn('Failed to generate embedding for context query, falling back to top memories', {
      error: error.message
    });
    return getTopMemories(db, namespace, categories);
  }
}

/**
 * Get top memories by access frequency and recency
 */
function getTopMemories(db, namespace, categories) {
  let memories = listMemories(db, {
    namespace,
    limit: 100,
    sort: 'access_count DESC, created_at DESC'
  });

  // Filter by categories if specified
  if (categories && categories.length > 0) {
    memories = memories.filter(m => categories.includes(m.category));
  }

  // Filter out low feedback memories
  memories = memories.filter(m => (m.feedback_score || 0) >= -0.3);

  // Score memories
  const scored = memories.map(memory => {
    const relevanceScore = calculateRelevanceScore(memory, 0);
    return { ...memory, relevanceScore };
  });

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored;
}

/**
 * Calculate relevance score for context inclusion
 */
function calculateRelevanceScore(memory, similarity = 0) {
  const confidence = memory.confidence || 0.8;
  const accessScore = Math.min(memory.access_count / 10, 1);
  const recencyScore = calculateRecency(memory);
  const feedbackScore = ((memory.feedback_score || 0) + 1) / 2;

  // Weight components
  return (similarity * 0.4) + (confidence * 0.25) + (accessScore * 0.15) +
         (recencyScore * 0.1) + (feedbackScore * 0.1);
}

/**
 * Calculate recency score
 */
function calculateRecency(memory) {
  const now = Date.now();
  const lastAccessed = memory.last_accessed || memory.created_at;
  const daysSince = (now - lastAccessed) / (1000 * 60 * 60 * 24);
  return 1 / (1 + daysSince * 0.01);
}

/**
 * Sort memories for context (group by category)
 */
function sortMemoriesForContext(memories) {
  // Priority order for categories
  const categoryOrder = ['preference', 'fact', 'pattern', 'decision', 'outcome'];

  return memories.sort((a, b) => {
    const orderA = categoryOrder.indexOf(a.category);
    const orderB = categoryOrder.indexOf(b.category);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // Within same category, sort by relevance score
    return (b.relevanceScore || 0) - (a.relevanceScore || 0);
  });
}

/**
 * Truncate memories to fit token budget
 */
function truncateToTokenBudget(memories, maxTokens) {
  let totalTokens = 100; // Reserve for headers/formatting
  const selected = [];

  for (const memory of memories) {
    const memoryTokens = estimateTokens(memory.content) + 20; // +20 for metadata
    if (totalTokens + memoryTokens <= maxTokens) {
      selected.push(memory);
      totalTokens += memoryTokens;
    }
  }

  return selected;
}

/**
 * Format context in requested format
 */
function formatContext(memories, format, includeMetadata, namespace) {
  switch (format) {
    case 'markdown':
      return formatMarkdown(memories, includeMetadata, namespace);
    case 'xml':
      return formatXML(memories, includeMetadata, namespace);
    case 'json':
      return formatJSON(memories, namespace);
    case 'plain':
      return formatPlain(memories);
    default:
      return formatMarkdown(memories, includeMetadata, namespace);
  }
}

/**
 * Format as Markdown
 */
function formatMarkdown(memories, includeMetadata, namespace) {
  if (memories.length === 0) {
    return '## User Context from Memory\n\nNo memories found.';
  }

  const lines = ['## User Context from Memory\n'];

  // Group by category
  const groups = groupByCategory(memories);

  for (const [category, categoryMemories] of Object.entries(groups)) {
    const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1) + 's';
    lines.push(`**${categoryTitle}:**`);

    for (const memory of categoryMemories) {
      if (includeMetadata) {
        lines.push(`- ${memory.content} *(id: ${memory.id.substring(0, 8)}, confidence: ${memory.confidence.toFixed(2)})*`);
      } else {
        lines.push(`- ${memory.content}`);
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*${memories.length} memories loaded from namespace "${namespace}" | Generated by Engram*`);

  return lines.join('\n');
}

/**
 * Format as XML
 */
function formatXML(memories, includeMetadata, namespace) {
  if (memories.length === 0) {
    return `<engram_context namespace="${namespace}" count="0" />\n`;
  }

  const lines = [`<engram_context namespace="${namespace}" count="${memories.length}">`];

  // Group by category
  const groups = groupByCategory(memories);

  for (const [category, categoryMemories] of Object.entries(groups)) {
    lines.push(`  <${category}s>`);

    for (const memory of categoryMemories) {
      if (includeMetadata) {
        lines.push(`    <memory id="${memory.id}" confidence="${memory.confidence.toFixed(2)}">${escapeXML(memory.content)}</memory>`);
      } else {
        lines.push(`    <memory>${escapeXML(memory.content)}</memory>`);
      }
    }

    lines.push(`  </${category}s>`);
  }

  lines.push('</engram_context>');

  return lines.join('\n');
}

/**
 * Format as JSON
 */
function formatJSON(memories, namespace) {
  const groups = groupByCategory(memories);

  return JSON.stringify({
    namespace,
    count: memories.length,
    memories: groups,
    generated_at: new Date().toISOString()
  }, null, 2);
}

/**
 * Format as plain text
 */
function formatPlain(memories) {
  return memories.map(m => m.content).join('. ');
}

/**
 * Group memories by category
 */
function groupByCategory(memories) {
  const groups = {};

  for (const memory of memories) {
    const cat = memory.category || 'fact';
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(memory);
  }

  return groups;
}

/**
 * Escape XML special characters
 */
function escapeXML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
