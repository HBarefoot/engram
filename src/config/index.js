import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Default configuration for Engram
 */
const DEFAULT_CONFIG = {
  port: 3838,
  dataDir: path.join(os.homedir(), '.engram'),
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
  llm: {
    provider: null,
    endpoint: null,
    model: null,
    apiKey: null
  },
  consolidation: {
    enabled: true,
    intervalHours: 24,
    duplicateThreshold: 0.92,
    decayEnabled: true
  },
  security: {
    secretDetection: true,
    auditLog: false,
    encryption: {
      enabled: false,      // opt-in; default installs are byte-for-byte unchanged
      keyFile: null,       // optional path to a key file (env var wins); never the raw key
      kdfIterations: 256000 // wxSQLite3 default; exposed for tuning
    }
  }
};

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Ensure the data directory exists
 * @param {string} dataDir - Path to data directory
 */
function ensureDataDir(dataDir) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create subdirectories
  const modelsDir = path.join(dataDir, 'models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
}

/**
 * Resolve a path that may contain a leading ~ to an absolute path.
 * @param {string} p
 * @returns {string}
 */
function resolveDataDir(p) {
  if (!p) return p;
  const expanded = p.startsWith('~')
    ? path.join(os.homedir(), p.slice(1))
    : p;
  return path.resolve(expanded);
}

/**
 * Load configuration from file or create default.
 *
 * Override priority for `dataDir`:
 *   1. `options.dataDir` (CLI --data-dir flag)
 *   2. `process.env.ENGRAM_DATA_DIR`
 *   3. `dataDir` from config.json
 *   4. Default (~/.engram)
 *
 * @param {string} [configPath] - Optional custom config path
 * @param {Object} [options]
 * @param {string} [options.dataDir] - Override the data directory (highest priority)
 * @returns {Object} Configuration object
 */
export function loadConfig(configPath, { dataDir } = {}) {
  const config = { ...DEFAULT_CONFIG };

  // Determine config file path
  const actualConfigPath = configPath || path.join(config.dataDir, 'config.json');

  // Ensure data directory exists
  ensureDataDir(config.dataDir);

  let merged = config;

  // Load config from file if it exists
  if (fs.existsSync(actualConfigPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(actualConfigPath, 'utf-8'));
      merged = deepMerge(config, fileConfig);

      // Ensure data directory from loaded config exists
      if (merged.dataDir !== config.dataDir) {
        ensureDataDir(merged.dataDir);
      }
    } catch (error) {
      console.warn(`Failed to load config from ${actualConfigPath}:`, error.message);
      console.warn('Using default configuration');
      merged = config;
    }
  } else {
    // Save default config to file if it doesn't exist
    try {
      fs.writeFileSync(actualConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to save default config to ${actualConfigPath}:`, error.message);
    }
  }

  // Apply dataDir override (CLI flag > env var > file value)
  const override = dataDir || process.env.ENGRAM_DATA_DIR;
  if (override) {
    const resolved = resolveDataDir(override);
    merged = { ...merged, dataDir: resolved };
    ensureDataDir(resolved);
  }

  return merged;
}

/**
 * Save configuration to file
 * @param {Object} config - Configuration object
 * @param {string} [configPath] - Optional custom config path
 */
export function saveConfig(config, configPath) {
  const actualConfigPath = configPath || path.join(config.dataDir, 'config.json');

  try {
    fs.writeFileSync(actualConfigPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save config to ${actualConfigPath}: ${error.message}`);
  }
}

/**
 * Get the database path from config
 * @param {Object} config - Configuration object
 * @returns {string} Path to SQLite database
 */
export function getDatabasePath(config) {
  return path.join(config.dataDir, 'memory.db');
}

/**
 * Get the models directory from config
 * @param {Object} config - Configuration object
 * @returns {string} Path to models directory
 */
export function getModelsPath(config) {
  return path.join(config.dataDir, 'models');
}

/**
 * Resolve the database encryption key, or null when encryption is off.
 *
 * The raw key is NEVER read from config.json (which is stored plaintext).
 * Precedence when `security.encryption.enabled` is true:
 *   1. ENGRAM_DB_KEY environment variable (preferred; CI/container friendly)
 *   2. security.encryption.keyFile — a file containing the key (should be 0600)
 *
 * Returns null when encryption is disabled. Throws a clear error when encryption
 * is enabled but no key can be found (so we never silently fall back to writing
 * an unencrypted DB). The key value itself is never logged.
 *
 * @param {Object} config - Engram configuration
 * @returns {string|null}
 */
export function resolveEncryptionKey(config) {
  const enc = config?.security?.encryption;
  if (!enc || !enc.enabled) return null;

  const fromEnv = process.env.ENGRAM_DB_KEY;
  if (fromEnv) return fromEnv;

  if (enc.keyFile) {
    const keyPath = resolveDataDir(enc.keyFile);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Encryption key file not found: ${keyPath}`);
    }
    const key = fs.readFileSync(keyPath, 'utf-8').trim();
    if (!key) throw new Error(`Encryption key file is empty: ${keyPath}`);
    return key;
  }

  throw new Error(
    'Encryption is enabled but no key was found. Set the ENGRAM_DB_KEY environment ' +
    'variable or security.encryption.keyFile in config.json.'
  );
}
