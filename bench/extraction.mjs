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
 * Two modes:
 *   - single model:  --model llama3.2:3b           (rule vs that one model)
 *   - SWEEP a ladder: --models qwen3:0.6b,qwen3:1.7b,llama3.2:3b
 *       runs rule + every pulled model with constrained decoding + thinking-off,
 *       prints an entity-match/latency table, and names the SMALLEST model that
 *       meaningfully beats rules on entity (the list is read smallest-first).
 *
 * 100% local: the only LLM is a local Ollama. If Ollama or a model is absent, it
 * prints the rule-based numbers and skips/flags the LLM column with install
 * guidance (never fabricates an improvement).
 *
 * Usage:
 *   node bench/extraction.mjs [--model llama3.2:3b] [--host http://localhost:11434]
 *   node bench/extraction.mjs --models qwen3:0.6b,qwen3:1.7b,llama3.2:3b [--think]
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
  validateArgs,
  loadFixture,
  writeResults,
  table,
  section,
  printMachine
} from './lib/common.mjs';

try {
  validateArgs(process.argv.slice(2), {
    model: 'string',
    models: 'string',
    host: 'string',
    think: 'boolean'
  });
} catch (err) {
  console.error(`Argument error: ${err.message}`);
  process.exit(1);
}

const args = parseArgs();
const HOST = args.host ?? 'http://localhost:11434';
const MODEL = args.model ?? 'llama3.2:3b';
const THINK = !!args.think;
// Sweep ladder, read smallest-first. When set, MODEL is ignored.
const MODELS = args.models
  ? String(args.models)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

// Entity margin (pts) a model must beat rules by to count as "meaningfully better".
const ENTITY_MARGIN = 0.05;
// A model must not regress category accuracy by more than this vs rules — entity
// gains aren't worth trading category away (small models often do exactly that).
const CATEGORY_TOLERANCE = 0.02;

// --- Ollama reachability ---------------------------------------------------
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

/** Fetch the pulled-model list, or null if Ollama is unreachable. */
async function fetchTags() {
  try {
    const tags = await httpJson(`${HOST}/api/tags`, {}, 3000);
    return (tags.models || []).map((m) => m.name);
  } catch {
    return null;
  }
}

const isPulled = (models, m) => models.some((x) => x === m || x.startsWith(`${m}:`));

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

/** Rule-based extraction over every item (always available, no network). */
function runRuleExtractor(items) {
  const scores = [];
  const lat = [];
  for (const item of items) {
    const t0 = now();
    const out = extractMemory(item.content, { source: 'bench' });
    lat.push(now() - t0);
    scores.push(scoreItem(item, out));
  }
  return { agg: aggregate(scores, lat), scores };
}

/**
 * LLM extraction over every item via the real layer (constrained decoding +
 * thinking-off, unless --think). Goes through extractMemoryLLM so what the bench
 * measures is exactly what production does.
 */
async function runLLMExtractor(model, items) {
  const cfg = { llm: { provider: 'ollama', endpoint: HOST, model, think: THINK } };
  const scores = [];
  const lat = [];
  const perItem = [];
  for (const item of items) {
    const t0 = now();
    const out = await extractMemoryLLM(item.content, { source: 'bench' }, cfg);
    lat.push(now() - t0);
    const s = scoreItem(item, out);
    scores.push(s);
    perItem.push({ category: out.category, entity: out.entity, confidence: out.confidence, ...s });
  }
  return { agg: aggregate(scores, lat), perItem };
}

