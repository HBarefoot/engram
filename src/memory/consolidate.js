import { getMemoriesWithEmbeddings, listMemories, updateMemory, deleteMemory, createContradiction, contradictionExists } from './store.js';
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
      const newContradictions = await findContradictions(db);
      results.contradictionsDetected = newContradictions.length;
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
 * Find contradictory memories and write to contradictions table
 * @param {Database} db - SQLite database instance
 * @returns {Promise<Array>} Array of newly created contradiction records
 */
async function findContradictions(db) {
  const memories = getMemoriesWithEmbeddings(db);
  const newContradictions = [];

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

        const result = seemsContradictory(memA.content, memB.content);
        if (result.isContradiction && !contradictionExists(db, memA.id, memB.id)) {
          try {
            const record = createContradiction(db, {
              memory1_id: memA.id,
              memory2_id: memB.id,
              confidence: result.confidence,
              reason: result.reason,
              category: memA.category,
              entity
            });
            newContradictions.push(record);
          } catch (error) {
            logger.warn('Failed to create contradiction record', { error: error.message });
          }
        }
      }
    }
  }

  return newContradictions;
}

/**
 * Check if two memory contents seem contradictory
 * @param {string} contentA - First memory content
 * @param {string} contentB - Second memory content
 * @returns {{ isContradiction: boolean, confidence: number, reason: string }}
 */
