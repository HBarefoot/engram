/**
 * One-time, opt-in feedback nudge.
 *
 * Engram has NO telemetry and never phones home. This module only prints a
 * single friendly line to the user's own terminal, exactly once, inviting
 * them to star the repo or send feedback. It records that it has run in the
 * local `meta` table (the same kv table used for migration flags) so the
 * line never appears a second time.
 *
 * It is deliberately silent in every non-interactive context — piped output,
 * CI, MCP stdio mode — and can be disabled outright with ENGRAM_NO_NUDGE.
 * It must never block, slow, or throw out of the CLI: all work is wrapped in
 * a try/catch that degrades to a no-op.
 */

const NUDGE_KEY = 'feedback_nudge_shown_v1';
const DISCUSSIONS_URL = 'https://github.com/HBarefoot/engram/discussions';
const NUDGE_MESSAGE = `Enjoying Engram? ★ Star it or send feedback → ${DISCUSSIONS_URL}`;

/**
 * Show the feedback nudge once, if appropriate.
 *
 * @param {import('better-sqlite3').Database} db - open Engram database (for the `meta` table)
 * @param {object} [opts]
 * @param {NodeJS.WriteStream|{isTTY?:boolean,write:Function}} [opts.stream=process.stdout] - output sink (injectable for tests)
 * @param {Record<string,string|undefined>} [opts.env=process.env] - environment (injectable for tests)
 * @returns {boolean} true if the nudge was shown this call, false otherwise
 */
export function maybeShowNudge(db, { stream = process.stdout, env = process.env } = {}) {
  try {
    // Explicit opt-out, or any non-interactive / automated context.
    if (env.ENGRAM_NO_NUDGE) return false;
    if (env.CI) return false;
    if (!stream || !stream.isTTY) return false;

    // Only ever show it once.
    const seen = db.prepare('SELECT value FROM meta WHERE key = ?').get(NUDGE_KEY);
    if (seen) return false;

    // Print first, then mark — so a write failure doesn't burn the one-shot.
    stream.write(`\n${NUDGE_MESSAGE}\n`);
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
      NUDGE_KEY,
      new Date().toISOString()
    );
    return true;
  } catch {
    // The nudge is never allowed to break the CLI.
    return false;
  }
}
