#!/usr/bin/env node

import { Command } from 'commander';
import { startMCPServer } from '../src/server/mcp.js';
import { startRESTServer } from '../src/server/rest.js';
import { loadConfig, getDatabasePath, getModelsPath } from '../src/config/index.js';
import { initDatabase, createMemory, getMemory, deleteMemory, listMemories, getStats } from '../src/memory/store.js';
import { recallMemories, formatRecallResults } from '../src/memory/recall.js';
import { consolidate, getConflicts } from '../src/memory/consolidate.js';
import { validateContent } from '../src/extract/secrets.js';
import { extractMemory } from '../src/extract/rules.js';
import { exportToStatic } from '../src/export/static.js';
import * as logger from '../src/utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('engram')
  .description('Persistent memory for AI agents - SQLite for agent state')
  .version(packageJson.version);

// Start server command
program
  .command('start')
  .description('Start the Engram server (MCP + REST + Dashboard)')
  .option('--mcp-only', 'Start only the MCP server (stdio mode)')
  .option('--port <port>', 'Custom port for REST API', '3838')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    if (options.mcpOnly) {
      // Start MCP server only (stdio mode)
      logger.info('Starting Engram MCP server (stdio mode)...');
      await startMCPServer(options.config);
    } else {
      // Start REST API server
      const config = loadConfig(options.config);
      const port = parseInt(options.port);

      logger.info('Starting Engram REST API server...');
      logger.info(`Server will be available at http://localhost:${port}`);
      logger.warn('Dashboard UI not yet implemented (Phase 5 pending)');

      await startRESTServer(config, port);

      // Keep process alive
      process.on('SIGINT', () => {
        logger.info('Received SIGINT, shutting down...');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        logger.info('Received SIGTERM, shutting down...');
        process.exit(0);
      });
    }
  });

