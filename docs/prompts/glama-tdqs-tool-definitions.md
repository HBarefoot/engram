# Prompt — Improve Engram's MCP Tool Definitions for Glama TDQS

> Paste everything below the line into Claude Code (or any coding agent) running in the Engram repo root.
> It rewrites the 6 MCP tool definitions to raise Glama's Tool Definition Quality Score without changing any runtime logic.

---

## Role & objective

You are improving the **MCP tool definitions** in `src/server/mcp.js` for the Engram project. Engram is listed on Glama (`glama.ai/mcp/servers/HBarefoot/engram`), which assigns each tool a **Tool Definition Quality Score (TDQS)** — an LLM-graded score of how well each tool's `description` and parameter docs are written. The score is computed purely from the tool **metadata** (names, descriptions, parameter descriptions, enums, defaults), NOT from runtime behavior.

Your job: rewrite the `description` strings and parameter descriptions for all 6 tools so each TDQS sub-dimension scores higher, while keeping every tool's **behavior, parameter names, types, enums, defaults, and `required` arrays exactly the same.**

## The 6 TDQS dimensions (what each one rewards)

1. **Behavior** — Clearly states what the tool *does*, including side effects and edge cases (what happens on dedup, on empty results, on failure). Don't just say what it's for; say what happens.
2. **Conciseness** — High signal-to-noise. Every sentence earns its place. (Currently 5/5 on every tool — DO NOT regress this. Add substance, not filler.)
3. **Completeness** — Documents the full surface: what it returns (the result shape/fields), every parameter, and notable states (empty, merged, rejected, fallback).
4. **Parameters** — Each parameter description specifies meaning, allowed values/enum, default, constraints, and a short example where useful.
5. **Purpose** — Clear "why this exists / when you'd reach for it." (Mostly 5/5 — preserve.)
6. **Usage Guidelines** — Explicit "use this when… / do NOT use this when…" and ordering relative to the other Engram tools.

## Current scores and the gaps to close (priority order)

| Tool | Overall | Target these weak dimensions |
|---|---|---|
| `engram_recall` | 3.5 | **Completeness (2/5 — top priority)**, Behavior (3), Usage Guidelines (3) |
| `engram_remember` | 4.0 | Behavior (3), Parameters (3) |
| `engram_context` | 4.0 | Behavior (3), Parameters (3) |
| `engram_feedback` | 4.1 | Parameters (3), Usage Guidelines (3) |
| `engram_forget` | 4.2 | Behavior (3) |
| `engram_status` | 4.3 | Usage Guidelines (3) |

## Hard constraints (do not violate)

