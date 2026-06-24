import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Regression: the MCP stdio server must boot even when @xenova/transformers
 * (and its transitive native `sharp` binary) cannot load.
 *
 * We simulate the real failure mode — sharp's prebuilt binary missing in a
 * clean Linux env (Glama's debian:trixie-slim, ARM Mac, Windows, Alpine) — by
 * making any load of `@xenova/transformers` throw. The MCP entry must NOT
 * evaluate transformers at import/boot time; it should only be touched when an
 * embedding is actually generated, where failure is already handled gracefully
 * (recall → FTS fallback, remember → store without embedding).
 *
 * Pre-fix, embed/index.js statically imported @xenova/transformers, so importing
 * the MCP server (bin → mcp → recall/context → embed) evaluated transformers at
 * module-load and this dynamic import would REJECT — the server could never be
 * constructed. Post-fix it loads lazily, so boot + the tool handlers work.
 */
vi.mock('@xenova/transformers', () => {
  throw new Error(
    "Something went wrong installing the \"sharp\" module\n" +
    "Cannot find module '../build/Release/sharp-linux-x64.node'"
  );
});

function makeConfig(dataDir) {
  return {
    port: 3838,
    dataDir,
    defaults: {
      namespace: 'default',
      recallLimit: 5,
      confidenceThreshold: 0.3,
      tokenBudget: 500,
      maxRecallResults: 20
    },
    embedding: { provider: 'local', model: 'Xenova/all-MiniLM-L6-v2', endpoint: null },
    llm: { provider: null, endpoint: null, model: null, apiKey: null },
    consolidation: { enabled: true, intervalHours: 24, duplicateThreshold: 0.92, decayEnabled: true },
    security: { secretDetection: true, auditLog: false }
  };
}

describe('MCP server boots without the transformers/sharp stack', () => {
  let tmpDir;
  let server;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), 'engram-boot-nosharp-' + Date.now());
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });
  });

  afterEach(() => {
    if (server && server.db) server.db.close();
    if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('imports the MCP entry and constructs the server when sharp is unavailable', async () => {
    // Pre-fix: this dynamic import rejects because mcp.js → recall/context →
    // embed statically imports the (now-throwing) transformers module.
    const mod = await import('../../src/server/mcp.js');
    expect(mod.EngramMCPServer).toBeTypeOf('function');

    server = new mod.EngramMCPServer(makeConfig(tmpDir));
    expect(server).toBeTruthy();
  });

  it('handles remember/recall via graceful fallback (no embedding, no crash)', async () => {
    const { EngramMCPServer } = await import('../../src/server/mcp.js');
    server = new EngramMCPServer(makeConfig(tmpDir));

    // remember: embedding generation fails (transformers throws) → stored anyway.
    const stored = await server.handleRemember({
      content: 'The MCP server boots without sharp',
      category: 'fact'
    });
    expect(stored.content[0].type).toBe('text');
    expect(stored.content[0].text).toMatch(/stored|merged|already exists/i);

    // recall: query embedding fails → FTS-only fallback, still a valid response.
    const recalled = await server.handleRecall({ query: 'boots without sharp' });
    expect(recalled.content[0].type).toBe('text');
    expect(typeof recalled.content[0].text).toBe('string');
  });
});
