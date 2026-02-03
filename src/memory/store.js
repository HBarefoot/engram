import Database from 'better-sqlite3';
import { generateId } from '../utils/id.js';
import * as logger from '../utils/logger.js';

/**
 * Initialize the database and run migrations
 * @param {string} dbPath - Path to SQLite database file
 * @returns {Database} SQLite database instance
 */
export function initDatabase(dbPath) {
  logger.info('Initializing database', { path: dbPath });

  const db = new Database(dbPath);

  // Set pragmas for performance and safety
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  logger.info('Database initialized successfully');
  return db;
}

/**
 * Run database migrations
 * @param {Database} db - SQLite database instance
 */
function runMigrations(db) {
  // Core memories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      entity TEXT,
      category TEXT NOT NULL DEFAULT 'fact',
      confidence REAL NOT NULL DEFAULT 0.8,
      embedding BLOB,
      source TEXT DEFAULT 'manual',
      namespace TEXT DEFAULT 'default',
      tags TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_accessed INTEGER,
      access_count INTEGER DEFAULT 0,
      decay_rate REAL DEFAULT 0.01
    );
  `);

  // Full-text search index
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      entity,
      tags,
      content='memories',
      content_rowid='rowid'
    );
  `);

  // Triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, entity, tags)
      VALUES (new.rowid, new.content, new.entity, new.tags);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, entity, tags)
      VALUES ('delete', old.rowid, old.content, old.entity, old.tags);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, entity, tags)
      VALUES ('delete', old.rowid, old.content, old.entity, old.tags);
      INSERT INTO memories_fts(rowid, content, entity, tags)
      VALUES (new.rowid, new.content, new.entity, new.tags);
    END;
  `);

  // Indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity);
    CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(namespace);
    CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence);
    CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_last_accessed ON memories(last_accessed);
  `);

  // Metadata table for system state
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  logger.debug('Database migrations completed');
}

/**
 * Store a new memory
 * @param {Database} db - SQLite database instance
 * @param {Object} memory - Memory object
 * @param {string} memory.content - Memory content
 * @param {string} [memory.category='fact'] - Memory category
 * @param {string} [memory.entity] - Entity this memory is about
 * @param {number} [memory.confidence=0.8] - Confidence score (0-1)
 * @param {Float32Array} [memory.embedding] - Embedding vector
 * @param {string} [memory.source='manual'] - Source of memory
 * @param {string} [memory.namespace='default'] - Namespace
 * @param {string[]} [memory.tags=[]] - Tags
 * @param {number} [memory.decay_rate=0.01] - Decay rate
 * @returns {Object} Stored memory with ID
 */
