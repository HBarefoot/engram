import { getMemoriesWithEmbeddings, listMemories, updateMemory, deleteMemory } from './store.js';
import { cosineSimilarity } from '../embed/index.js';
import * as logger from '../utils/logger.js';

/**
 * Run full consolidation process
 * @param {Database} db - SQLite database instance
 * @param {Object} [options] - Consolidation options
 * @param {boolean} [options.detectDuplicates=true] - Enable duplicate detection
 * @param {boolean} [options.detectContradictions=true] - Enable contradiction detection
 * @param {boolean} [options.applyDecay=true] - Enable confidence decay
 * @param {boolean} [options.cleanupStale=false] - Enable stale cleanup
 * @param {number} [options.duplicateThreshold=0.92] - Similarity threshold for duplicates
 * @returns {Promise<Object>} Consolidation results
 */
export async function consolidate(db, options = {}) {
  const {
    detectDuplicates = true,
    detectContradictions = true,
    applyDecay = true,
    cleanupStale = false,
    duplicateThreshold = 0.92
  } = options;

  logger.info('Starting memory consolidation', options);

  const results = {
    duplicatesRemoved: 0,
    contradictionsDetected: 0,
    memoriesDecayed: 0,
    staleMemoriesCleaned: 0,
    startTime: Date.now()
  };

  try {
    // Step 1: Detect and merge duplicates
    if (detectDuplicates) {
      logger.debug('Detecting duplicates...');
      const duplicates = await findDuplicates(db, duplicateThreshold);
      results.duplicatesRemoved = await mergeDuplicates(db, duplicates);
      logger.info('Duplicates removed', { count: results.duplicatesRemoved });
    }

    // Step 2: Detect contradictions
    if (detectContradictions) {
      logger.debug('Detecting contradictions...');
      const contradictions = await findContradictions(db);
      results.contradictionsDetected = contradictions.length;
      // Flag contradictions (don't auto-resolve)
      await flagContradictions(db, contradictions);
      logger.info('Contradictions detected', { count: results.contradictionsDetected });
    }

    // Step 3: Apply confidence decay
    if (applyDecay) {
      logger.debug('Applying confidence decay...');
      results.memoriesDecayed = await applyConfidenceDecay(db);
      logger.info('Memories decayed', { count: results.memoriesDecayed });
    }

    // Step 4: Cleanup stale memories
    if (cleanupStale) {
      logger.debug('Cleaning up stale memories...');
      results.staleMemoriesCleaned = await cleanupStaleMemories(db);
      logger.info('Stale memories cleaned', { count: results.staleMemoriesCleaned });
    }

    results.duration = Date.now() - results.startTime;
    logger.info('Consolidation complete', results);

    return results;
  } catch (error) {
    logger.error('Consolidation failed', { error: error.message });
    throw error;
  }
}

/**
 * Find duplicate memories based on embedding similarity
 * @param {Database} db - SQLite database instance
 * @param {number} threshold - Similarity threshold (default 0.92)
 * @returns {Promise<Array>} Array of duplicate pairs
 */
async function findDuplicates(db, threshold = 0.92) {
  const memories = getMemoriesWithEmbeddings(db);
  const duplicates = [];

  logger.debug('Checking for duplicates', { memories: memories.length, threshold });

  // Compare each memory with every other memory
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const memA = memories[i];
      const memB = memories[j];

      // Skip if in different namespaces
      if (memA.namespace !== memB.namespace) {
        continue;
      }

      // Calculate similarity
      const similarity = cosineSimilarity(memA.embedding, memB.embedding);

      if (similarity > threshold) {
        duplicates.push({
          memory1: memA,
          memory2: memB,
          similarity
        });
      }
    }
  }

  logger.debug('Duplicates found', { count: duplicates.length });

  return duplicates;
}

/**
 * Merge duplicate memories
 * @param {Database} db - SQLite database instance
 * @param {Array} duplicates - Array of duplicate pairs
 * @returns {Promise<number>} Number of duplicates removed
 */
