import Fastify from 'fastify';
import { loadConfig, getDatabasePath, getModelsPath } from '../config/index.js';
import { initDatabase, createMemory, getMemory, deleteMemory, listMemories, getStats } from '../memory/store.js';
import { recallMemories } from '../memory/recall.js';
import { consolidate, getConflicts } from '../memory/consolidate.js';
import { validateContent } from '../extract/secrets.js';
import { extractMemory } from '../extract/rules.js';
import { exportToStatic } from '../export/static.js';
import * as logger from '../utils/logger.js';

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

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
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
          error: error.message
        };
      }

      return {
        status: 'ok',
        memory: {
          total: stats.total,
          withEmbeddings: stats.withEmbeddings,
          byCategory: stats.byCategory,
          byNamespace: stats.byNamespace
        },
        model: {
          name: modelInfo.name,
          available: modelInfo.available,
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
          total: memories.length
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

    await fastify.listen({ port, host: '0.0.0.0' });

    logger.info('REST API server started', { port, url: `http://localhost:${port}` });

    return fastify;
  } catch (error) {
    logger.error('Failed to start REST server', { error: error.message });
    throw error;
  }
}
