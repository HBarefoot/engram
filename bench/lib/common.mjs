/**
 * Shared helpers for the Engram benchmark suite.
 *
 * Everything here is plain Node ESM. Benchmarks import Engram's *public* API
 * from ../../src/index.js (plus a couple of read-only helpers from the embed
 * module) and never touch src/ logic. All runs are isolated to a throwaway
 * data dir via ENGRAM_DATA_DIR so the user's real ~/.engram is never touched.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

import { logger } from '../../src/index.js';
import { isModelAvailable, getModelInfo } from '../../src/embed/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the repo root (bench/lib -> ../../). */
export const REPO_ROOT = path.resolve(__dirname, '../..');
/** Absolute path to bench/results. */
export const RESULTS_DIR = path.resolve(__dirname, '../results');
/** Absolute path to bench/fixtures. */
export const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

/** Silence Engram's INFO/WARN chatter so benchmark tables are readable. */
export function quietLogs() {
  try {
    logger.setLogLevel(logger.LOG_LEVELS.ERROR);
  } catch {
    /* older logger shape — ignore */
  }
}

/** High-resolution clock in ms. */
export const now = () => performance.now();

/**
 * Create an isolated throwaway data dir and point Engram at it via
 * ENGRAM_DATA_DIR. Returns the path. Registers a process `exit` hook so the dir
 * is removed even when a script calls process.exit() (which bypasses finally),
 * e.g. the retrieval CI gate. Callers may still call cleanupDataDir() for an
 * immediate teardown — it is idempotent.
 */
export function setupTempDataDir(prefix = 'engram-bench-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.ENGRAM_DATA_DIR = dir;
  process.once('exit', () => cleanupDataDir(dir));
  return dir;
}

/** Remove a temp data dir (best-effort). */
export function cleanupDataDir(dir) {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

/**
 * If the embedding model is already cached on disk, force the transformers
 * stack into offline mode so the whole run is provably network-free. Returns
 * true when offline mode was enforced (i.e. model was available locally).
 */
export function enforceOfflineIfModelCached(modelsPath) {
  const available = isModelAvailable(modelsPath)?.available;
  if (available) {
    process.env.TRANSFORMERS_OFFLINE = '1';
    process.env.HF_HUB_OFFLINE = '1';
    return true;
  }
  return false;
}

/** Re-export so scripts can report model status without re-importing embed. */
export { getModelInfo, isModelAvailable };

/** Machine context, reported in every result file for honesty. */
export function getMachineInfo() {
  const cpus = os.cpus() || [];
  return {
    cpu: cpus[0]?.model?.trim() || 'unknown',
    cores: cpus.length,
    arch: os.arch(),
    platform: os.platform(),
    osRelease: os.release(),
    totalRamGB: +(os.totalmem() / 1024 ** 3).toFixed(1),
    node: process.version,
    timestamp: new Date().toISOString()
  };
}

/**
 * Minimal CLI flag parser. Supports `--flag value`, `--flag=value`, and bare
 * boolean `--flag`. Numeric-looking values are coerced to numbers.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    let key = tok.slice(2);
    let val;
    if (key.includes('=')) {
      [key, val] = key.split(/=(.*)/s);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      val = argv[++i];
    } else {
      val = true;
    }
    if (typeof val === 'string' && val !== '' && !Number.isNaN(Number(val))) {
      val = Number(val);
    }
    out[camel(key)] = val;
  }
  return out;
}

function camel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function dash(s) {
  return s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

/**
 * Strictly validate the raw argv against an allowlist spec, throwing on anything
 * unexpected. This is the "fail loud" guard: a bare positional, an unknown flag,
 * or a boolean flag that swallowed a value (e.g. `--judge qwen3.5:9b`, which used
 * to silently leave --model on its default and mask a model swap) all error out
 * instead of degrading quietly.
 *
 * @param {string[]} argv - raw args (process.argv.slice(2))
 * @param {Object<string,'string'|'number'|'boolean'>} spec - camelCase flag -> type
 */
export function validateArgs(argv, spec) {
  const known = new Map(); // dash-flag -> type
  for (const [k, type] of Object.entries(spec)) known.set(dash(k), type);
  const knownList = [...known.keys()].map((f) => `--${f}`).join(', ');

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) {
      throw new Error(`Unexpected argument "${tok}". Expected a --flag. Known flags: ${knownList}`);
    }
    let flag = tok.slice(2);
    let inlineVal;
    if (flag.includes('=')) [flag, inlineVal] = flag.split(/=(.*)/s);

    const type = known.get(flag);
    if (type === undefined) {
      throw new Error(`Unknown argument "--${flag}". Known flags: ${knownList}`);
    }

    if (type === 'boolean') {
      if (inlineVal !== undefined) {
        throw new Error(`--${flag} is a boolean flag and takes no value (got "${inlineVal}").`);
      }
      // A following non-flag token means the value was meant for a different
      // flag (the classic --judge <model> mistake). Fail instead of swallowing.
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        throw new Error(
          `--${flag} is a boolean flag and takes no value (got "${argv[i + 1]}"). ` +
            `Did you mean to attach that value to a different flag?`
        );
      }
    } else if (inlineVal === undefined) {
      // value-taking flag: must be followed by a value
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
        throw new Error(`--${flag} expects a value.`);
      }
      i++; // consume the value token
    }
  }
}

