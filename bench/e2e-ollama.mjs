/**
 * End-to-end benchmark — answer accuracy when a LOCAL LLM consumes Engram's
 * recalled context. 100% local: the only model is a local Ollama instance.
 *
 * If Ollama is not reachable, or the requested model is not pulled, this prints
 * friendly install/pull guidance and exits 0 — it never fails the suite just
 * because the optional local LLM is absent.
 *
 * Usage:
 *   node bench/e2e-ollama.mjs [--model llama3.2:3b] [--k 5] [--judge] [--host http://localhost:11434]
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
  now,
  ms,
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
const HOST = args.host ?? 'http://localhost:11434';
const MODEL = args.model ?? 'llama3.2:3b';
const K = args.k ?? 5;
const SEED = args.seed ?? 42;
const USE_JUDGE = !!args.judge;

async function httpJson(url, opts = {}, timeoutMs = 120000) {
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

async function ollamaReachable() {
  try {
    const tags = await httpJson(`${HOST}/api/tags`, {}, 3000);
    return { up: true, models: (tags.models || []).map((m) => m.name) };
  } catch {
    return { up: false, models: [] };
  }
}

function skip(message) {
  section('Engram — End-to-End (local Ollama) — SKIPPED');
  console.log(message);
  process.exit(0); // never fail the suite because the optional LLM is absent
}

async function chat(model, system, user) {
  const body = {
    model,
    stream: false,
    options: { temperature: 0, seed: SEED },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  const t0 = now();
  const json = await httpJson(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { text: (json.message?.content ?? '').trim(), latencyMs: now() - t0 };
}

function keywordScore(answer, expected, minK) {
  const lc = answer.toLowerCase();
  const hits = expected.filter((kw) => lc.includes(kw.toLowerCase()));
  return { pass: hits.length >= (minK || 1), hits };
}

async function judge(model, question, answer, expected) {
  const sys =
    'You are a strict grader. Reply with exactly one word: YES if the answer is correct, or NO if it is wrong or evasive.';
  const user = `Question: ${question}\nExpected facts (any of): ${expected.join(', ')}\nAnswer: ${answer}\nIs the answer correct?`;
  try {
    const { text } = await chat(model, sys, user);
    return /\byes\b/i.test(text);
  } catch {
    return null;
  }
}

async function main() {
  quietLogs();
  const machine = getMachineInfo();

  // --- Reachability + model checks (skip cleanly, never fail) --------------
  const reach = await ollamaReachable();
  if (!reach.up) {
    skip(
      `Ollama is not reachable at ${HOST}.\n\n` +
        'To run this benchmark fully locally:\n' +
        '  1. Install Ollama:   brew install ollama   (or https://ollama.com/download)\n' +
        '  2. Start it:         ollama serve\n' +
        `  3. Pull the model:   ollama pull ${MODEL}\n` +
        '  4. Re-run:           npm run bench:e2e\n'
    );
  }
  const hasModel = reach.models.some((m) => m === MODEL || m.startsWith(`${MODEL}:`));
  if (!hasModel) {
    skip(
      `Ollama is up at ${HOST}, but model "${MODEL}" is not pulled.\n` +
        `Pulled models: ${reach.models.join(', ') || '(none)'}\n\n` +
        `Pull it locally with:  ollama pull ${MODEL}\n` +
        `Or pick another local model:  npm run bench:e2e -- --model <name>\n` +
        'Note: ":cloud" models route to Ollama\'s cloud and are NOT local — avoid them for this offline benchmark.\n'
    );
  }
  if (MODEL.endsWith(':cloud')) {
    skip(
      `Refusing to run against "${MODEL}": ":cloud" models route to Ollama's cloud, ` +
        'which violates this suite\'s 100%-local rule. Use a local model, e.g. llama3.2:3b.\n'
    );
  }

  section('Engram — End-to-End (local Ollama)');
  printMachine(machine);
  console.log(`Model: ${MODEL} @ ${HOST} | k=${K} | temperature=0 | seed=${SEED} | judge=${USE_JUDGE}`);

  const corpus = loadFixture('retrieval-set.json');
  const qa = loadFixture('qa-set.json');
  const dataDir = setupTempDataDir();

  try {
    const config = loadConfig();
    const dbPath = getDatabasePath(config);
    const modelsPath = getModelsPath(config);
    enforceOfflineIfModelCached(modelsPath);
    const db = initDatabase(dbPath);

    process.stdout.write(`Seeding ${corpus.memories.length} memories as the corpus... `);
    await seedMemories(db, corpus.memories, modelsPath, { createMemory, generateEmbedding });
    process.stdout.write('done.\n');

    const system =
      'You answer the user using ONLY the provided context memories. ' +
      'Be concise. If the answer is not in the context, say you do not know.';

    const rows = [];
    const detail = [];
    let kwPass = 0;
    let judgePass = 0;
    let judgeCount = 0;
    const latencies = [];

    for (const item of qa.questions) {
      const ctx = await recallMemories(
        db,
        item.question,
        { namespace: 'bench', limit: K, threshold: 0 },
        modelsPath
      );
      const contextBlock = ctx.map((m, i) => `${i + 1}. ${m.content}`).join('\n');
      const user = `Context memories:\n${contextBlock}\n\nQuestion: ${item.question}`;

      const { text, latencyMs } = await chat(MODEL, system, user);
      latencies.push(latencyMs);

      const kw = keywordScore(text, item.expected_keywords || [], item.min_keywords);
      if (kw.pass) kwPass++;

      let judged = null;
      if (USE_JUDGE) {
        judged = await judge(MODEL, item.question, text, item.expected_keywords || []);
        if (judged != null) {
          judgeCount++;
          if (judged) judgePass++;
        }
      }

      rows.push([
        item.id,
        kw.pass ? 'PASS' : 'FAIL',
        USE_JUDGE ? (judged == null ? 'n/a' : judged ? 'PASS' : 'FAIL') : '-',
        `${ms(latencyMs)} ms`
      ]);
      detail.push({
        id: item.id,
        question: item.question,
        answer: text,
        keywordPass: kw.pass,
        keywordHits: kw.hits,
        judgePass: judged,
        latencyMs: ms(latencyMs)
      });
    }

    const n = qa.questions.length;
    const kwAccuracy = n ? kwPass / n : 0;
    const judgeAccuracy = judgeCount ? judgePass / judgeCount : null;

    section('Per-question results');
    console.log(table(['question', 'keyword', 'judge', 'latency'], rows));

    section('Summary');
    console.log(
      table(
        ['Metric', 'Value'],
        [
          ['Questions', String(n)],
          ['Keyword accuracy', `${(kwAccuracy * 100).toFixed(1)}% (${kwPass}/${n})`],
          ['Judge accuracy', judgeAccuracy == null ? 'n/a (use --judge)' : `${(judgeAccuracy * 100).toFixed(1)}% (${judgePass}/${judgeCount})`],
          ['Mean answer latency', `${ms(mean(latencies))} ms`]
        ]
      )
    );

    const result = {
      kind: 'e2e-ollama',
      machine,
      model: MODEL,
      host: HOST,
      params: { k: K, temperature: 0, seed: SEED, judge: USE_JUDGE },
      summary: {
        questions: n,
        keywordAccuracy: kwAccuracy,
        judgeAccuracy,
        meanLatencyMs: ms(mean(latencies))
      },
      detail
    };
    const file = writeResults('e2e', result);
    console.log(`\nWrote ${file}`);

    db.close();
  } finally {
    cleanupDataDir(dataDir);
  }
}

main().catch((err) => {
  console.error('E2E benchmark failed:', err);
  process.exit(1);
});