// Remember command (CLI version)
program
  .command('remember <content>')
  .description('Store a memory from command line')
  .option('-c, --category <type>', 'Memory category (preference|fact|pattern|decision|outcome)', 'fact')
  .option('-e, --entity <name>', 'What this is about')
  .option('--confidence <score>', 'Confidence score (0-1)', parseFloat, 0.8)
  .option('-n, --namespace <name>', 'Project/scope namespace', 'default')
  .option('--config <path>', 'Path to config file')
  .action(async (content, options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      // Validate content
      const validation = validateContent(content, { autoRedact: config.security?.secretDetection !== false });

      if (!validation.valid) {
        console.error('❌ Cannot store memory:', validation.errors.join(', '));
        process.exit(1);
      }

      // Extract if needed
      let memoryData = {
        content: validation.content,
        category: options.category,
        entity: options.entity,
        confidence: options.confidence,
        namespace: options.namespace,
        source: 'cli'
      };

      if (!options.entity) {
        const extracted = extractMemory(content, { source: 'cli', namespace: options.namespace });
        memoryData.entity = extracted.entity;
      }

      // Generate embedding
      try {
        const { generateEmbedding } = await import('../src/embed/index.js');
        const embedding = await generateEmbedding(validation.content, getModelsPath(config));
        memoryData.embedding = embedding;
      } catch (error) {
        logger.warn('Failed to generate embedding', { error: error.message });
      }

      const memory = createMemory(db, memoryData);

      console.log('✅ Memory stored successfully!');
      console.log(`ID: ${memory.id}`);
      console.log(`Category: ${memory.category}`);
      console.log(`Entity: ${memory.entity || 'none'}`);
      console.log(`Confidence: ${memory.confidence}`);
      console.log(`Namespace: ${memory.namespace}`);

      if (validation.warnings?.length > 0) {
        console.log(`\n⚠️  Warnings: ${validation.warnings.join(', ')}`);
      }

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Recall command
program
  .command('recall <query>')
  .description('Recall memories matching a query')
  .option('-l, --limit <n>', 'Max results (default 5)', parseInt, 5)
  .option('-c, --category <type>', 'Filter by category')
  .option('-n, --namespace <name>', 'Filter by namespace')
  .option('--threshold <score>', 'Minimum relevance score (0-1)', parseFloat, 0.3)
  .option('--config <path>', 'Path to config file')
  .action(async (query, options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));
      const modelsPath = getModelsPath(config);

      const memories = await recallMemories(
        db,
        query,
        {
          limit: options.limit,
          category: options.category,
          namespace: options.namespace,
          threshold: options.threshold
        },
        modelsPath
      );

      const formatted = formatRecallResults(memories);
      console.log(formatted);

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Forget command
program
  .command('forget <id>')
  .description('Delete a memory by ID')
  .option('--config <path>', 'Path to config file')
  .action((id, options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const memory = getMemory(db, id);

      if (!memory) {
        console.error(`❌ Memory not found: ${id}`);
        db.close();
        process.exit(1);
      }

      const deleted = deleteMemory(db, id);

      if (deleted) {
        console.log(`✅ Memory deleted: ${id}`);
        console.log(`Content: ${memory.content}`);
      } else {
        console.error(`❌ Failed to delete memory: ${id}`);
      }

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all memories (paginated)')
  .option('-l, --limit <n>', 'Max results', parseInt, 50)
  .option('--offset <n>', 'Offset for pagination', parseInt, 0)
  .option('-c, --category <type>', 'Filter by category')
  .option('-n, --namespace <name>', 'Filter by namespace')
  .option('--config <path>', 'Path to config file')
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const memories = listMemories(db, {
        limit: options.limit,
        offset: options.offset,
        category: options.category,
        namespace: options.namespace
      });

      console.log(`\nFound ${memories.length} memories:\n`);

      memories.forEach((memory, index) => {
        console.log(`[${index + 1}] ${memory.id.substring(0, 8)}`);
        console.log(`    ${memory.content}`);
        console.log(`    Category: ${memory.category} | Entity: ${memory.entity || 'none'} | Confidence: ${memory.confidence}`);
        console.log(`    Namespace: ${memory.namespace} | Accessed: ${memory.access_count} times`);
        console.log('');
      });

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show Engram status and statistics')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));
      const stats = getStats(db);

      console.log('\n📊 Engram Status\n');

      console.log('Memory Statistics:');
      console.log(`  Total memories: ${stats.total}`);
      console.log(`  With embeddings: ${stats.withEmbeddings}`);
      console.log(`  By category:`);
      for (const [category, count] of Object.entries(stats.byCategory)) {
        console.log(`    - ${category}: ${count}`);
      }
      console.log(`  By namespace:`);
      for (const [namespace, count] of Object.entries(stats.byNamespace)) {
        console.log(`    - ${namespace}: ${count}`);
      }

      // Model info
      try {
        const { getModelInfo } = await import('../src/embed/index.js');
        const modelInfo = getModelInfo(getModelsPath(config));

        console.log('\n🤖 Embedding Model:');
        console.log(`  Name: ${modelInfo.name}`);
        console.log(`  Available: ${modelInfo.available ? '✅' : '❌'}`);
        console.log(`  Cached: ${modelInfo.cached ? '✅' : '❌'}`);
        console.log(`  Size: ${modelInfo.sizeMB} MB`);
        console.log(`  Path: ${modelInfo.path}`);
      } catch (error) {
        console.log('\n🤖 Embedding Model: ❌ Not available');
      }

      console.log('\n⚙️  Configuration:');
      console.log(`  Data directory: ${config.dataDir}`);
      console.log(`  Default namespace: ${config.defaults.namespace}`);
      console.log(`  Recall limit: ${config.defaults.recallLimit}`);
      console.log(`  Secret detection: ${config.security.secretDetection ? '✅' : '❌'}`);
      console.log('');

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Consolidate command
program
  .command('consolidate')
  .description('Run consolidation manually')
  .option('--no-duplicates', 'Skip duplicate detection')
  .option('--no-contradictions', 'Skip contradiction detection')
  .option('--no-decay', 'Skip confidence decay')
  .option('--cleanup-stale', 'Enable stale memory cleanup')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      console.log('🔄 Running consolidation...\n');

      const results = await consolidate(db, {
        detectDuplicates: options.duplicates !== false,
        detectContradictions: options.contradictions !== false,
        applyDecay: options.decay !== false,
        cleanupStale: options.cleanupStale === true
      });

      console.log('✅ Consolidation complete!');
      console.log(`  Duplicates removed: ${results.duplicatesRemoved}`);
      console.log(`  Contradictions detected: ${results.contradictionsDetected}`);
      console.log(`  Memories decayed: ${results.memoriesDecayed}`);
      console.log(`  Stale memories cleaned: ${results.staleMemoriesCleaned}`);
      console.log(`  Duration: ${results.duration}ms`);
      console.log('');

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Conflicts command
program
  .command('conflicts')
  .description('Show detected contradictions')
  .option('--config <path>', 'Path to config file')
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const conflicts = getConflicts(db);

      if (conflicts.length === 0) {
        console.log('✅ No conflicts detected');
      } else {
        console.log(`\n⚠️  Found ${conflicts.length} conflict(s):\n`);

        conflicts.forEach((conflict, index) => {
          console.log(`Conflict ${index + 1}: ${conflict.conflictId}`);
          conflict.memories.forEach((memory, mIndex) => {
            console.log(`  [${String.fromCharCode(65 + mIndex)}] ${memory.id.substring(0, 8)}: ${memory.content}`);
          });
          console.log('');
        });
      }

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Export context command
program
  .command('export-context')
  .description('Export memories to a static context file')
  .requiredOption('-n, --namespace <name>', 'Namespace to export from')
  .option('-o, --output <path>', 'Output file path (stdout if omitted)')
  .option('-f, --format <type>', 'Format: markdown, claude, txt, json', 'markdown')
  .option('-c, --categories <list>', 'Comma-separated list of categories')
  .option('--min-confidence <score>', 'Minimum confidence (0-1)', parseFloat, 0.5)
  .option('--min-access <count>', 'Minimum access count', parseInt, 0)
  .option('--include-low-feedback', 'Include memories with negative feedback', false)
  .option('--group-by <field>', 'Group by: category, entity, none', 'category')
  .option('--header <text>', 'Custom header text')
  .option('--footer <text>', 'Custom footer text')
  .option('--config <path>', 'Path to config file')
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const categories = options.categories ? options.categories.split(',') : undefined;

      const result = exportToStatic(db, {
        namespace: options.namespace,
        format: options.format,
        categories,
        minConfidence: options.minConfidence,
        minAccess: options.minAccess,
        includeLowFeedback: options.includeLowFeedback,
        groupBy: options.groupBy,
        header: options.header,
        footer: options.footer
      });

      if (options.output) {
        // Write to file
        fs.writeFileSync(options.output, result.content, 'utf8');
        console.log(`✅ Exported ${result.stats.totalExported} memories to ${options.output}`);
        console.log(`   Size: ${result.stats.sizeKB} KB`);
        console.log(`   By category:`, result.stats.byCategory);
      } else {
        // Output to stdout
        console.log(result.content);
      }

      db.close();
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
