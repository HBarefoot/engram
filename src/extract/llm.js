/**
 * Optional LLM-enhanced extraction wrapper.
 *
 * extractMemory() (rules.js) stays synchronous and untouched — it is always the
 * fallback. extractMemoryLLM() computes the rule-based result first, and only
 * when the optional LLM layer is enabled does it ask a local model to sharpen
 * the category/entity/confidence. Any failure (disabled, unreachable, bad
 * output) returns the exact rule-based result, so behavior is identical to
 * today when LLM is off.
 */
import { extractMemory } from './rules.js';
import { isLLMEnabled, llmComplete } from '../llm/index.js';
import { recordEvent } from '../llm/stats.js';

const VALID_CATEGORIES = ['preference', 'fact', 'pattern', 'decision', 'outcome'];

// Extraction is a one-shot classification — a short budget keeps an interactive
// write snappy. Overridable via config.llm.timeoutMs.
const EXTRACTION_TIMEOUT_MS = 8000;

// JSON Schema for constrained decoding: the model is forced to emit exactly this
// shape (Ollama structured outputs), so a small model can't mis-format. The
// strict validation below stays as the safety net regardless.
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: VALID_CATEGORIES },
    entity: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: ['category', 'entity', 'confidence']
};

// A few compact, in-prompt examples lift small-model accuracy on the one task
// that benefits — entity extraction for names outside the rule extractor's
// keyword list, and the implicit categories rules default to 'fact'. These are
// deliberately NOT drawn from the extraction benchmark fixture, so bench numbers
// stay honest.
const FEW_SHOT =
  'Examples:\n' +
  'Memory: "Honestly I\'d take Rust over C++ for new services any day." => ' +
  '{"category":"preference","entity":"Rust","confidence":0.7}\n' +
  'Memory: "We adopted Kubernetes after the VM sprawl got unmanageable." => ' +
  '{"category":"decision","entity":"Kubernetes","confidence":0.8}\n' +
  'Memory: "We pair-program every new feature before it merges." => ' +
  '{"category":"pattern","entity":"pair programming","confidence":0.7}';

/**
 * Extract a structured memory, optionally enhanced by a local LLM.
 * @param {string} content - Raw memory content
 * @param {Object} [options] - Same options as extractMemory (source, namespace, tags)
 * @param {Object} [config] - Engram config; when llm is enabled, used to enhance
 * @returns {Promise<Object>} Structured memory (same shape as extractMemory)
 */
export async function extractMemoryLLM(content, options = {}, config = null) {
  // Rule-based result is always computed and is the fallback.
  const base = extractMemory(content, options);

  // Disabled: identical to rules, no network call, no stats recorded.
  if (!isLLMEnabled(config)) return { ...base, extraction_method: 'rules' };

  const model = config.llm.model;
  try {
    const system =
      'You classify a single memory for an AI agent memory store. ' +
      'Respond with ONLY a JSON object, no prose.\n' +
      `Definitions — preference: a like/dislike; fact: an objective truth; ` +
      `pattern: a recurring workflow; decision: a choice + rationale; ` +
      `outcome: the result of an action.\n` +
      FEW_SHOT;
    const prompt =
      `Classify this memory and return JSON.\n\n` +
      `Memory: """${content}"""\n\n` +
      `Return: {"category": one of [${VALID_CATEGORIES.join(', ')}], ` +
      `"entity": a short noun phrase the memory is about (or null), ` +
      `"confidence": a number 0..1 for how factual/reliable this memory is}.`;

    const out = await llmComplete(config, {
      system,
      prompt,
      schema: EXTRACTION_SCHEMA,
      timeoutMs: config.llm?.timeoutMs ?? EXTRACTION_TIMEOUT_MS
    });
    if (!out || typeof out !== 'object') {
      recordEvent({ op: 'extract', outcome: 'fallback', model });
      return { ...base, extraction_method: 'rules' };
    }

    const category = VALID_CATEGORIES.includes(out.category) ? out.category : base.category;
    const entity =
      typeof out.entity === 'string' && out.entity.trim()
        ? out.entity.trim().slice(0, 80)
        : base.entity;
    const confidence =
      typeof out.confidence === 'number' && out.confidence >= 0 && out.confidence <= 1
        ? out.confidence
        : base.confidence;

    recordEvent({ op: 'extract', outcome: 'enhanced', model });
    return { ...base, category, entity, confidence, extraction_method: 'llm' };
  } catch {
    recordEvent({ op: 'extract', outcome: 'fallback', model });
    return { ...base, extraction_method: 'rules' };
  }
}
