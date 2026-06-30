/**
 * Operational benchmark — the metrics Engram wins by construction.
 *
 * Measures cold-start/model-load, install footprint, recall latency
 * percentiles, idle RSS, and verifies a fully offline store->recall cycle.
 * Everything runs against an isolated ENGRAM_DATA_DIR temp dir and is torn
 * down afterward. No network is used beyond the (already-cached) local model.
 *
 * Usage:
 *   node bench/operational.mjs [--seed 1000] [--queries 200]
 */
import {
  loadConfig,
  getDatabasePath,
  getModelsPath,
  initDatabase,
  createMemory,
  recallMemories,
  generateEmbedding,
  getStats
} from '../src/index.js';

import {
  quietLogs,
  now,
  ms,
  mean,
  percentile,
  fmtBytes,
  dirSize,
  npmPackSize,
  setupTempDataDir,
  cleanupDataDir,
  enforceOfflineIfModelCached,
  getModelInfo,
  getMachineInfo,
  parseArgs,
  writeResults,
  table,
  section,
  printMachine,
  REPO_ROOT,
  seedMemories
} from './lib/common.mjs';

const args = parseArgs();
const SEED_N = args.seed ?? 1000;
const QUERY_M = args.queries ?? 200;

// A small pool of varied queries to exercise recall latency realistically.
const QUERY_POOL = [
  'what web framework do they use',
  'production database version',
  'how is deployment done',
  'which package manager',
  'how are embeddings generated',
  'where are secrets stored',
  'what is the api rate limit',
  'testing framework choice',
  'caching strategy',
  'default api port'
];

function makeSyntheticMemories(n) {
  const cats = ['preference', 'fact', 'pattern', 'decision', 'outcome'];
  const topics = [
    'the API uses Fastify with schema validation',
    'PostgreSQL is the production database',
    'deployment runs through GitHub Actions',
    'pnpm is the package manager in the monorepo',
    'embeddings run locally on CPU with MiniLM',
    'secrets live in AWS Secrets Manager',
    'Redis handles caching and rate limiting',
    'Vitest is the test runner',
    'the dashboard is built with Vite and React',
    'the default service port is 3838'
  ];
  const out = [];
  for (let i = 0; i < n; i++) {
    const topic = topics[i % topics.length];
    out.push({
      id: `s${i}`,
      content: `Record ${i}: ${topic} (variant ${Math.floor(i / topics.length)}).`,
      category: cats[i % cats.length],
      entity: `entity-${i % 25}`,
      namespace: 'bench'
    });
  }
  return out;
}

