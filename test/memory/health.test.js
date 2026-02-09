import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from '../../src/memory/health.js';

describe('Health Score', () => {
  function makeOverview(overrides = {}) {
    return {
      totalMemories: 100,
      totalRecalled: 50,
      accessedLast30Days: 40,
      avgConfidence: 0.8,
      byCategory: { fact: 30, preference: 25, pattern: 20, decision: 15, outcome: 10 },
      createdLast7Days: 10,
      createdLast30Days: 30,
      ...overrides
    };
  }

  function makeTrends(days = 30) {
    const daily = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - (days - i) * 86400000).toISOString().split('T')[0];
      daily.push({ date, created: 1, avgConfidence: 0.8 });
    }
    return { daily };
  }

  it('should return 0 for empty database', () => {
    const overview = makeOverview({ totalMemories: 0 });
    expect(calculateHealthScore(overview)).toBe(0);
  });

  it('should return a number between 0 and 100', () => {
    const score = calculateHealthScore(makeOverview(), 0, makeTrends());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should be higher with more recalled memories', () => {
    const lowRecall = calculateHealthScore(makeOverview({ totalRecalled: 10, accessedLast30Days: 5 }), 0, makeTrends());
    const highRecall = calculateHealthScore(makeOverview({ totalRecalled: 90, accessedLast30Days: 80 }), 0, makeTrends());
    expect(highRecall).toBeGreaterThan(lowRecall);
  });

  it('should be lower with many duplicates', () => {
    const noDups = calculateHealthScore(makeOverview(), 0, makeTrends());
    const manyDups = calculateHealthScore(makeOverview(), 50, makeTrends());
    expect(noDups).toBeGreaterThan(manyDups);
  });

  it('should be higher with diverse categories', () => {
    const diverse = calculateHealthScore(
      makeOverview({ byCategory: { fact: 20, preference: 20, pattern: 20, decision: 20, outcome: 20 } }),
      0, makeTrends()
    );
    const singleCategory = calculateHealthScore(
      makeOverview({ byCategory: { fact: 100 } }),
      0, makeTrends()
    );
    expect(diverse).toBeGreaterThan(singleCategory);
  });

  it('should be higher with good confidence', () => {
    const lowConf = calculateHealthScore(makeOverview({ avgConfidence: 0.3 }), 0, makeTrends());
    const highConf = calculateHealthScore(makeOverview({ avgConfidence: 0.95 }), 0, makeTrends());
    expect(highConf).toBeGreaterThan(lowConf);
  });

  it('should handle missing trends gracefully', () => {
    const score = calculateHealthScore(makeOverview(), 0, null);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should cap score at 100 even with perfect inputs', () => {
    const perfect = makeOverview({
      totalRecalled: 100,
      accessedLast30Days: 100,
      avgConfidence: 1.0,
      byCategory: { fact: 20, preference: 20, pattern: 20, decision: 20, outcome: 20 }
    });
    const score = calculateHealthScore(perfect, 0, makeTrends());
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should handle growth calculation with trends data', () => {
    const daily = [];
    // Prior week: 0 created, Recent week: 5 created
    for (let i = 0; i < 14; i++) {
      const date = new Date(Date.now() - (14 - i) * 86400000).toISOString().split('T')[0];
      daily.push({ date, created: i >= 7 ? 1 : 0, avgConfidence: 0.8 });
    }
    const growingTrends = { daily };

    const score = calculateHealthScore(makeOverview(), 0, growingTrends);
    expect(score).toBeGreaterThan(0);
  });
});
