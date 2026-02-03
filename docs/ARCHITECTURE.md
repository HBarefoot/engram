# Engram Architecture

This document describes the internal architecture, design decisions, and implementation details of Engram.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Memory Retrieval](#memory-retrieval)
- [Database Design](#database-design)
- [Embedding System](#embedding-system)
- [API Layer](#api-layer)
- [Design Decisions](#design-decisions)

## Overview

Engram is designed as a modular memory system with clear separation of concerns:

```
┌─────────────────────────────────────────────────┐
│                 Interfaces                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │   CLI    │  │ REST API │  │  MCP Server  │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│              Core Memory System                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Store   │  │  Recall  │  │ Consolidate  │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│            Supporting Systems                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Embeddings│  │ Extraction│  │   Config    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│                 Storage                          │
│            SQLite + FTS5                         │
└──────────────────────────────────────────────────┘
```

## Core Components

### 1. Memory Store (`src/memory/store.js`)

Responsible for all database operations:

- **Schema Management**: Creates tables, indexes, and FTS5 virtual table
- **CRUD Operations**: Create, read, update, delete memories
- **Query Interface**: List, search, filter operations
- **Embedding Storage**: Serializes Float32Array embeddings to BLOB
- **Access Tracking**: Updates `access_count` and `last_accessed`

**Key Functions:**
- `initDatabase(path)` - Initialize database with schema
- `createMemory(db, data)` - Insert new memory
- `getMemory(db, id)` - Retrieve by ID
- `listMemories(db, options)` - Query with filters
- `searchMemories(db, query, limit)` - FTS5 search
- `updateAccessStats(db, ids)` - Track usage

### 2. Memory Recall (`src/memory/recall.js`)

Implements hybrid search algorithm:

- **Embedding Similarity**: Cosine similarity of query vs memory embeddings
- **FTS Search**: SQLite FTS5 for keyword matching
- **Candidate Fetching**: Combines FTS top 20 + all embedded memories
- **Scoring**: Weighted formula balancing multiple factors
- **Fallback**: Gracefully degrades to FTS-only if embeddings fail

**Scoring Formula:**
```javascript
score = (similarity × 0.5) +    // Semantic relevance
        (recency × 0.15) +       // Time-based decay
        (confidence × 0.2) +     // User confidence
        (access × 0.05) +        // Access frequency
        ftsBoost                 // +0.1 if in FTS results
```

**Recency Calculation:**
```javascript
recency = 1 / (1 + days_since_access × decay_rate)
```

### 3. Memory Consolidation (`src/memory/consolidate.js`)

Maintains memory quality over time:

- **Duplicate Detection**: Cosine similarity >0.92 between embeddings
- **Duplicate Merging**: Keeps higher confidence/access_count/newer memory
- **Contradiction Detection**: Finds conflicting memories about same entity
- **Confidence Decay**: `new_confidence = confidence × (1 - decay_rate × days)`
- **Stale Cleanup**: Marks memories with confidence<0.15, age>90 days, no access

**Conflict Detection:**
1. Group memories by entity
2. Look for negation patterns (not, never, don't, etc.)
3. Flag high-similarity memories with negations
4. Create conflict groups with unique IDs

### 4. Embedding System (`src/embed/index.js`)

Generates vector embeddings using transformers.js:

- **Model**: Xenova/all-MiniLM-L6-v2 (384 dimensions, ~23MB)
- **Lazy Loading**: Downloads on first use, not npm install
- **Caching**: Stored in `~/.engram/models/`
- **Pipeline**: Uses `feature-extraction` pipeline
- **Similarity**: Cosine similarity function included

**Why this model?**
- Small size (~23MB vs 500MB+ for larger models)
- Good quality for semantic search
- Fast inference on CPU
- No GPU required
- Runs entirely locally

### 5. Content Extraction (`src/extract/`)

**rules.js** - Extracts structured data from raw content:
- **Category Detection**: Pattern matching for preference, decision, pattern, etc.
- **Entity Extraction**: Finds tech keywords and patterns
- **Confidence Calculation**: Based on explicitness and source

**secrets.js** - Detects and redacts secrets:
- **Pattern Matching**: RegExp for common secret formats
- **Secret Types**: API keys, tokens, private keys, connection strings
- **Auto-Redaction**: Replaces secrets with `[REDACTED]`
- **Validation**: Rejects or redacts content with secrets

## Data Flow

### Creating a Memory

```
User Input
    │
    ▼
┌─────────────────┐
│ Validate Content│ ◄─── Secret Detection
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract Metadata│ ◄─── Category, Entity, Confidence
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Generate Embedding│ ◄─── transformers.js
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store in DB   │ ◄─── SQLite + FTS5 sync
└─────────────────┘
```

### Searching Memories

```
Query String
    │
    ▼
┌─────────────────┐
│Generate Query   │
│   Embedding     │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
   ┌──────────┐   ┌──────────┐
   │FTS Search│   │ Embedding│
   │ (Top 20) │   │  Search  │
   └─────┬────┘   └─────┬────┘
         │              │
         └──────┬───────┘
                │
                ▼
        ┌───────────────┐
        │ Merge & Score │ ◄─── Hybrid scoring
        │  Candidates   │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │Filter & Sort  │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │Update Access  │
        │   Stats       │
        └───────────────┘
```

## Database Design

### Schema

```sql
-- Main memories table
CREATE TABLE memories (
    id TEXT PRIMARY KEY,           -- UUID
    content TEXT NOT NULL,         -- Memory content
    entity TEXT,                   -- What it's about
    category TEXT DEFAULT 'fact',  -- Type of memory
    confidence REAL DEFAULT 0.8,   -- 0.0 to 1.0
    embedding BLOB,                -- Float32Array serialized
    source TEXT,                   -- cli, api, mcp
    namespace TEXT DEFAULT 'default',
    tags TEXT,                     -- JSON array
    access_count INTEGER DEFAULT 0,
    decay_rate REAL DEFAULT 0.01,
    created_at INTEGER NOT NULL,   -- Unix timestamp
    updated_at INTEGER NOT NULL,
    last_accessed INTEGER
);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE memories_fts USING fts5(
    content, entity, category, namespace,
    content='memories',
    content_rowid='rowid'
);

-- Automatic FTS sync triggers
CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, content, entity, category, namespace)
    VALUES (new.rowid, new.content, new.entity, new.category, new.namespace);
END;

CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
    DELETE FROM memories_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
    UPDATE memories_fts
    SET content = new.content, entity = new.entity,
        category = new.category, namespace = new.namespace
    WHERE rowid = old.rowid;
END;

-- Indexes for common queries
CREATE INDEX idx_category ON memories(category);
CREATE INDEX idx_entity ON memories(entity);
CREATE INDEX idx_namespace ON memories(namespace);
CREATE INDEX idx_confidence ON memories(confidence);
CREATE INDEX idx_created_at ON memories(created_at);
CREATE INDEX idx_last_accessed ON memories(last_accessed);
```

### WAL Mode

Uses Write-Ahead Logging for better concurrency:
- Readers don't block writers
- Writers don't block readers
- Better performance for concurrent access

### Embedding Storage

Embeddings are stored as BLOBs:

```javascript
// Serialize: Float32Array → BLOB
const buffer = Buffer.from(embedding.buffer);
db.prepare('INSERT INTO memories (embedding, ...) VALUES (?, ...)').run(buffer, ...);

// Deserialize: BLOB → Float32Array
const buffer = row.embedding;
const embedding = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
);
```

## API Layer

### REST API (`src/server/rest.js`)

Built with Fastify for performance:

- **JSON Validation**: Request/response schema validation
- **CORS**: Enabled for all origins (dev mode)
- **Error Handling**: Centralized error responses
- **Async/Await**: Non-blocking operations
- **Graceful Shutdown**: Closes DB connections properly

**Endpoints:**
- POST `/api/memories` - Create
- GET `/api/memories` - List (with filters)
- POST `/api/memories/search` - Search
- GET `/api/memories/:id` - Get one
- DELETE `/api/memories/:id` - Delete
- POST `/api/consolidate` - Run consolidation
- GET `/api/conflicts` - Get conflicts
- GET `/api/status` - System status
- GET `/health` - Health check

### MCP Server (`src/server/mcp.js`)

Implements Model Context Protocol:

- **Transport**: Stdio (stdin/stdout)
- **Tools**: 4 MCP tools (remember, recall, forget, status)
- **Error Handling**: Structured error responses
- **Database**: Lazy initialization on first request

**Tool Definitions:**
- Rich input schemas with descriptions
- Examples and default values
- Category enums and validation

## Design Decisions

### Why SQLite?

- **Embedded**: No separate server process
- **Fast**: Excellent read performance
- **Reliable**: ACID transactions
- **FTS5**: Built-in full-text search
- **Portable**: Single file database
- **Zero Config**: Works immediately

### Why better-sqlite3?

- **Synchronous**: Simpler code, no async/await for queries
- **Fast**: Up to 2x faster than async SQLite libraries
- **Type Safety**: Better TypeScript support
- **Prepared Statements**: Efficient query execution

### Why Local Embeddings?

- **Privacy**: No data sent to external APIs
- **Cost**: No per-request charges
- **Speed**: No network latency
- **Reliability**: Works offline
- **Control**: Full control over model

### Why Hybrid Search?

Pure semantic search can miss exact keyword matches. Pure keyword search misses similar concepts. Hybrid combines both:

- **FTS5** for exact matches and keyword search
- **Embeddings** for semantic similarity
- **Recency** to prefer recent information
- **Confidence** to trust explicit statements
- **Access** to surface frequently used memories

### Why Confidence Decay?

Memories become less reliable over time:
- Technology changes
- Preferences evolve
- Facts become outdated

Decay rate controls how quickly confidence decreases:
- `0.0` = never decay (permanent facts)
- `0.01` = slow decay (general knowledge)
- `0.05` = fast decay (rapidly changing info)

### Why Namespaces?

Different contexts need separate memory spaces:
- **Projects**: project-alpha, project-beta
- **Environments**: development, staging, production
- **Users**: user-123, user-456
- **Scopes**: personal, team, organization

### Why ESM Modules?

- **Modern**: ES modules are the standard
- **Top-level await**: Simpler async code
- **Better tooling**: Native browser support
- **Future-proof**: Node.js default direction

## Performance Considerations

### Query Optimization

- Indexes on commonly filtered fields
- LIMIT for pagination
- FTS5 for fast text search
- Prepared statements for reuse

### Memory Usage

- Lazy model loading (only when needed)
- Stream large result sets
- Close connections properly
- Cache model in memory

### Embedding Generation

- Batch processing when possible
- CPU-bound operation
- ~10-50ms per embedding
- Cached in database

### Consolidation

- Run periodically, not on every request
- CPU-intensive (similarity calculations)
- Batch updates for efficiency
- Configurable thresholds

## Security

### Secret Detection

Prevents accidental storage of sensitive data:
- Pattern-based detection
- Auto-redaction option
- Warning messages
- Validation before storage

### Input Validation

- Content length limits
- Category enum validation
- Confidence range (0-1)
- Namespace sanitization

### SQL Injection

- Prepared statements for all queries
- No string concatenation
- Parameter binding
- better-sqlite3 protection

## Testing Strategy

### Unit Tests

- Isolated component testing
- Mock external dependencies
- Fast execution
- High coverage

### Integration Tests

- Full database lifecycle
- Temporary test databases
- Clean state between tests
- Real embedding generation

### Test Structure

```
test/
├── extract/
│   ├── rules.test.js       # Category/entity extraction
│   └── secrets.test.js     # Secret detection
├── memory/
│   ├── store.test.js       # CRUD operations
│   ├── recall.test.js      # Search functionality
│   └── consolidate.test.js # Memory consolidation
```

## Future Considerations

### Scalability

- Currently optimized for <100k memories
- Consider sharding for larger datasets
- Vector index (HNSW) for faster search
- Distributed caching layer

### Features

- Custom embedding models
- Memory export/import
- Backup and restore
- Memory versioning
- Collaborative memories

### Performance

- WebAssembly for embeddings
- GPU acceleration option
- Parallel query execution
- Query result caching

---

This architecture provides a solid foundation for persistent AI agent memory while remaining simple enough to understand and extend.