async function mergeDuplicates(db, duplicates) {
  let removed = 0;

  for (const { memory1, memory2, similarity } of duplicates) {
    try {
      // Determine which memory to keep (higher confidence, more accesses, or more recent)
      let keepMemory, removeMemory;

      if (memory1.confidence > memory2.confidence) {
        keepMemory = memory1;
        removeMemory = memory2;
      } else if (memory1.confidence < memory2.confidence) {
        keepMemory = memory2;
        removeMemory = memory1;
      } else if (memory1.access_count > memory2.access_count) {
        keepMemory = memory1;
        removeMemory = memory2;
      } else if (memory1.access_count < memory2.access_count) {
        keepMemory = memory2;
        removeMemory = memory1;
      } else if (memory1.updated_at > memory2.updated_at) {
        keepMemory = memory1;
        removeMemory = memory2;
      } else {
        keepMemory = memory2;
        removeMemory = memory1;
      }

      // Merge access counts
      const mergedAccessCount = keepMemory.access_count + removeMemory.access_count;

      // Update the kept memory with merged stats
      updateMemory(db, keepMemory.id, {
        access_count: mergedAccessCount
      });

      // Delete the duplicate
      deleteMemory(db, removeMemory.id);

      logger.debug('Duplicate merged', {
        kept: keepMemory.id.substring(0, 8),
        removed: removeMemory.id.substring(0, 8),
        similarity: similarity.toFixed(3)
      });

      removed++;
    } catch (error) {
      logger.warn('Failed to merge duplicate', { error: error.message });
    }
  }

  return removed;
}

/**
 * Find contradictory memories
 * @param {Database} db - SQLite database instance
 * @returns {Promise<Array>} Array of contradiction pairs
 */
async function findContradictions(db) {
  const memories = getMemoriesWithEmbeddings(db);
  const contradictions = [];

  // Group memories by entity
  const byEntity = new Map();
  for (const memory of memories) {
    if (!memory.entity) continue;

    if (!byEntity.has(memory.entity)) {
      byEntity.set(memory.entity, []);
    }
    byEntity.get(memory.entity).push(memory);
  }

  // Look for contradictions within each entity group
  for (const [entity, entityMemories] of byEntity.entries()) {
    if (entityMemories.length < 2) continue;

    for (let i = 0; i < entityMemories.length; i++) {
      for (let j = i + 1; j < entityMemories.length; j++) {
        const memA = entityMemories[i];
        const memB = entityMemories[j];

        // Skip if in different namespaces
        if (memA.namespace !== memB.namespace) {
          continue;
        }

        // Check if contents suggest contradiction
        if (seemsContradictory(memA.content, memB.content)) {
          contradictions.push({
            memory1: memA,
            memory2: memB,
            entity
          });
        }
      }
    }
  }

  return contradictions;
}

/**
 * Check if two memory contents seem contradictory
 * @param {string} contentA - First memory content
 * @param {string} contentB - Second memory content
 * @returns {boolean} True if potentially contradictory
 */
function seemsContradictory(contentA, contentB) {
  const lowerA = contentA.toLowerCase();
  const lowerB = contentB.toLowerCase();

  // Check for explicit contradictions
  const contradictionPatterns = [
    // Preferences
    { a: /prefer.*?(\w+)/, b: /prefer.*?(\w+)/ },
    { a: /uses?\s+(\w+)/, b: /uses?\s+(\w+)/ },
    { a: /instead of\s+(\w+)/, b: /instead of\s+(\w+)/ },

    // Facts
    { a: /is\s+(\w+)/, b: /is\s+(\w+)/ },
    { a: /version\s+(\d+)/, b: /version\s+(\d+)/ },

    // Negations
    { a: /never|not|doesn't|don't/, b: /always|does|do/ }
  ];

  // Simple heuristic: if one contains "not"/"never" and the other doesn't
  const hasNegationA = /\b(not|never|doesn't|don't|avoid|dislike)\b/i.test(lowerA);
  const hasNegationB = /\b(not|never|doesn't|don't|avoid|dislike)\b/i.test(lowerB);

  if (hasNegationA !== hasNegationB) {
    // Remove negation words and check similarity
    const normalizedA = lowerA.replace(/\b(not|never|doesn't|don't|avoid|dislike)\b/gi, '');
    const normalizedB = lowerB.replace(/\b(not|never|doesn't|don't|avoid|dislike)\b/gi, '');

    // If the rest is similar, it's likely a contradiction
    const similarity = simpleSimilarity(normalizedA, normalizedB);
    if (similarity > 0.6) {
      return true;
    }
  }

  return false;
}