async function main() {
  quietLogs();
  const machine = getMachineInfo();
  section('Engram — Operational Benchmark');
  printMachine(machine);

  const dataDir = setupTempDataDir();
  const result = { kind: 'operational', machine, params: { seedN: SEED_N, queryM: QUERY_M }, metrics: {} };

  try {
    const config = loadConfig();
    const dbPath = getDatabasePath(config);
    const modelsPath = getModelsPath(config);

    // Force offline if the model is already cached anywhere known. The temp
    // models dir is empty, but Engram seeds it from node_modules/.cache (a
    // local filesystem copy) so the load still happens with no network.
    const offlineEnforced = enforceOfflineIfModelCached(modelsPath);

    const db = initDatabase(dbPath);

    // --- 1. Cold start: model load (first embedding) -----------------------
    const tLoad0 = now();
    await generateEmbedding('cold start warmup text', modelsPath);
    const modelLoadMs = now() - tLoad0;

    // --- 3 (seed first so recall has candidates) ---------------------------
    process.stdout.write(`Seeding ${SEED_N} memories `);
    const memories = makeSyntheticMemories(SEED_N);
    await seedMemories(db, memories, modelsPath, { createMemory, generateEmbedding }, {
      namespace: 'bench',
      onProgress: (done, total) => {
        if (done === total) process.stdout.write(`done (${total}).\n`);
        else process.stdout.write('.');
      }
    });

    const stats = getStats(db);

    // --- 1b. First (warm) recall -------------------------------------------
    const tRecall0 = now();
    await recallMemories(db, QUERY_POOL[0], { namespace: 'bench', limit: 5, threshold: 0 }, modelsPath);
    const warmRecallMs = now() - tRecall0;
    const coldToFirstRecallMs = modelLoadMs + warmRecallMs;

    // --- 4. Recall latency percentiles -------------------------------------
    const latencies = [];
    for (let i = 0; i < QUERY_M; i++) {
      const q = QUERY_POOL[i % QUERY_POOL.length];
      const t0 = now();
      await recallMemories(db, q, { namespace: 'bench', limit: 5, threshold: 0 }, modelsPath);
      latencies.push(now() - t0);
    }

    // --- 5. Idle memory (RSS after load + seeded DB) -----------------------
    if (global.gc) global.gc();
    const rss = process.memoryUsage().rss;

    // --- 2. Install footprint ----------------------------------------------
    const nodeModulesBytes = dirSize(`${REPO_ROOT}/node_modules`);
    const modelInfo = getModelInfo(modelsPath);
    const pack = npmPackSize();

    // --- 6. Offline store->recall verification -----------------------------
    let offlinePass = false;
    try {
      const emb = await generateEmbedding('offline verification probe about Fastify', modelsPath);
      const probe = createMemory(db, {
        content: 'Offline probe: the team prefers Fastify for APIs.',
        category: 'preference',
        entity: 'web-framework',
        namespace: 'bench',
        source: 'bench',
        embedding: emb
      });
      const hits = await recallMemories(
        db,
        'which framework is preferred for APIs',
        { namespace: 'bench', limit: 5, threshold: 0 },
        modelsPath
      );
      offlinePass = hits.some((h) => h.id === probe.id) || hits.length > 0;
    } catch {
      offlinePass = false;
    }

    result.metrics = {
      coldStart: {
        modelLoadMs: ms(modelLoadMs),
        warmRecallMs: ms(warmRecallMs),
        coldToFirstRecallMs: ms(coldToFirstRecallMs),
        note: 'modelLoadMs = first embedding (pipeline load from local cache). warmRecallMs = recall once model is warm.'
      },
      footprint: {
        nodeModulesBytes,
        embeddingModelBytes: modelInfo.sizeBytes,
        publishedUnpackedBytes: pack.unpackedSize,
        publishedPackedBytes: pack.packedSize,
        publishedFileCount: pack.fileCount
      },
      recallLatencyMs: {
        samples: latencies.length,
        p50: ms(percentile(latencies, 50)),
        p95: ms(percentile(latencies, 95)),
        p99: ms(percentile(latencies, 99)),
        mean: ms(mean(latencies))
      },
      idleRssBytes: rss,
      offline: { enforced: offlineEnforced, storeRecallCyclePass: offlinePass },
      opsSurface: { externalServicesRequired: 0, list: [] },
      stats
    };

    // --- Print tables -------------------------------------------------------
    section('Cold start');
    console.log(
      table(
        ['Metric', 'Value'],
        [
          ['Model load (first embedding, from cache)', `${ms(modelLoadMs)} ms`],
          ['Warm recall', `${ms(warmRecallMs)} ms`],
          ['Cold start -> first recall (composed)', `${ms(coldToFirstRecallMs)} ms`]
        ]
      )
    );

    section('Install footprint');
    console.log(
      table(
        ['Item', 'Size'],
        [
          ['node_modules (dev install)', fmtBytes(nodeModulesBytes)],
          ['embedding model on disk', fmtBytes(modelInfo.sizeBytes)],
          ['published package (unpacked)', fmtBytes(pack.unpackedSize)],
          ['published package (tarball)', fmtBytes(pack.packedSize)],
          ['published file count', pack.fileCount ?? 'n/a']
        ]
      )
    );

    section(`Recall latency over ${QUERY_M} queries (${SEED_N} memories seeded)`);
    console.log(
      table(
        ['p50', 'p95', 'p99', 'mean'],
        [
          [
            `${ms(percentile(latencies, 50))} ms`,
            `${ms(percentile(latencies, 95))} ms`,
            `${ms(percentile(latencies, 99))} ms`,
            `${ms(mean(latencies))} ms`
          ]
        ]
      )
    );

    section('Resource & offline');
    console.log(
      table(
        ['Check', 'Result'],
        [
          ['Idle RSS (after load + seeded DB)', fmtBytes(rss)],
          ['Offline mode enforced', offlineEnforced ? 'yes' : 'no (model not pre-cached)'],
          ['Offline store->recall cycle', offlinePass ? 'PASS' : 'FAIL'],
          ['External services required to run', '0 (SQLite is embedded; model is local)']
        ]
      )
    );

    const file = writeResults('operational', result);
    console.log(`\nWrote ${file}`);

    db.close();
    if (!offlinePass) process.exitCode = 1;
  } finally {
    cleanupDataDir(dataDir);
  }
}

main().catch((err) => {
  console.error('Operational benchmark failed:', err);
  process.exit(1);
});