/** Percentile (p in 0..100) of a numeric array (not required pre-sorted). */
export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Human-readable bytes. */
export function fmtBytes(n) {
  if (n == null) return 'n/a';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

/** Round ms to 2 decimals. */
export const ms = (x) => +x.toFixed(2);

/**
 * Directory size in bytes. Uses `du -sk` when available (fast), falls back to
 * a recursive walk (e.g. on platforms without du).
 */
export function dirSize(target) {
  if (!fs.existsSync(target)) return 0;
  try {
    const out = execFileSync('du', ['-sk', target], { encoding: 'utf-8' });
    const kb = parseInt(out.split(/\s+/)[0], 10);
    if (!Number.isNaN(kb)) return kb * 1024;
  } catch {
    /* fall through to JS walk */
  }
  let total = 0;
  const walk = (p) => {
    let entries;
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) walk(fp);
      else {
        try {
          total += fs.statSync(fp).size;
        } catch {
          /* skip */
        }
      }
    }
  };
  walk(target);
  return total;
}

/**
 * Published-package unpacked + tarball size via `npm pack --dry-run --json`.
 * Returns { unpackedSize, packedSize } in bytes, or nulls on failure.
 */
export function npmPackSize() {
  try {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const arr = JSON.parse(out);
    const pkg = Array.isArray(arr) ? arr[0] : arr;
    return {
      unpackedSize: pkg?.unpackedSize ?? null,
      packedSize: pkg?.size ?? null,
      fileCount: pkg?.entryCount ?? null
    };
  } catch {
    return { unpackedSize: null, packedSize: null, fileCount: null };
  }
}

/**
 * Seed a fresh DB with fixture memories, generating a real embedding for each
 * (mirrors what the MCP remember handler does before createMemory). Returns a
 * Map of fixture stable-id -> generated db id so labeled queries can be scored.
 *
 * @param {object} deps - { createMemory, generateEmbedding }
 */
export async function seedMemories(db, memories, modelsPath, deps, opts = {}) {
  const { createMemory, generateEmbedding } = deps;
  const { namespace = 'bench', source = 'bench', onProgress } = opts;
  const idMap = new Map();
  for (let i = 0; i < memories.length; i++) {
    const m = memories[i];
    const embedding = await generateEmbedding(m.content, modelsPath);
    const created = createMemory(db, {
      content: m.content,
      entity: m.entity ?? null,
      category: m.category ?? 'fact',
      confidence: m.confidence ?? 0.8,
      namespace: m.namespace ?? namespace,
      tags: m.tags ?? [],
      source,
      embedding
    });
    if (m.id) idMap.set(m.id, created.id);
    if (onProgress && (i % 100 === 0 || i === memories.length - 1)) {
      onProgress(i + 1, memories.length);
    }
  }
  return idMap;
}

/** Load a JSON fixture from bench/fixtures. */
export function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8'));
}

/** Write a timestamped result file into bench/results and return its path. */
export function writeResults(name, payload) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(RESULTS_DIR, `${name}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

/**
 * Render a simple aligned ASCII table. headers: string[]; rows: string[][].
 */
export function table(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length))
  );
  const line = (cells) =>
    '| ' + cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' | ') + ' |';
  const sep = '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|';
  return [line(headers), sep, ...rows.map(line)].join('\n');
}

/** Print a labeled section header. */
export function section(title) {
  console.log(`\n${'='.repeat(64)}\n${title}\n${'='.repeat(64)}`);
}

/** Print the machine block. */
export function printMachine(info) {
  console.log(
    `Machine: ${info.cpu} | ${info.cores} cores | ${info.arch}/${info.platform} | ` +
      `${info.totalRamGB} GB RAM | Node ${info.node}`
  );
}
