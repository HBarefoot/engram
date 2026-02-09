import { getStats, getMemoriesWithEmbeddings } from './store.js';
import { cosineSimilarity } from '../embed/index.js';
import * as logger from '../utils/logger.js';

/**
 * Get analytics overview: totals, date-range counts, average confidence, health inputs
 * @param {Database} db - SQLite database instance
 * @returns {Object} Overview analytics
 */
export function getOverview(db) {
  const stats = getStats(db);
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const createdLast7Days = db.prepare(
    'SELECT COUNT(*) as count FROM memories WHERE created_at >= ?'
  ).get(sevenDaysAgo).count;

  const createdLast30Days = db.prepare(
    'SELECT COUNT(*) as count FROM memories WHERE created_at >= ?'
  ).get(thirtyDaysAgo).count;

  const avgConfidence = db.prepare(
    'SELECT AVG(confidence) as avg FROM memories'
  ).get().avg || 0;

  const totalRecalled = db.prepare(
    'SELECT COUNT(*) as count FROM memories WHERE access_count > 0'
  ).get().count;

  const accessedLast30Days = db.prepare(
    'SELECT COUNT(*) as count FROM memories WHERE last_accessed >= ?'
  ).get(thirtyDaysAgo).count;

  return {
    totalMemories: stats.total,
    byCategory: stats.byCategory,
    byNamespace: stats.byNamespace,
    withEmbeddings: stats.withEmbeddings,
    createdLast7Days,
    createdLast30Days,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    totalRecalled,
    accessedLast30Days,
    recallRate: stats.total > 0
      ? Math.round((totalRecalled / stats.total) * 100)
      : 0
  };
}

/**
 * Get stale memories (not accessed in N+ days)
 * @param {Database} db
 * @param {number} daysThreshold - Days since last access (default 30)
 * @param {number} limit - Max results (default 50)
 * @returns {Object} { items, count }
 */
export function getStaleMemories(db, daysThreshold = 30, limit = 50) {
  const now = Date.now();
  const threshold = now - daysThreshold * 24 * 60 * 60 * 1000;

  // Stale = last_accessed before threshold, OR never accessed AND created before threshold
  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM memories
    WHERE (last_accessed IS NOT NULL AND last_accessed < ?)
       OR (last_accessed IS NULL AND created_at < ?)
  `).get(threshold, threshold);

  const rows = db.prepare(`
    SELECT id, content, category, entity, confidence, last_accessed, created_at, access_count
    FROM memories
    WHERE (last_accessed IS NOT NULL AND last_accessed < ?)
       OR (last_accessed IS NULL AND created_at < ?)
    ORDER BY COALESCE(last_accessed, created_at) ASC
    LIMIT ?
  `).all(threshold, threshold, limit);

  const items = rows.map(row => ({
    id: row.id,
    content: row.content,
    category: row.category,
    entity: row.entity,
    confidence: row.confidence,
    lastAccessed: row.last_accessed,
    accessCount: row.access_count,
    daysSinceAccess: Math.floor(
      (now - (row.last_accessed || row.created_at)) / (1000 * 60 * 60 * 24)
    )
  }));

  return { items, count: countResult.count };
}

/**
 * Get memories that have never been recalled (access_count = 0)
 * @param {Database} db
 * @param {number} limit
 * @returns {Object} { items, count }
 */
export function getNeverRecalled(db, limit = 50) {
  const now = Date.now();

  const countResult = db.prepare(
    'SELECT COUNT(*) as count FROM memories WHERE access_count = 0'
  ).get();

  const rows = db.prepare(`
    SELECT id, content, category, entity, confidence, created_at
    FROM memories
    WHERE access_count = 0
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit);

  const items = rows.map(row => ({
    id: row.id,
    content: row.content,
    category: row.category,
    entity: row.entity,
    confidence: row.confidence,
    createdAt: row.created_at,
    daysSinceCreation: Math.floor(
      (now - row.created_at) / (1000 * 60 * 60 * 24)
    )
  }));

  return { items, count: countResult.count };
}

/**
 * Find clusters of duplicate/similar memories
 * Uses cosine similarity on embeddings, threshold 0.85
 * @param {Database} db
 * @param {number} threshold - Similarity threshold (default 0.85)
 * @returns {Object} { clusters, totalDuplicates }
 */
export function getDuplicateClusters(db, threshold = 0.85) {
  const memories = getMemoriesWithEmbeddings(db);
  const pairs = [];

  // O(n²) comparison — same pattern as consolidate.js but lower threshold
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const memA = memories[i];
      const memB = memories[j];

      if (memA.namespace !== memB.namespace) continue;

      const similarity = cosineSimilarity(memA.embedding, memB.embedding);
      if (similarity > threshold) {
        pairs.push({ a: memA.id, b: memB.id, similarity, memA, memB });
      }
    }
  }

  // Group pairs into clusters using union-find
  const parent = new Map();
  function find(id) {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)));
    return parent.get(id);
  }
  function union(a, b) {
    parent.set(find(a), find(b));
  }

  const memById = new Map();
  const clusterSimilarity = new Map();

  for (const { a, b, similarity, memA, memB } of pairs) {
    memById.set(a, memA);
    memById.set(b, memB);

    const rootA = find(a);
    const rootB = find(b);
    union(a, b);
    const newRoot = find(a);

    const minSim = Math.min(
      clusterSimilarity.get(rootA) ?? similarity,
      clusterSimilarity.get(rootB) ?? similarity,
      similarity
    );
    clusterSimilarity.set(newRoot, minSim);
  }

  // Build clusters
  const clusterMap = new Map();
  for (const id of memById.keys()) {
    const root = find(id);
    if (!clusterMap.has(root)) clusterMap.set(root, []);
    clusterMap.get(root).push(id);
  }

  const clusters = [];
  for (const [root, ids] of clusterMap.entries()) {
    if (ids.length < 2) continue;
    clusters.push({
      memories: ids.map(id => {
        const m = memById.get(id);
        return {
          id: m.id,
          content: m.content,
          category: m.category,
          confidence: m.confidence,
          accessCount: m.access_count
        };
      }),
      similarity: Math.round((clusterSimilarity.get(root) || threshold) * 100) / 100
    });
  }

  const totalDuplicates = clusters.reduce((sum, c) => sum + c.memories.length - 1, 0);

  return { clusters, totalDuplicates };
}

/**
 * Get daily trends data for the last N days
 * @param {Database} db
 * @param {number} days - Number of days to look back (default 30)
 * @returns {Object} { daily: [{ date, created, avgConfidence }] }
 */
export function getTrends(db, days = 30) {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // Get daily creation counts and average confidence
  const rows = db.prepare(`
    SELECT
      date(created_at / 1000, 'unixepoch') as date,
      COUNT(*) as created,
      ROUND(AVG(confidence), 2) as avgConfidence
    FROM memories
    WHERE created_at >= ?
    GROUP BY date(created_at / 1000, 'unixepoch')
    ORDER BY date ASC
  `).all(startTime);

  // Fill in missing days with zeros
  const daily = [];
  const dateSet = new Map(rows.map(r => [r.date, r]));
  const current = new Date(startTime);
  const end = new Date(now);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const row = dateSet.get(dateStr);
    daily.push({
      date: dateStr,
      created: row ? row.created : 0,
      avgConfidence: row ? row.avgConfidence : null
    });
    current.setDate(current.getDate() + 1);
  }

  return { daily };
}
