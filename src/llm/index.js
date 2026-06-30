/**
 * Optional local LLM client — "Layer 1" of the onion architecture.
 *
 * This is OFF by default (config.llm.provider === null). When disabled, none of
 * these functions make a network call and callers fall back to the zero-config
 * rule-based path. When enabled it talks to a LOCAL model only (Ollama by
 * default, or any OpenAI-compatible local server). Every call is wrapped in a
 * timeout + try/catch and returns null on any failure so callers degrade
 * gracefully and Engram never crashes because a model is slow or absent.
 *
 * No memory content ever leaves the machine: the endpoint is the user's own
 * local server, and nothing here points at a hosted API unless the user
 * explicitly configures one.
 */
import * as logger from '../utils/logger.js';
import { recordCall } from './stats.js';
import {
  breakerOpen,
  breakerRecordSuccess,
  breakerRecordFailure,
  DEFAULT_BREAKER_THRESHOLD,
  DEFAULT_BREAKER_COOLDOWN_MS
} from './breaker.js';

/** Default request timeout (ms). Overridable via config.llm.timeoutMs. */
const DEFAULT_TIMEOUT_MS = 20000;
/** Default local Ollama endpoint. */
const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';
/** Default model when none configured. */
const DEFAULT_MODEL = 'llama3.2:3b';

/**
 * Is the optional LLM layer enabled?
 * @param {Object} config - Engram config
 * @returns {boolean}
 */
export function isLLMEnabled(config) {
  return !!(config && config.llm && config.llm.provider);
}

/** Strip code fences / prose around a JSON object and return the JSON text. */
function isolateJson(text) {
  if (typeof text !== 'string') return text;
  let t = text.trim();
  // Remove ```json ... ``` or ``` ... ``` fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Fall back to the first {...} or [...] span
  const objStart = t.indexOf('{');
  const arrStart = t.indexOf('[');
  let start = -1;
  if (objStart === -1) start = arrStart;
  else if (arrStart === -1) start = objStart;
  else start = Math.min(objStart, arrStart);
  if (start > 0) {
    const lastObj = t.lastIndexOf('}');
    const lastArr = t.lastIndexOf(']');
    const end = Math.max(lastObj, lastArr);
    if (end > start) t = t.slice(start, end + 1);
  }
  return t;
}

/** Default time to keep the model resident between calls (Ollama keep_alive). */
const DEFAULT_KEEP_ALIVE = '5m';

/**
 * Complete a single prompt with the configured local model.
 *
 * The layer's two real jobs (extraction, contradiction confirmation) are
 * classification tasks, where small models shine if you (1) constrain the output
 * so they can't mis-format and (2) turn thinking off so they're fast/cool. Pass a
 * JSON `schema` for constrained decoding (Ollama structured outputs); the model
 * is then forced to emit exactly that shape. Thinking is OFF by default for the
 * Ollama provider (opt back in via `config.llm.think: true`).
 *
 * @param {Object} config - Engram config (reads config.llm)
 * @param {Object} opts
 * @param {string} [opts.system] - System prompt
 * @param {string} opts.prompt - User prompt
 * @param {boolean} [opts.json=false] - Request + parse a JSON response
 * @param {Object} [opts.schema] - JSON Schema for constrained decoding (implies json)
 * @param {number} [opts.timeoutMs] - Per-call timeout override
 * @returns {Promise<string|Object|null>} text, parsed JSON (json/schema), or null on failure
 */