// --- Sweep mode ------------------------------------------------------------
async function runSweep(items, ruleAgg, tags, machine) {
  section('Small-model sweep (constrained decoding + thinking-off)');
  console.log(`Models (smallest-first): ${MODELS.join(', ')} @ ${HOST} | think=${THINK}`);
  if (tags === null) {
    console.log('\nOllama is not reachable — cannot run the sweep. Showing rule-based only.');
  }

  const rows = [['rules', pct(ruleAgg.categoryAccuracy), pct(ruleAgg.entityMatchRate), pct(ruleAgg.confidenceInBand), `${ruleAgg.meanLatencyMs} ms`, '—']];
  const swept = [];
  for (const model of MODELS) {
    if (tags === null || !isPulled(tags, model)) {
      rows.push([model, 'not pulled', '—', '—', '—', tags === null ? 'ollama down' : `ollama pull ${model}`]);
      continue;
    }
    if (model.endsWith(':cloud')) {
      rows.push([model, 'skipped', '—', '—', '—', ':cloud is non-local']);
      continue;
    }
    process.stdout.write(`  running ${model}... `);
    const { agg, perItem } = await runLLMExtractor(model, items);
    process.stdout.write(`entity ${pct(agg.entityMatchRate)} @ ${agg.meanLatencyMs} ms\n`);
    swept.push({ model, agg, perItem });
    rows.push([
      model,
      pct(agg.categoryAccuracy),
      pct(agg.entityMatchRate),
      pct(agg.confidenceInBand),
      `${agg.meanLatencyMs} ms`,
      delta(ruleAgg.entityMatchRate, agg.entityMatchRate)
    ]);
  }

  section('Results');
  console.log(table(['Model', 'Category', 'Entity', 'ConfBand', 'Latency/item', 'Δ entity vs rules'], rows));
  console.log('(Models are read smallest-first; latency is hardware/model-dependent.)');

  // Verdict: the smallest model that (a) beats rules on entity by the margin AND
  // (b) doesn't regress category accuracy. A small model that wins entity but
  // tanks category is NOT a good default.
  section('Verdict');
  const qualifies = (s) =>
    s.agg.entityMatchRate - ruleAgg.entityMatchRate >= ENTITY_MARGIN &&
    s.agg.categoryAccuracy >= ruleAgg.categoryAccuracy - CATEGORY_TOLERANCE;
  const winner = swept.find(qualifies);
  // Models that won entity but were disqualified for regressing category.
  const entityOnly = swept.filter(
    (s) => s.agg.entityMatchRate - ruleAgg.entityMatchRate >= ENTITY_MARGIN && !qualifies(s)
  );
  if (winner) {
    console.log(
      `Recommended default: ${winner.model} — entity ${pct(winner.agg.entityMatchRate)} ` +
        `(${delta(ruleAgg.entityMatchRate, winner.agg.entityMatchRate)} vs rules), category ${pct(winner.agg.categoryAccuracy)} ` +
        `(${delta(ruleAgg.categoryAccuracy, winner.agg.categoryAccuracy)}), at ~${winner.agg.meanLatencyMs} ms/item. ` +
        `It is the smallest model that clears +${(ENTITY_MARGIN * 100).toFixed(0)} pts on entity without regressing category.`
    );
    if (entityOnly.length) {
      console.log(
        `(Skipped ${entityOnly.map((s) => s.model).join(', ')} — entity gain came with a category ` +
          `regression beyond ${(CATEGORY_TOLERANCE * 100).toFixed(0)} pts, not worth the trade.)`
      );
    }
  } else if (entityOnly.length) {
    const best = entityOnly.reduce((a, b) => (b.agg.categoryAccuracy > a.agg.categoryAccuracy ? b : a));
    console.log(
      `No model both beat rules on entity AND held category. ` +
        `Closest was ${best.model} (entity ${pct(best.agg.entityMatchRate)} but category ${pct(best.agg.categoryAccuracy)}, ` +
        `${delta(ruleAgg.categoryAccuracy, best.agg.categoryAccuracy)}). Try a larger model or keep the layer off.`
    );
  } else if (swept.length) {
    const best = swept.reduce((a, b) => (b.agg.entityMatchRate > a.agg.entityMatchRate ? b : a));
    console.log(
      `No model cleared +${(ENTITY_MARGIN * 100).toFixed(0)} pts on entity vs rules. ` +
        `Best was ${best.model} (entity ${pct(best.agg.entityMatchRate)}, ${delta(ruleAgg.entityMatchRate, best.agg.entityMatchRate)}). ` +
        `On this set the rule-based path is hard to beat — keep the LLM layer off or try a larger model.`
    );
  } else {
    console.log('No models were runnable — pull at least one from the ladder and re-run.');
  }

  const file = writeResults('extraction-sweep', {
    kind: 'extraction-sweep',
    machine,
    host: HOST,
    think: THINK,
    entityMargin: ENTITY_MARGIN,
    ladder: MODELS,
    recommended: winner ? winner.model : null,
    aggregate: { rule: ruleAgg, models: swept.map((s) => ({ model: s.model, ...s.agg })) }
  });
  console.log(`\nWrote ${file}`);
}

// --- Single-model mode (rule vs one LLM) -----------------------------------
async function runSingle(items, ruleAgg, ruleScores, tags, machine) {
  const available = tags !== null && isPulled(tags, MODEL) && !MODEL.endsWith(':cloud');
  let skipReason = null;
  if (tags === null) skipReason = `Ollama not reachable at ${HOST}. Install + run it, then: ollama pull ${MODEL}`;
  else if (MODEL.endsWith(':cloud')) skipReason = `Refusing "${MODEL}": ":cloud" models route off-machine — use a local model.`;
  else if (!isPulled(tags, MODEL)) skipReason = `Ollama is up but "${MODEL}" isn't pulled. Run: ollama pull ${MODEL}`;

  let llmAgg = null;
  let perItem = [];
  if (available) {
    console.log(`Running LLM extractor: ${MODEL} @ ${HOST} (temperature 0, think=${THINK})...`);
    const r = await runLLMExtractor(MODEL, items);
    llmAgg = r.agg;
    perItem = r.perItem;
  } else {
    console.log(`\nLLM column SKIPPED — ${skipReason}`);
  }

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

  // Per-item join (rule + llm) for the result file.
  const detail = items.map((item, i) => ({
    id: item.id,
    expected_category: item.expected_category,
    rule: { ...ruleScores[i] },
    llm: perItem[i] ?? null
  }));

  const file = writeResults('extraction', {
    kind: 'extraction',
    machine,
    model: MODEL,
    host: HOST,
    think: THINK,
    llmAvailable: !!llmAgg,
    llmSkipReason: llmAgg ? null : skipReason,
    aggregate: { rule: ruleAgg, llm: llmAgg },
    perItem: detail
  });
  console.log(`\nWrote ${file}`);
}

async function main() {
  quietLogs();
  const machine = getMachineInfo();
  section('Engram — Extraction-Quality Benchmark (rule-based vs local LLM)');
  printMachine(machine);

  const fixture = loadFixture('extraction-set.json');
  const items = fixture.items;
  console.log(`${items.length} labeled items.`);

  const { agg: ruleAgg, scores: ruleScores } = runRuleExtractor(items);
  const tags = await fetchTags();

  if (MODELS) {
    await runSweep(items, ruleAgg, tags, machine);
  } else {
    await runSingle(items, ruleAgg, ruleScores, tags, machine);
  }
}

main().catch((err) => {
  console.error('Extraction benchmark failed:', err);
  process.exit(1);
});
