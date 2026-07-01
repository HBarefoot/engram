import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { initDatabase, createMemory, getStats } from '../../src/memory/store.js';
import { recordFeedback } from '../../src/memory/feedback.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '../../bin/engram.js');

/** Run the CLI against a data dir and resolve with {code, stdout, stderr}. */
function runCli(args, dataDir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      env: { ...process.env, ENGRAM_DATA_DIR: dataDir, ENGRAM_NO_BANNER: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function backupFiles(dataDir) {
  return readdirSync(dataDir).filter((f) => f.includes('.engram-backup-'));
}

describe('engram purge (CLI)', () => {
  let dataDir;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'engram-purge-'));
    // Seed directly (no embeddings) into the data dir the CLI will open.
    const db = initDatabase(join(dataDir, 'memory.db'));
    createMemory(db, { content: 'alpha one', namespace: 'alpha' });
    const withFb = createMemory(db, { content: 'alpha two', namespace: 'alpha' });
    createMemory(db, { content: 'beta one', namespace: 'beta' });
    recordFeedback(db, withFb.id, true);
    db.close();
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('dry-run (no --yes) deletes nothing and writes no backup', async () => {
    const { code, stdout } = await runCli(['purge', '--namespace', 'alpha'], dataDir);
    expect(code).toBe(0);
    expect(stdout).toMatch(/DRY RUN/);

    const db = initDatabase(join(dataDir, 'memory.db'));
    expect(getStats(db).total).toBe(3);
    db.close();
    expect(backupFiles(dataDir)).toHaveLength(0);
  });

  it('--yes deletes only the target namespace, backs up, cascades feedback', async () => {
    const { code, stdout } = await runCli(['purge', '--namespace', 'alpha', '--yes'], dataDir);
    expect(code).toBe(0);
    expect(stdout).toMatch(/Deleted 2 memories/);

    const db = initDatabase(join(dataDir, 'memory.db'));
    const stats = getStats(db);
    expect(stats.total).toBe(1);            // only beta survives
    expect(stats.byNamespace.beta).toBe(1);
    expect(stats.byNamespace.alpha).toBeUndefined();
    // memory_feedback rows cascade with their memory
    const fb = db.prepare('SELECT COUNT(*) AS n FROM memory_feedback').get().n;
    expect(fb).toBe(0);
    db.close();

    expect(backupFiles(dataDir)).toHaveLength(1);
  });

  it('--project is an alias for --namespace', async () => {
    const { stdout } = await runCli(['purge', '--project', 'beta'], dataDir);
    expect(stdout).toMatch(/would delete 1 memory .*beta/);
  });

  it('errors when no target selector is given', async () => {
    const { code, stderr } = await runCli(['purge'], dataDir);
    expect(code).toBe(1);
    expect(stderr).toMatch(/Specify a target/);
  });
});

describe('engram audit (CLI)', () => {
  let dataDir;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'engram-audit-cli-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('exits 0 on a clean store', async () => {
    const db = initDatabase(join(dataDir, 'memory.db'));
    createMemory(db, { content: 'nothing sensitive here' });
    db.close();

    const { code, stdout } = await runCli(['audit'], dataDir);
    expect(code).toBe(0);
    expect(stdout).toMatch(/Secrets/);
  });

  it('exits non-zero when a stored memory contains a secret', async () => {
    const db = initDatabase(join(dataDir, 'memory.db'));
    createMemory(db, { content: `token sk-${'a'.repeat(40)}` });
    db.close();

    const { code, stdout } = await runCli(['audit', '--json'], dataDir);
    expect(code).toBe(2);
    const report = JSON.parse(stdout);
    expect(report.hasSecrets).toBe(true);
    expect(report.secrets.count).toBe(1);
  });

  it('--fix redacts secrets in place and then exits clean', async () => {
    const db = initDatabase(join(dataDir, 'memory.db'));
    createMemory(db, { content: `token sk-${'a'.repeat(40)}` });
    db.close();

    const fix = await runCli(['audit', '--fix'], dataDir);
    expect(fix.code).toBe(0);
    expect(fix.stdout).toMatch(/Redacted secrets in 1 memory/);

    // Re-audit: now clean.
    const recheck = await runCli(['audit', '--json'], dataDir);
    expect(recheck.code).toBe(0);
    expect(JSON.parse(recheck.stdout).hasSecrets).toBe(false);
    expect(backupFiles(dataDir)).toHaveLength(1);
  });
});
