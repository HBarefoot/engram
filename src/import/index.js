import * as logger from '../utils/logger.js';

// Lazy-load parsers to avoid importing unused ones
const PARSERS = {
  cursorrules: () => import('./parsers/cursorrules.js'),
  claude: () => import('./parsers/claude.js'),
  package: () => import('./parsers/package.js'),
  git: () => import('./parsers/git.js'),
  ssh: () => import('./parsers/ssh.js'),
  shell: () => import('./parsers/shell.js'),
  obsidian: () => import('./parsers/obsidian.js'),
  env: () => import('./parsers/env.js')
};

/**
 * Get metadata for all available import sources
 * @returns {Object[]} Array of source metadata
 */
export async function getSourceMeta() {
  const sources = [];

  for (const [key, loader] of Object.entries(PARSERS)) {
    try {
      const parser = await loader();
      sources.push({
        id: key,
        ...parser.meta
      });
    } catch (error) {
      logger.warn(`Failed to load parser: ${key}`, { error: error.message });
    }
  }

  return sources;
}

/**
 * Detect which import sources are available on this system
 * @param {Object} [options] - Detection options
 * @param {string} [options.cwd] - Working directory
 * @returns {Object[]} Array of { id, meta, detected: { found, path } }
 */
export async function detectSources(options = {}) {
  const results = [];

  for (const [key, loader] of Object.entries(PARSERS)) {
    try {
      const parser = await loader();
      const detection = parser.detect ? parser.detect(options) : { found: false, path: null };

      results.push({
        id: key,
        ...parser.meta,
        detected: detection
      });
    } catch (error) {
      logger.warn(`Failed to detect source: ${key}`, { error: error.message });
      results.push({
        id: key,
        name: key,
        label: key,
        description: 'Failed to load parser',
        detected: { found: false, path: null, error: error.message }
      });
    }
  }

  return results;
}

/**
 * Scan selected sources and extract candidate memories
 * @param {string[]} sourceIds - Array of source IDs to scan
 * @param {Object} [options] - Scan options
 * @param {string} [options.cwd] - Working directory
 * @returns {Object} Scan results
 */
export async function scanSources(sourceIds, options = {}) {
  const startTime = Date.now();
  const allMemories = [];
  const allSkipped = [];
  const allWarnings = [];
  const sourceResults = {};

  for (const sourceId of sourceIds) {
    const loader = PARSERS[sourceId];
    if (!loader) {
      allWarnings.push(`Unknown source: ${sourceId}`);
      continue;
    }

    try {
      const parser = await loader();
      const result = await parser.parse(options);

      sourceResults[sourceId] = {
        memoriesCount: result.memories.length,
        skippedCount: result.skipped.length,
        warnings: result.warnings
      };

      allMemories.push(...result.memories);
      allSkipped.push(...result.skipped.map(s => ({ ...s, source: sourceId })));
      allWarnings.push(...result.warnings.map(w => `[${sourceId}] ${w}`));

      logger.info(`Scanned source: ${sourceId}`, {
        memories: result.memories.length,
        skipped: result.skipped.length
      });
    } catch (error) {
      logger.error(`Failed to scan source: ${sourceId}`, { error: error.message });
      allWarnings.push(`[${sourceId}] Scan failed: ${error.message}`);
      sourceResults[sourceId] = { memoriesCount: 0, skippedCount: 0, warnings: [error.message] };
    }
  }

  return {
    memories: allMemories,
    skipped: allSkipped,
    warnings: allWarnings,
    sources: sourceResults,
    duration: Date.now() - startTime
  };
}

/**
 * Commit scanned memories to the database
 * @param {Object} db - SQLite database instance
 * @param {Object[]} memories - Memory candidates to commit
 * @param {Object} [options] - Commit options
 * @param {string} [options.namespace] - Override namespace for all memories
 * @param {Function} [options.createMemoryFn] - Custom createMemory function
 * @param {Function} [options.generateEmbeddingFn] - Custom embedding function
 * @param {Function} [options.validateContentFn] - Custom validation function
 * @returns {Object} Commit results
 */
export async function commitMemories(db, memories, options = {}) {
  const {
    namespace,
    createMemoryFn,
    generateEmbeddingFn,
    validateContentFn
  } = options;

  const startTime = Date.now();
  const results = {
    created: 0,
    duplicates: 0,
    merged: 0,
    rejected: 0,
    errors: [],
    details: []
  };

  // Import store functions
  const { createMemoryWithDedup } = await import('../memory/store.js');
  const commitFn = createMemoryFn || createMemoryWithDedup;

  // Optionally import embedding function
  let embedFn = generateEmbeddingFn;
  let modelsPath;
  if (!embedFn) {
    try {
      const { generateEmbedding } = await import('../embed/index.js');
      const { loadConfig, getModelsPath } = await import('../config/index.js');
      const config = loadConfig();
      modelsPath = getModelsPath(config);
      embedFn = (content) => generateEmbedding(content, modelsPath);
    } catch {
      logger.warn('Embeddings not available, committing without embeddings');
    }
  }

  // Optionally import validation
  let validateFn = validateContentFn;
  if (!validateFn) {
    const { validateContent } = await import('../extract/secrets.js');
    validateFn = (content) => validateContent(content, { autoRedact: true });
  }

  for (const memory of memories) {
    try {
      // Final secret validation
      const validation = validateFn(memory.content);
      if (!validation.valid) {
        results.rejected++;
        results.details.push({
          content: memory.content.substring(0, 50),
          status: 'rejected',
          reason: 'Failed secret detection'
        });
        continue;
      }

      // Generate embedding
      let embedding = null;
      if (embedFn) {
        try {
          embedding = await embedFn(validation.content);
        } catch {
          // Continue without embedding
        }
      }

      const memoryData = {
        content: validation.content,
        category: memory.category || 'fact',
        entity: memory.entity || null,
        confidence: memory.confidence || 0.8,
        namespace: namespace || memory.namespace || 'default',
        tags: memory.tags || [],
        source: memory.source || 'import',
        embedding
      };

      const commitResult = commitFn(db, memoryData);

      switch (commitResult.status) {
        case 'created':
          results.created++;
          break;
        case 'duplicate':
          results.duplicates++;
          break;
        case 'merged':
          results.merged++;
          break;
        default:
          results.created++;
      }

      results.details.push({
        content: memory.content.substring(0, 50),
        status: commitResult.status,
        id: commitResult.id
      });
    } catch (error) {
      results.errors.push({
        content: memory.content.substring(0, 50),
        error: error.message
      });
    }
  }

  results.duration = Date.now() - startTime;
  results.total = memories.length;

  logger.info('Import commit complete', {
    total: results.total,
    created: results.created,
    duplicates: results.duplicates,
    merged: results.merged,
    rejected: results.rejected,
    errors: results.errors.length,
    duration: results.duration
  });

  return results;
}
