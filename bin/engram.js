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

// Read version from package.json (may not exist when running as bundled sidecar)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let version = '1.1.0';
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../package.json'), 'utf-8')
  );
  version = packageJson.version;
} catch {
  // Running as bundled sidecar — package.json not available
}

const program = new Command();

program
  .name('engram')
  .description('Persistent memory for AI agents - SQLite for agent state')
  .version(version);

// ── Lazy format helpers (only loaded for non-MCP commands) ───────────

let fmt;
async function loadFormat() {
  if (!fmt) {
    fmt = await import('../src/utils/format.js');
  }
  return fmt;
}

// Start server command
program
  .command('start')
  .description('Start the Engram server (MCP + REST + Dashboard)')
  .option('--mcp-only', 'Start only the MCP server (stdio mode)')
  .option('--port <port>', 'Custom port for REST API', '3838')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    if (options.mcpOnly) {
      // Start MCP server only (stdio mode) — no formatting imports
      logger.info('Starting Engram MCP server (stdio mode)...');
      await startMCPServer(options.config);
    } else {
      const f = await loadFormat();
      const chalk = (await import('chalk')).default;
      const config = loadConfig(options.config);
      const port = parseInt(options.port);

      f.printHeader(version);

      f.info(`REST API   ${chalk.cyan(`http://localhost:${port}`)}`);
      f.info(`Dashboard  ${chalk.cyan(`http://localhost:${port}`)}`);
      console.log('');

      await startRESTServer(config, port);

      // Keep process alive
      process.on('SIGINT', () => {
        console.log('');
        f.info('Shutting down...');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        f.info('Shutting down...');
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
    const f = await loadFormat();
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      // Validate content
      const validation = validateContent(content, { autoRedact: config.security?.secretDetection !== false });

      if (!validation.valid) {
        f.error(`Cannot store memory: ${validation.errors.join(', ')}`);
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

      // Generate embedding with spinner
      const spin = f.spinner('Generating embedding...');
      spin.start();
      try {
        const { generateEmbedding } = await import('../src/embed/index.js');
        const embedding = await generateEmbedding(validation.content, getModelsPath(config));
        memoryData.embedding = embedding;
        spin.succeed('Embedding generated');
      } catch (error) {
        spin.warn('Embedding skipped (model unavailable)');
      }

      const memory = createMemory(db, memoryData);

      console.log('');
      f.success('Memory stored');
      console.log('');
      f.printKeyValue([
        ['ID',         memory.id],
        ['Category',   f.categoryBadge(memory.category)],
        ['Entity',     memory.entity || 'none'],
        ['Confidence', f.confidenceColor(memory.confidence)],
        ['Namespace',  memory.namespace]
      ]);

      if (validation.warnings?.length > 0) {
        console.log('');
        f.warning(`Warnings: ${validation.warnings.join(', ')}`);
      }
      console.log('');

      db.close();
    } catch (error) {
      f.error(error.message);
      process.exit(1);
    }
  });

// Recall command
program
  .command('recall <query>')
  .description('Recall memories matching a query')
  .option('-l, --limit <n>', 'Max results (default 5)', v => parseInt(v, 10), 5)
  .option('-c, --category <type>', 'Filter by category')
  .option('-n, --namespace <name>', 'Filter by namespace')
  .option('--threshold <score>', 'Minimum relevance score (0-1)', parseFloat, 0.3)
  .option('--config <path>', 'Path to config file')
  .action(async (query, options) => {
    const f = await loadFormat();
    const chalk = (await import('chalk')).default;
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

      if (memories.length === 0) {
        console.log('');
        f.info('No relevant memories found.');
        console.log('');
        db.close();
        return;
      }

      f.printSection(`${memories.length} result${memories.length === 1 ? '' : 's'}`);
      console.log('');

      memories.forEach((memory, index) => {
        const num = chalk.bold(`#${index + 1}`);
        const cat = f.categoryBadge(memory.category);
        const id = f.shortId(memory.id);
        const score = memory.score ? f.scoreDisplay(memory.score, { showBar: true }) : '';

        console.log(`${num}  ${cat}  ${id}  ${score}`);
        console.log(`   ${memory.content}`);

        if (memory.scoreBreakdown) {
          const bd = memory.scoreBreakdown;
          const parts = [
            `sim=${chalk.dim(bd.similarity.toFixed(2))}`,
            `rec=${chalk.dim(bd.recency.toFixed(2))}`,
            `conf=${chalk.dim(bd.confidence.toFixed(2))}`,
            `fts=${chalk.dim(bd.ftsBoost.toFixed(2))}`
          ];
          console.log(`   ${chalk.dim(parts.join('  '))}`);
        }
        console.log('');
      });

      db.close();
    } catch (error) {
      f.error(error.message);
      process.exit(1);
    }
  });

// Forget command
program
  .command('forget <id>')
  .description('Delete a memory by ID')
  .option('--config <path>', 'Path to config file')
  .action(async (id, options) => {
    const f = await loadFormat();
    const chalk = (await import('chalk')).default;
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const memory = getMemory(db, id);

      if (!memory) {
        f.error(`Memory not found: ${id}`);
        db.close();
        process.exit(1);
      }

      // Show preview before deletion
      console.log('');
      console.log(f.box(
        `${chalk.bold('Deleting memory')}  ${f.shortId(memory.id)}\n` +
        `${f.categoryBadge(memory.category)}  conf ${f.confidenceColor(memory.confidence)}\n` +
        `${f.truncate(memory.content, 60)}`
      ));

      const deleted = deleteMemory(db, id);

      console.log('');
      if (deleted) {
        f.success(`Memory deleted: ${id}`);
      } else {
        f.error(`Failed to delete memory: ${id}`);
      }
      console.log('');

      db.close();
    } catch (error) {
      f.error(error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List all memories (paginated)')
  .option('-l, --limit <n>', 'Max results', v => parseInt(v, 10), 50)
  .option('--offset <n>', 'Offset for pagination', v => parseInt(v, 10), 0)
  .option('-c, --category <type>', 'Filter by category')
  .option('-n, --namespace <name>', 'Filter by namespace')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    const f = await loadFormat();
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const memories = listMemories(db, {
        limit: options.limit,
        offset: options.offset,
        category: options.category,
        namespace: options.namespace
      });

      f.printSection(`${memories.length} memories`);

      if (memories.length === 0) {
        console.log('');
        f.info('No memories found.');
        console.log('');
        db.close();
        return;
      }

      const table = f.createTable({
        head: ['ID', 'Content', 'Category', 'Conf', 'Access', 'Namespace']
      });

      for (const memory of memories) {
        table.push([
          f.shortId(memory.id),
          f.truncate(memory.content, 50),
          f.categoryBadge(memory.category),
          f.confidenceColor(memory.confidence),
          String(memory.access_count),
          memory.namespace
        ]);
      }

      console.log(table.toString());
      console.log('');

      db.close();
    } catch (error) {
      f.error(error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show Engram status and statistics')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    const f = await loadFormat();
    const chalk = (await import('chalk')).default;
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));
      const stats = getStats(db);

      f.printHeader(version);

      // Memory statistics
      f.printSection('Memory Statistics');
      console.log('');
      f.printKeyValue([
        ['Total memories',  chalk.bold(String(stats.total))],
        ['With embeddings', String(stats.withEmbeddings)]
      ]);

      // Categories table
      if (Object.keys(stats.byCategory).length > 0) {
        console.log('');
        const catTable = f.createTable({ head: ['Category', 'Count'] });
        for (const [category, count] of Object.entries(stats.byCategory)) {
          catTable.push([f.categoryBadge(category), String(count)]);
        }
        console.log(catTable.toString());
      }

      // Namespaces table
      if (Object.keys(stats.byNamespace).length > 0) {
        console.log('');
        const nsTable = f.createTable({ head: ['Namespace', 'Count'] });
        for (const [namespace, count] of Object.entries(stats.byNamespace)) {
          nsTable.push([namespace, String(count)]);
        }
        console.log(nsTable.toString());
      }

      // Model info
      f.printSection('Embedding Model');
      console.log('');
      try {
        const { getModelInfo } = await import('../src/embed/index.js');
        const modelInfo = getModelInfo(getModelsPath(config));

        let statusText;
        if (modelInfo.cached) {
          statusText = chalk.green('Ready');
        } else if (modelInfo.loading) {
          statusText = chalk.yellow('Loading...');
        } else if (modelInfo.available) {
          statusText = chalk.green('Available');
        } else {
          statusText = chalk.red('Not available');
        }

        f.printKeyValue([
          ['Name',   modelInfo.name],
          ['Status', statusText],
          ['Size',   `${modelInfo.sizeMB} MB`],
          ['Path',   chalk.dim(modelInfo.path)]
        ]);
      } catch {
        f.printKeyValue([['Status', chalk.red('Not available')]]);
      }

      // Configuration
      f.printSection('Configuration');
      console.log('');
      f.printKeyValue([
        ['Data directory',    chalk.dim(config.dataDir)],
        ['Namespace',         config.defaults.namespace],
        ['Recall limit',      String(config.defaults.recallLimit)],
        ['Secret detection',  config.security.secretDetection ? chalk.green('on') : chalk.red('off')]
      ]);
      console.log('');

      db.close();
    } catch (error) {
      const f2 = await loadFormat();
      f2.error(error.message);
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
    const f = await loadFormat();
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const spin = f.spinner('Running consolidation...');
      spin.start();

      const results = await consolidate(db, {
        detectDuplicates: options.duplicates !== false,
        detectContradictions: options.contradictions !== false,
        applyDecay: options.decay !== false,
        cleanupStale: options.cleanupStale === true
      });

      spin.succeed('Consolidation complete');
      console.log('');

      const table = f.createTable({ head: ['Metric', 'Count'] });
      table.push(
        ['Duplicates removed',      String(results.duplicatesRemoved)],
        ['Contradictions detected',  String(results.contradictionsDetected)],
        ['Memories decayed',         String(results.memoriesDecayed)],
        ['Stale cleaned',            String(results.staleMemoriesCleaned)],
        ['Duration',                 `${results.duration}ms`]
      );
      console.log(table.toString());
      console.log('');

      db.close();
    } catch (error) {
      f.error(error.message);
      process.exit(1);
    }
  });

// Conflicts command
program
  .command('conflicts')
  .description('Show detected contradictions')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    const f = await loadFormat();
    const chalk = (await import('chalk')).default;
    try {
      const config = loadConfig(options.config);
      const db = initDatabase(getDatabasePath(config));

      const conflicts = getConflicts(db);

      if (conflicts.length === 0) {
        console.log('');
        f.success('No conflicts detected');
        console.log('');
      } else {
        f.printSection(`${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}`);
        console.log('');

        conflicts.forEach((conflict, index) => {
          const header = `${chalk.bold(`Conflict ${index + 1}`)}  ${chalk.dim(conflict.conflictId)}`;
          const memLines = conflict.memories.map((memory, mIndex) => {
            const label = chalk.bold(String.fromCharCode(65 + mIndex));
            return `${label}  ${f.shortId(memory.id)}  ${f.categoryBadge(memory.category || 'fact')}\n   ${f.truncate(memory.content, 56)}`;
          }).join('\n');

          console.log(f.box(`${header}\n${memLines}`));
          console.log('');
        });
      }

      db.close();
    } catch (error) {
      f.error(error.message);
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
  .option('--min-access <count>', 'Minimum access count', v => parseInt(v, 10), 0)
  .option('--include-low-feedback', 'Include memories with negative feedback', false)
  .option('--group-by <field>', 'Group by: category, entity, none', 'category')
  .option('--header <text>', 'Custom header text')
  .option('--footer <text>', 'Custom footer text')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    const f = await loadFormat();
    const chalk = (await import('chalk')).default;
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
        console.log('');
        f.success(`Exported to ${chalk.bold(options.output)}`);
        console.log('');
        f.printKeyValue([
          ['Memories', String(result.stats.totalExported)],
          ['Size',     `${result.stats.sizeKB} KB`],
          ['Format',   options.format]
        ]);

        if (result.stats.byCategory && Object.keys(result.stats.byCategory).length > 0) {
          console.log('');
          const catTable = f.createTable({ head: ['Category', 'Count'] });
          for (const [cat, count] of Object.entries(result.stats.byCategory)) {
            catTable.push([f.categoryBadge(cat), String(count)]);
          }
          console.log(catTable.toString());
        }
        console.log('');
      } else {
        // Output to stdout (raw, no formatting)
        console.log(result.content);
      }

      db.close();
    } catch (error) {
      f.error(error.message);
      process.exit(1);
    }
  });

// Import wizard command
program
  .command('import')
  .description('Import memories from developer artifacts (smart import wizard)')
  .option('-s, --source <type>', 'Single source: cursorrules, claude, package, git, ssh, shell, obsidian, env')
  .option('--dry-run', 'Preview without committing')
  .option('-n, --namespace <name>', 'Override namespace for imported memories')
  .option('--config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      const { runWizard } = await import('../src/import/wizard.js');
      await runWizard({
        source: options.source,
        dryRun: options.dryRun,
        namespace: options.namespace,
        config: options.config
      });
    } catch (error) {
      const f = await loadFormat();
      f.error(`Import error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
