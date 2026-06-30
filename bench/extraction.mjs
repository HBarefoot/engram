/**
 * Extraction-quality benchmark — rule-based vs optional local LLM.
 *
 * The retrieval benchmark feeds GOLD category/entity into the store and measures
 * the recall scorer, which the LLM layer never touches — so it shows no delta
 * with Ollama on. THIS benchmark measures what the LLM layer actually changes:
 * turning raw text into the right category / entity / confidence.
 *
 * For each labeled item it runs both extractors and scores category accuracy,
 * entity match rate, confidence calibration, and latency — per mode + delta.
 *
 * 100% local: the only LLM is a local Ollama. If Ollama or the pinned model is
 * absent, it prints the rule-based numbers and skips the LLM column with install
 * guidance (never fabricates an improvement).
 *
 * Usage:
 *   node bench/extraction.mjs [--model llama3.2:3b] [--host http://localhost:11434]
 */
import { extractMemory } from '../src/extract/rules.js';
import { extractMemoryLLM } from '../src/extract/llm.js';

import {
  quietLogs,
  now,
  ms,
  mean,
  getMachineInfo,
  parseArgs,
  loadFixture,
  writeResults,
  table,
  section,
  printMachine
} from './lib/common.mjs';

const args = parseArgs();
const HOST = args.host ?? 'http://localhost:11434';
const MODEL = args.model ?? 'llama3.2:3b';

