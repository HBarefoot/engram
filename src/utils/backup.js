import path from 'path';
import { getDatabasePath } from '../config/index.js';
import * as logger from './logger.js';

/**
 * Create a timestamped, consistent backup of the memory database.
 *
 * Uses SQLite `VACUUM INTO`, not a filesystem copy: it writes a single,
 * checkpointed, self-contained file — so there are no `-wal`/`-shm` sidecars to
 * copy and no risk of capturing a half-written WAL. It also transparently
 * carries the connection's encryption key when the DB is encrypted (Feature 1),
 * producing an encrypted backup with the same key.
 *
 * The destination is derived from the live DB path with an ISO timestamp:
 *   ~/.engram/memory.db  ->  ~/.engram/memory.db.engram-backup-<ISO>
 *
 * @param {import('better-sqlite3').Database} db - open database handle
 * @param {Object} config - Engram config (for resolving the DB path)
 * @returns {string} Absolute path to the backup file that was written
 */
export function backupDatabase(db, config) {
  const dbPath = getDatabasePath(config);
  // Colons are illegal in filenames on some platforms — keep the stamp portable.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}.engram-backup-${stamp}`;

  // VACUUM INTO requires a bound parameter or a quoted literal; use the prepared
  // form so paths with special characters are handled safely.
  db.prepare('VACUUM INTO ?').run(backupPath);

  logger.info('Database backup created', { path: path.basename(backupPath) });
  return backupPath;
}
