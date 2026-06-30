import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { starNudge } from '../../src/utils/format.js';

const REPO_URL = 'https://github.com/HBarefoot/engram';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '../../bin/engram.js');

describe('format.starNudge', () => {
  let logSpy;
  const prevEnv = process.env.ENGRAM_NO_BANNER;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env.ENGRAM_NO_BANNER;
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (prevEnv === undefined) delete process.env.ENGRAM_NO_BANNER;
    else process.env.ENGRAM_NO_BANNER = prevEnv;
  });

  it('prints a one-line star nudge with the repo URL', () => {
    starNudge();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain(REPO_URL);
  });

  it('is suppressed by ENGRAM_NO_BANNER', () => {
    process.env.ENGRAM_NO_BANNER = '1';
    starNudge();
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('engram start --mcp-only (stdio transport)', () => {
  it('never emits the star nudge — stdout stays pure JSON-RPC', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'engram-nudge-'));
    const child = spawn(process.execPath, [BIN, 'start', '--mcp-only'], {
      env: { ...process.env, ENGRAM_DATA_DIR: dataDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });

    // Drive a minimal MCP handshake so the server produces real stdout.
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
      }) + '\n'
    );

    try {
      // Wait for the initialize response (or time out), then inspect stdout.
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 4000);
        child.stdout.on('data', () => {
          if (stdout.includes('"result"')) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      // The protocol response must be present...
      expect(stdout).toContain('"result"');
      // ...and the human-facing star nudge must NOT pollute the stdio channel.
      expect(stdout).not.toContain(REPO_URL);
      expect(stdout).not.toContain('Star it');

      // Every stdout line must parse as JSON-RPC (no banner/log leakage).
      for (const line of stdout.split('\n').filter((l) => l.trim())) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    } finally {
      child.kill('SIGKILL');
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 15000);
});
