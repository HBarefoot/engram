# Recommended model: `engram/extract`

Engram's optional LLM layer is **off by default** and, when on, does just two
small classification jobs — sharpen `category`/`entity`/`confidence` on a new
memory, and confirm whether a heuristic-flagged pair is *really* a
contradiction. Neither is open-ended generation. That's exactly where a **small
model with constrained decoding and thinking turned off** wins: it can't
mis-format (the layer forces a JSON schema), and with no reasoning trace it
answers in fast, cool, sub-second bursts.

`engram/extract` packages that into a one-line install. It is a
**recommendation, not a lock-in** — any Ollama or OpenAI-compatible model still
works.

## Why a small model (and why constrained)

The layer calls the model through `src/llm/index.js`, which:

- passes a **JSON schema** as Ollama's `format` (structured outputs), so the
  model is forced to emit exactly `{category, entity, confidence}` (extraction)
  or `{contradicts}` (contradiction) — no free-text to misparse;
- sends `think: false` (thinking-off) — the latency/heat lever; and
- keeps the model resident (`keep_alive`) so it isn't reloaded per write.

Strict validation (enum/range/bounded-entity/strict-boolean) still runs on the
output as the safety net, and any failure falls back to the rule-based path.

## Base model & licensing

`FROM qwen3:1.7b` — a **Qwen3 1.7B** base, **Apache-2.0** licensed. The
permissive license keeps `BUSINESS_MODEL.md` acquirer-clean; avoid
restrictively-licensed bases (e.g. Llama's community license) for the *packaged*
model even though the layer happily runs them if a user picks one.

The size was chosen with the sweep below: the **smallest** model that
meaningfully beats the rule-based extractor on entity match. Re-run the sweep on
your own hardware and swap `FROM` to your winner if a different size fits better.

## Find the right size (sweep)

```bash
# read smallest-first; the bench names the smallest model that clears
# +5 pts entity match vs rules, with constrained decoding + thinking-off
node bench/extraction.mjs --models qwen3:0.6b,qwen3:1.7b,qwen3:4b,llama3.2:3b
```

The sweep prints an entity-match/latency table and a verdict. See
[`bench/README.md`](../../bench/README.md) for the column meanings.

## Build & test locally

```bash
# 1. build the packaged model from the Modelfile
ollama create engram/extract -f models/engram-extract.Modelfile

# 2. confirm it matches the sweep winner on the extraction fixture
node bench/extraction.mjs --model engram/extract
```

Point Engram at it in `~/.engram/config.json`:

```json
{ "llm": { "provider": "ollama", "model": "engram/extract" } }
```

…or, in the desktop app, Preferences → **AI Enhancement** → set the model to
`engram/extract`.

## Publishing (manual — needs Henry's Ollama account)

Pushing to the public Ollama library is a **manual step**, not done by this repo
or any agent:

```bash
# requires `ollama login` with the owning account; choose the namespace
ollama cp engram/extract hbarefoot/engram-extract
ollama push hbarefoot/engram-extract
```

Until it's published, users build it locally from the Modelfile (above), which
is fully offline and needs no account.

## Future work (not this change)

A **fine-tuned** custom extraction model (LoRA on a labeled memory corpus) could
beat a prompted base further, but it's an "if-adoption-justifies-it" item — the
cost of curating data + training isn't warranted at current usage. The prompted
`engram/extract` is the right scope today.
