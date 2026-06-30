import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRESTServer } from '../../src/server/rest.js';

/**
 * Regression tests for the LLM-config REST surface and — critically — that CORS
 * allows PUT. v1.7.0 shipped with `Access-Control-Allow-Methods` lacking PUT, so
 * the desktop "AI Enhancement → Save" PUT failed its preflight in the macOS
 * WebView ("Load failed"). GET/POST worked, which masked it.
 */
describe('REST LLM config endpoints + CORS', () => {
  let fastify;
  let tmpDir;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), 'engram-rest-llm-test-' + Date.now());
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });
    fastify = createRESTServer({ dataDir: tmpDir });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('CORS preflight advertises PUT so the desktop can save LLM config', async () => {
    const res = await fastify.inject({ method: 'OPTIONS', url: '/api/config/llm' });
    expect(res.headers['access-control-allow-methods']).toContain('PUT');
  });

  it('GET returns the llm block with apiKey redacted to hasApiKey', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/config/llm' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('provider');
    expect(body).toHaveProperty('hasApiKey');
    expect(body).not.toHaveProperty('apiKey');
  });

  it('PUT persists the llm block and never echoes the apiKey', async () => {
    const put = await fastify.inject({
      method: 'PUT',
      url: '/api/config/llm',
      payload: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2:3b', apiKey: 'sk-secret' }
    });
    expect(put.statusCode).toBe(200);
    expect(JSON.stringify(put.json())).not.toContain('sk-secret');

    const get = await fastify.inject({ method: 'GET', url: '/api/config/llm' });
    const body = get.json();
    expect(body.provider).toBe('ollama');
    expect(body.model).toBe('llama3.2:3b');
    expect(body.hasApiKey).toBe(true);
    expect(JSON.stringify(body)).not.toContain('sk-secret');
  });

  it('PUT rejects an invalid provider with 400', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/api/config/llm',
      payload: { provider: 'evil-cloud' }
    });
    expect(res.statusCode).toBe(400);
  });
});
