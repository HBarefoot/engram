# Engram Benchmark Suite

Reproducible, **fully-local, offline** benchmarks for Engram. There are four:

| Benchmark | File | What it measures | Needs |
| --- | --- | --- | --- |
| **Operational** | `operational.mjs` | Cold start, install footprint, recall latency, idle memory, offline guarantee | nothing (local model already cached after first Engram use) |
| **Retrieval quality** | `retrieval.mjs` | recall@k / precision@k / MRR / nDCG@k of the hybrid scorer on a labeled set | nothing |
| **Extraction quality** | `extraction.mjs` | category accuracy / entity match / confidence calibration — rule-based vs optional local LLM | rule-based: nothing; LLM column: a local Ollama model |
| **End-to-end** | `e2e-ollama.mjs` | Answer accuracy when a **local** LLM consumes Engram's recalled context | a local [Ollama](https://ollama.com) model |

The headline story is **operational + retrieval**. The e2e benchmark exists so the
suite is complete *and stays 100% local* — itself a differentiator versus suites that
assume a cloud LLM.

## Ground rules baked in

- **Offline.** The only model is the embedding model Engram already caches locally, plus
  (optionally) a local Ollama instance. No cloud APIs. If the embedding model is already
  cached, the harness sets `TRANSFORMERS_OFFLINE=1` / `HF_HUB_OFFLINE=1` so the run is
  provably network-free.
- **Isolated data.** Every run uses a throwaway `ENGRAM_DATA_DIR` temp dir and cleans it
  up afterward. Your real `~/.engram/memory.db` is never touched.
- **Honest.** Every result file records the machine (CPU/arch/RAM/Node). Latency and
  cold-start numbers are **hardware-dependent** — treat the shape, not the absolute ms, as
  portable. Competitor comparison is infra-only (below); no competitor performance numbers
  are invented.

## Running

```bash
# operational + retrieval (the default headline run)
npm run bench

# individually
npm run bench:ops          # operational
npm run bench:retrieval    # retrieval quality
npm run bench:extraction   # extraction quality (rule vs LLM; LLM column needs local Ollama)
npm run bench:e2e          # end-to-end (needs local Ollama; skips cleanly if absent)

# pass flags through npm with `--`
npm run bench:ops -- --seed 1000 --queries 200
npm run bench:retrieval -- --k 5 --min-mrr 0.70 --min-recall 0.80
npm run bench:extraction -- --model llama3.2:3b
npm run bench:e2e -- --model llama3.2:3b --judge
```

Results are written as JSON to `bench/results/<kind>-<timestamp>.json`.

### Flags

| Script | Flag | Default | Meaning |
| --- | --- | --- | --- |
| operational | `--seed` | `1000` | memories to seed before measuring latency |
| operational | `--queries` | `200` | recall queries to sample for percentiles |
| retrieval | `--k` | `5` | cutoff for @k metrics |
| retrieval | `--threshold` | `0` | recall score floor (0 = measure pure ranking at k) |
| retrieval | `--min-mrr` / `--min-recall` | none | CI gates; exit non-zero if aggregate is below |
| extraction | `--model` | `llama3.2:3b` | single local Ollama model (rule vs that model) |
| extraction | `--models` | none | comma list, **smallest-first**, to sweep (see below); overrides `--model` |
| extraction | `--think` | off | re-enable the model's reasoning trace (default: thinking **off**) |
| e2e | `--model` | `llama3.2:3b` | local Ollama model that answers (pinned for reproducibility) |
| e2e | `--judge-model` | = `--model` | a separate (often stronger) model to grade answers |
| e2e | `--host` | `http://localhost:11434` | Ollama endpoint |
| e2e | `--k` | `5` | context memories recalled per question |
| e2e | `--judge` | off | add an Ollama-as-judge correctness pass |
| e2e | `--think` | off | re-enable thinking for answer + judge calls (default: **off**) |

> **Strict args.** Both Ollama benchmarks now **fail loud** on unknown flags, stray positionals,
> and a boolean flag that swallowed a value — e.g. `--judge qwen3.5:9b` (missing `--judge-model`)
> errors instead of silently leaving `--model` on its default. That class of mistake previously
> masked a model swap.