/**
 * Simple text similarity calculation
 * @param {string} a - First text
 * @param {string} b - Second text
 * @returns {number} Similarity score (0-1)
 */
function simpleSimilarity(a, b) {
  const wordsA = new Set(a.toLowerCase().match(/\b\w+\b/g) || []);
  const wordsB = new Set(b.toLowerCase().match(/\b\w+\b/g) || []);

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Flag contradictions for user review
 * @param {Database} db - SQLite database instance
 * @param {Array} contradictions - Array of contradiction pairs
 * @returns {Promise<number>} Number of contradictions flagged
 */
async function flagContradictions(db, contradictions) {
  let flagged = 0;

  for (const { memory1, memory2 } of contradictions) {
    try {
      // Generate a conflict ID for this pair
      const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Add conflict tag to both memories
      const tags1 = memory1.tags || [];
      const tags2 = memory2.tags || [];

      if (!tags1.includes(conflictId)) {
        updateMemory(db, memory1.id, {
          tags: [...tags1, conflictId, 'has-conflict']
        });
      }

      if (!tags2.includes(conflictId)) {
        updateMemory(db, memory2.id, {
          tags: [...tags2, conflictId, 'has-conflict']
        });
      }

      flagged++;
    } catch (error) {
      logger.warn('Failed to flag contradiction', { error: error.message });
    }
  }

  return flagged;
}

/**
 * Apply confidence decay to memories based on age and access
 * @param {Database} db - SQLite database instance
 * @returns {Promise<number>} Number of memories decayed
 */
async function applyConfidenceDecay(db) {
  const memories = listMemories(db, { limit: 10000 }); // Get all memories
  const now = Date.now();
  let decayed = 0;

  for (const memory of memories) {
    if (memory.decay_rate === 0) {
      continue; // Skip memories that never decay
    }

    const lastAccessed = memory.last_accessed || memory.created_at;
    const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);

    // Calculate decay
    const decay = memory.decay_rate * daysSinceAccess;
    const newConfidence = Math.max(0.1, memory.confidence * (1 - decay));

    // Only update if confidence changed significantly
    if (Math.abs(newConfidence - memory.confidence) > 0.01) {
      updateMemory(db, memory.id, { confidence: newConfidence });
      decayed++;
    }
  }

  return decayed;
}

/**
 * Clean up stale memories
 * @param {Database} db - SQLite database instance
 * @returns {Promise<number>} Number of memories cleaned
 */
async function cleanupStaleMemories(db) {
  const memories = listMemories(db, { limit: 10000 });
  const now = Date.now();
  let cleaned = 0;

  for (const memory of memories) {
    // Criteria for stale: confidence < 0.15, no accesses, and > 90 days old
    const age = (now - memory.created_at) / (1000 * 60 * 60 * 24);

    if (memory.confidence < 0.15 && memory.access_count === 0 && age > 90) {
      // Mark as stale (add tag) instead of deleting
      const tags = memory.tags || [];
      if (!tags.includes('stale')) {
        updateMemory(db, memory.id, {
          tags: [...tags, 'stale']
        });
        cleaned++;
      }
    }
  }

  return cleaned;
}

/**
 * Get memories flagged with contradictions
 * @param {Database} db - SQLite database instance
 * @returns {Object[]} Array of memories with conflict tags
 */
export function getConflicts(db) {
  const memories = listMemories(db, { limit: 10000 });

  // Find all memories with conflict tags
  const conflicts = memories.filter(m =>
    m.tags && m.tags.some(tag => tag.startsWith('conflict_') || tag === 'has-conflict')
  );

  // Group by conflict ID
  const grouped = new Map();

  for (const memory of conflicts) {
    const conflictTags = memory.tags.filter(tag => tag.startsWith('conflict_'));

    for (const conflictId of conflictTags) {
      if (!grouped.has(conflictId)) {
        grouped.set(conflictId, []);
      }
      grouped.get(conflictId).push(memory);
    }
  }

  // Convert to array of conflict pairs
  return Array.from(grouped.entries()).map(([conflictId, memories]) => ({
    conflictId,
    memories
  }));
}
