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
    auditLog: false
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
 * Load configuration from file or create default
 * @param {string} [configPath] - Optional custom config path
 * @returns {Object} Configuration object
 */
export function loadConfig(configPath) {
  const config = { ...DEFAULT_CONFIG };

  // Determine config file path
  const actualConfigPath = configPath || path.join(config.dataDir, 'config.json');

  // Ensure data directory exists
  ensureDataDir(config.dataDir);

  // Load config from file if it exists
  if (fs.existsSync(actualConfigPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(actualConfigPath, 'utf-8'));
      const merged = deepMerge(config, fileConfig);

      // Ensure data directory from loaded config exists
      if (merged.dataDir !== config.dataDir) {
        ensureDataDir(merged.dataDir);
      }

      return merged;
    } catch (error) {
      console.warn(`Failed to load config from ${actualConfigPath}:`, error.message);
      console.warn('Using default configuration');
    }
  }

  // Save default config to file if it doesn't exist
  try {
    fs.writeFileSync(actualConfigPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`Failed to save default config to ${actualConfigPath}:`, error.message);
  }

  return config;
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
