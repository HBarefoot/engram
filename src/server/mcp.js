import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, getDatabasePath, getModelsPath } from '../config/index.js';
import { initDatabase, createMemory, createMemoryWithDedup, getMemory, deleteMemory, getStats } from '../memory/store.js';
import { recallMemories, formatRecallResults } from '../memory/recall.js';
import { recordFeedback, getFeedbackStats } from '../memory/feedback.js';
import { generateContext } from '../memory/context.js';
import { validateContent } from '../extract/secrets.js';
import { extractMemory } from '../extract/rules.js';
import * as logger from '../utils/logger.js';

/**
 * MCP Server for Engram
 * Provides 6 tools: engram_remember, engram_recall, engram_forget, engram_feedback, engram_context, engram_status
 */
export class EngramMCPServer {
  constructor(config) {
    this.config = config;
    this.db = null;
    this.server = new Server(
      {
        name: 'engram',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  /**
   * Initialize database connection
   */
  initializeDatabase() {
    if (!this.db) {
      const dbPath = getDatabasePath(this.config);
      this.db = initDatabase(dbPath);
      logger.info('MCP Server database initialized', { path: dbPath });
    }
    return this.db;
  }

  /**
   * Setup MCP tool handlers
   */
  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'engram_remember',
            description: 'Store a durable memory (fact/preference/pattern/decision/outcome) that persists across sessions. Every write is scanned for secrets (16+ patterns — OpenAI/Stripe/AWS/GitHub/Slack/Google keys, private keys, connection strings, JWTs): by default detected secrets are redacted to [REDACTED] before storage, or the write is rejected if auto-redaction is disabled. Category and entity are auto-extracted when omitted, a local embedding is generated, and the content is deduplicated against existing memories. Returns: the memory id plus an outcome — "created" (new), "merged" (0.92–0.95 cosine to an existing memory; content/tags/confidence folded into it), or "duplicate" (≥0.95 cosine; not stored unless force:true). Use when you learn something worth remembering about the user, project, setup, or workflow; recall with engram_recall, delete with engram_forget.',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The memory to store. Be specific and factual. Good: "User prefers Fastify over Express for Node.js APIs". Bad: "User likes stuff".'
                },
                category: {
                  type: 'string',
                  enum: ['preference', 'fact', 'pattern', 'decision', 'outcome'],
                  description: 'Type of memory. preference=user likes/dislikes, fact=objective truth about their setup, pattern=recurring workflow, decision=choice they made and why, outcome=result of an action',
                  default: 'fact'
                },
                entity: {
                  type: 'string',
                  description: 'What this memory is about (e.g., "nginx", "deployment", "coding-style", "project-api"). Helps with retrieval.'
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'How confident this memory is accurate, 0.0–1.0 (default 0.8). Use 1.0 for facts the user explicitly stated, 0.5–0.7 for inferred preferences.',
                  default: 0.8
                },
                namespace: {
                  type: 'string',
                  description: 'Project/scope to store under (default "default"). Use a project name to isolate project-specific memories; "default" for general ones.',
                  default: 'default'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional string tags for categorization and retrieval, e.g. ["backend", "api"].'
                },
                force: {
                  type: 'boolean',
                  description: 'If true, bypass the duplicate check and store even when a ≥0.95-similar memory already exists (creates a near-identical copy — use sparingly). Default false.',
                  default: false
                }
              },
              required: ['content']
            }
          },
          {
            name: 'engram_recall',
            description: 'Retrieve memories relevant to a query, ranked by a hybrid score. Embeds the query, gathers candidates (FTS5 top-20 plus in-namespace embeddings, optionally time-filtered), and scores each by similarity×0.45 + recency×0.15 + confidence×0.15 + access×0.05 + feedback×0.10 + a 0.1 FTS boost, then filters by category/threshold and returns the top results. If embedding generation fails it falls back to FTS-only search. Reading a memory bumps its last_accessed and access_count. Returns: an array of memory objects — each with id, content, category, entity, confidence, namespace, tags, timestamps, score, and scoreBreakdown — or an empty array if nothing clears the threshold (with a time_filter, the array also carries timeRange metadata). Use at session start or to look up a specific fact; prefer engram_context when you want a ready-to-inject block instead of raw results.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'What you want to remember. Can be a question ("what is their deployment setup?") or a topic ("docker configuration"). Be specific for better results.'
                },
                limit: {
                  type: 'number',
                  minimum: 1,
                  maximum: 20,
                  description: 'Maximum memories to return, 1–20 (default 5). Keep low to avoid context pollution.',
                  default: 5
                },
                category: {
                  type: 'string',
                  enum: ['preference', 'fact', 'pattern', 'decision', 'outcome'],
                  description: 'Optional filter by memory type (preference/fact/pattern/decision/outcome). Omit to search all types.'
                },
                namespace: {
                  type: 'string',
                  description: 'Optional project/scope filter. Omit to search across all namespaces.'
                },
                threshold: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Minimum relevance score to include a result, 0.0–1.0 (default 0.3). Raise for fewer, more precise results.',
                  default: 0.3
                },
                time_filter: {
                  type: 'object',
                  description: 'Restrict results to a time range by created/updated time. Provide after/before, or a period shorthand. Supports relative times like "3 days ago", "last week", or ISO dates.',
                  properties: {
                    after: {
                      type: 'string',
                      description: 'Start time - ISO date (2024-01-01) or relative (3 days ago, last week, yesterday)'
                    },
                    before: {
                      type: 'string',
                      description: 'End time - ISO date or relative (today, now)'
                    },
                    period: {
                      type: 'string',
                      enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'this_year', 'last_year'],
                      description: 'Shorthand for common time periods'
                    }
                  }
                }
              },
              required: ['query']
            }
          },
          {
            name: 'engram_forget',
            description: 'Permanently delete one memory by id. Irreversible — also removes that memory\'s feedback rows. Returns: whether a memory with the given id was found and deleted; reports not-found without error if the id doesn\'t exist. Use when a memory is wrong, outdated, or the user asks you to forget it. If you\'re unsure, downvote with engram_feedback (helpful:false) instead of deleting.',
            inputSchema: {
              type: 'object',
              properties: {
                memory_id: {
                  type: 'string',
                  description: 'The id of the memory to delete, as returned by engram_recall or engram_remember.'
                }
              },
              required: ['memory_id']
            }
          },
          {
            name: 'engram_feedback',
            description: 'Record a helpful/unhelpful vote on a recalled memory to tune future ranking. Updates the memory\'s aggregated feedback_score (−1 to 1), which feeds the recall score (weight 0.10); after 5+ votes it may auto-adjust the memory\'s confidence (strongly negative lowers it, strongly positive raises it). Returns: the updated feedback stats for that memory. Call right after acting on a memory from engram_recall to close the learning loop; to remove a bad memory outright, use engram_forget instead.',
            inputSchema: {
              type: 'object',
              properties: {
                memory_id: {
                  type: 'string',
                  description: 'The id of the memory being rated, taken from a prior engram_recall result.'
                },
                helpful: {
                  type: 'boolean',
                  description: 'true if the memory was useful in this context (raises its feedback_score and future ranking), false if not (lowers it).'
                },
                context: {
                  type: 'string',
                  description: 'Optional note describing the query or situation that prompted this vote; stored for later review.'
                }
              },
              required: ['memory_id', 'helpful']
            }
          },
          {
            name: 'engram_context',
            description: 'Build a single pre-formatted context block from relevant memories, ready to inject into a system prompt at session start. With a query it selects semantically relevant memories; with no query it returns the top memories by access frequency and recency. The block is rendered in the requested format and truncated to fit max_tokens. Returns: one formatted string (not an array) — contrast with engram_recall, which returns raw scored memory objects. Use when you want drop-in context text; use engram_recall when you need structured results to reason over.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Optional query to select relevant memories. If omitted, returns top memories by access frequency and recency.'
                },
                namespace: {
                  type: 'string',
                  description: 'Namespace to pull memories from (default "default").',
                  default: 'default'
                },
                limit: {
                  type: 'number',
                  minimum: 1,
                  maximum: 25,
                  description: 'Maximum memories to include, 1–25 (default 10).',
                  default: 10
                },
                format: {
                  type: 'string',
                  enum: ['markdown', 'xml', 'json', 'plain'],
                  description: 'Output format (default markdown): markdown=human-readable headings, xml=structured tags, json=machine-parseable, plain=raw text.',
                  default: 'markdown'
                },
                include_metadata: {
                  type: 'boolean',
                  description: 'If true, append each memory\'s id and confidence to the output (markdown and xml formats only). Default false.',
                  default: false
                },
                categories: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional list of memory types to include, e.g. ["preference", "fact"]; omit for all.'
                },
                max_tokens: {
                  type: 'number',
                  minimum: 50,
                  description: 'Approximate token budget for the block; lower-priority memories are dropped to fit (default 1000).',
                  default: 1000
                }
              }
            }
          },
          {
            name: 'engram_status',
            description: 'Report Engram health and statistics. Read-only and parameter-free. Returns: memory counts by category and namespace, embedding-model status (name, cached/loaded state, size), the database location, and key config (default namespace, recall limit, confidence threshold, secret-detection on/off). Use as a diagnostics/health check — to confirm the model is loaded and see how many memories exist — before relying on recall.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'engram_remember':
            return await this.handleRemember(args);
          case 'engram_recall':
            return await this.handleRecall(args);
          case 'engram_forget':
            return await this.handleForget(args);
          case 'engram_feedback':
            return await this.handleFeedback(args);
          case 'engram_context':
            return await this.handleContext(args);
          case 'engram_status':
            return await this.handleStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error('Tool execution error', { error: error.message, stack: error.stack });
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  /**
   * Handle engram_remember tool
   */
  async handleRemember(args) {
    const db = this.initializeDatabase();
    const { content, category, entity, confidence, namespace, tags, force } = args;

    logger.info('Remember requested', { category, entity, namespace, force });

    // Validate content for secrets
    const validation = validateContent(content, {
      autoRedact: this.config.security?.secretDetection !== false
    });

    if (!validation.valid) {
      const errorMsg = `Cannot store memory: ${validation.errors.join(', ')}`;
      logger.warn('Memory rejected due to secrets', { errors: validation.errors });

      return {
        content: [
          {
            type: 'text',
            text: errorMsg
          }
        ]
      };
    }

    // Auto-extract category and entity if not provided
    let memoryData = {
      content: validation.content, // Use potentially redacted content
      category: category || 'fact',
      entity: entity,
      confidence: confidence !== undefined ? confidence : 0.8,
      namespace: namespace || 'default',
      tags: tags || [],
      source: 'mcp'
    };

    // Extract category/entity if not provided
    if (!entity || !category) {
      const extracted = extractMemory(validation.content, {
        source: 'mcp',
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
      const modelsPath = getModelsPath(this.config);
      const embedding = await generateEmbedding(validation.content, modelsPath);
      memoryData.embedding = embedding;
      logger.debug('Embedding generated for memory');
    } catch (error) {
      logger.warn('Failed to generate embedding, storing without it', { error: error.message });
    }

    // Store memory with deduplication check
    const result = createMemoryWithDedup(db, memoryData, { force: force || false });

    let responseText;

    switch (result.status) {
      case 'duplicate':
        responseText = `Similar memory already exists (${(result.similarity * 100).toFixed(1)}% match)\n\nExisting ID: ${result.id}\nExisting content: ${result.existingContent}\n\nUse force: true to store anyway.`;
        logger.info('Duplicate memory rejected', { existingId: result.id, similarity: result.similarity });
        break;

      case 'merged':
        responseText = `Memory merged with existing (${(result.similarity * 100).toFixed(1)}% match)\n\nID: ${result.id}\nCategory: ${result.memory.category}\nEntity: ${result.memory.entity || 'none'}\nConfidence: ${result.memory.confidence}\nNamespace: ${result.memory.namespace}\n\nMerged content: ${result.memory.content}`;
        logger.info('Memory merged', { id: result.id, similarity: result.similarity });
        break;

      case 'created':
      default:
        responseText = `Memory stored successfully!\n\nID: ${result.id}\nCategory: ${result.memory.category}\nEntity: ${result.memory.entity || 'none'}\nConfidence: ${result.memory.confidence}\nNamespace: ${result.memory.namespace}`;
        logger.info('Memory stored', { id: result.id, category: result.memory.category });
        break;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      responseText += `\n\nWarnings: ${validation.warnings.join(', ')}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  }

  /**
   * Handle engram_recall tool
   */
  async handleRecall(args) {
    const db = this.initializeDatabase();
    const { query, limit = 5, category, namespace, threshold = 0.3, time_filter } = args;

    logger.info('Recall requested', { query, limit, category, namespace, threshold, time_filter });

    const modelsPath = getModelsPath(this.config);

    // Recall memories
    const memories = await recallMemories(
      db,
      query,
      { limit, category, namespace, threshold, time_filter },
      modelsPath
    );

    // Format results
    const formattedResults = formatRecallResults(memories);

    return {
      content: [
        {
          type: 'text',
          text: formattedResults
        }
      ]
    };
  }

  /**
   * Handle engram_forget tool
   */
  async handleForget(args) {
    const db = this.initializeDatabase();
    const { memory_id } = args;

    logger.info('Forget requested', { memory_id });

    // Check if memory exists
    const memory = getMemory(db, memory_id);

    if (!memory) {
      return {
        content: [
          {
            type: 'text',
            text: `Memory not found: ${memory_id}`
          }
        ]
      };
    }

    // Delete the memory
    const deleted = deleteMemory(db, memory_id);

    if (deleted) {
      logger.info('Memory deleted', { id: memory_id });
      return {
        content: [
          {
            type: 'text',
            text: `Memory deleted successfully: ${memory_id}\n\nContent: ${memory.content}`
          }
        ]
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to delete memory: ${memory_id}`
          }
        ]
      };
    }
  }

  /**
   * Handle engram_feedback tool
   */
  async handleFeedback(args) {
    const db = this.initializeDatabase();
    const { memory_id, helpful, context } = args;

    logger.info('Feedback requested', { memory_id, helpful, context });

    // Check if memory exists
    const memory = getMemory(db, memory_id);

    if (!memory) {
      return {
        content: [
          {
            type: 'text',
            text: `Memory not found: ${memory_id}`
          }
        ]
      };
    }

    // Record the feedback
    const result = recordFeedback(db, memory_id, helpful, context);

    const helpfulText = helpful ? 'helpful' : 'not helpful';
    let responseText = `Feedback recorded: memory marked as ${helpfulText}\n\n`;
    responseText += `Memory ID: ${memory_id}\n`;
    responseText += `Feedback Score: ${result.feedbackScore.toFixed(2)} (${result.helpfulCount} helpful, ${result.unhelpfulCount} unhelpful)\n`;

    if (result.confidenceAdjusted) {
      responseText += `\nConfidence adjusted to: ${result.newConfidence.toFixed(2)}`;
    }

    logger.info('Feedback recorded', {
      memoryId: memory_id,
      helpful,
      feedbackScore: result.feedbackScore,
      confidenceAdjusted: result.confidenceAdjusted
    });

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  }

  /**
   * Handle engram_context tool
   */
  async handleContext(args) {
    const db = this.initializeDatabase();
    const {
      query,
      namespace = 'default',
      limit = 10,
      format = 'markdown',
      include_metadata = false,
      categories,
      max_tokens = 1000
    } = args;

    logger.info('Context requested', { query, namespace, limit, format });

    const modelsPath = getModelsPath(this.config);

    // Generate context
    const result = await generateContext(db, {
      query,
      namespace,
      limit: Math.min(limit, 25),
      format,
      include_metadata,
      categories,
      max_tokens
    }, modelsPath);

    return {
      content: [
        {
          type: 'text',
          text: result.content
        }
      ]
    };
  }

  /**
   * Handle engram_status tool
   */
  async handleStatus() {
    const db = this.initializeDatabase();

    logger.info('Status requested');

    // Get database stats
    const stats = getStats(db);

    // Get model info
    const modelsPath = getModelsPath(this.config);
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

    // Build status response
    const statusText = `Engram Status

📊 Memory Statistics:
- Total memories: ${stats.total}
- With embeddings: ${stats.withEmbeddings}
- By category: ${Object.entries(stats.byCategory).map(([k, v]) => `${k}=${v}`).join(', ')}
- By namespace: ${Object.entries(stats.byNamespace).map(([k, v]) => `${k}=${v}`).join(', ')}

🤖 Embedding Model:
- Name: ${modelInfo.name}
- Status: ${modelInfo.cached ? 'Ready' : modelInfo.loading ? 'Loading...' : modelInfo.available ? 'Available (not loaded)' : 'Not available'}
- Cached: ${modelInfo.cached ? 'Yes' : 'No'}
- Size: ${modelInfo.sizeMB} MB
- Path: ${modelInfo.path}

⚙️  Configuration:
- Data directory: ${this.config.dataDir}
- Default namespace: ${this.config.defaults.namespace}
- Recall limit: ${this.config.defaults.recallLimit}
- Confidence threshold: ${this.config.defaults.confidenceThreshold}
- Secret detection: ${this.config.security.secretDetection ? 'Enabled' : 'Disabled'}
`;

    return {
      content: [
        {
          type: 'text',
          text: statusText
        }
      ]
    };
  }

  /**
   * Start the MCP server
   */
  async start() {
    logger.info('Starting Engram MCP server...');

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('Engram MCP server started successfully');
  }

  /**
   * Close the server
   */
  async close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }

    await this.server.close();
    logger.info('MCP server closed');
  }
}

/**
 * Start the MCP server
 * @param {string} [configPath] - Optional path to config file
 * @param {Object} [options]
 * @param {string} [options.dataDir] - Override the data directory
 */
export async function startMCPServer(configPath, { dataDir } = {}) {
  try {
    const config = loadConfig(configPath, { dataDir });
    const server = new EngramMCPServer(config);

    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down...');
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...');
      await server.close();
      process.exit(0);
    });

    await server.start();
  } catch (error) {
    logger.error('Failed to start MCP server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}
