import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, getDatabasePath, getModelsPath } from '../config/index.js';
import { initDatabase, createMemory, getMemory, deleteMemory, listMemories, getStats } from '../memory/store.js';
import { recallMemories } from '../memory/recall.js';
import { consolidate, getConflicts } from '../memory/consolidate.js';
import { getOverview, getStaleMemories, getNeverRecalled, getDuplicateClusters, getTrends } from '../memory/analytics.js';
import { calculateHealthScore } from '../memory/health.js';
import { validateContent } from '../extract/secrets.js';
import { extractMemory } from '../extract/rules.js';
import { exportToStatic } from '../export/static.js';
import * as logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Sanitize and validate a path for import scanning.
 * Rejects paths with traversal sequences and resolves to absolute.
 * @param {string} p - Path to validate
 * @returns {string|null} Resolved absolute path, or null if invalid
 */
function sanitizePath(p) {
  if (typeof p !== 'string' || !p.trim()) return null;
  const resolved = path.resolve(p.trim());
  // Reject paths that use traversal sequences in the original input
  if (p.includes('..')) return null;
  return resolved;
}

/**
 * Validate and sanitize paths array from user input.
 * @param {string[]} paths - Raw paths from request
 * @returns {string[]} Sanitized paths (invalid entries removed)
 */
function sanitizePaths(paths) {
  if (!paths || !Array.isArray(paths)) return [];
  return paths.map(sanitizePath).filter(Boolean);
}
const __dirname = path.dirname(__filename);

/**
 * Get the Engram server version.
 * In the esbuild sidecar bundle, process.env.ENGRAM_VERSION is replaced at build time.
 * Otherwise, reads from package.json.
 * @returns {string}
 */