export function createMemory(db, memory) {
  const id = generateId();
  const now = Date.now();

  const tags = JSON.stringify(memory.tags || []);
  const embeddingBuffer = memory.embedding
    ? Buffer.from(memory.embedding.buffer)
    : null;

  const stmt = db.prepare(`
    INSERT INTO memories (
      id, content, entity, category, confidence, embedding,
      source, namespace, tags, created_at, updated_at, decay_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    memory.content,
    memory.entity || null,
    memory.category || 'fact',
    memory.confidence !== undefined ? memory.confidence : 0.8,
    embeddingBuffer,
    memory.source || 'manual',
    memory.namespace || 'default',
    tags,
    now,
    now,
    memory.decay_rate !== undefined ? memory.decay_rate : 0.01
  );

  logger.debug('Memory created', { id, category: memory.category });

  return getMemory(db, id);
}

/**
 * Get a memory by ID
 * @param {Database} db - SQLite database instance
 * @param {string} id - Memory ID
 * @returns {Object|null} Memory object or null if not found
 */
export function getMemory(db, id) {
  const stmt = db.prepare('SELECT * FROM memories WHERE id = ?');
  const row = stmt.get(id);

  if (!row) {
    return null;
  }

  return deserializeMemory(row);
}

/**
 * Update a memory
 * @param {Database} db - SQLite database instance
 * @param {string} id - Memory ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated memory or null if not found
 */
export function updateMemory(db, id, updates) {
  // Build dynamic UPDATE query
  const allowedFields = [
    'content', 'entity', 'category', 'confidence',
    'embedding', 'source', 'namespace', 'tags', 'decay_rate'
  ];

  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);

      if (key === 'tags') {
        values.push(JSON.stringify(value));
      } else if (key === 'embedding' && value) {
        values.push(Buffer.from(value.buffer));
      } else {
        values.push(value);
      }
    }
  }

  if (fields.length === 0) {
    return getMemory(db, id);
  }

  // Add updated_at
  fields.push('updated_at = ?');
  values.push(Date.now());

  // Add id for WHERE clause
  values.push(id);

  const stmt = db.prepare(`
    UPDATE memories
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  logger.debug('Memory updated', { id });

  return getMemory(db, id);
}

/**
 * Delete a memory
 * @param {Database} db - SQLite database instance
 * @param {string} id - Memory ID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteMemory(db, id) {
  const stmt = db.prepare('DELETE FROM memories WHERE id = ?');
  const result = stmt.run(id);

  if (result.changes > 0) {
    logger.debug('Memory deleted', { id });
    return true;
  }

  return false;
}

/**
 * List memories with optional filters
 * @param {Database} db - SQLite database instance
 * @param {Object} [options] - Query options
 * @param {string} [options.namespace] - Filter by namespace
 * @param {string} [options.category] - Filter by category
 * @param {number} [options.limit=50] - Maximum results
 * @param {number} [options.offset=0] - Offset for pagination
 * @param {string} [options.sort='created_at DESC'] - Sort order
 * @returns {Object[]} Array of memories
 */
export function listMemories(db, options = {}) {
  const {
    namespace,
    category,
    limit = 50,
    offset = 0,
    sort = 'created_at DESC'
  } = options;

  let query = 'SELECT * FROM memories WHERE 1=1';
  const params = [];

  if (namespace) {
    query += ' AND namespace = ?';
    params.push(namespace);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ` ORDER BY ${sort} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map(deserializeMemory);
}

/**
 * Search memories using FTS
 * @param {Database} db - SQLite database instance
 * @param {string} query - Search query
 * @param {number} [limit=20] - Maximum results
 * @returns {Object[]} Array of matching memories
 */
export function searchMemories(db, query, limit = 20) {
  const stmt = db.prepare(`
    SELECT m.*
    FROM memories m
    JOIN memories_fts fts ON m.rowid = fts.rowid
    WHERE memories_fts MATCH ?
    LIMIT ?
  `);

  const rows = stmt.all(query, limit);
  return rows.map(deserializeMemory);
}

/**
 * Get all memories with embeddings for similarity search
 * @param {Database} db - SQLite database instance
 * @param {string} [namespace] - Optional namespace filter
 * @returns {Object[]} Array of memories with embeddings
 */
export function getMemoriesWithEmbeddings(db, namespace) {
  let query = 'SELECT * FROM memories WHERE embedding IS NOT NULL';
  const params = [];

  if (namespace) {
    query += ' AND namespace = ?';
    params.push(namespace);
  }

  const stmt = db.prepare(query);
  const rows = params.length > 0 ? stmt.all(...params) : stmt.all();

  return rows.map(deserializeMemory);
}

/**
 * Update last_accessed and access_count for memories
 * @param {Database} db - SQLite database instance
 * @param {string[]} ids - Memory IDs to update
 */
export function updateAccessStats(db, ids) {
  if (ids.length === 0) return;

  const now = Date.now();
  const placeholders = ids.map(() => '?').join(',');

  const stmt = db.prepare(`
    UPDATE memories
    SET last_accessed = ?,
        access_count = access_count + 1
    WHERE id IN (${placeholders})
  `);

  stmt.run(now, ...ids);

  logger.debug('Access stats updated', { count: ids.length });
}

/**
 * Get database statistics
 * @param {Database} db - SQLite database instance
 * @returns {Object} Database statistics
 */
export function getStats(db) {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM memories');
  const total = totalStmt.get().count;

  const byCategoryStmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM memories
    GROUP BY category
  `);
  const byCategory = Object.fromEntries(
    byCategoryStmt.all().map(row => [row.category, row.count])
  );

  const byNamespaceStmt = db.prepare(`
    SELECT namespace, COUNT(*) as count
    FROM memories
    GROUP BY namespace
  `);
  const byNamespace = Object.fromEntries(
    byNamespaceStmt.all().map(row => [row.namespace, row.count])
  );

  const withEmbeddingsStmt = db.prepare(
    'SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL'
  );
  const withEmbeddings = withEmbeddingsStmt.get().count;

  return {
    total,
    byCategory,
    byNamespace,
    withEmbeddings
  };
}

/**
 * Deserialize a database row into a memory object
 * @param {Object} row - Database row
 * @returns {Object} Memory object
 */
function deserializeMemory(row) {
  const memory = {
    id: row.id,
    content: row.content,
    entity: row.entity,
    category: row.category,
    confidence: row.confidence,
    source: row.source,
    namespace: row.namespace,
    tags: JSON.parse(row.tags),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_accessed: row.last_accessed,
    access_count: row.access_count,
    decay_rate: row.decay_rate
  };

  // Deserialize embedding if present
  if (row.embedding) {
    const buffer = row.embedding;
    memory.embedding = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / 4
    );
  }

  return memory;
}
