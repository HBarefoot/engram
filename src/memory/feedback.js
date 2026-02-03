/**
 * Memory feedback system for confidence adjustments
 */

import { generateId } from '../utils/id.js';
import * as logger from '../utils/logger.js';

/**
 * Record feedback for a memory
 * @param {Database} db - SQLite database instance
 * @param {string} memoryId - ID of the memory
 * @param {boolean} helpful - Whether the memory was helpful
 * @param {string} [context] - Optional context for the feedback
 * @returns {Object} Feedback result with updated scores
 */
export function recordFeedback(db, memoryId, helpful, context = null) {
  const id = generateId();
  const now = Date.now();

  // Insert feedback record
  const insertStmt = db.prepare(`
    INSERT INTO memory_feedback (id, memory_id, helpful, context, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertStmt.run(id, memoryId, helpful ? 1 : 0, context, now);

  logger.debug('Feedback recorded', { feedbackId: id, memoryId, helpful });

  // Recalculate feedback_score for the memory
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) as helpful_count
    FROM memory_feedback
    WHERE memory_id = ?
  `).get(memoryId);

  // Calculate feedback_score: ranges from -1.0 (all unhelpful) to +1.0 (all helpful)
  const feedbackScore = stats.total > 0
    ? (2 * stats.helpful_count - stats.total) / stats.total
    : 0;

  // Update the memory's feedback_score
  db.prepare(`UPDATE memories SET feedback_score = ? WHERE id = ?`)
    .run(feedbackScore, memoryId);

  logger.info('Memory feedback score updated', {
    memoryId,
    feedbackScore,
    totalFeedback: stats.total,
    helpfulCount: stats.helpful_count
  });

  // Apply automatic confidence adjustment if threshold met
  const adjustmentResult = applyConfidenceAdjustment(db, memoryId, feedbackScore, stats.total);

  return {
    feedbackId: id,
    memoryId,
    feedbackScore,
    feedbackCount: stats.total,
    helpfulCount: stats.helpful_count,
    unhelpfulCount: stats.total - stats.helpful_count,
    confidenceAdjusted: adjustmentResult.adjusted,
    newConfidence: adjustmentResult.confidence
  };
}

/**
 * Apply automatic confidence adjustment based on feedback
 * @param {Database} db - SQLite database instance
 * @param {string} memoryId - ID of the memory
 * @param {number} feedbackScore - Current feedback score (-1 to 1)
 * @param {number} feedbackCount - Total number of feedback events
 * @returns {Object} Adjustment result
 */
function applyConfidenceAdjustment(db, memoryId, feedbackScore, feedbackCount) {
  // Only adjust after minimum feedback threshold
  const MIN_FEEDBACK_FOR_ADJUSTMENT = 5;

  if (feedbackCount < MIN_FEEDBACK_FOR_ADJUSTMENT) {
    const memory = db.prepare('SELECT confidence FROM memories WHERE id = ?').get(memoryId);
    return { adjusted: false, confidence: memory?.confidence || 0.8 };
  }

  const memory = db.prepare('SELECT confidence FROM memories WHERE id = ?').get(memoryId);
  if (!memory) {
    return { adjusted: false, confidence: 0.8 };
  }

  let newConfidence = memory.confidence;

  // Decrease confidence for consistently unhelpful memories
  if (feedbackScore < -0.5) {
    newConfidence = Math.max(0.1, memory.confidence - 0.1);
    logger.info('Confidence decreased due to negative feedback', {
      memoryId,
      oldConfidence: memory.confidence,
      newConfidence,
      feedbackScore
    });
  }
  // Increase confidence for consistently helpful memories
  else if (feedbackScore > 0.5) {
    newConfidence = Math.min(1.0, memory.confidence + 0.05);
    logger.info('Confidence increased due to positive feedback', {
      memoryId,
      oldConfidence: memory.confidence,
      newConfidence,
      feedbackScore
    });
  }

  if (newConfidence !== memory.confidence) {
    db.prepare('UPDATE memories SET confidence = ? WHERE id = ?')
      .run(newConfidence, memoryId);
    return { adjusted: true, confidence: newConfidence };
  }

  return { adjusted: false, confidence: memory.confidence };
}

/**
 * Get feedback history for a memory
 * @param {Database} db - SQLite database instance
 * @param {string} memoryId - ID of the memory
 * @param {number} [limit=10] - Maximum feedback records to return
 * @returns {Object[]} Array of feedback records
 */
export function getFeedbackHistory(db, memoryId, limit = 10) {
  const stmt = db.prepare(`
    SELECT id, helpful, context, created_at
    FROM memory_feedback
    WHERE memory_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(memoryId, limit).map(row => ({
    id: row.id,
    helpful: row.helpful === 1,
    context: row.context,
    createdAt: row.created_at
  }));
}

/**
 * Get feedback statistics for a memory
 * @param {Database} db - SQLite database instance
 * @param {string} memoryId - ID of the memory
 * @returns {Object} Feedback statistics
 */
export function getFeedbackStats(db, memoryId) {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) as helpful_count,
      MIN(created_at) as first_feedback,
      MAX(created_at) as last_feedback
    FROM memory_feedback
    WHERE memory_id = ?
  `).get(memoryId);

  const memory = db.prepare('SELECT feedback_score, confidence FROM memories WHERE id = ?')
    .get(memoryId);

  return {
    totalFeedback: stats.total || 0,
    helpfulCount: stats.helpful_count || 0,
    unhelpfulCount: (stats.total || 0) - (stats.helpful_count || 0),
    feedbackScore: memory?.feedback_score || 0,
    confidence: memory?.confidence || 0.8,
    firstFeedbackAt: stats.first_feedback,
    lastFeedbackAt: stats.last_feedback
  };
}

/**
 * Get all memories with low feedback scores
 * @param {Database} db - SQLite database instance
 * @param {number} [threshold=-0.3] - Feedback score threshold
 * @param {number} [minFeedback=3] - Minimum feedback count
 * @returns {Object[]} Array of memories with low scores
 */
export function getLowFeedbackMemories(db, threshold = -0.3, minFeedback = 3) {
  const stmt = db.prepare(`
    SELECT m.*,
           (SELECT COUNT(*) FROM memory_feedback f WHERE f.memory_id = m.id) as feedback_count
    FROM memories m
    WHERE m.feedback_score <= ?
      AND (SELECT COUNT(*) FROM memory_feedback f WHERE f.memory_id = m.id) >= ?
    ORDER BY m.feedback_score ASC
  `);

  return stmt.all(threshold, minFeedback);
}
