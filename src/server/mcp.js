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
 * Provides 4 tools: engram_remember, engram_recall, engram_forget, engram_status
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
            description: 'Store a memory/fact/preference/pattern that should be remembered across sessions. Use this when you learn something important about the user, their project, their preferences, infrastructure, or workflow patterns.',
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
                  description: 'How confident you are this is accurate (0.0-1.0). Default 0.8. Use 1.0 for things the user explicitly stated. Use 0.5-0.7 for inferred preferences.',
                  default: 0.8
                },
                namespace: {
                  type: 'string',
                  description: 'Project or scope for this memory. Use "default" for general memories, or a project name for project-specific ones.',
                  default: 'default'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional tags for categorization'
                },
                force: {
                  type: 'boolean',
                  description: 'Bypass deduplication check. If true, memory will be stored even if a similar one exists. Default: false',
                  default: false
                }
              },
              required: ['content']
            }
          },
          {
            name: 'engram_recall',
            description: 'Retrieve relevant memories for the current context. Call this at the start of a session or when you need to remember something about the user, their project, or their preferences. Returns the most relevant memories ranked by similarity and recency.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'What you want to remember. Can be a question ("what is their deployment setup?") or a topic ("docker configuration"). Be specific for better results.'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum memories to return (1-20). Default 5. Keep low to avoid context pollution.',
                  default: 5
                },
                category: {
                  type: 'string',
                  enum: ['preference', 'fact', 'pattern', 'decision', 'outcome'],
                  description: 'Optional: filter by memory type'
                },
                namespace: {
                  type: 'string',
                  description: 'Optional: filter by project/scope. Omit to search all namespaces.'
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum relevance score (0.0-1.0). Default 0.3. Increase to get fewer, more relevant results.',
                  default: 0.3
                },
                time_filter: {
                  type: 'object',
                  description: 'Filter memories by time range. Supports relative times like "3 days ago", "last week", or ISO dates.',
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
            description: 'Remove a specific memory by ID. Use when a memory is outdated, incorrect, or the user asks you to forget something.',
            inputSchema: {
              type: 'object',
              properties: {
                memory_id: {
                  type: 'string',
                  description: 'The ID of the memory to remove (returned by engram_recall)'
                }
              },
              required: ['memory_id']
            }
          },
          {
            name: 'engram_feedback',
            description: 'Provide feedback on a recalled memory to help improve future recall accuracy. Positive feedback increases a memory\'s relevance score; negative feedback decreases it.',
            inputSchema: {
              type: 'object',
              properties: {
                memory_id: {
                  type: 'string',
                  description: 'The ID of the memory to provide feedback on (returned by engram_recall)'
                },
                helpful: {
                  type: 'boolean',
                  description: 'Was this memory helpful in the current context? true = helpful, false = not helpful'
                },
                context: {
                  type: 'string',
                  description: 'Optional: describe the context or query that prompted this feedback'
                }
              },
              required: ['memory_id', 'helpful']
            }
          },
          {
            name: 'engram_context',
            description: 'Generate a pre-formatted context block of relevant memories to inject into your system prompt or conversation. Use this at the start of a session to load relevant user context.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Optional query to filter relevant memories. If omitted, returns top memories by access frequency and recency.'
                },
                namespace: {
                  type: 'string',
                  description: 'Namespace to pull context from (default: "default")',
                  default: 'default'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum memories to include (1-25). Default 10.',
                  default: 10
                },
                format: {
                  type: 'string',
                  enum: ['markdown', 'xml', 'json', 'plain'],
                  description: 'Output format. markdown=human-readable, xml=structured, json=programmatic, plain=raw text',
                  default: 'markdown'
                },
                include_metadata: {
                  type: 'boolean',
                  description: 'Include memory IDs and confidence scores in output',
                  default: false
                },
                categories: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by categories (e.g., ["preference", "fact"])'
                },
                max_tokens: {
                  type: 'number',
                  description: 'Approximate token budget. Will truncate to fit. Default 1000.',
                  default: 1000
                }
              }
            }
          },
          {
            name: 'engram_status',
            description: 'Check Engram health and stats. Returns memory count, database size, embedding model status, and configuration.',
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
 */
export async function startMCPServer(configPath) {
  try {
    const config = loadConfig(configPath);
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
