import { generateEmbedding, cosineSimilarity } from '../embed/index.js';
import { searchMemories, getMemoriesWithEmbeddings, updateAccessStats } from './store.js';
import * as logger from '../utils/logger.js';

/**
 * Recall memories using hybrid search (embedding similarity + FTS + recency)
 * @param {Database} db - SQLite database instance
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} [options.limit=5] - Maximum results to return
 * @param {string} [options.category] - Filter by category
 * @param {string} [options.namespace] - Filter by namespace
 * @param {number} [options.threshold=0.3] - Minimum relevance score
 * @param {string} modelsPath - Path to models directory
 * @returns {Promise<Object[]>} Array of relevant memories with scores
 */
export async function recallMemories(db, query, options = {}, modelsPath) {
  const {
    limit = 5,
    category,
    namespace,
    threshold = 0.3
  } = options;

  logger.debug('Recalling memories', { query, limit, category, namespace, threshold });

  try {
    // Step 1: Generate embedding for the query
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(query, modelsPath);
      logger.debug('Query embedding generated', { dimensions: queryEmbedding.length });
    } catch (error) {
      logger.warn('Failed to generate query embedding, falling back to FTS only', { error: error.message });
      // Fall back to FTS-only search
      return await fallbackToFTS(db, query, { limit, category, namespace });
    }

    // Step 2: Fetch candidate memories
    const candidates = await fetchCandidates(db, query, namespace);
    logger.debug('Fetched candidates', { count: candidates.length });

    if (candidates.length === 0) {
      logger.debug('No candidates found');
      return [];
    }

    // Step 3: Score each candidate
    const scored = candidates.map(memory => {
      const scores = calculateScores(memory, queryEmbedding, candidates);

      return {
        ...memory,
        score: scores.final,
        scoreBreakdown: scores
      };
    });

    // Step 4: Filter by category if specified
    let filtered = scored;
    if (category) {
      filtered = filtered.filter(m => m.category === category);
    }

    // Step 5: Filter by threshold
    filtered = filtered.filter(m => m.score >= threshold);

    // Step 6: Sort by score descending
    filtered.sort((a, b) => b.score - a.score);

    // Step 7: Take top N
    const results = filtered.slice(0, limit);

    // Step 8: Update access stats for returned memories
    if (results.length > 0) {
      const ids = results.map(m => m.id);
      updateAccessStats(db, ids);
    }

    logger.info('Memories recalled', {
      query,
      returned: results.length,
      avgScore: results.length > 0
        ? (results.reduce((sum, m) => sum + m.score, 0) / results.length).toFixed(3)
        : 0
    });

    return results;
  } catch (error) {
    logger.error('Error during recall', { error: error.message });
    // Fallback to FTS if anything fails
    return await fallbackToFTS(db, query, { limit, category, namespace });
  }
}

/**
 * Fetch candidate memories for scoring
 * @param {Database} db - SQLite database instance
 * @param {string} query - Search query
 * @param {string} [namespace] - Optional namespace filter
 * @returns {Promise<Object[]>} Candidate memories
 */
async function fetchCandidates(db, query, namespace) {
  const candidates = new Map();

  // Fetch FTS matches (top 20)
  try {
    let ftsResults = searchMemories(db, query, 20);

    // Filter by namespace if specified
    if (namespace) {
      ftsResults = ftsResults.filter(m => m.namespace === namespace);
    }

    for (const memory of ftsResults) {
      memory.fromFTS = true;
      candidates.set(memory.id, memory);
    }
    logger.debug('FTS candidates', { count: ftsResults.length });
  } catch (error) {
    logger.warn('FTS search failed', { error: error.message });
  }

  // Fetch all memories with embeddings in namespace
  const embeddedMemories = getMemoriesWithEmbeddings(db, namespace);
  for (const memory of embeddedMemories) {
    if (!candidates.has(memory.id)) {
      memory.fromFTS = false;
      candidates.set(memory.id, memory);
    } else {
      // Mark that this memory was also found via FTS
      candidates.get(memory.id).fromFTS = true;
    }
  }
  logger.debug('Embedding candidates', { count: embeddedMemories.length });

  return Array.from(candidates.values());
}