function getServerVersion() {
  if (process.env.ENGRAM_VERSION) return process.env.ENGRAM_VERSION;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

/**
 * Create and configure the Fastify REST API server
 * @param {Object} config - Engram configuration
 * @returns {Object} Fastify instance
 */
export function createRESTServer(config) {
  const fastify = Fastify({
    logger: false, // Use our own logger
    trustProxy: true
  });

  // Initialize database
  const db = initDatabase(getDatabasePath(config));
  const modelsPath = getModelsPath(config);

  // CORS support
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
  });

  // Handle OPTIONS requests
  fastify.options('/*', async (request, reply) => {
    reply.code(204).send();
  });

  const serverVersion = getServerVersion();

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      version: serverVersion,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  // System status endpoint
  fastify.get('/api/status', async (request, reply) => {
    try {
      const stats = getStats(db);

      // Get model info
      let modelInfo;
      try {
        const { getModelInfo } = await import('../embed/index.js');
        modelInfo = getModelInfo(modelsPath);
      } catch (error) {
        modelInfo = {
          name: 'unknown',
          available: false,
          cached: false,
          loading: false,
          sizeMB: 0,
          path: '',
          error: error.message
        };
      }

      return {
        status: 'ok',
        version: serverVersion,
        memory: {
          total: stats.total,
          withEmbeddings: stats.withEmbeddings,
          byCategory: stats.byCategory,
          byNamespace: stats.byNamespace
        },
        model: {
          name: modelInfo.name,
          available: modelInfo.available,
          loading: modelInfo.loading || false,
          cached: modelInfo.cached,
          size: modelInfo.sizeMB,
          path: modelInfo.path
        },
        config: {
          dataDir: config.dataDir,
          defaultNamespace: config.defaults.namespace,
          recallLimit: config.defaults.recallLimit,
          secretDetection: config.security.secretDetection
        }
      };
    } catch (error) {
      logger.error('Status endpoint error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Create memory endpoint
  fastify.post('/api/memories', async (request, reply) => {
    try {
      const { content, category, entity, confidence, namespace, tags } = request.body;

      if (!content) {
        reply.code(400);
        return { error: 'Content is required' };
      }

      // Validate content for secrets
      const validation = validateContent(content, {
        autoRedact: config.security?.secretDetection !== false
      });

      if (!validation.valid) {
        reply.code(400);
        return {
          error: 'Cannot store memory',
          details: validation.errors,
          warnings: validation.warnings
        };
      }

      // Auto-extract category and entity if not provided
      let memoryData = {
        content: validation.content,
        category: category || 'fact',
        entity: entity,
        confidence: confidence !== undefined ? confidence : 0.8,
        namespace: namespace || 'default',
        tags: tags || [],
        source: 'api'
      };

      if (!entity || !category) {
        const extracted = extractMemory(validation.content, {
          source: 'api',
          namespace: namespace || 'default'
        });

        if (!entity) {
          memoryData.entity = extracted.entity;
        }
        if (!category) {
          memoryData.category = extracted.category;
        }
      }

      // Generate embedding
      try {
        const { generateEmbedding } = await import('../embed/index.js');
        const embedding = await generateEmbedding(validation.content, modelsPath);
        memoryData.embedding = embedding;
      } catch (error) {
        logger.warn('Failed to generate embedding', { error: error.message });
      }

      // Store memory
      const memory = createMemory(db, memoryData);

      logger.info('Memory created via API', { id: memory.id, category: memory.category });

      return {
        success: true,
        memory: {
          id: memory.id,
          content: memory.content,
          category: memory.category,
          entity: memory.entity,
          confidence: memory.confidence,
          namespace: memory.namespace,
          tags: memory.tags,
          createdAt: memory.created_at
        },
        warnings: validation.warnings
      };
    } catch (error) {
      logger.error('Create memory error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // List memories endpoint
  fastify.get('/api/memories', async (request, reply) => {
    try {
      const { limit = 50, offset = 0, category, namespace } = request.query;

      const memories = listMemories(db, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        category,
        namespace
      });

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as count FROM memories WHERE 1=1';
      const countParams = [];
      if (namespace) { countQuery += ' AND namespace = ?'; countParams.push(namespace); }
      if (category) { countQuery += ' AND category = ?'; countParams.push(category); }
      const totalCount = db.prepare(countQuery).get(...countParams).count;

      return {
        success: true,
        memories: memories.map(m => ({
          id: m.id,
          content: m.content,
          category: m.category,
          entity: m.entity,
          confidence: m.confidence,
          namespace: m.namespace,
          tags: m.tags,
          accessCount: m.access_count,
          createdAt: m.created_at,
          lastAccessed: m.last_accessed
        })),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      };
    } catch (error) {
      logger.error('List memories error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Search/recall memories endpoint
  fastify.post('/api/memories/search', async (request, reply) => {
    try {
      const { query, limit = 5, category, namespace, threshold = 0.3 } = request.body;

      if (!query) {
        reply.code(400);
        return { error: 'Query is required' };
      }

      const memories = await recallMemories(
        db,
        query,
        { limit, category, namespace, threshold },
        modelsPath
      );

      return {
        success: true,
        query,
        memories: memories.map(m => ({
          id: m.id,
          content: m.content,
          category: m.category,
          entity: m.entity,
          confidence: m.confidence,
          namespace: m.namespace,
          tags: m.tags,
          score: m.score,
          scoreBreakdown: m.scoreBreakdown,
          accessCount: m.access_count,
          createdAt: m.created_at,
          lastAccessed: m.last_accessed
        }))
      };
    } catch (error) {
      logger.error('Search memories error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Get single memory endpoint
  fastify.get('/api/memories/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const memory = getMemory(db, id);

      if (!memory) {
        reply.code(404);
        return { error: 'Memory not found' };
      }

      return {
        success: true,
        memory: {
          id: memory.id,
          content: memory.content,
          category: memory.category,
          entity: memory.entity,
          confidence: memory.confidence,
          namespace: memory.namespace,
          tags: memory.tags,
          accessCount: memory.access_count,
          decayRate: memory.decay_rate,
          createdAt: memory.created_at,
          updatedAt: memory.updated_at,
          lastAccessed: memory.last_accessed,
          hasEmbedding: !!memory.embedding
        }
      };
    } catch (error) {
      logger.error('Get memory error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Delete memory endpoint
  fastify.delete('/api/memories/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      // Check if memory exists
      const memory = getMemory(db, id);
      if (!memory) {
        reply.code(404);
        return { error: 'Memory not found' };
      }

      // Delete the memory
      const deleted = deleteMemory(db, id);

      if (deleted) {
        logger.info('Memory deleted via API', { id });
        return {
          success: true,
          message: 'Memory deleted successfully',
          deletedMemory: {
            id: memory.id,
            content: memory.content
          }
        };
      } else {
        reply.code(500);
        return { error: 'Failed to delete memory' };
      }
    } catch (error) {
      logger.error('Delete memory error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Consolidate endpoint
  fastify.post('/api/consolidate', async (request, reply) => {
    try {
      const {
        detectDuplicates = true,
        detectContradictions = true,
        applyDecay = true,
        cleanupStale = false
      } = request.body || {};

      const results = await consolidate(db, {
        detectDuplicates,
        detectContradictions,
        applyDecay,
        cleanupStale
      });

      logger.info('Consolidation completed via API', results);

      return {
        success: true,
        results: {
          duplicatesRemoved: results.duplicatesRemoved,
          contradictionsDetected: results.contradictionsDetected,
          memoriesDecayed: results.memoriesDecayed,
          staleMemoriesCleaned: results.staleMemoriesCleaned,
          duration: results.duration
        }
      };
    } catch (error) {
      logger.error('Consolidate error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Get conflicts endpoint
  fastify.get('/api/conflicts', async (request, reply) => {
    try {
      const conflicts = getConflicts(db);

      return {
        success: true,
        conflicts: conflicts.map(conflict => ({
          conflictId: conflict.conflictId,
          memories: conflict.memories.map(m => ({
            id: m.id,
            content: m.content,
            category: m.category,
            entity: m.entity,
            confidence: m.confidence,
            createdAt: m.created_at
          }))
        }))
      };
    } catch (error) {
      logger.error('Get conflicts error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // --- Analytics endpoints ---

  fastify.get('/api/analytics/overview', async (request, reply) => {
    try {
      const overview = getOverview(db);
      const trends = getTrends(db);
      const healthScore = calculateHealthScore(overview, 0, trends);

      return { ...overview, healthScore };
    } catch (error) {
      logger.error('Analytics overview error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  fastify.get('/api/analytics/stale', async (request, reply) => {
    try {
      const { days = 30, limit = 50 } = request.query;
      return getStaleMemories(db, parseInt(days), parseInt(limit));
    } catch (error) {
      logger.error('Analytics stale error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  fastify.get('/api/analytics/never-recalled', async (request, reply) => {
    try {
      const { limit = 50 } = request.query;
      return getNeverRecalled(db, parseInt(limit));
    } catch (error) {
      logger.error('Analytics never-recalled error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  fastify.get('/api/analytics/duplicates', async (request, reply) => {
    try {
      return getDuplicateClusters(db);
    } catch (error) {
      logger.error('Analytics duplicates error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  fastify.get('/api/analytics/trends', async (request, reply) => {
    try {
      const { days = 30 } = request.query;
      return getTrends(db, parseInt(days));
    } catch (error) {
      logger.error('Analytics trends error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  fastify.post('/api/memories/bulk-delete', async (request, reply) => {
    try {
      const { ids } = request.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        reply.code(400);
        return { error: 'ids array is required' };
      }

      let deleted = 0;
      for (const id of ids) {
        if (deleteMemory(db, id)) deleted++;
      }

      return { success: true, deleted };
    } catch (error) {
      logger.error('Bulk delete error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Get installation info endpoint
  fastify.get('/api/installation-info', async (request, reply) => {
    try {
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const fs = await import('fs');

      // Determine installation path
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const installationPath = path.resolve(__dirname, '../../bin/engram.js');

      // Verify the path exists
      const exists = fs.existsSync(installationPath);

      return {
        success: true,
        installation: {
          binPath: installationPath,
          exists,
          platform: process.platform,
          nodeVersion: process.version
        }
      };
    } catch (error) {
      logger.error('Installation info error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Export to static context endpoint
  fastify.post('/api/export/static', async (request, reply) => {
    try {
      const {
        namespace,
        format = 'markdown',
        categories,
        min_confidence = 0.5,
        min_access = 0,
        include_low_feedback = false,
        group_by = 'category',
        header,
        footer
      } = request.body;

      if (!namespace) {
        reply.code(400);
        return { error: 'Namespace is required' };
      }

      const result = exportToStatic(db, {
        namespace,
        format,
        categories,
        minConfidence: min_confidence,
        minAccess: min_access,
        includeLowFeedback: include_low_feedback,
        groupBy: group_by,
        header,
        footer
      });

      return {
        success: true,
        content: result.content,
        filename: result.filename,
        stats: result.stats
      };
    } catch (error) {
      logger.error('Export error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // === Import Wizard Endpoints ===

  // Get available import sources with detection status
  fastify.get('/api/import/sources', async (request, reply) => {
    try {
      const { detectSources } = await import('../import/index.js');
      const rawCwd = request.query.cwd;
      const cwd = rawCwd ? sanitizePath(rawCwd) || process.cwd() : process.cwd();
      const paths = request.query.paths
        ? sanitizePaths(request.query.paths.split(','))
        : undefined;
      const sources = await detectSources({ cwd, paths });

      return {
        success: true,
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          label: s.label,
          description: s.description,
          category: s.category,
          detected: s.detected
        }))
      };
    } catch (error) {
      logger.error('Import sources error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Scan selected sources for memory candidates
  fastify.post('/api/import/scan', async (request, reply) => {
    try {
      const { sources, cwd: rawCwd, paths: rawPaths } = request.body;

      if (!sources || !Array.isArray(sources) || sources.length === 0) {
        reply.code(400);
        return { error: 'sources array is required' };
      }

      const { scanSources } = await import('../import/index.js');
      const cwd = rawCwd ? sanitizePath(rawCwd) || process.cwd() : process.cwd();
      const scanOptions = { cwd };
      const sanitized = sanitizePaths(rawPaths);
      if (sanitized.length > 0) {
        scanOptions.paths = sanitized;
      }
      const result = await scanSources(sources, scanOptions);

      return {
        success: true,
        memories: result.memories.map((m, i) => ({
          _index: i,
          content: m.content,
          category: m.category,
          entity: m.entity,
          confidence: m.confidence,
          tags: m.tags,
          source: m.source
        })),
        skipped: result.skipped,
        warnings: result.warnings,
        sources: result.sources,
        duration: result.duration
      };
    } catch (error) {
      logger.error('Import scan error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Commit imported memories
  fastify.post('/api/import/commit', async (request, reply) => {
    try {
      const { memories, namespace } = request.body;

      if (!memories || !Array.isArray(memories) || memories.length === 0) {
        reply.code(400);
        return { error: 'memories array is required' };
      }

      const { commitMemories } = await import('../import/index.js');
      const result = await commitMemories(db, memories, { namespace });

      return {
        success: true,
        results: {
          total: result.total,
          created: result.created,
          duplicates: result.duplicates,
          merged: result.merged,
          rejected: result.rejected,
          errors: result.errors,
          duration: result.duration
        }
      };
    } catch (error) {
      logger.error('Import commit error', { error: error.message });
      reply.code(500);
      return { error: error.message };
    }
  });

  // Serve dashboard static files (skip if dist dir doesn't exist, e.g. in sidecar bundle)
  const dashboardPath = path.resolve(__dirname, '../../dashboard/dist');
  const hasDashboard = fs.existsSync(dashboardPath);

  if (hasDashboard) {
    fastify.register(fastifyStatic, {
      root: dashboardPath,
      prefix: '/'
    });
  } else {
    logger.warn('Dashboard dist not found, skipping static file serving', { path: dashboardPath });
  }

  // Fallback to index.html for SPA routing (only when dashboard is available)
  fastify.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/health') && hasDashboard) {
      reply.type('text/html').sendFile('index.html');
    } else {
      reply.code(404).send({ error: 'Not found' });
    }
  });

  // Cleanup on shutdown
  fastify.addHook('onClose', async (instance) => {
    if (db) {
      db.close();
      logger.info('Database connection closed');
    }
  });

  return fastify;
}

/**
 * Start the REST API server
 * @param {Object} config - Engram configuration
 * @param {number} port - Port to listen on
 * @returns {Promise<Object>} Running Fastify instance
 */
export async function startRESTServer(config, port = 3838) {
  try {
    const fastify = createRESTServer(config);

    await fastify.listen({ port, host: '127.0.0.1' });

    logger.info('REST API server started', { port, url: `http://localhost:${port}` });

    // Set TRANSFORMERS_CACHE early so isModelAvailable() can find cached models
    const modelsPath = getModelsPath(config);
    process.env.TRANSFORMERS_CACHE = modelsPath;

    // Pre-warm embedding pipeline in background so status reports correctly
    import('../embed/index.js').then(({ initializePipeline }) => {
      initializePipeline(modelsPath).then(() => {
        logger.info('Embedding pipeline pre-warmed');
      }).catch(err => {
        logger.warn('Embedding pipeline pre-warm failed (will retry on first use)', { error: err.message });
      });
    }).catch(err => {
      logger.warn('Failed to import embedding module for pre-warm', { error: err?.message ?? String(err) });
    });

    return fastify;
  } catch (error) {
    logger.error('Failed to start REST server', { error: error.message });
    throw error;
  }
}