export async function llmComplete(config, { system, prompt, json = false, schema = null, timeoutMs } = {}) {
  const llm = config && config.llm;
  if (!llm || !llm.provider) return null;
  if (!prompt) return null;

  // Circuit open: skip the network entirely and fall back to rules instantly.
  if (breakerOpen()) return null;

  if (llm.provider !== 'ollama' && llm.provider !== 'openai-compatible') {
    logger.warn('Unknown LLM provider, skipping', { provider: llm.provider });
    return null;
  }

  const breakerThreshold = llm.breakerThreshold || DEFAULT_BREAKER_THRESHOLD;
  const breakerCooldownMs = llm.breakerCooldownMs || DEFAULT_BREAKER_COOLDOWN_MS;
  const timeout = timeoutMs || llm.timeoutMs || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const model = llm.model || DEFAULT_MODEL;
  const wantJson = json || !!schema;
  const callStart = Date.now();

  const endpoint = (llm.endpoint || DEFAULT_OLLAMA_ENDPOINT).replace(/\/+$/, '');
  const headers = { 'content-type': 'application/json' };
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  // Build the request body. `format` lets an Ollama schema request degrade to
  // plain JSON when the server is too old for structured-output schemas.
  let url;
  const buildBody = (ollamaFormat) => {
    if (llm.provider === 'ollama') {
      url = `${endpoint}/api/chat`;
      const body = {
        model,
        messages,
        stream: false,
        // Thinking OFF by default — the latency/heat lever. Harmless for
        // non-thinking models; disables the reasoning trace on capable ones.
        think: llm.think === true,
        // Keep the model resident so it isn't reloaded on every write.
        keep_alive: llm.keepAlive ?? DEFAULT_KEEP_ALIVE,
        options: { temperature: 0 }
      };
      if (ollamaFormat !== undefined) body.format = ollamaFormat;
      else if (schema) body.format = schema;
      else if (wantJson) body.format = 'json';
      return body;
    }
    // openai-compatible
    url = `${endpoint}/v1/chat/completions`;
    const body = { model, messages, temperature: 0, stream: false };
    if (wantJson) body.response_format = { type: 'json_object' };
    if (llm.apiKey) headers.authorization = `Bearer ${llm.apiKey}`;
    return body;
  };

  // For an Ollama schema request, allow a single fallback to plain-JSON format if
  // the server rejects the structured-output schema (older Ollama). The robust
  // parse below still recovers the object.
  const formatAttempts = llm.provider === 'ollama' && schema ? [undefined, 'json'] : [undefined];

  try {
    let text = null;
    for (let a = 0; a < formatAttempts.length; a++) {
      const body = buildBody(formatAttempts[a]); // also sets `url`
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!res.ok) {
        // Schema rejected? fall through to the plain-JSON attempt before failing.
        if (a < formatAttempts.length - 1) continue;
        logger.warn('LLM endpoint returned non-OK status', { status: res.status });
        recordFailure(model, callStart, 'error', `HTTP ${res.status}`, breakerThreshold, breakerCooldownMs);
        return null;
      }

      const data = await res.json();
      text =
        llm.provider === 'ollama'
          ? data && data.message && data.message.content
          : data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      break;
    }

    if (typeof text !== 'string' || !text.trim()) {
      recordFailure(model, callStart, 'error', 'empty response', breakerThreshold, breakerCooldownMs);
      return null;
    }

    if (wantJson) {
      let parsed;
      try {
        parsed = JSON.parse(isolateJson(text));
      } catch {
        logger.warn('LLM returned unparseable JSON, falling back');
        recordFailure(model, callStart, 'error', 'unparseable JSON', breakerThreshold, breakerCooldownMs);
        return null;
      }
      recordCall({ latencyMs: Date.now() - callStart, status: 'ok', model });
      breakerRecordSuccess();
      return parsed;
    }
    recordCall({ latencyMs: Date.now() - callStart, status: 'ok', model });
    breakerRecordSuccess();
    return text.trim();
  } catch (error) {
    // AbortError (timeout), connection refused, DNS, etc. — all degrade to null.
    // Log only the error CLASS, never the message/prompt/content.
    const timedOut = error.name === 'AbortError';
    logger.warn('LLM call failed, falling back to rule-based path', { errorClass: error.name });
    recordFailure(model, callStart, timedOut ? 'timeout' : 'error', error.name, breakerThreshold, breakerCooldownMs);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Record a failed LLM call: counter + lastError (stats) AND a breaker tick.
 * Feed events for the op-level outcome (fallback) are emitted by the caller, so
 * failures aren't double-counted in the activity feed. `error` should be an error
 * class/short reason, never memory content.
 */
function recordFailure(model, callStart, status, error, breakerThreshold, breakerCooldownMs) {
  recordCall({ latencyMs: Date.now() - callStart, status, model, error });
  breakerRecordFailure(breakerThreshold, breakerCooldownMs);
}

/**
 * Ping the configured endpoint with a tiny prompt. Used by the desktop
 * "Test connection" button. Never throws.
 * @param {Object} config - Engram config (or one with a posted llm block)
 * @returns {Promise<{ ok: boolean, model?: string, latencyMs: number, error?: string }>}
 */
export async function testLLM(config) {
  const start = Date.now();
  const model = config && config.llm && config.llm.model;
  if (!isLLMEnabled(config)) {
    return { ok: false, latencyMs: 0, error: 'No LLM provider configured' };
  }
  try {
    const text = await llmComplete(config, {
      system: 'You are a connectivity check. Reply with the single word: ok.',
      prompt: 'ping',
      timeoutMs: 8000
    });
    const latencyMs = Date.now() - start;
    if (text === null) {
      return {
        ok: false,
        model,
        latencyMs,
        error: 'No response — endpoint unreachable, timed out, or returned an error.'
      };
    }
    return { ok: true, model, latencyMs };
  } catch (error) {
    return { ok: false, model, latencyMs: Date.now() - start, error: error.message };
  }
}
