import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { initDatabase, createMemory } from '../../src/memory/store.js';
import {
  recordFeedback,
  getFeedbackHistory,
  getFeedbackStats,
  getLowFeedbackMemories
} from '../../src/memory/feedback.js';

describe('Memory Feedback', () => {
  let db;
  let testDbPath;
  let memory;

  beforeEach(() => {
    const tmpDir = path.join(os.tmpdir(), 'engram-feedback-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    testDbPath = path.join(tmpDir, 'test.db');
    db = initDatabase(testDbPath);

    memory = createMemory(db, {
      content: 'Test memory for feedback',
      category: 'fact',
      confidence: 0.8
    });
  });

  afterEach(() => {
    if (db) db.close();
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.rmSync(path.dirname(testDbPath), { recursive: true, force: true });
    }
  });

  describe('recordFeedback', () => {
    it('should set feedback_score to 1.0 for a single helpful vote', () => {
      const r = recordFeedback(db, memory.id, true);
      expect(r.feedbackScore).toBe(1.0);
      expect(r.helpfulCount).toBe(1);
      expect(r.unhelpfulCount).toBe(0);
      expect(r.confidenceAdjusted).toBe(false);
    });

    it('should set feedback_score to -1.0 for a single unhelpful vote', () => {
      const r = recordFeedback(db, memory.id, false);
      expect(r.feedbackScore).toBe(-1.0);
      expect(r.helpfulCount).toBe(0);
      expect(r.unhelpfulCount).toBe(1);
    });

    it('should compute feedback_score = (2*helpful - total) / total for mixed votes', () => {
      recordFeedback(db, memory.id, true);
      recordFeedback(db, memory.id, true);
      const r = recordFeedback(db, memory.id, false);
      // 2 helpful, 1 unhelpful, total 3 → (2*2 - 3) / 3 = 1/3
      expect(r.feedbackScore).toBeCloseTo(1 / 3, 5);
    });

    it('should not adjust confidence below 5-vote threshold', () => {
      for (let i = 0; i < 4; i++) {
        const r = recordFeedback(db, memory.id, false);
        expect(r.confidenceAdjusted).toBe(false);
      }
    });

    it('should decrease confidence after 5+ consistently unhelpful votes', () => {
      for (let i = 0; i < 5; i++) {
        recordFeedback(db, memory.id, false);
      }
      const stats = getFeedbackStats(db, memory.id);
      expect(stats.confidence).toBeLessThan(0.8);
      expect(stats.confidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should increase confidence after 5+ consistently helpful votes', () => {
      for (let i = 0; i < 5; i++) {
        recordFeedback(db, memory.id, true);
      }
      const stats = getFeedbackStats(db, memory.id);
      expect(stats.confidence).toBeGreaterThan(0.8);
      expect(stats.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should cap confidence at 1.0 even after many helpful votes', () => {
      const high = createMemory(db, { content: 'Near-max confidence', confidence: 0.98 });
      for (let i = 0; i < 10; i++) {
        recordFeedback(db, high.id, true);
      }
      const stats = getFeedbackStats(db, high.id);
      expect(stats.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should floor confidence at 0.1 even after many unhelpful votes', () => {
      const low = createMemory(db, { content: 'Near-floor confidence', confidence: 0.15 });
      for (let i = 0; i < 20; i++) {
        recordFeedback(db, low.id, false);
      }
      const stats = getFeedbackStats(db, low.id);
      expect(stats.confidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should persist optional context with each vote', () => {
      recordFeedback(db, memory.id, true, 'helpful for debugging');
      const history = getFeedbackHistory(db, memory.id);
      expect(history[0].context).toBe('helpful for debugging');
    });
  });

  describe('getFeedbackHistory', () => {
    it('should return feedback in most-recent-first order', async () => {
      recordFeedback(db, memory.id, true, 'first');
      await new Promise(r => setTimeout(r, 5));
      recordFeedback(db, memory.id, false, 'second');

      const history = getFeedbackHistory(db, memory.id);
      expect(history).toHaveLength(2);
      expect(history[0].context).toBe('second');
      expect(history[1].context).toBe('first');
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) recordFeedback(db, memory.id, true);
      const history = getFeedbackHistory(db, memory.id, 3);
      expect(history).toHaveLength(3);
    });

    it('should expose helpful as a boolean', () => {
      recordFeedback(db, memory.id, true);
      recordFeedback(db, memory.id, false);
      const history = getFeedbackHistory(db, memory.id);
      expect(history.some(h => h.helpful === true)).toBe(true);
      expect(history.some(h => h.helpful === false)).toBe(true);
    });
  });

  describe('getFeedbackStats', () => {
    it('should return zeroes for a memory with no feedback', () => {
      const stats = getFeedbackStats(db, memory.id);
      expect(stats.totalFeedback).toBe(0);
      expect(stats.helpfulCount).toBe(0);
      expect(stats.unhelpfulCount).toBe(0);
      expect(stats.feedbackScore).toBe(0);
      expect(stats.confidence).toBe(0.8);
    });

    it('should return correct counts and timestamps', () => {
      const before = Date.now();
      recordFeedback(db, memory.id, true);
      recordFeedback(db, memory.id, false);
      recordFeedback(db, memory.id, true);
      const after = Date.now();

      const stats = getFeedbackStats(db, memory.id);
      expect(stats.totalFeedback).toBe(3);
      expect(stats.helpfulCount).toBe(2);
      expect(stats.unhelpfulCount).toBe(1);
      expect(stats.firstFeedbackAt).toBeGreaterThanOrEqual(before);
      expect(stats.lastFeedbackAt).toBeLessThanOrEqual(after);
    });
  });

  describe('getLowFeedbackMemories', () => {
    it('should return only memories below threshold with enough feedback', () => {
      const a = createMemory(db, { content: 'A — bad' });
      const b = createMemory(db, { content: 'B — bad but few votes' });
      const c = createMemory(db, { content: 'C — good' });

      // a: 3 unhelpful → score -1, count 3 (meets default minFeedback=3)
      for (let i = 0; i < 3; i++) recordFeedback(db, a.id, false);
      // b: 2 unhelpful → score -1 but count below min
      for (let i = 0; i < 2; i++) recordFeedback(db, b.id, false);
      // c: 3 helpful → score +1
      for (let i = 0; i < 3; i++) recordFeedback(db, c.id, true);

      const low = getLowFeedbackMemories(db);
      const ids = low.map(m => m.id);
      expect(ids).toContain(a.id);
      expect(ids).not.toContain(b.id);
      expect(ids).not.toContain(c.id);
    });

    it('should respect custom threshold and minFeedback parameters', () => {
      const m = createMemory(db, { content: 'Borderline' });
      // 1 helpful, 1 unhelpful → score 0, count 2
      recordFeedback(db, m.id, true);
      recordFeedback(db, m.id, false);

      // With default (threshold -0.3, min 3): excluded
      expect(getLowFeedbackMemories(db).map(x => x.id)).not.toContain(m.id);
      // With threshold 0.1 and min 2: included
      expect(getLowFeedbackMemories(db, 0.1, 2).map(x => x.id)).toContain(m.id);
    });
  });
});
