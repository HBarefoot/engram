/**
 * Observability for the optional local-LLM layer.
 *
 * The LLM call sites write to this module. All counts are LOCAL and exposed only
 * to the user via GET /api/llm/stats — no telemetry, no phone-home.
 *
 * Persistence + cross-process sharing (v1.10):
 *   `engram start` (REST + dashboard) and the agent-facing MCP stdio server run
 *   in SEPARATE processes. Real extractions happen in the MCP process, so an
 *   in-memory singleton left the dashboard reading 0 enhanced extractions even
 *   when the layer was working. When a DB handle is bound via initStats(db),
 *   counters/events write through to the `llm_stats` + `llm_events` tables
 *   (atomic UPSERT), and getStats() reads back the shared totals — correct
 *   across both processes and across restarts.
 *
 *   When NO db is bound (embedded-library use, unit tests), the module falls
 *   back to the original in-memory behavior so nothing else has to change.
 *
 * The recent-events ring buffer is intentionally generic/serializable so it can
 * back the "Live Agent Activity" feed without reshaping.
 */

const MAX_EVENTS = 50;

// Counter columns kept in llm_stats (key/value). lastError is stored as a JSON
// string under 'lastError'; lastCallAt/lastLatencyMs/lastModel are stored raw.
const COUNTER_KEYS = [
  'calls',
  'failures',
  'timeouts',
  'extractionsEnhanced',
  'extractionsFallback',
  'contradictionsConfirmed',
  'contradictionsFiltered',
  'contradictionsConfirmSkipped',
  'totalLatencyMs'
];

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

// Bound DB handle. When set, stats persist to SQLite and are shared across
// processes; when null, we use the in-memory `state` above.
let db = null;

/**
 * Bind a SQLite handle so stats persist and are shared across the REST + MCP
 * processes. Called once at startup (after initDatabase) in each entry point.
 * The `llm_stats`/`llm_events` tables are created by runMigrations. Safe to
 * call with a falsy value (keeps the in-memory path).
 * @param {import('better-sqlite3').Database} database
 */
export function initStats(database) {
  db = database || null;
}

// --- persistence helpers (no-ops when db is unbound) ---

function bumpCounters(deltas) {
  if (!db) return;
  const stmt = db.prepare(
    `INSERT INTO llm_stats (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + excluded.value`
  );
  const apply = db.transaction((entries) => {
    for (const [key, delta] of entries) {
      if (!delta) continue;
      stmt.run(key, String(delta));
    }
  });
  apply(Object.entries(deltas));
}