function seemsContradictory(contentA, contentB) {
  const lowerA = contentA.toLowerCase();
  const lowerB = contentB.toLowerCase();
  const noResult = { isContradiction: false, confidence: 0, reason: '' };

  // 1. Version conflict: both mention version numbers but different ones
  const versionA = lowerA.match(/version\s+(\d[\d.]*)/);
  const versionB = lowerB.match(/version\s+(\d[\d.]*)/);
  if (versionA && versionB && versionA[1] !== versionB[1]) {
    return { isContradiction: true, confidence: 0.85, reason: `Version mismatch: ${versionA[1]} vs ${versionB[1]}` };
  }

  // 2. Preference conflict: both express preference but for different things
  const prefA = lowerA.match(/\b(?:prefer|prefers|likes?|chooses?|uses?)\s+(\w+)/);
  const prefB = lowerB.match(/\b(?:prefer|prefers|likes?|chooses?|uses?)\s+(\w+)/);
  if (prefA && prefB && prefA[1] !== prefB[1]) {
    // Only flag if the surrounding context is similar (same topic)
    const sim = simpleSimilarity(lowerA, lowerB);
    if (sim > 0.3) {
      return { isContradiction: true, confidence: 0.8, reason: `Conflicting preferences: "${prefA[1]}" vs "${prefB[1]}"` };
    }
  }

  // 3. Boolean flip: enabled vs disabled, true vs false, on vs off
  const boolA = /\b(enabled|true|on|active)\b/i.test(lowerA);
  const boolB = /\b(disabled|false|off|inactive)\b/i.test(lowerB);
  const boolA2 = /\b(disabled|false|off|inactive)\b/i.test(lowerA);
  const boolB2 = /\b(enabled|true|on|active)\b/i.test(lowerB);
  if ((boolA && boolB) || (boolA2 && boolB2)) {
    const sim = simpleSimilarity(
      lowerA.replace(/\b(enabled|disabled|true|false|on|off|active|inactive)\b/gi, ''),
      lowerB.replace(/\b(enabled|disabled|true|false|on|off|active|inactive)\b/gi, '')
    );
    if (sim > 0.5) {
      return { isContradiction: true, confidence: 0.75, reason: 'Opposing boolean state' };
    }
  }

  // 4. Negation detection (enhanced from original)
  const hasNegationA = /\b(not|never|doesn't|don't|avoid|dislike|won't|can't|cannot)\b/i.test(lowerA);
  const hasNegationB = /\b(not|never|doesn't|don't|avoid|dislike|won't|can't|cannot)\b/i.test(lowerB);
  if (hasNegationA !== hasNegationB) {
    const normalizedA = lowerA.replace(/\b(not|never|doesn't|don't|avoid|dislike|won't|can't|cannot)\b/gi, '');
    const normalizedB = lowerB.replace(/\b(not|never|doesn't|don't|avoid|dislike|won't|can't|cannot)\b/gi, '');
    const similarity = simpleSimilarity(normalizedA, normalizedB);
    if (similarity > 0.6) {
      return { isContradiction: true, confidence: 0.7, reason: 'Negation conflict: one affirms, the other denies' };
    }
  }

  // 5. Temporal supersession: "switched from X to Y" vs "uses X"
  const switchMatch = lowerA.match(/\b(?:switched|migrated|moved)\s+(?:from\s+)?(\w+)\s+to\s+(\w+)/)
    || lowerB.match(/\b(?:switched|migrated|moved)\s+(?:from\s+)?(\w+)\s+to\s+(\w+)/);
  if (switchMatch) {
    const oldThing = switchMatch[1];
    const other = switchMatch.input === lowerA ? lowerB : lowerA;
    if (other.includes(oldThing) && !other.includes('switched') && !other.includes('migrated')) {
      return { isContradiction: true, confidence: 0.6, reason: `Possible outdated info after switch from "${oldThing}"` };
    }
  }

  return noResult;
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
 * Check a single new memory against existing memories for contradictions.
 * Called on memory insert for proactive detection.
 * @param {Database} db - SQLite database instance
 * @param {Object} newMemory - The newly created memory object
 * @returns {Promise<Array>} Array of new contradiction records
 */
export async function detectContradictionsForMemory(db, newMemory) {
  if (!newMemory.entity) return [];

  // Get memories with the same entity and namespace
  const candidates = listMemories(db, {
    limit: 50,
    sort: 'created_at DESC'
  }).filter(m =>
    m.id !== newMemory.id &&
    m.entity === newMemory.entity &&
    m.namespace === (newMemory.namespace || 'default')
  );

  const newContradictions = [];

  for (const candidate of candidates) {
    const result = seemsContradictory(newMemory.content, candidate.content);
    if (result.isContradiction && !contradictionExists(db, newMemory.id, candidate.id)) {
      try {
        const record = createContradiction(db, {
          memory1_id: candidate.id,
          memory2_id: newMemory.id,
          confidence: result.confidence,
          reason: result.reason,
          category: newMemory.category,
          entity: newMemory.entity
        });
        newContradictions.push(record);
      } catch (error) {
        logger.warn('Proactive contradiction detection failed for pair', { error: error.message });
      }
    }
  }

  if (newContradictions.length > 0) {
    logger.info('Proactive contradiction detection found conflicts', { count: newContradictions.length });
  }

  return newContradictions;
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
 * Get conflicts from contradictions table (backward-compatible).
 * Returns the old { conflictId, memories[] } shape for existing consumers.
 * @param {Database} db - SQLite database instance
 * @returns {Object[]} Array of conflict objects
 */
export function getConflicts(db) {
  const stmt = db.prepare(`
    SELECT c.id, c.memory1_id, c.memory2_id,
      m1.id as m1_id, m1.content as m1_content, m1.category as m1_category,
      m1.entity as m1_entity, m1.confidence as m1_confidence,
      m1.created_at as m1_created_at, m1.namespace as m1_namespace,
      m1.tags as m1_tags, m1.source as m1_source,
      m2.id as m2_id, m2.content as m2_content, m2.category as m2_category,
      m2.entity as m2_entity, m2.confidence as m2_confidence,
      m2.created_at as m2_created_at, m2.namespace as m2_namespace,
      m2.tags as m2_tags, m2.source as m2_source
    FROM contradictions c
    LEFT JOIN memories m1 ON c.memory1_id = m1.id
    LEFT JOIN memories m2 ON c.memory2_id = m2.id
    WHERE c.status = 'unresolved'
    ORDER BY c.detected_at DESC
  `);

  const rows = stmt.all();

  return rows.map(row => ({
    conflictId: row.id,
    memories: [
      row.m1_content ? {
        id: row.m1_id, content: row.m1_content, category: row.m1_category,
        entity: row.m1_entity, confidence: row.m1_confidence,
        created_at: row.m1_created_at, namespace: row.m1_namespace,
        tags: JSON.parse(row.m1_tags || '[]'), source: row.m1_source
      } : null,
      row.m2_content ? {
        id: row.m2_id, content: row.m2_content, category: row.m2_category,
        entity: row.m2_entity, confidence: row.m2_confidence,
        created_at: row.m2_created_at, namespace: row.m2_namespace,
        tags: JSON.parse(row.m2_tags || '[]'), source: row.m2_source
      } : null
    ].filter(Boolean)
  }));
}
