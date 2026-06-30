import { describe, it, expect, vi, afterEach } from 'vitest';
import { isLLMEnabled, llmComplete, testLLM } from '../../src/llm/index.js';
import { extractMemoryLLM } from '../../src/extract/llm.js';
import { extractMemory } from '../../src/extract/rules.js';

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

const ollamaCfg = {
  llm: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2:3b' }
};

function mockFetch(handler) {
  global.fetch = vi.fn(handler);
}
function ollamaReply(content) {
  return async () => ({ ok: true, json: async () => ({ message: { content } }) });
}

describe('isLLMEnabled', () => {
  it('is false when disabled / unset', () => {
    expect(isLLMEnabled(null)).toBe(false);
    expect(isLLMEnabled({})).toBe(false);
    expect(isLLMEnabled({ llm: { provider: null } })).toBe(false);
  });
  it('is true when a provider is set', () => {
    expect(isLLMEnabled(ollamaCfg)).toBe(true);
  });
});

describe('llmComplete', () => {
  it('makes NO network call when disabled and returns null', async () => {
    global.fetch = vi.fn();
    const r = await llmComplete({ llm: { provider: null } }, { prompt: 'hi' });
    expect(r).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns text on an Ollama success and hits /api/chat', async () => {
    mockFetch(ollamaReply('hello world'));
    const r = await llmComplete(ollamaCfg, { prompt: 'hi' });
    expect(r).toBe('hello world');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('parses JSON when json:true (and strips code fences)', async () => {
    mockFetch(ollamaReply('```json\n{"category":"fact","entity":"x","confidence":0.9}\n```'));
    const r = await llmComplete(ollamaCfg, { prompt: 'hi', json: true });
    expect(r).toEqual({ category: 'fact', entity: 'x', confidence: 0.9 });
  });

  it('returns null on malformed JSON when json:true', async () => {
    mockFetch(ollamaReply('this is not json at all'));
    const r = await llmComplete(ollamaCfg, { prompt: 'hi', json: true });
    expect(r).toBeNull();
  });

  it('returns null on a non-OK status', async () => {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await llmComplete(ollamaCfg, { prompt: 'hi' })).toBeNull();
  });

  it('returns null when the endpoint is unreachable (fetch throws)', async () => {
    mockFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await llmComplete(ollamaCfg, { prompt: 'hi' })).toBeNull();
  });

  it('returns null on timeout (abort)', async () => {
    mockFetch(
      (url, opts) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const r = await llmComplete(
      { llm: { provider: 'ollama', timeoutMs: 20 } },
      { prompt: 'hi' }
    );
    expect(r).toBeNull();
  });

  it('openai-compatible posts to /v1/chat/completions with Bearer auth when apiKey set', async () => {
    let captured;
    global.fetch = vi.fn(async (url, opts) => {
      captured = { url, opts };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) };
    });
    const cfg = {
      llm: { provider: 'openai-compatible', endpoint: 'http://localhost:1234', model: 'm', apiKey: 'sk-test' }
    };
    const r = await llmComplete(cfg, { prompt: 'x' });
    expect(r).toBe('hi');
    expect(captured.url).toBe('http://localhost:1234/v1/chat/completions');
    expect(captured.opts.headers.authorization).toBe('Bearer sk-test');
  });

  it('openai-compatible omits the auth header when no apiKey', async () => {
    let captured;
    global.fetch = vi.fn(async (url, opts) => {
      captured = { url, opts };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'hi' } }] }) };
    });
    const cfg = { llm: { provider: 'openai-compatible', endpoint: 'http://localhost:1234', model: 'm' } };
    await llmComplete(cfg, { prompt: 'x' });
    expect(captured.opts.headers.authorization).toBeUndefined();
  });
});

describe('testLLM', () => {
  it('reports ok with model + latency on success', async () => {
    mockFetch(ollamaReply('ok'));
    const r = await testLLM(ollamaCfg);
    expect(r.ok).toBe(true);
    expect(r.model).toBe('llama3.2:3b');
    expect(typeof r.latencyMs).toBe('number');
  });

  it('reports not-ok when disabled', async () => {
    const r = await testLLM({ llm: { provider: null } });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('reports not-ok with an error when unreachable', async () => {
    mockFetch(async () => {
      throw new Error('down');
    });
    const r = await testLLM(ollamaCfg);
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe('extractMemoryLLM', () => {
  it('disabled path makes no network call and matches rule-based output exactly', async () => {
    global.fetch = vi.fn();
    const content = 'User prefers Fastify over Express for Node APIs';
    const base = extractMemory(content, { source: 'test', namespace: 'ns' });
    const out = await extractMemoryLLM(content, { source: 'test', namespace: 'ns' }, null);
    expect(out).toEqual(base);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('enhances category/entity/confidence when enabled, preserving base fields', async () => {
    mockFetch(ollamaReply('{"category":"decision","entity":"web-framework","confidence":0.95}'));
    const out = await extractMemoryLLM('we went with fastify', { source: 'test', namespace: 'ns' }, ollamaCfg);
    expect(out.category).toBe('decision');
    expect(out.entity).toBe('web-framework');
    expect(out.confidence).toBe(0.95);
    expect(out.source).toBe('test');
    expect(out.namespace).toBe('ns');
  });

  it('falls back to rule-based output when the LLM fails', async () => {
    mockFetch(async () => {
      throw new Error('down');
    });
    const content = 'User prefers Fastify over Express';
    const base = extractMemory(content, { source: 'test' });
    const out = await extractMemoryLLM(content, { source: 'test' }, ollamaCfg);
    expect(out).toEqual(base);
  });
});
