/**
 * Cosine similarity thresholds (0-1) used across the memory pipeline.
 *
 * Each band has a distinct semantic role; they are NOT interchangeable.
 * Tuning one affects user-visible behavior in specific ways noted below.
 *
 * Single source of truth — every module that classifies memory pairs
 * imports from here. Don't reintroduce module-local constants; the
 * "Merge N duplicates" button regression (v1.5.2) was caused by exactly
 * that drift.
 */
export const SIMILARITY_THRESHOLDS = {
  /**
   * "Redundant" — pairs at or above this are surfaced to the user for
   * cleanup (Memory Health page, GET /api/analytics/duplicates).
   * User-initiated merge actions use this same threshold so the
   * displayed count matches what the merge button removes.
   */
  REDUNDANT: 0.85,

  /**
   * "Merge" — pairs at or above this are automatically merged during
   * insert-time dedup and the default batch consolidation pass. Stricter
   * than REDUNDANT because automatic merges should be high-confidence.
   */
  MERGE: 0.92,

  /**
   * "Duplicate" — pairs at or above this are rejected on insert as
   * nearly identical (nothing new to record). The reject path returns
   * a "duplicate" status to the caller rather than storing the new row.
   */
  DUPLICATE: 0.95
};