For accurate idle-RSS, run operational with `node --expose-gc bench/operational.mjs`.

## Small-model sweep + the recommended model

The LLM layer does *classification*, not generation, so it's tuned for **small models with
constrained decoding + thinking off** (the layer forces a JSON schema and sends `think: false`).
To find the smallest model that's actually worth running, sweep a ladder smallest-first:

```bash
node bench/extraction.mjs --models qwen3:0.6b,qwen3:1.7b,qwen3:4b,llama3.2:3b
```

It runs the rule-based extractor plus every *pulled* model (skipping ones you haven't pulled and
any `:cloud` model), prints an entity-match/latency table, and names the **smallest** model that
beats rules on entity match by ≥ 5 pts **without regressing category accuracy** (a tiny model that
wins entity but tanks category is disqualified — entity gains aren't worth trading category away).
That winner is the recommended base for `engram/extract`
(see [`docs/llm/recommended-model.md`](../docs/llm/recommended-model.md) and
[`models/engram-extract.Modelfile`](../models/engram-extract.Modelfile)). The ladder is read
smallest-first; latency is hardware/model-dependent, so re-run it on your own machine.

## Metrics explained

**Operational**
- **Model load (cold):** time for the first `generateEmbedding` — loads the embedding
  pipeline from the local cache. Reported separately from warm recall.
- **Warm recall:** a single `recallMemories` once the model is loaded.
- **Cold start → first recall:** model load + first warm recall (composed).
- **Install footprint:** `node_modules` size (dev), embedding model on disk, and the
  **published package** size via `npm pack --dry-run --json` (`unpackedSize` / tarball).
- **Recall latency p50/p95/p99:** distribution over `--queries` recalls against `--seed`
  memories.
- **Idle RSS:** resident set size after load + seeded DB.
- **Offline store→recall:** a full embed→store→recall cycle under enforced offline mode;
  prints PASS/FAIL (and the operational script exits non-zero on FAIL).
- **Ops surface:** external services required to run Engram — **zero** (SQLite is embedded,
  the model runs in-process on CPU).

**Retrieval quality** (binary relevance from the labeled fixture)
- **recall@k:** fraction of a query's relevant memories that appear in the top *k*.
- **precision@k:** relevant hits in the top *k* divided by *k*. Note: most queries have a
  single relevant memory, so precision@5 is bounded near `0.2` by construction — read it
  alongside recall and nDCG, not alone.
- **MRR:** mean reciprocal rank of the first relevant hit (within top *k*).
- **nDCG@k:** rank-discounted gain normalized by the ideal ranking.

**Extraction quality** (rule-based vs optional local LLM — see the dedicated section below)
- **Category accuracy:** exact match of the extracted category vs `expected_category`.
- **Entity match rate:** normalized match of the extracted entity against any `acceptable_entities`.
- **Confidence in band:** share of items whose returned confidence falls inside `confidence_band`.
- **Mean latency / item:** per-item extraction time per mode (the LLM path is far slower).

**End-to-end**
- **Keyword accuracy:** fraction of answers containing the expected fact keywords.
- **Judge accuracy:** (with `--judge`) fraction the local model grades correct.
- **Mean answer latency:** Ollama chat latency per question (`temperature: 0`, fixed seed).

## Extraction-quality benchmark

**What it measures.** How well raw text becomes the right `category`, `entity`, and
`confidence` — comparing the default rule-based extractor (`extractMemory`, `src/extract/rules.js`)
against the optional local-LLM extractor (`extractMemoryLLM`, `src/extract/llm.js`). It is the
honest basis for any "with local AI it's more accurate" claim.

**Why retrieval can't measure this.** `retrieval.mjs` seeds the store with the fixture's *gold*
`category`/`entity` and scores the recall ranker — which the LLM layer never touches. So retrieval
correctly shows **no delta** with Ollama on. The LLM layer only changes *extraction*, so it needs
its own benchmark.

**Entity-matching rule.** Both the extracted entity and each `acceptable_entities` alias are
normalized to lowercase with all non-alphanumerics stripped (`next.js` → `nextjs`). A match counts
when the normalized strings are equal, **or** one contains the other and the shorter side is ≥ 3
chars (so `stripe billing` ~ `stripe`, without `go` matching `google`). A null/empty entity never
matches.

**Run it.**
```bash
npm run bench:extraction                          # rule-based always; LLM column if Ollama+model present
npm run bench:extraction -- --model llama3.2:3b   # pin a model (default llama3.2:3b)
```
Rule-based scoring needs nothing. The LLM column needs a local Ollama with the pinned model
(`ollama pull llama3.2:3b`); if it's absent the LLM column is skipped with guidance and the
rule-based numbers still print. `:cloud` models are refused (off-machine). Not part of the CI
`bench.yml` gate — it's local and on-demand. Latency is **hardware/model-dependent**; the result
JSON records the machine and model.

## Fixture schemas

### `fixtures/retrieval-set.json`
```jsonc
{
  "memories": [
    {
      "id": "m01",            // stable label id (harness maps it to Engram's UUID)
      "content": "…",         // the memory text (this is what gets embedded)
      "category": "preference|fact|pattern|decision|outcome",
      "entity": "web-framework",
      "namespace": "bench"
    }
  ],
  "queries": [
    {
      "id": "q01",
      "query": "natural-language query text",
      "relevant_ids": ["m01", "m34"]  // memory ids that SHOULD rank in the top-k
    }
  ]
}
```
The set deliberately includes near-duplicate / topically-adjacent memories (e.g. `m01`/`m34`
on Fastify, `m10`/`m38`/`m39` on pnpm) to stress ranking. Grow it by adding memories with new
ids and queries that reference them.

### `fixtures/qa-set.json`
```jsonc
{
  "questions": [
    {
      "id": "qa01",
      "question": "…",
      "expected_keywords": ["fastify"],  // lowercased substrings
      "min_keywords": 1                   // how many must appear for a keyword PASS
    }
  ]
}
```
The retrieval-set memories are the corpus; each question recalls top-k context, which is fed
to the local model.

### `fixtures/extraction-set.json`
```jsonc
{
  "items": [
    {
      "id": "x01",
      "content": "the raw memory text an agent would store",
      "expected_category": "preference|fact|pattern|decision|outcome",
      "acceptable_entities": ["primary", "synonym/alias"],  // any normalized match counts
      "confidence_band": [0.6, 1.0]                          // optional plausible min/max
    }
  ]
}
```
Designed to expose where rules are weak: items with an **implicit** category (no trigger keyword
from `rules.js`'s signal lists, which the rule extractor defaults to `fact`), entities **not** in
`rules.js`'s `TECH_KEYWORDS` (product/SaaS names), a few genuinely ambiguous items (intended label
noted in the fixture's `_schema.ambiguous`), and a spread across all five categories.

## Reproducibility notes

- **Embedding model:** `Xenova/all-MiniLM-L6-v2` (quantized), pinned by Engram itself.
- **e2e model:** pinned via `--model` (default `llama3.2:3b`), `temperature: 0`, fixed
  `seed`. `:cloud` Ollama models are refused — they route to Ollama's cloud and would break
  the local guarantee.
- **Hardware caveat:** ms-level numbers depend on CPU/RAM. The result JSON records the
  machine so runs are comparable; don't compare absolute latency across different hardware.

## Infra required — qualitative comparison

Engram's structural advantage is **zero infrastructure**: `npm install` and it runs. The
table below lists the *documented default* setup each project requires to run locally — it is
**infra-only and cites each project's own docs**; no performance numbers are invented or
implied. Project requirements change, so verify against current docs before quoting.

| Project | Local setup to run | External services |
| --- | --- | --- |
| **Engram** | `npm install` | **none** — embedded SQLite + in-process CPU embeddings |
| Mem0 / OpenMemory | `docker compose up` (OpenMemory quickstart) | Docker; vector store + LLM/embedder keys per config |
| Zep (Community Edition) | Docker Compose | Docker; Postgres (bundled in compose) |
| Letta / MemGPT | server + database | Postgres (or Docker), model provider |
| Cognee | library + datastore | a vector/graph store per setup |

Sources: each project's own "quickstart" / "self-host" documentation. The point of the table
is the **shape of the dependency** (Docker/Postgres/vector DB vs. nothing), not a speed claim.
