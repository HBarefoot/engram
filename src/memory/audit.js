import fs from 'fs';
import { getDatabasePath } from '../config/index.js';
import { getStats, countUnresolvedContradictions } from './store.js';
import { getStaleMemories, getNeverRecalled, getDuplicateClusters } from './analytics.js';
import { detectSecrets } from '../extract/secrets.js';

/**
 * Run a read-only audit of the memory store.
 *
 * Composes existing machinery (no new detection logic): re-scans every memory's
 * content for secrets — catching anything stored before secret detection existed
 * or via `force: true` — and rolls up health signals (stale, never-recalled,
 * duplicate clusters, unresolved contradictions) plus store/DB metadata.
 *
 * Pure and synchronous: returns a structured object the CLI/REST layers format.
 * `hasSecrets` is the CI gate — callers exit non-zero when it is true.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Object} [options]
 * @param {string} [options.namespace] - Restrict the secret scan to one namespace
 * @param {Object} [options.config] - Engram config (enables DB size + path reporting)
 * @returns {Object} Audit report
 */
export function runAudit(db, options = {}) {
  const { namespace, config } = options;

  // Secret re-scan over stored content (optionally namespace-scoped).
  const rows = namespace
    ? db.prepare('SELECT id, content, namespace FROM memories WHERE namespace = ?').all(namespace)
    : db.prepare('SELECT id, content, namespace FROM memories').all();

  const secretFindings = [];
  for (const row of rows) {
    const detection = detectSecrets(row.content);
    if (detection.hasSecrets) {
      secretFindings.push({
        id: row.id,
        namespace: row.namespace,
        types: detection.secrets.map((s) => s.type)
      });
    }
  }

  const stale = getStaleMemories(db);
  const neverRecalled = getNeverRecalled(db);
  const duplicates = getDuplicateClusters(db);
  const unresolvedContradictions = countUnresolvedContradictions(db);

  // DB size + encryption status (best-effort; only when a config is provided).
  let dbSizeBytes = null;
  let encrypted = false;
  if (config) {
    try {
      dbSizeBytes = fs.statSync(getDatabasePath(config)).size;
    } catch {
      dbSizeBytes = null;
    }
    const flag = db.prepare('SELECT value FROM meta WHERE key = ?').get('encryption_enabled_v1');
    encrypted = Boolean(flag);
  }

  return {
    scannedNamespace: namespace || null,
    stats: getStats(db),
    secrets: {
      count: secretFindings.length,
      findings: secretFindings
    },
    hasSecrets: secretFindings.length > 0,
    stale: { count: stale.count },
    neverRecalled: { count: neverRecalled.count },
    duplicates: {
      clusters: duplicates.clusters.length,
      totalDuplicates: duplicates.totalDuplicates
    },
    unresolvedContradictions,
    dbSizeBytes,
    encrypted
  };
}
