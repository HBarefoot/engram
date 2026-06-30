import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { llmComplete } from '../../src/llm/index.js';
import { extractMemoryLLM } from '../../src/extract/llm.js';
import { resetBreaker } from '../../src/llm/breaker.js';

const realFetch = global.fetch;

beforeEach(() => resetBreaker());
afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

const ollamaCfg = {
  llm: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'engram/extract' }
};

const SCHEMA = {
  type: 'object',
  properties: { contradicts: { type: 'boolean' } },
  required: ['contradicts']
};

/** Capture the parsed request body of the (last) fetch call. */
function captureFetch(reply) {
  const calls = [];
  global.fetch = vi.fn(async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return typeof reply === 'function' ? reply(calls.length) : reply;
  });
  return calls;
}
const ok = (content) => ({ ok: true, json: async () => ({ message: { content } }) });

describe('constrained decoding (schema)', () => {
  it('sends the JSON schema as Ollama `format` and parses the structured result', async () => {
    const calls = captureFetch(ok('{"contradicts": true}'));
    const out = await llmComplete(ollamaCfg, { prompt: 'x', schema: SCHEMA });
    expect(out).toEqual({ contradicts: true });
    expect(calls[0].body.format).toEqual(SCHEMA);
  });

  it('implies JSON parsing without an explicit json:true', async () => {
    captureFetch(ok('{"contradicts": false}'));
    const out = await llmComplete(ollamaCfg, { prompt: 'x', schema: SCHEMA });
    expect(out).toEqual({ contradicts: false });
  });

  it('falls back from schema `format` to plain JSON when the server rejects the schema', async () => {
    const calls = captureFetch((n) =>
      n === 1
        ? { ok: false, status: 400, json: async () => ({}) } // schema rejected
        : ok('{"contradicts": true}') // plain-json retry succeeds
    );
    const out = await llmComplete(ollamaCfg, { prompt: 'x', schema: SCHEMA });
    expect(out).toEqual({ contradicts: true });
    expect(calls).toHaveLength(2);
    expect(calls[0].body.format).toEqual(SCHEMA);
    expect(calls[1].body.format).toBe('json');
  });

  it('openai-compatible uses response_format json_object for a schema request', async () => {
    let captured;
    global.fetch = vi.fn(async (url, opts) => {
      captured = { url, body: JSON.parse(opts.body) };
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"contradicts":true}' } }] }) };
    });
    const cfg = { llm: { provider: 'openai-compatible', endpoint: 'http://localhost:1234', model: 'm' } };
    const out = await llmComplete(cfg, { prompt: 'x', schema: SCHEMA });
    expect(out).toEqual({ contradicts: true });
    expect(captured.body.response_format).toEqual({ type: 'json_object' });
  });
});

describe('thinking-off + keep_alive', () => {
  it('defaults think:false and sets keep_alive on Ollama requests', async () => {
    const calls = captureFetch(ok('{"contradicts":true}'));
    await llmComplete(ollamaCfg, { prompt: 'x', schema: SCHEMA });
    expect(calls[0].body.think).toBe(false);
    expect(calls[0].body.keep_alive).toBeDefined();
  });

  it('honors think:true when config.llm.think is set, without breaking parsing', async () => {
    const calls = captureFetch(ok('<think>reasoning</think>\n{"contradicts":false}'));
    const cfg = { llm: { ...ollamaCfg.llm, think: true } };
    const out = await llmComplete(cfg, { prompt: 'x', schema: SCHEMA });
    expect(calls[0].body.think).toBe(true);
    // robust parse still isolates the JSON even with a thinking preamble
    expect(out).toEqual({ contradicts: false });
  });

  it('honors a custom keep_alive', async () => {
    const calls = captureFetch(ok('{"contradicts":true}'));
    const cfg = { llm: { ...ollamaCfg.llm, keepAlive: '30m' } };
    await llmComplete(cfg, { prompt: 'x', schema: SCHEMA });
    expect(calls[0].body.keep_alive).toBe('30m');
  });
});

describe('extractMemoryLLM constrained path', () => {
  it('requests a schema with category enum + think:false and returns a valid structured memory', async () => {
    const calls = captureFetch(ok('{"category":"decision","entity":"Kubernetes","confidence":0.8}'));
    const out = await extractMemoryLLM('we adopted k8s', { source: 'test' }, ollamaCfg);
    expect(out.category).toBe('decision');
    expect(out.entity).toBe('Kubernetes');
    expect(out.confidence).toBe(0.8);
    expect(out.extraction_method).toBe('llm');
    // constrained: format is the schema object, with the category enum present
    expect(typeof calls[0].body.format).toBe('object');
    expect(calls[0].body.format.properties.category.enum).toContain('decision');
    expect(calls[0].body.think).toBe(false);
  });

  it('disabled path makes no network call', async () => {
    global.fetch = vi.fn();
    await extractMemoryLLM('hello', { source: 'test' }, null);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
