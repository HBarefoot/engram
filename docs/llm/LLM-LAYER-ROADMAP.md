# Engram LLM Layer — Roadmap

The optional LLM enhancement layer ("Layer 1"). This doc captures the direction so the work stays coherent and on-brand.

## Invariants (true across every phase)

- **Opt-in, off by default.** With `llm.provider: null`, Engram makes zero LLM calls and behaves exactly like the rule-based path.
- **The core stays rule-based + zero-dependency.** The LLM is an *accuracy enhancement*, never a requirement. Default Engram = SQLite + a 23 MB local embedder; featherweight.
- **Local-first + pluggable.** "We recommend our model; use any Ollama or OpenAI-compatible model you prefer." Honest local-vs-cloud labeling when a model runs off-device.
- **Acquirer-clean.** Any shipped/recommended model uses a permissive base (e.g. Qwen, Apache-2.0). No restrictive licenses, no telemetry.

## What the layer actually does

Two narrow **classification** tasks (not generation):
1. **Extraction** — sharpen `category`/`entity`/`confidence` on a new memory.
2. **Contradiction confirmation** — yes/no on whether two memories conflict (false-positive filter).

Benchmark reality: the LLM's *only* clear win is **entity extraction** (+37.5 pts vs rules); category is a wash. Optimize for that.

## Immediate steps (now — cheap, light, on-brand)

1. **Optimize for small models** — constrained decoding (JSON-schema output), thinking-off, few-shot. Makes a 1–2B model reliable *and* fast (sub-second bursts, quiet fans).
2. **Bench upgrades** — `--judge-model`, thinking-off, fail-loud on unknown args; then a model sweep to find the smallest model that beats rules on entity extraction.
3. **`henrybarefoot1987/engram-extract` Modelfile** — small permissive base + tuned prompt/params/constrained format, published to Ollama as the recommended (optional) model. "Ours, but your choice" — without a training project.
4. **Local/cloud honesty labeling** (v1.8.1) — show on-device vs off-device clearly.
5. **Document the recommended config** (small, non-thinking, constrained) in README + desktop.

Prompts: `docs/prompts/llm-small-model-optimization.md` (steps 1–3), `docs/prompts/llm-cloud-labeling-v1.8.1.md` (step 4).

## Long vision (phased + gated)

- **Phase 1 — now:** off-the-shelf small model + great prompting + the `henrybarefoot1987/engram-extract` Modelfile = recommended default. "Optional local AI enhancement that just works, tiny footprint, fully local."
- **Phase 2 — if adoption justifies it:** a purpose-built, **fine-tuned tiny "Engram memory model"** targeting entity extraction + contradiction confirmation; permissive base; distributed via Ollama; recommended-but-replaceable. The moat / flagship asset.
- **Phase 3 — aspirational:** that model + observability + the redesign's Live Agent Activity = "Engram learns how you work, entirely on your machine."

## Gating (be honest about priority)

Engram's real bottleneck is **distribution/adoption**, not capability. The LLM layer is a differentiator-in-waiting — don't let it consume the energy that should go to getting Engram discovered.

**Phase 2 (the fine-tune) is gated on BOTH:**
1. Real adoption to justify ongoing model maintenance (training pipeline, eval, quantization, hosting, retraining, support — heavy for a solo maintainer), and
2. Benchmark proof that a tuned off-the-shelf small model (Phase 1) isn't already good enough.

Until both are true, fine-tuning stays a documented "later, if" — not active work.
