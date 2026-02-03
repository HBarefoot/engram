/**
 * Basic Engram Usage Example
 *
 * This example demonstrates the fundamental operations:
 * - Creating memories
 * - Searching for relevant memories
 * - Listing and filtering memories
 * - Deleting memories
 */

import { loadConfig, getDatabasePath, getModelsPath } from '../src/config/index.js';
import { initDatabase, createMemory, listMemories, deleteMemory } from '../src/memory/store.js';
import { recallMemories, formatRecallResults } from '../src/memory/recall.js';

async function main() {
  console.log('🧠 Engram Basic Usage Example\n');

  // Load configuration
  const config = loadConfig();
  const db = initDatabase(getDatabasePath(config));
  const modelsPath = getModelsPath(config);

  try {
    // 1. Create some memories
    console.log('📝 Creating memories...\n');

    const memory1 = createMemory(db, {
      content: 'User prefers Fastify over Express for building APIs',
      category: 'preference',
      entity: 'fastify',
      confidence: 0.9,
      namespace: 'backend-preferences',
      tags: ['backend', 'nodejs', 'api'],
      source: 'example'
    });
    console.log(`✓ Created memory: ${memory1.id.substring(0, 8)}`);
    console.log(`  Content: ${memory1.content}\n`);

    const memory2 = createMemory(db, {
      content: 'Project uses PostgreSQL 15 with pgvector extension for vector storage',
      category: 'fact',
      entity: 'postgresql',
      confidence: 1.0,
      namespace: 'infrastructure',
      tags: ['database', 'vectors'],
      source: 'example'
    });
    console.log(`✓ Created memory: ${memory2.id.substring(0, 8)}`);
    console.log(`  Content: ${memory2.content}\n`);

    const memory3 = createMemory(db, {
      content: 'Always run tests before committing code',
      category: 'pattern',
      entity: 'testing',
      confidence: 1.0,
      namespace: 'workflow',
      tags: ['testing', 'workflow'],
      source: 'example'
    });
    console.log(`✓ Created memory: ${memory3.id.substring(0, 8)}`);
    console.log(`  Content: ${memory3.content}\n`);

    // 2. List all memories
    console.log('📋 Listing all memories...\n');
    const allMemories = listMemories(db, { limit: 10 });
    console.log(`Found ${allMemories.length} memories:\n`);
    allMemories.forEach((m, i) => {
      console.log(`${i + 1}. [${m.category}] ${m.content.substring(0, 60)}...`);
      console.log(`   Namespace: ${m.namespace} | Confidence: ${m.confidence}`);
    });
    console.log();

    // 3. Search for relevant memories
    console.log('🔍 Searching for memories about "database"...\n');
    const searchResults = await recallMemories(
      db,
      'What database does the project use?',
      { limit: 3, threshold: 0.3 },
      modelsPath
    );

    console.log(formatRecallResults(searchResults));

    // 4. Filter by namespace
    console.log('🏷️  Filtering by namespace "backend-preferences"...\n');
    const backendMemories = listMemories(db, {
      namespace: 'backend-preferences',
      limit: 10
    });
    console.log(`Found ${backendMemories.length} backend preferences:\n`);
    backendMemories.forEach(m => {
      console.log(`- ${m.content}`);
    });
    console.log();

    // 5. Filter by category
    console.log('📊 Filtering by category "pattern"...\n');
    const patterns = listMemories(db, {
      category: 'pattern',
      limit: 10
    });
    console.log(`Found ${patterns.length} workflow patterns:\n`);
    patterns.forEach(m => {
      console.log(`- ${m.content}`);
    });
    console.log();

    // 6. Cleanup - delete example memories
    console.log('🗑️  Cleaning up example memories...\n');
    deleteMemory(db, memory1.id);
    deleteMemory(db, memory2.id);
    deleteMemory(db, memory3.id);
    console.log('✓ Deleted all example memories\n');

    console.log('✅ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

main().catch(console.error);
