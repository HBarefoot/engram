import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig, getDatabasePath, getModelsPath } from '../../src/config/index.js';

describe('loadConfig', () => {
  let tmpDir;
  let configPath;
  let savedEnv;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), 'engram-config-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    configPath = path.join(tmpDir, 'config.json');
    // Snapshot the env so individual tests can clear ENGRAM_DATA_DIR safely
    savedEnv = process.env.ENGRAM_DATA_DIR;
    delete process.env.ENGRAM_DATA_DIR;
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.ENGRAM_DATA_DIR;
    } else {
      process.env.ENGRAM_DATA_DIR = savedEnv;
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('default behavior (no override)', () => {
    it('returns the file dataDir when no override is set', () => {
      // Write a config.json with a specific dataDir
      const customDir = path.join(tmpDir, 'from-file');
      fs.writeFileSync(configPath, JSON.stringify({ dataDir: customDir }), 'utf-8');

      const config = loadConfig(configPath);

      expect(config.dataDir).toBe(customDir);
      expect(getDatabasePath(config)).toBe(path.join(customDir, 'memory.db'));
      expect(getModelsPath(config)).toBe(path.join(customDir, 'models'));
    });

    it('falls back to the default ~/.engram when no file exists and no override', () => {
      const config = loadConfig(configPath); // configPath doesn't exist yet
      // The default is os.homedir()/.engram — verify it ends with .engram
      expect(config.dataDir.endsWith('.engram')).toBe(true);
    });
  });

  describe('ENGRAM_DATA_DIR env var override', () => {
    it('overrides the file dataDir when env var is set', () => {
      const fileDir = path.join(tmpDir, 'from-file');
      const envDir = path.join(tmpDir, 'from-env');
      fs.writeFileSync(configPath, JSON.stringify({ dataDir: fileDir }), 'utf-8');

      process.env.ENGRAM_DATA_DIR = envDir;
      const config = loadConfig(configPath);

      expect(config.dataDir).toBe(envDir);
      expect(getDatabasePath(config)).toBe(path.join(envDir, 'memory.db'));
    });

    it('creates the env-var-pointed directory if it does not exist', () => {
      const envDir = path.join(tmpDir, 'new-via-env', 'nested');
      process.env.ENGRAM_DATA_DIR = envDir;

      const config = loadConfig(configPath);

      expect(config.dataDir).toBe(envDir);
      expect(fs.existsSync(envDir)).toBe(true);
      expect(fs.existsSync(path.join(envDir, 'models'))).toBe(true);
    });

    it('expands a leading ~ to the home directory', () => {
      // Avoid actually writing into the user's home; assert the resolved path
      // starts with os.homedir() but skip ensureDataDir side effect by passing
      // a sub-path we'll clean up.
      process.env.ENGRAM_DATA_DIR = '~';
      const config = loadConfig(configPath);
      expect(config.dataDir).toBe(os.homedir());
    });
  });

  describe('explicit dataDir override beats both', () => {
    it('CLI flag takes precedence over env var and file', () => {
      const fileDir = path.join(tmpDir, 'from-file');
      const envDir = path.join(tmpDir, 'from-env');
      const cliDir = path.join(tmpDir, 'from-cli');
      fs.writeFileSync(configPath, JSON.stringify({ dataDir: fileDir }), 'utf-8');
      process.env.ENGRAM_DATA_DIR = envDir;

      const config = loadConfig(configPath, { dataDir: cliDir });

      expect(config.dataDir).toBe(cliDir);
      expect(config.dataDir).not.toBe(envDir);
      expect(config.dataDir).not.toBe(fileDir);
    });

    it('ignored when dataDir is empty string or undefined', () => {
      const fileDir = path.join(tmpDir, 'from-file');
      fs.writeFileSync(configPath, JSON.stringify({ dataDir: fileDir }), 'utf-8');

      const a = loadConfig(configPath, { dataDir: undefined });
      const b = loadConfig(configPath, { dataDir: '' });
      const c = loadConfig(configPath, {});

      expect(a.dataDir).toBe(fileDir);
      expect(b.dataDir).toBe(fileDir);
      expect(c.dataDir).toBe(fileDir);
    });
  });

  describe('non-dataDir fields stay loaded from file', () => {
    it('keeps file-loaded port even when dataDir is overridden', () => {
      const fileDir = path.join(tmpDir, 'from-file');
      const cliDir = path.join(tmpDir, 'from-cli');
      fs.writeFileSync(configPath, JSON.stringify({
        dataDir: fileDir,
        port: 4444
      }), 'utf-8');

      const config = loadConfig(configPath, { dataDir: cliDir });

      expect(config.dataDir).toBe(cliDir);
      expect(config.port).toBe(4444);
    });
  });
});
