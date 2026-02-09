/**
 * Calculate a composite memory health score (0-100)
 *
 * Factors and weights (sum to 1.0):
 * - Recall rate:   % of memories accessed at least once        (0.25)
 * - Freshness:     % of memories accessed in last 30 days      (0.20)
 * - Confidence:    average confidence score                     (0.20)
 * - Diversity:     category distribution entropy                (0.15)
 * - Growth:        positive trend in memory creation            (0.10)
 * - Cleanliness:   inverse of duplicate ratio                   (0.10)
 *
 * @param {Object} overview - From analytics.getOverview()
 * @param {number} duplicateCount - From analytics.getDuplicateClusters().totalDuplicates
 * @param {Object} trends - From analytics.getTrends()
 * @returns {number} Health score 0-100
 */
export function calculateHealthScore(overview, duplicateCount = 0, trends = null) {
  if (overview.totalMemories === 0) return 0;

  // 1. Recall rate (0.25): % of memories ever accessed
  const recallRate = overview.totalRecalled / overview.totalMemories;

  // 2. Freshness (0.20): % of memories accessed in last 30 days
  const freshness = overview.accessedLast30Days / overview.totalMemories;

  // 3. Confidence avg (0.20): already 0-1
  const confidence = overview.avgConfidence;

  // 4. Diversity (0.15): Shannon entropy of category distribution, normalized
  const diversity = calculateDiversity(overview.byCategory);

  // 5. Growth (0.10): whether memories are being actively created
  const growth = calculateGrowth(overview, trends);

  // 6. Cleanliness (0.10): inverse of duplicate ratio
  const duplicateRatio = duplicateCount / overview.totalMemories;
  const cleanliness = Math.max(0, 1 - duplicateRatio * 5); // 20% duplicates = 0

  const weightedScore =
    recallRate * 0.25 +
    freshness * 0.20 +
    confidence * 0.20 +
    diversity * 0.15 +
    growth * 0.10 +
    cleanliness * 0.10;

  return Math.round(Math.min(1, Math.max(0, weightedScore)) * 100);
}

/**
 * Calculate category diversity using normalized Shannon entropy
 * Max entropy = all 5 categories equally distributed
 * @param {Object} byCategory - { preference: n, fact: n, ... }
 * @returns {number} 0-1 diversity score
 */
function calculateDiversity(byCategory) {
  const counts = Object.values(byCategory);
  const total = counts.reduce((s, c) => s + c, 0);
  if (total === 0 || counts.length <= 1) return 0;

  let entropy = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
  }

  // Normalize by max possible entropy (5 categories)
  const maxEntropy = Math.log2(5);
  return entropy / maxEntropy;
}

/**
 * Calculate growth score based on recent creation activity
 * @param {Object} overview
 * @param {Object|null} trends
 * @returns {number} 0-1 growth score
 */
function calculateGrowth(overview, trends) {
  // If we have trends data, compare recent week vs prior weeks
  if (trends && trends.daily && trends.daily.length >= 14) {
    const daily = trends.daily;
    const recentWeek = daily.slice(-7).reduce((s, d) => s + d.created, 0);
    const priorWeek = daily.slice(-14, -7).reduce((s, d) => s + d.created, 0);

    if (priorWeek === 0 && recentWeek > 0) return 1;
    if (priorWeek === 0 && recentWeek === 0) return 0.3;
    const ratio = recentWeek / priorWeek;
    return Math.min(1, ratio / 2); // ratio of 2 = max growth score
  }

  // Fallback: use 7-day vs 30-day ratio
  if (overview.createdLast30Days === 0) return 0;
  const weeklyRate = overview.createdLast7Days / 7;
  const monthlyRate = overview.createdLast30Days / 30;
  if (monthlyRate === 0) return 0;

  const ratio = weeklyRate / monthlyRate;
  return Math.min(1, ratio / 2);
}
