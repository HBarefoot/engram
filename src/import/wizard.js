import { createInterface } from 'readline';
import os from 'os';
import { detectSources, scanSources, commitMemories } from './index.js';
import { initDatabase } from '../memory/store.js';
import { loadConfig, getDatabasePath } from '../config/index.js';
import {
  printHeader, printSection, warning, info,
  categoryBadge, confidenceColor, truncate,
  createTable, spinner
} from '../utils/format.js';
import chalk from 'chalk';

/**
 * Interactive CLI import wizard
 * @param {Object} [options] - Wizard options
 * @param {string} [options.source] - Single source for non-interactive mode
 * @param {boolean} [options.dryRun] - Preview without committing
 * @param {string} [options.namespace] - Override namespace
 * @param {string} [options.config] - Config file path
 * @param {string[]} [options.paths] - Additional directories to scan
 */
export async function runWizard(options = {}) {
  const config = loadConfig(options.config);

  // Non-interactive single-source mode
  if (options.source) {
    return runNonInteractive(config, options);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question) => new Promise(resolve => rl.question(question, resolve));

  try {
    printHeader('1.1.0');
    printSection('Smart Import Wizard');
    console.log('');
    info('Scanning your system for developer artifacts to import as memories.');
    console.log('');

    // Step 1: Detect available sources
    const spin = spinner('Scanning for sources...');
    spin.start();
    const scanOpts = { cwd: process.cwd() };
    if (options.paths) scanOpts.paths = options.paths;
    const sources = await detectSources(scanOpts);
    const foundSources = sources.filter(s => s.detected.found);
    const notFoundSources = sources.filter(s => !s.detected.found);

    if (foundSources.length === 0) {
      spin.fail('No importable sources detected');
      info('Try running this from a project directory with package.json, .cursorrules, etc.');
      console.log('');
      rl.close();
      return;
    }

    spin.succeed(`Found ${foundSources.length} source${foundSources.length === 1 ? '' : 's'}`);
    console.log('');

    const srcTable = createTable({ head: ['#', 'Source', 'Description', 'Path(s)'] });
    foundSources.forEach((s, i) => {
      const pathsDisplay = s.detected.paths && s.detected.paths.length > 1
        ? s.detected.paths.map(p => p.replace(os.homedir(), '~')).join(', ')
        : (s.detected.path || '-').replace(os.homedir(), '~');
      srcTable.push([
        String(i + 1),
        chalk.bold(s.label),
        s.description,
        chalk.dim(pathsDisplay)
      ]);
    });
    console.log(srcTable.toString());

    if (notFoundSources.length > 0) {
      console.log('');
      info(`Not found: ${chalk.dim(notFoundSources.map(s => s.label).join(', '))}`);
    }

    // Step 2: Select sources
    console.log('');
    const selection = await ask(`${chalk.bold('Select sources')} (comma-separated numbers, or "all"): `);

    let selectedIds;
    if (selection.trim().toLowerCase() === 'all') {
      selectedIds = foundSources.map(s => s.id);
    } else {
      const indices = selection.split(',').map(s => parseInt(s.trim()) - 1);
      selectedIds = indices
        .filter(i => i >= 0 && i < foundSources.length)
        .map(i => foundSources[i].id);
    }

    if (selectedIds.length === 0) {
      info('No sources selected. Exiting.');
      rl.close();
      return;
    }

    info(`Selected: ${chalk.bold(selectedIds.join(', '))}`);

    // Step 3: Scan
    console.log('');
    const scanSpin = spinner('Scanning sources...');
    scanSpin.start();
    const scanResult = await scanSources(selectedIds, scanOpts);
    scanSpin.succeed(`Found ${scanResult.memories.length} memories from ${selectedIds.length} source${selectedIds.length === 1 ? '' : 's'}`);

    if (scanResult.skipped.length > 0) {
      warning(`Skipped: ${scanResult.skipped.length} items (security or parse errors)`);
    }
    if (scanResult.warnings.length > 0) {
      for (const w of scanResult.warnings) {
        warning(w);
      }
    }

    if (scanResult.memories.length === 0) {
      console.log('');
      info('No memories to import. Exiting.');
      rl.close();
      return;
    }

    // Step 4: Preview
    printSection('Preview');

    const previewCount = Math.min(scanResult.memories.length, 20);
    const previewTable = createTable({ head: ['#', 'Category', 'Content', 'Confidence', 'Source'] });
    for (let i = 0; i < previewCount; i++) {
      const m = scanResult.memories[i];
      previewTable.push([
        String(i + 1),
        categoryBadge(m.category),
        truncate(m.content, 50),
        confidenceColor(m.confidence),
        chalk.dim(m.source)
      ]);
    }
    console.log(previewTable.toString());

    if (scanResult.memories.length > 20) {
      info(`... and ${scanResult.memories.length - 20} more`);
    }

    // Step 5: Confirm
    if (options.dryRun) {
      console.log('');
      info('Dry run mode — no memories were stored.');
      console.log('');
      printSummary(scanResult);
      rl.close();
      return;
    }

    console.log('');
    const confirm = await ask(`${chalk.bold(`Commit ${scanResult.memories.length} memories?`)} (y/N) `);
    if (confirm.trim().toLowerCase() !== 'y') {
      info('Import cancelled.');
      rl.close();
      return;
    }

    // Step 6: Commit
    const commitSpin = spinner('Committing memories...');
    commitSpin.start();
    const db = initDatabase(getDatabasePath(config));

    const commitResult = await commitMemories(db, scanResult.memories, {
      namespace: options.namespace
    });

    db.close();
    commitSpin.succeed('Import complete');

    // Step 7: Summary
    console.log('');
    const summaryTable = createTable({ head: ['Metric', 'Count'] });
    summaryTable.push(
      ['Created',    String(commitResult.created)],
      ['Duplicates', `${commitResult.duplicates} (skipped)`],
      ['Merged',     String(commitResult.merged)],
      ['Rejected',   `${commitResult.rejected} (security)`]
    );
    if (commitResult.errors.length > 0) {
      summaryTable.push(['Errors', String(commitResult.errors.length)]);
    }
    summaryTable.push(['Duration', `${commitResult.duration}ms`]);
    console.log(summaryTable.toString());

    console.log('');
    info(`View your memories at ${chalk.cyan('http://localhost:3838')}`);
    console.log('');

    rl.close();
    return commitResult;
  } catch (err) {
    rl.close();
    throw err;
  }
}

