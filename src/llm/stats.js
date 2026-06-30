/**
 * In-process observability for the optional local-LLM layer.
 *
 * A tiny singleton the LLM call sites write to. All counts are LOCAL, kept in
 * memory for the life of the process, and exposed only to the user via
 * GET /api/llm/stats — no persistence, no telemetry, no phone-home.
 *
 * The recent-events ring buffer is intentionally generic/serializable so it can
 * back the upcoming "Live Agent Activity" feed without reshaping.
 */

const MAX_EVENTS = 50;

function emptyState() {
  return {
    calls: 0,
    failures: 0,
    timeouts: 0,
    extractionsEnhanced: 0,
    extractionsFallback: 0,
    contradictionsConfirmed: 0,
    contradictionsFiltered: 0,
    contradictionsConfirmSkipped: 0,
    totalLatencyMs: 0,
    lastError: null, // { message, at }
    lastCallAt: null,
    lastLatencyMs: 0,
    lastModel: null,
    events: [] // ring buffer of { ts, op, outcome, latencyMs, model }
  };
}

let state = emptyState();

/**
 * Record a single LLM HTTP call (one fetch attempt).
 * @param {Object} p
 * @param {number} p.latencyMs
 * @param {'ok'|'timeout'|'error'} p.status
 * @param {string} [p.model]
 * @param {string} [p.error] - error message when status !== 'ok'
 */
export function recordCall({ latencyMs = 0, status = 'ok', model = null, error = null }) {
  state.calls += 1;
  state.totalLatencyMs += latencyMs;
  state.lastLatencyMs = latencyMs;
  state.lastCallAt = Date.now();
  if (model) state.lastModel = model;
  if (status === 'timeout') state.timeouts += 1;
  if (status === 'error') state.failures += 1;
  if (status !== 'ok') {
    state.lastError = { message: error || status, at: Date.now() };
  }
}

/**
 * Record a semantic, op-level event into the ring buffer (and bump the matching
 * counter). This is what the activity feed renders.
 * @param {Object} p
 * @param {'extract'|'contradiction'} p.op
 * @param {'enhanced'|'fallback'|'confirmed'|'filtered'|'timeout'|'error'} p.outcome
 * @param {number} [p.latencyMs] - defaults to the last call's latency
 * @param {string} [p.model] - defaults to the last call's model
 */
export function recordEvent({ op, outcome, latencyMs, model }) {
  if (outcome === 'enhanced') state.extractionsEnhanced += 1;
  else if (outcome === 'fallback') state.extractionsFallback += 1;
  else if (outcome === 'confirmed') state.contradictionsConfirmed += 1;
  else if (outcome === 'filtered') state.contradictionsFiltered += 1;

  state.events.push({
    ts: Date.now(),
    op,
    outcome,
    latencyMs: latencyMs ?? state.lastLatencyMs,
    model: model ?? state.lastModel
  });
  if (state.events.length > MAX_EVENTS) state.events.shift();
}

/** Record contradiction confirmations skipped because the per-run cap was hit. */
export function recordSkippedConfirmations(n = 1) {
  state.contradictionsConfirmSkipped += n;
}

/**
 * Snapshot of counters + recent events (most-recent-first). Safe to JSON.
 */
export function getStats() {
  return {
    calls: state.calls,
    failures: state.failures,
    timeouts: state.timeouts,
    extractionsEnhanced: state.extractionsEnhanced,
    extractionsFallback: state.extractionsFallback,
    contradictionsConfirmed: state.contradictionsConfirmed,
    contradictionsFiltered: state.contradictionsFiltered,
    contradictionsConfirmSkipped: state.contradictionsConfirmSkipped,
    avgLatencyMs: state.calls ? Math.round(state.totalLatencyMs / state.calls) : 0,
    lastError: state.lastError,
    lastCallAt: state.lastCallAt,
    recentEvents: [...state.events].reverse()
  };
}

/** Reset all counters + the buffer (tests). */
export function reset() {
  state = emptyState();
}
