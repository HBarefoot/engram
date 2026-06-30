/**
 * Circuit breaker for the optional LLM layer.
 *
 * After N consecutive failures/timeouts the breaker OPENS for a cooldown; while
 * open, `llmComplete` short-circuits to null with zero network and zero added
 * latency, so callers fall straight to the rule-based path. The first call once
 * the cooldown elapses is a half-open trial — success closes the breaker, another
 * failure re-opens it. All in-process; no persistence, no telemetry.
 */
import { recordEvent } from './stats.js';

export const DEFAULT_BREAKER_THRESHOLD = 3;
export const DEFAULT_BREAKER_COOLDOWN_MS = 60000;

let consecutiveFailures = 0;
let openUntil = 0; // epoch ms; 0 = closed

/** True while the breaker is open (within cooldown) — caller should short-circuit. */
export function breakerOpen(now = Date.now()) {
  return openUntil > now;
}

/** Successful call: clears the streak and closes the breaker if it was open. */
export function breakerRecordSuccess() {
  consecutiveFailures = 0;
  if (openUntil !== 0) {
    openUntil = 0;
    recordEvent({ op: 'breaker', outcome: 'closed' });
  }
}

/**
 * Failed/timed-out call: opens the breaker once the consecutive-failure
 * threshold is hit (or re-opens after a failed half-open trial).
 */
export function breakerRecordFailure(
  threshold = DEFAULT_BREAKER_THRESHOLD,
  cooldownMs = DEFAULT_BREAKER_COOLDOWN_MS,
  now = Date.now()
) {
  consecutiveFailures += 1;
  if (consecutiveFailures >= threshold && openUntil <= now) {
    openUntil = now + cooldownMs;
    recordEvent({ op: 'breaker', outcome: 'open' });
  }
}

/** Snapshot for GET /api/llm/status. */
export function getBreakerState(now = Date.now()) {
  return {
    open: breakerOpen(now),
    consecutiveFailures,
    openUntil: openUntil || null
  };
}

/** Reset breaker state (tests). */
export function resetBreaker() {
  consecutiveFailures = 0;
  openUntil = 0;
}