- **Only edit text** — `description` fields on tools and on parameters, and you may add JSON Schema annotations that are pure metadata: `minimum`, `maximum`, `examples`, `default` (only where it already matches the handler's real default). Do NOT add or rename parameters, change `type`, change `enum` values, or change `required`.
- **Do not touch handler logic** — the `CallTool` handlers (`handleRemember`, `handleRecall`, etc.) and anything below the `ListToolsRequestSchema` block stay unchanged.
- **Every claim must be true.** Verify behavior against the source before describing it: `src/memory/recall.js` (scoring), `src/memory/store.js` (dedup, createMemoryWithDedup), `src/extract/secrets.js` (secret detection), `src/extract/rules.js` (auto category/entity), `src/memory/feedback.js`, `src/memory/context.js`. Cross-check facts against `CLAUDE.md`. If code and this prompt disagree, the **code wins** — describe what the code actually does.
- **Preserve conciseness.** Aim for descriptions that are richer but still scannable. Prefer one or two tight sentences plus, where helpful, a compact "Returns: …" clause. No marketing language, no repetition.
- **Tests and lint must pass** afterward: run `npm run test:run` and `npm run lint`.

## Ground-truth behavior to encode (verify each against the source first)

**engram_remember** — Runs secret detection on every write (`validateContent`, 16+ patterns: OpenAI/Stripe/AWS/GitHub/Slack/Google keys, private keys, connection strings, JWTs) and rejects or redacts secrets. Auto-extracts `category` and `entity` if omitted (rule-based, `src/extract/rules.js`). Generates a local embedding, then calls `createMemoryWithDedup`, which returns one of three outcomes: **created** (new), **merged** (≥0.92 cosine similarity to an existing memory — fields combined), or **duplicate** (≥0.95 cosine — rejected unless `force: true`). Returns the memory id and which outcome occurred.

**engram_recall** — Embeds the query, gathers candidates (FTS5 top-20 ∪ in-namespace embeddings, optionally time-filtered), and ranks with a hybrid score: `similarity×0.45 + recency×0.15 + confidence×0.15 + access×0.05 + feedback×0.10 + fts_boost(0.1)`. Filters by `category` (if set) and `threshold`, sorts descending, returns up to `limit`. **Returns an array of memory objects** — each with `id`, `content`, `category`, `entity`, `confidence`, `namespace`, `tags`, timestamps, and a `score` (plus `scoreBreakdown`). Returns an **empty array** if nothing clears the threshold. Updates `last_accessed` and `access_count` on returned memories. If embedding generation fails, **falls back gracefully to FTS-only** search. With a `time_filter`, results also carry `timeRange` metadata.

**engram_forget** — Permanently deletes one memory by `id`. Returns whether a memory was found and deleted (no error if the id doesn't exist — it reports not-found). Irreversible.

**engram_feedback** — Records a helpful/unhelpful vote in `memory_feedback`, updates the memory's aggregated `feedback_score` (range −1 to 1), which feeds the recall ranking. After enough votes it may auto-adjust the memory's `confidence`. Use the `memory_id` returned by `engram_recall`.

**engram_context** — Returns a single pre-formatted context block (not an array) assembled from relevant memories, in the requested `format` (markdown/xml/json/plain), truncated to fit `max_tokens`. With no `query`, returns top memories by access frequency + recency. Intended for system-prompt injection at session start.

**engram_status** — Returns counts by category and namespace, embedding-model status (name, cached/loaded, size), DB location, and config (default namespace, recall limit, threshold, secret-detection on/off). Read-only; takes no parameters.

## Per-tool instructions

For **each** tool below, rewrite the top-level `description` to cover Purpose + Behavior + a "Returns:" clause + a "Use when / not when" hint, and tighten each parameter description to state meaning, allowed values, default, and (where useful) an example.

- **engram_recall (do this one most thoroughly):** The `description` must explicitly state the return shape (array of scored memory objects, the key fields, empty-array case), the hybrid-ranking behavior in plain terms, the FTS fallback, and the access-stat side effect. Add a "Use when / don't use" line (e.g. use at session start or when you need a specific fact; prefer `engram_context` when you want a ready-to-inject block rather than raw results). For parameters: give `limit` a `minimum: 1`, `maximum: 20`; `threshold` `minimum: 0`, `maximum: 1`; clarify that omitting `namespace` searches all namespaces; document `time_filter` sub-fields with examples.
- **engram_remember:** Description must name the three outcomes (created/merged/duplicate), the secret-detection rejection, and auto-extraction of category/entity. Parameters: enrich `confidence` (`minimum: 0`, `maximum: 1`, when to use 1.0 vs 0.5–0.7), `force` (what it bypasses and the risk), `category` enum meanings (keep existing enum), `tags` (format + example).
- **engram_context:** Clarify it returns one formatted block (contrast with `engram_recall`'s array), the no-query behavior, and token truncation. Parameters: document each `format` value's use case, `include_metadata` effect on output, `max_tokens` as approximate with `minimum`.
- **engram_feedback:** Parameters: spell out that `memory_id` comes from a prior `engram_recall` result, what `helpful: true/false` does to `feedback_score` and future ranking, and what `context` is for. Add a usage guideline: call after acting on a recalled memory to close the learning loop.
- **engram_forget:** Behavior: state it's permanent/irreversible, returns found-vs-not-found, and contrast with `engram_feedback` (downvote instead of delete when unsure).
- **engram_status:** Add a usage guideline: call for a health/diagnostics check or to confirm the model is loaded and how many memories exist; note it's read-only and parameter-free.

## Deliverable & verification

1. Edit only the `ListToolsRequestSchema` block (≈ lines 57–246) of `src/server/mcp.js`.
2. Run `npm run lint` and `npm run test:run` — both must pass.
3. Output a concise diff/summary of what changed per tool and which TDQS dimension each change targets.
4. Do NOT bump the package version or edit the changelog — that's done separately at publish time.

## Acceptance criteria

- All 6 tool descriptions state what the tool returns and when to use it.
- Every parameter has meaning + allowed values + default (where one exists) + constraint annotations where applicable.
- No behavioral/schema changes; tests and lint green.
- Descriptions remain tight and scannable (no regression in conciseness).
