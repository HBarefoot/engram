import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import {
  initDatabase
} from '../../src/memory/store.js';
import {
  startRESTServer,
  findAvailablePort
} from '../../src/server/rest.js';

/**
 * Bind a sacrificial net.createServer to hold a port for the test.
 * Returns the bound port and a close() helper.
 */
function blockPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

describe('REST server port handling', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), 'engram-port-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'models'), { recursive: true });
    // Pre-seed an empty DB so createRESTServer doesn't crash on startup
    const db = initDatabase(path.join(tmpDir, 'memory.db'));
    db.close();
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('findAvailablePort', () => {
    it('throws with an actionable message when all attempts are exhausted', async () => {
      // Block one port and ask for exactly one attempt — guaranteed failure.
      const blocker = await blockPort(0);
      try {
        await expect(findAvailablePort(blocker.port, 1)).rejects.toThrow(
          /port|range|config\.json/i
        );
      } finally {
        await blocker.close();
      }
    });

    it('returns the first free port when start port is free', async () => {
      // Use port 0 to let the OS pick a free port for the blocker, then close it.
      const blocker = await blockPort(0);
      const freePort = blocker.port;
      await blocker.close();
      // Small async tick to let the OS release the port.
      await new Promise(r => setImmediate(r));

      const found = await findAvailablePort(freePort, 5);
      expect(found).toBe(freePort);
    });
  });

  describe('startRESTServer', () => {
    it('returns { fastify, port } with the requested port when free', async () => {
      // Pick a free port via blocker trick, then release it before startRESTServer runs
      const blocker = await blockPort(0);
      const freePort = blocker.port;
      await blocker.close();
      await new Promise(r => setImmediate(r));

      const result = await startRESTServer({ dataDir: tmpDir }, freePort);
      try {
        expect(result.port).toBe(freePort);
        expect(result.fastify).toBeDefined();
        // Sanity: server is actually listening
        const res = await result.fastify.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
      } finally {
        await result.fastify.close();
      }
    });

    it('falls back to the next available port when the requested port is in use', async () => {
      const blocker = await blockPort(0);
      const blockedPort = blocker.port;

      try {
        const result = await startRESTServer({ dataDir: tmpDir }, blockedPort);
        try {
          // Fallback should land on a higher port within the 5-attempt window
          expect(result.port).toBeGreaterThan(blockedPort);
          expect(result.port).toBeLessThanOrEqual(blockedPort + 4);
          // Health check on the fallback port
          const res = await result.fastify.inject({ method: 'GET', url: '/health' });
          expect(res.statusCode).toBe(200);
        } finally {
          await result.fastify.close();
        }
      } finally {
        await blocker.close();
      }
    });
  });
});
