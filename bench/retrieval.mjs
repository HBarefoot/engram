/**
 * Retrieval-quality benchmark — precision/recall of the hybrid scorer on a
 * labeled set. No LLM involved; deterministic given the fixture and model, so
 * it doubles as a CI regression guard.
 *
 * Metrics (per query, then averaged): recall@k, precision@k, MRR, nDCG@k.
 *
 * Usage:
 *   node bench/retrieval.mjs [--k 5] [--threshold 0] [--min-mrr 0.7] [--min-recall 0.8]
 * Exits non-zero if --min-mrr / --min-recall thresholds are not met.
 */
import {
  loadConfig,
  getDatabasePath,
  getModelsPath,
  initDatabase,
  createMemory,
  recallMemories,
  generateEmbedding
} from '../src/index.js';

import {
  quietLogs,
  mean,
  setupTempDataDir,
  cleanupDataDir,
  enforceOfflineIfModelCached,
  getMachineInfo,
  parseArgs,
  loadFixture,
  writeResults,
  table,
  section,
  printMachine,
  seedMemories
} from './lib/common.mjs';

const args = parseArgs();
const K = args.k ?? 5;
const THRESHOLD = args.threshold ?? 0; // 0 = measure pure ranking quality at k
const MIN_MRR = args.minMrr ?? null;
const MIN_RECALL = args.minRecall ?? null;

function dcg(relevances) {
  // relevances: array of 0/1 in ranked order
  return relevances.reduce((sum, rel, i) => sum + rel / Math.log2(i + 2), 0);
}

function scoreQuery(rankedIds, relevantSet, k) {
  const topK = rankedIds.slice(0, k);
  const relInTopK = topK.filter((id) => relevantSet.has(id));
  const totalRelevant = relevantSet.size;

  const recall = totalRelevant ? relInTopK.length / totalRelevant : 0;
  const precision = k ? relInTopK.length / k : 0;

  // MRR: reciprocal rank of the first relevant hit within top-k
  let rr = 0;
  for (let i = 0; i < topK.length; i++) {
    if (relevantSet.has(topK[i])) {
      rr = 1 / (i + 1);
      break;
    }
  }

  // nDCG@k with binary relevance
  const gains = topK.map((id) => (relevantSet.has(id) ? 1 : 0));
  const ideal = Array.from({ length: Math.min(totalRelevant, k) }, () => 1);
  const idcg = dcg(ideal);
  const ndcg = idcg ? dcg(gains) / idcg : 0;

  return { recall, precision, rr, ndcg, relInTopK: relInTopK.length, totalRelevant };
}

async function main() {
  quietLogs();
  const machine = getMachineInfo();
  section('Engram — Retrieval-Quality Benchmark');
  printMachine(machine);
  console.log(`k=${K}, threshold=${THRESHOLD}`);

  const fixture = loadFixture('retrieval-set.json');
  const dataDir = setupTempDataDir();

  try {
    const config = loadConfig();
    const dbPath = getDatabasePath(config);
    const modelsPath = getModelsPath(config);
    enforceOfflineIfModelCached(modelsPath);

    const db = initDatabase(dbPath);

    process.stdout.write(`Seeding ${fixture.memories.length} labeled memories... `);
    const idMap = await seedMemories(db, fixture.memories, modelsPath, {
      createMemory,
      generateEmbedding
    });
    process.stdout.write('done.\n');

    const perQuery = [];
    for (const q of fixture.queries) {
      const relevantDbIds = new Set(
        (q.relevant_ids || []).map((fid) => idMap.get(fid)).filter(Boolean)
      );
      const results = await recallMemories(
        db,
        q.query,
        { namespace: 'bench', limit: K, threshold: THRESHOLD },
        modelsPath
      );
      const rankedIds = results.map((r) => r.id);
      const s = scoreQuery(rankedIds, relevantDbIds, K);
      perQuery.push({ id: q.id, query: q.query, ...s });
    }

    const agg = {
      recallAtK: mean(perQuery.map((p) => p.recall)),
      precisionAtK: mean(perQuery.map((p) => p.precision)),
      mrr: mean(perQuery.map((p) => p.rr)),
      ndcgAtK: mean(perQuery.map((p) => p.ndcg))
    };

    // Per-query table
    section('Per-query results');
    console.log(
      table(
        ['query', 'rel/total', 'R@k', 'P@k', 'RR', 'nDCG'],
        perQuery.map((p) => [
          p.id,
          `${p.relInTopK}/${p.totalRelevant}`,
          p.recall.toFixed(2),
          p.precision.toFixed(2),
          p.rr.toFixed(2),
          p.ndcg.toFixed(2)
        ])
      )
    );

    section(`Aggregate (n=${perQuery.length} queries, k=${K})`);
    console.log(
      table(
        [`recall@${K}`, `precision@${K}`, 'MRR', `nDCG@${K}`],
        [
          [
            agg.recallAtK.toFixed(3),
            agg.precisionAtK.toFixed(3),
            agg.mrr.toFixed(3),
            agg.ndcgAtK.toFixed(3)
          ]
        ]
      )
    );

    const result = {
      kind: 'retrieval',
      machine,
      params: { k: K, threshold: THRESHOLD, minMrr: MIN_MRR, minRecall: MIN_RECALL },
      aggregate: agg,
      perQuery
    };
    const file = writeResults('retrieval', result);
    console.log(`\nWrote ${file}`);

    db.close();

    // CI gating
    const failures = [];
    if (MIN_MRR != null && agg.mrr < MIN_MRR) {
      failures.push(`MRR ${agg.mrr.toFixed(3)} < min ${MIN_MRR}`);
    }
    if (MIN_RECALL != null && agg.recallAtK < MIN_RECALL) {
      failures.push(`recall@${K} ${agg.recallAtK.toFixed(3)} < min ${MIN_RECALL}`);
    }
    if (failures.length) {
      console.error(`\nFAIL (regression gate):\n  - ${failures.join('\n  - ')}`);
      process.exit(1);
    } else if (MIN_MRR != null || MIN_RECALL != null) {
      console.log('\nPASS (regression gate met).');
    }
  } finally {
    cleanupDataDir(dataDir);
  }
}

main().catch((err) => {
  console.error('Retrieval benchmark failed:', err);
  process.exit(1);
});