function setMeta(key, value) {
  if (!db) return;
  db.prepare(
    `INSERT INTO llm_stats (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value === null || value === undefined ? '' : String(value));
}

function pushEvent(evt) {
  if (!db) return;
  db.prepare(
    `INSERT INTO llm_events (ts, op, outcome, latencyMs, model) VALUES (?, ?, ?, ?, ?)`
  ).run(evt.ts, evt.op ?? null, evt.outcome ?? null, evt.latencyMs ?? null, evt.model ?? null);
  // Keep the ring bounded to the newest MAX_EVENTS rows.
  db.prepare(
    `DELETE FROM llm_events
     WHERE id NOT IN (SELECT id FROM llm_events ORDER BY id DESC LIMIT ?)`
  ).run(MAX_EVENTS);
}

function readCounter(key) {
  const row = db.prepare('SELECT value FROM llm_stats WHERE key = ?').get(key);
  return row ? parseInt(row.value, 10) || 0 : 0;
}

function readRaw(key) {
  const row = db.prepare('SELECT value FROM llm_stats WHERE key = ?').get(key);
  return row && row.value !== '' ? row.value : null;
}

/**
 * Record a single LLM HTTP call (one fetch attempt).
 * @param {Object} p
 * @param {number} p.latencyMs
 * @param {'ok'|'timeout'|'error'} p.status
 * @param {string} [p.model]
 * @param {string} [p.error] - error message when status !== 'ok'
 */
export function recordCall({ latencyMs = 0, status = 'ok', model = null, error = null }) {
  const at = Date.now();

  // In-memory (authoritative when unbound; harmless bookkeeping when bound,
  // and it keeps lastLatencyMs/lastModel available as recordEvent defaults).
  state.calls += 1;
  state.totalLatencyMs += latencyMs;
  state.lastLatencyMs = latencyMs;
  state.lastCallAt = at;
  if (model) state.lastModel = model;
  if (status === 'timeout') state.timeouts += 1;
  if (status === 'error') state.failures += 1;
  if (status !== 'ok') state.lastError = { message: error || status, at };

  if (db) {
    bumpCounters({
      calls: 1,
      totalLatencyMs: latencyMs,
      timeouts: status === 'timeout' ? 1 : 0,
      failures: status === 'error' ? 1 : 0
    });
    setMeta('lastCallAt', at);
    if (model) setMeta('lastModel', model);
    if (status !== 'ok') {
      setMeta('lastError', JSON.stringify({ message: error || status, at }));
    }
  }
}

/**
 * Record a semantic, op-level event into the ring buffer (and bump the matching
 * counter). This is what the activity feed renders.
 * @param {Object} p
 * @param {'extract'|'contradiction'|'breaker'} p.op
 * @param {'enhanced'|'fallback'|'confirmed'|'filtered'|'timeout'|'error'|'closed'|'open'} p.outcome
 * @param {number} [p.latencyMs] - defaults to the last call's latency
 * @param {string} [p.model] - defaults to the last call's model
 */
export function recordEvent({ op, outcome, latencyMs, model }) {
  if (outcome === 'enhanced') state.extractionsEnhanced += 1;
  else if (outcome === 'fallback') state.extractionsFallback += 1;
  else if (outcome === 'confirmed') state.contradictionsConfirmed += 1;
  else if (outcome === 'filtered') state.contradictionsFiltered += 1;

  const evt = {
    ts: Date.now(),
    op,
    outcome,
    latencyMs: latencyMs ?? state.lastLatencyMs,
    model: model ?? state.lastModel
  };

  state.events.push(evt);
  if (state.events.length > MAX_EVENTS) state.events.shift();

  if (db) {
    const counter =
      outcome === 'enhanced' ? 'extractionsEnhanced'
      : outcome === 'fallback' ? 'extractionsFallback'
      : outcome === 'confirmed' ? 'contradictionsConfirmed'
      : outcome === 'filtered' ? 'contradictionsFiltered'
      : null;
    if (counter) bumpCounters({ [counter]: 1 });
    pushEvent(evt);
  }
}

/** Record contradiction confirmations skipped because the per-run cap was hit. */
export function recordSkippedConfirmations(n = 1) {
  state.contradictionsConfirmSkipped += n;
  if (db) bumpCounters({ contradictionsConfirmSkipped: n });
}

/**
 * Snapshot of counters + recent events (most-recent-first). Safe to JSON.
 * Reads from the bound DB (shared across processes) when available, else from
 * the in-memory state.
 */
export function getStats() {
  if (db) {
    const calls = readCounter('calls');
    const totalLatencyMs = readCounter('totalLatencyMs');
    const rawError = readRaw('lastError');
    const lastCallAtRaw = readRaw('lastCallAt');
    const events = db
      .prepare('SELECT ts, op, outcome, latencyMs, model FROM llm_events ORDER BY ts DESC, id DESC LIMIT ?')
      .all(MAX_EVENTS);
    return {
      calls,
      failures: readCounter('failures'),
      timeouts: readCounter('timeouts'),
      extractionsEnhanced: readCounter('extractionsEnhanced'),
      extractionsFallback: readCounter('extractionsFallback'),
      contradictionsConfirmed: readCounter('contradictionsConfirmed'),
      contradictionsFiltered: readCounter('contradictionsFiltered'),
      contradictionsConfirmSkipped: readCounter('contradictionsConfirmSkipped'),
      avgLatencyMs: calls ? Math.round(totalLatencyMs / calls) : 0,
      lastError: rawError ? JSON.parse(rawError) : null,
      lastCallAt: lastCallAtRaw ? parseInt(lastCallAtRaw, 10) : null,
      recentEvents: events // already newest-first
    };
  }

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

/** Reset all counters + the buffer (tests). Clears both memory and the DB. */
export function reset() {
  state = emptyState();
  if (db) {
    db.exec('DELETE FROM llm_stats; DELETE FROM llm_events;');
  }
}
