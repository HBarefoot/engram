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
      'Respond with ONLY a JSON object, no prose.';
    const prompt =
      `Classify this memory and return JSON.\n\n` +
      `Memory: """${content}"""\n\n` +
      `Return: {"category": one of [${VALID_CATEGORIES.join(', ')}], ` +
      `"entity": a short noun phrase the memory is about (or null), ` +
      `"confidence": a number 0..1 for how factual/reliable this memory is}.\n` +
      `Definitions — preference: a like/dislike; fact: an objective truth; ` +
      `pattern: a recurring workflow; decision: a choice + rationale; ` +
      `outcome: the result of an action.`;

    const out = await llmComplete(config, { system, prompt, json: true });
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