/**
 * Non-interactive single-source import
 */
async function runNonInteractive(config, options) {
  printSection(`Import: ${options.source}`);
  console.log('');

  const scanSpin = spinner(`Scanning ${options.source}...`);
  scanSpin.start();
  const nonInteractiveOpts = { cwd: process.cwd() };
  if (options.paths) nonInteractiveOpts.paths = options.paths;
  const scanResult = await scanSources([options.source], nonInteractiveOpts);
  scanSpin.succeed(`Found ${scanResult.memories.length} memories`);

  if (scanResult.warnings.length > 0) {
    for (const w of scanResult.warnings) {
      warning(w);
    }
  }

  if (scanResult.memories.length === 0) {
    info('No memories to import.');
    console.log('');
    return;
  }

  if (options.dryRun) {
    printSection('Preview');
    const previewTable = createTable({ head: ['Category', 'Content'] });
    for (const m of scanResult.memories) {
      previewTable.push([
        categoryBadge(m.category),
        truncate(m.content, 60)
      ]);
    }
    console.log(previewTable.toString());
    console.log('');
    info('Dry run — no memories stored.');
    console.log('');
    return;
  }

  const commitSpin = spinner('Committing memories...');
  commitSpin.start();
  const db = initDatabase(getDatabasePath(config));
  const commitResult = await commitMemories(db, scanResult.memories, {
    namespace: options.namespace
  });
  db.close();
  commitSpin.succeed(`Imported ${commitResult.created} memories (${commitResult.duplicates} duplicates skipped)`);
  console.log('');
  return commitResult;
}

/**
 * Print scan summary
 */
function printSummary(scanResult) {
  const byCategory = {};
  const bySource = {};

  for (const m of scanResult.memories) {
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    bySource[m.source] = (bySource[m.source] || 0) + 1;
  }

  if (Object.keys(byCategory).length > 0) {
    const catTable = createTable({ head: ['Category', 'Count'] });
    for (const [cat, count] of Object.entries(byCategory)) {
      catTable.push([categoryBadge(cat), String(count)]);
    }
    console.log(catTable.toString());
  }

  if (Object.keys(bySource).length > 0) {
    console.log('');
    const srcTable = createTable({ head: ['Source', 'Count'] });
    for (const [src, count] of Object.entries(bySource)) {
      srcTable.push([src, String(count)]);
    }
    console.log(srcTable.toString());
  }
  console.log('');
}