/**
 * Calculate all component scores for a memory
 * @param {Object} memory - Memory to score
 * @param {Float32Array} queryEmbedding - Query embedding
 * @param {Object[]} allCandidates - All candidate memories (for FTS boost calculation)
 * @returns {Object} Scores object
 */
function calculateScores(memory, queryEmbedding, allCandidates) {
  // Similarity score (cosine similarity if embedding exists)
  let similarity = 0;
  if (memory.embedding && queryEmbedding) {
    similarity = cosineSimilarity(queryEmbedding, memory.embedding);
  }

  // Recency score based on last access
  const recency = calculateRecencyScore(memory);

  // Confidence score (from memory)
  const confidence = memory.confidence || 0.8;

  // Access score (how often this memory has been recalled)
  const access = Math.min(memory.access_count / 10, 1.0);

  // FTS boost (if memory appeared in FTS results)
  const ftsBoost = memory.fromFTS ? 0.1 : 0;

  // Final score calculation
  const final = (similarity * 0.5) + (recency * 0.15) + (confidence * 0.2) + (access * 0.05) + ftsBoost;

  return {
    similarity,
    recency,
    confidence,
    access,
    ftsBoost,
    final
  };
}

/**
 * Calculate recency score based on last access time and decay rate
 * @param {Object} memory - Memory object
 * @returns {number} Recency score (0-1)
 */
function calculateRecencyScore(memory) {
  const now = Date.now();
  const lastAccessed = memory.last_accessed || memory.created_at;
  const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
  const decayRate = memory.decay_rate || 0.01;

  // Recency score decreases over time based on decay rate
  const recency = 1 / (1 + daysSinceAccess * decayRate);

  return Math.max(0, Math.min(1, recency));
}

/**
 * Fallback to FTS-only search when embeddings fail
 * @param {Database} db - SQLite database instance
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object[]>} Search results
 */
async function fallbackToFTS(db, query, options = {}) {
  const { limit = 5, category, namespace } = options;

  logger.warn('Using FTS-only fallback search');

  try {
    let results = searchMemories(db, query, limit * 2); // Get more to filter

    // Filter by category if specified
    if (category) {
      results = results.filter(m => m.category === category);
    }

    // Filter by namespace if specified
    if (namespace) {
      results = results.filter(m => m.namespace === namespace);
    }

    // Take top N
    results = results.slice(0, limit);

    // Add a basic score based on position
    results = results.map((memory, index) => ({
      ...memory,
      score: 1.0 - (index * 0.1), // Simple position-based score
      scoreBreakdown: {
        similarity: 0,
        recency: 0,
        confidence: memory.confidence,
        access: 0,
        ftsBoost: 1.0 - (index * 0.1),
        final: 1.0 - (index * 0.1)
      }
    }));

    // Update access stats
    if (results.length > 0) {
      const ids = results.map(m => m.id);
      updateAccessStats(db, ids);
    }

    logger.info('FTS fallback recall complete', { returned: results.length });

    return results;
  } catch (error) {
    logger.error('FTS fallback failed', { error: error.message });
    return [];
  }
}

/**
 * Format recall results for display
 * @param {Object[]} memories - Recalled memories with scores
 * @returns {string} Formatted text output
 */
export function formatRecallResults(memories) {
  if (memories.length === 0) {
    return 'No relevant memories found.';
  }

  const lines = [`Found ${memories.length} relevant ${memories.length === 1 ? 'memory' : 'memories'}:\n`];

  memories.forEach((memory, index) => {
    const num = index + 1;
    const category = memory.category;
    const confidence = memory.confidence.toFixed(2);
    const id = memory.id.substring(0, 8);
    const score = memory.score ? ` (score: ${memory.score.toFixed(3)})` : '';

    lines.push(`[${num}] (${category}, confidence: ${confidence}, id: ${id})${score}`);
    lines.push(memory.content);
    lines.push('');
  });

  return lines.join('\n');
}
