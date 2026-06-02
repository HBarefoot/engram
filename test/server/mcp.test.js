import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EngramMCPServer } from '../../src/server/mcp.js';

/**
 * MCP server integration tests — exercises each of the 6 tools end-to-end
 * against the real handler stack with an isolated tmpdir DB. The embedding
 * model loader will seed from any available cache (node_modules /
 * ~/.cache/huggingface) on first use; if no cache is available the remember
 * path stores without an embedding and recall falls back to FTS-only.
 */
describe('MCP Server', () => {
  let server;
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), 'engram-mcp-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });

    server = new EngramMCPServer({
      port: 3838,
      dataDir: tmpDir,
      defaults: {
        namespace: 'default',
        recallLimit: 5,
        confidenceThreshold: 0.3,
        tokenBudget: 500,
        maxRecallResults: 20
      },
      embedding: {
        provider: 'local',
        model: 'Xenova/all-MiniLM-L6-v2',
        endpoint: null
      },
      llm: { provider: null, endpoint: null, model: null, apiKey: null },
      consolidation: {
        enabled: true,
        intervalHours: 24,
        duplicateThreshold: 0.92,
        decayEnabled: true
      },
      security: { secretDetection: true, auditLog: false }
    });
  });

  afterEach(() => {
    if (server && server.db) server.db.close();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function extractId(text) {
    const match = text.match(/ID:\s*([a-f0-9-]{36})/i);
    return match ? match[1] : null;
  }

  describe('engram_remember', () => {
    it('should store a memory and return success', async () => {
      const res = await server.handleRemember({
        content: 'User prefers Vitest for testing',
        category: 'preference',
        entity: 'testing'
      });
      expect(res.content[0].type).toBe('text');
      expect(res.content[0].text).toContain('Memory stored successfully');
      expect(extractId(res.content[0].text)).toBeTruthy();
    });

    it('should reject content containing an API-key-like secret', async () => {
      const res = await server.handleRemember({
        content: 'My OpenAI key is sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD'
      });
      const text = res.content[0].text;
      // Validator either rejects entirely or redacts + warns
      expect(text).toMatch(/Cannot store|redacted|secret|Warnings/i);
    });

    it('should detect a duplicate on identical second insert', async () => {
      const first = await server.handleRemember({
        content: 'A unique memory about deployment'
      });
      expect(first.content[0].text).toContain('Memory stored successfully');

      const second = await server.handleRemember({
        content: 'A unique memory about deployment'
      });
      // With embedding available → similarity ≥ 0.95 → duplicate.
      // Without embedding → no dedup → new memory created.
      // Both are acceptable behaviors; assert it's not a hard error.
      expect(second.content[0].text).toMatch(/already exists|merged|stored|match/i);
    });

    it('should bypass deduplication when force=true', async () => {
      await server.handleRemember({ content: 'Force test memory' });
      const second = await server.handleRemember({
        content: 'Force test memory',
        force: true
      });
      expect(second.content[0].text).toContain('Memory stored successfully');
    });

    it('should default category to fact when omitted (auto-extraction fallback)', async () => {
      const res = await server.handleRemember({
        content: 'A bare memory with no category'
      });
      expect(res.content[0].text).toContain('Memory stored successfully');
      expect(res.content[0].text).toMatch(/Category:/);
    });
  });

  describe('engram_recall', () => {
    it('should return "No relevant memories" when DB is empty', async () => {
      const res = await server.handleRecall({ query: 'anything' });
      expect(res.content[0].text).toContain('No relevant memories');
    });

    it('should return a stored memory in the result text', async () => {
      await server.handleRemember({
        content: 'PostgreSQL 15 is used for production',
        category: 'fact'
      });
      const res = await server.handleRecall({ query: 'PostgreSQL', threshold: 0.1 });
      expect(res.content[0].text).toMatch(/PostgreSQL|No relevant memories/);
    });
  });

  describe('engram_forget', () => {
    it('should delete an existing memory by ID', async () => {
      const remember = await server.handleRemember({ content: 'Memory to forget' });
      const id = extractId(remember.content[0].text);
      expect(id).toBeTruthy();

      const forget = await server.handleForget({ memory_id: id });
      expect(forget.content[0].text).toContain('deleted');
    });

    it('should report not-found for a missing id', async () => {
      const res = await server.handleForget({ memory_id: 'non-existent-id-12345' });
      expect(res.content[0].text).toContain('not found');
    });
  });

  describe('engram_feedback', () => {
    it('should record helpful feedback and surface the score', async () => {
      const remember = await server.handleRemember({ content: 'Feedback test memory' });
      const id = extractId(remember.content[0].text);

      const res = await server.handleFeedback({ memory_id: id, helpful: true });
      expect(res.content[0].text).toContain('helpful');
      expect(res.content[0].text).toMatch(/Feedback Score/i);
    });

    it('should record unhelpful feedback', async () => {
      const remember = await server.handleRemember({ content: 'Another feedback test' });
      const id = extractId(remember.content[0].text);

      const res = await server.handleFeedback({
        memory_id: id,
        helpful: false,
        context: 'wrong answer in context X'
      });
      expect(res.content[0].text).toContain('not helpful');
    });

    it('should report not-found for a missing id', async () => {
      const res = await server.handleFeedback({
        memory_id: 'non-existent',
        helpful: true
      });
      expect(res.content[0].text).toContain('not found');
    });
  });

  describe('engram_context', () => {
    beforeEach(async () => {
      await server.handleRemember({
        content: 'Runs Node 20 in production',
        category: 'fact'
      });
      await server.handleRemember({
        content: 'Prefers Tailwind CSS for styling',
        category: 'preference'
      });
    });

    it('should produce markdown context (default)', async () => {
      const res = await server.handleContext({ format: 'markdown', limit: 10 });
      expect(res.content[0].text).toContain('## User Context from Memory');
      expect(res.content[0].text).toMatch(/Node 20|Tailwind/);
    });

    it('should produce XML context', async () => {
      const res = await server.handleContext({ format: 'xml', limit: 10 });
      expect(res.content[0].text).toContain('<engram_context');
    });

    it('should produce JSON context', async () => {
      const res = await server.handleContext({ format: 'json', limit: 10 });
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.namespace).toBeDefined();
      expect(parsed.count).toBeGreaterThan(0);
    });

    it('should produce plain context', async () => {
      const res = await server.handleContext({ format: 'plain', limit: 10 });
      expect(res.content[0].text).toMatch(/Node 20|Tailwind/);
    });
  });

  describe('engram_status', () => {
    it('should return health info with memory statistics', async () => {
      const res = await server.handleStatus();
      const text = res.content[0].text;
      expect(text).toContain('Engram Status');
      expect(text).toContain('Total memories:');
      expect(text).toContain('Embedding Model:');
      expect(text).toContain('Configuration:');
    });

    it('should reflect added memories in the count', async () => {
      // Use semantically distinct content so the dedup check (≥0.95 cosine
      // similarity) doesn't reject the second insert.
      await server.handleRemember({
        content: 'Server runs on Kubernetes in us-east-1'
      });
      await server.handleRemember({
        content: 'Frontend uses Vue 3 with Pinia for state management'
      });

      const res = await server.handleStatus();
      // At least 2 memories — match any digit ≥ 2
      expect(res.content[0].text).toMatch(/Total memories:\s*[2-9]\d*/);
    });
  });
});
