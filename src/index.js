/**
 * Engram - Persistent Memory for AI Agents
 * Main entry point for programmatic usage
 *
 * @example
 * import { createMemory, recallMemories, initDatabase } from 'engram';
 */

// Configuration
export { loadConfig, getDatabasePath, getModelsPath } from './config/index.js';

// Memory operations
export {
  initDatabase,
  createMemory,
  getMemory,
  deleteMemory,
  listMemories,
  getStats
} from './memory/store.js';

// Recall & search
export {
  recallMemories,
  formatRecallResults
} from './memory/recall.js';

// Consolidation
export {
  consolidate,
  getConflicts
} from './memory/consolidate.js';

// Extraction
export {
  extractMemory
} from './extract/rules.js';

export {
  validateContent
} from './extract/secrets.js';

// Embedding
export {
  generateEmbedding,
  cosineSimilarity
} from './embed/index.js';

// Utilities
export {
  generateId
} from './utils/id.js';

export * as logger from './utils/logger.js';