// --- Ollama reachability (mirrors bench/e2e-ollama.mjs) --------------------
async function httpJson(url, opts = {}, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function checkOllama() {
  if (MODEL.endsWith(':cloud')) {
    return { available: false, reason: `Refusing "${MODEL}": ":cloud" models route off-machine — use a local model.` };
  }
  let tags;
  try {
    tags = await httpJson(`${HOST}/api/tags`, {}, 3000);
  } catch {
    return {
      available: false,
      reason:
        `Ollama not reachable at ${HOST}. Install + run it, then: ollama pull ${MODEL}\n` +
        '   (brew install ollama / https://ollama.com/download)'
    };
  }
  const models = (tags.models || []).map((m) => m.name);
  const hasModel = models.some((m) => m === MODEL || m.startsWith(`${MODEL}:`));
  if (!hasModel) {
    return {
      available: false,
      reason: `Ollama is up but "${MODEL}" isn't pulled. Run: ollama pull ${MODEL}\n   Pulled: ${models.join(', ') || '(none)'}`
    };
  }
  return { available: true };
}

// --- Scoring helpers -------------------------------------------------------
/** Normalize an entity for matching: lowercase, strip all non-alphanumerics. */
function normEntity(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Entity match: normalized exact match against any acceptable alias, OR a
 * substring hit in either direction when the shorter side is >= 3 chars (so
 * "next.js" ~ "nextjs", "stripe billing" ~ "stripe", without "go" matching
 * "google").
 */
function entityMatches(extracted, acceptable) {
  const e = normEntity(extracted);
  if (!e) return false;
  return (acceptable || []).some((a) => {
    const n = normEntity(a);
    if (!n) return false;
    if (e === n) return true;
    const shorter = e.length <= n.length ? e : n;
    return shorter.length >= 3 && (e.includes(n) || n.includes(e));
  });
}

function scoreItem(item, out) {
  const categoryCorrect = out.category === item.expected_category;
  const entityCorrect = entityMatches(out.entity, item.acceptable_entities);
  let confInBand = null;
  if (Array.isArray(item.confidence_band)) {
    const [lo, hi] = item.confidence_band;
    confInBand = typeof out.confidence === 'number' && out.confidence >= lo && out.confidence <= hi;
  }
  return { categoryCorrect, entityCorrect, confInBand };
}

function aggregate(scores, latencies) {
  const n = scores.length;
  const withBand = scores.filter((s) => s.confInBand !== null);
  return {
    n,
    categoryAccuracy: n ? scores.filter((s) => s.categoryCorrect).length / n : 0,
    entityMatchRate: n ? scores.filter((s) => s.entityCorrect).length / n : 0,
    confidenceInBand: withBand.length ? withBand.filter((s) => s.confInBand).length / withBand.length : null,
    confidenceSampled: withBand.length,
    meanLatencyMs: ms(mean(latencies))
  };
}

const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const delta = (a, b) => (a === null || b === null ? 'n/a' : `${b - a >= 0 ? '+' : ''}${((b - a) * 100).toFixed(1)} pts`);

async function main() {
  quietLogs();
  const machine = getMachineInfo();
  section('Engram — Extraction-Quality Benchmark (rule-based vs local LLM)');
  printMachine(machine);

  const fixture = loadFixture('extraction-set.json');
  const items = fixture.items;
  console.log(`${items.length} labeled items.`);

  const ollama = await checkOllama();
  const llmConfig = { llm: { provider: 'ollama', endpoint: HOST, model: MODEL } };

  // --- Rule-based (always) -------------------------------------------------
  const ruleScores = [];
  const ruleLat = [];
  const perItem = [];
  for (const item of items) {
    const t0 = now();
    const out = extractMemory(item.content, { source: 'bench' });
    ruleLat.push(now() - t0);
    const s = scoreItem(item, out);
    ruleScores.push(s);
    perItem.push({
      id: item.id,
      expected_category: item.expected_category,
      rule: { category: out.category, entity: out.entity, confidence: out.confidence, ...s }
    });
  }

  // --- LLM (only if available) --------------------------------------------
  let llmScores = null;
  let llmLat = [];
  if (ollama.available) {
    console.log(`Running LLM extractor: ${MODEL} @ ${HOST} (temperature 0)...`);
    llmScores = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const t0 = now();
      const out = await extractMemoryLLM(item.content, { source: 'bench' }, llmConfig);
      llmLat.push(now() - t0);
      const s = scoreItem(item, out);
      llmScores.push(s);
      perItem[i].llm = { category: out.category, entity: out.entity, confidence: out.confidence, ...s };
    }
  } else {
    console.log(`\nLLM column SKIPPED — ${ollama.reason}`);
  }

  const ruleAgg = aggregate(ruleScores, ruleLat);
  const llmAgg = llmScores ? aggregate(llmScores, llmLat) : null;

  // --- Table ---------------------------------------------------------------
  section('Results');
  const llmCell = (v) => (llmAgg ? v : 'skipped');
  console.log(
    table(
      ['Metric', 'Rule-based', 'LLM', 'Δ (LLM − rule)'],
      [
        ['Category accuracy', pct(ruleAgg.categoryAccuracy), llmCell(pct(llmAgg?.categoryAccuracy ?? null)), llmAgg ? delta(ruleAgg.categoryAccuracy, llmAgg.categoryAccuracy) : 'n/a'],
        ['Entity match rate', pct(ruleAgg.entityMatchRate), llmCell(pct(llmAgg?.entityMatchRate ?? null)), llmAgg ? delta(ruleAgg.entityMatchRate, llmAgg.entityMatchRate) : 'n/a'],
        [`Confidence in band (n=${ruleAgg.confidenceSampled})`, pct(ruleAgg.confidenceInBand), llmCell(pct(llmAgg?.confidenceInBand ?? null)), llmAgg ? delta(ruleAgg.confidenceInBand, llmAgg.confidenceInBand) : 'n/a'],
        ['Mean latency / item', `${ruleAgg.meanLatencyMs} ms`, llmCell(llmAgg ? `${llmAgg.meanLatencyMs} ms` : null), llmAgg ? `${(llmAgg.meanLatencyMs - ruleAgg.meanLatencyMs).toFixed(1)} ms` : 'n/a']
      ]
    )
  );
  console.log('(Latency is hardware/model-dependent; the LLM path is expected to be far slower.)');

  // --- Honest verdict ------------------------------------------------------
  section('Verdict');
  if (!llmAgg) {
    console.log(
      `Rule-based only: category ${pct(ruleAgg.categoryAccuracy)}, entity ${pct(ruleAgg.entityMatchRate)}. ` +
        `Enable the LLM column by pulling the model:  ollama pull ${MODEL}`
    );
  } else {
    const dCat = llmAgg.categoryAccuracy - ruleAgg.categoryAccuracy;
    const dEnt = llmAgg.entityMatchRate - ruleAgg.entityMatchRate;
    const verdicts = [];
    verdicts.push(
      dCat > 0.01 ? `improves category accuracy by ${(dCat * 100).toFixed(1)} pts` : dCat < -0.01 ? `HURTS category accuracy by ${(-dCat * 100).toFixed(1)} pts` : 'is roughly even on category'
    );
    verdicts.push(
      dEnt > 0.01 ? `improves entity match by ${(dEnt * 100).toFixed(1)} pts` : dEnt < -0.01 ? `HURTS entity match by ${(-dEnt * 100).toFixed(1)} pts` : 'is roughly even on entity'
    );
    const net = dCat + dEnt > 0.02 ? 'On this set the local LLM earns its keep.' : dCat + dEnt < -0.02 ? 'On this set the local LLM is NOT worth it.' : 'On this set the local LLM is roughly a wash.';
    console.log(`The ${MODEL} extractor ${verdicts.join(' and ')}, at ~${llmAgg.meanLatencyMs} ms/item vs ${ruleAgg.meanLatencyMs} ms. ${net}`);
  }

  const file = writeResults('extraction', {
    kind: 'extraction',
    machine,
    model: MODEL,
    host: HOST,
    llmAvailable: !!llmAgg,
    llmSkipReason: llmAgg ? null : ollama.reason,
    aggregate: { rule: ruleAgg, llm: llmAgg },
    perItem
  });
  console.log(`\nWrote ${file}`);
}

main().catch((err) => {
  console.error('Extraction benchmark failed:', err);
  process.exit(1);
});
