# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Engram** is a lightweight, embeddable memory layer that gives AI agents persistent, cross-session memory. It's designed as "SQLite for agent state" - any agent framework can plug into it.

**Core Concept:** Engram is NOT a RAG system, vector database, or chatbot. It answers "what does this specific person need me to know right now, given everything I've learned about how they work?" - like a colleague who's worked with you for years.

## Tech Stack

- **Runtime:** Node.js 20+ (ESM modules)
- **Database:** better-sqlite3 (synchronous, embedded, zero-config)
- **Embeddings:** all-MiniLM-L6-v2 via @xenova/transformers (~23MB, CPU-only)
- **MCP Server:** @modelcontextprotocol/sdk (primary interface)
- **REST API:** Fastify
- **CLI:** Commander.js
- **Dashboard:** React 18 + Tailwind CSS 3 + Vite
- **Testing:** Vitest

**Critical Constraints:**
- Plain JavaScript only (no TypeScript in v1)
- No Express (use Fastify)
- No ORMs (raw SQL with better-sqlite3)
- No cloud dependencies, Docker requirements, or Python dependencies
- Must work fully offline

## Architecture

Three-layer architecture:

```
INTERFACES: MCP Server (primary) | REST API | CLI | GUI
     ↓
CORE ENGINE: extract/ | memory/ | embed/
     ↓
STORAGE: ~/.engram/memory.db (SQLite) | config.json | models/
```

### Core Components

- **memory/store.js** - SQLite CRUD operations
- **memory/recall.js** - Hybrid search (embedding similarity + FTS + recency)
- **memory/consolidate.js** - Duplicate detection, decay, contradiction flagging
- **extract/rules.js** - Zero-dependency rule-based fact extraction
- **extract/secrets.js** - Secret/sensitive data detection (CRITICAL: never store API keys)
- **embed/index.js** - Embedding generation + model management (lazy download)
- **server/mcp.js** - MCP server with 4 tools (remember, recall, forget, status)
- **server/rest.js** - Fastify REST API + dashboard serving
- **discover/agents.js** - Auto-detect Claude Code, Cursor, Windsurf, etc.

## Development Commands

### Setup & Running
```bash
npm install                   # Install dependencies
npm start                     # Start Engram (MCP + REST + Dashboard)
npm run mcp                   # Start MCP server only (stdio mode)
npm run dev                   # Dev mode (server + dashboard hot reload)
```

### Building & Testing
```bash
npm run build                 # Build React dashboard to dashboard/dist/
npm test                      # Run tests in watch mode
npm run test:run              # Run tests once
npm run lint                  # Lint source files
```

### CLI Commands (after build)
```bash
engram start                  # Start server
engram start --mcp-only       # MCP server only
engram start --port 3838      # Custom port

engram remember "content"     # Store a memory
engram recall "query"         # Recall memories
engram forget <id>            # Delete a memory
engram list                   # List all memories
engram status                 # Health check

engram import <file>          # Import from file
engram export                 # Export to JSON

engram agents                 # List detected agents
engram connect <agent-id>     # Write MCP config
engram consolidate            # Run consolidation
```

## Database Schema

Located at `~/.engram/memory.db`. Key table:

```sql
memories (
  id TEXT PRIMARY KEY,              -- UUIDv4
  content TEXT NOT NULL,            -- Memory text
  entity TEXT,                      -- What/who this is about
  category TEXT DEFAULT 'fact',     -- preference|fact|pattern|decision|outcome
  confidence REAL DEFAULT 0.8,      -- 0.0 to 1.0
  embedding BLOB,                   -- Float32Array as Buffer
  source TEXT DEFAULT 'manual',     -- Which agent created this
  namespace TEXT DEFAULT 'default', -- Project/scope isolation
  tags TEXT DEFAULT '[]',           -- JSON array
  created_at INTEGER,               -- Unix timestamp (ms)
  updated_at INTEGER,
  last_accessed INTEGER,
  access_count INTEGER DEFAULT 0,
  decay_rate REAL DEFAULT 0.01
)
```

Uses FTS5 for full-text search with automatic trigger-based sync.

## Memory Categories

- **preference** - User likes/dislikes (e.g., "prefers Fastify over Express")
- **fact** - Objective truth about setup (e.g., "uses PostgreSQL 15")
- **pattern** - Recurring workflow (e.g., "deploys via GitHub Actions")
- **decision** - Choice made and rationale (e.g., "switched to ESM because...")
- **outcome** - Result of an action (e.g., "migration to Vite improved build time")

## Recall Algorithm

Hybrid scoring system:
1. Generate embedding for query
2. Fetch candidates (FTS5 top 20 + all embeddings in namespace)
3. Score each: `(similarity×0.5) + (recency×0.15) + (confidence×0.2) + (access×0.05) + fts_boost`
4. Filter by threshold (default 0.3)
5. Return top N (default 5)
6. Update last_accessed and access_count

## Implementation Order

**Phase 1: Core Memory Engine**
1. config/index.js - Config management
2. utils/id.js, utils/logger.js
3. memory/store.js - SQLite init, migrations, CRUD
4. extract/secrets.js - Secret detection
5. extract/rules.js - Category detection, entity extraction
6. Write tests

**Phase 2: Embedding & Recall**
7. embed/index.js - Model download, embedding generation
8. memory/recall.js - Hybrid search
9. memory/consolidate.js - Duplicate detection, decay
10. Write tests

**Phase 3: MCP Server**
11. server/mcp.js - 4 MCP tools (remember, recall, forget, status)
12. bin/engram.js - CLI with --mcp-only
13. Test with Claude Code

**Phase 4: REST API + CLI**
14. server/rest.js - All REST endpoints
15. Complete CLI commands
16. discover/agents.js - Agent detection
17. import/index.js - Document import
18. Write tests

**Phase 5: Web Dashboard**
19. Scaffold dashboard/ with Vite + React + Tailwind
20. Build components (SearchBar, MemoryList, MemoryEditor, etc.)
21. Wire to REST API
22. Build and integrate into Fastify

**Phase 6: Polish**
23. README.md, docs/, examples/
24. Final testing
25. npm publish prep

## Critical Quality Rules

1. **Zero external network calls** - Must work fully offline by default
2. **Never store secrets** - Run secret detection on EVERY memory (security-critical)
3. **Never crash the MCP server** - Wrap all tool handlers in try/catch
4. **Conservative memory extraction** - Better 10 high-confidence than 200 noisy memories
5. **Token budget discipline** - Default recall returns max 5 memories (~500 tokens)
6. **Graceful degradation** - If embeddings fail → FTS → basic LIKE query
7. **Idempotent operations** - Check for duplicates (>0.92 similarity) before insert
8. **Back up before modifying** - Always create timestamped backup when writing agent configs
9. **Clean, readable code** - Flat modules, exported functions, JSDoc comments
10. **Tests for core logic** - Memory store, recall, secret detection, extraction MUST have tests

## MCP Server Details

Primary interface for AI agents. Implements 4 tools via stdio transport:

- **engram_remember** - Store a memory with category, entity, confidence, namespace
- **engram_recall** - Retrieve relevant memories by semantic query
- **engram_forget** - Delete a memory by ID
- **engram_status** - Health check and stats

Tool responses must return `{ content: [{ type: "text", text: "..." }] }` per MCP spec.

## Secret Detection

The extract/secrets.js module MUST reject:
- API keys (patterns: sk-, pk_, AKIA, ghp_, xoxb-, etc.)
- Passwords and tokens
- Private keys (BEGIN RSA/EC/OPENSSH PRIVATE KEY)
- Connection strings with credentials
- AWS credentials, GCP service account keys
- .env values that look like secrets

Reject memory entirely or redact secret portions. Log warnings.

## Agent Auto-Discovery

Detects and connects to:
- Claude Code (~/.claude/mcp.json)
- Claude Desktop (~/Library/Application Support/Claude/claude_desktop_config.json)
- Cursor (~/.cursor/mcp.json)
- Windsurf (~/.windsurf/mcp.json)
- n8n (REST adapter, port 5678)
- Ollama (REST adapter, port 11434)

Connection flow:
1. Read existing MCP config
2. Create backup: config.json → config.json.engram-backup-{timestamp}
3. Deep-merge engram server entry
4. Write updated config
5. NEVER overwrite/remove existing MCP servers

## File Structure Reference

See [engram-build-prompt.md](engram-build-prompt.md) section 4 for complete file tree.

Key directories:
- `bin/` - CLI entry point
- `src/` - Core implementation
  - `server/` - MCP + REST
  - `memory/` - Store, recall, consolidate
  - `extract/` - Rules, secrets, LLM
  - `embed/` - Embedding generation
  - `discover/` - Agent detection
  - `import/` - Document import
  - `config/` - Configuration
  - `utils/` - ID, tokens, logger
- `dashboard/` - React web UI
- `test/` - Vitest tests
- `docs/` - Architecture and API docs
- `examples/` - Usage examples

## Testing Strategy

- **Core logic tests required:** memory/store, memory/recall, extract/rules, extract/secrets
- **REST endpoint tests required:** server/rest
- **Manual testing acceptable for v1:** UI components, CLI commands
- Use Vitest with ESM-native configuration
- Test fixtures in test/fixtures/

## Configuration

Located at `~/.engram/config.json`. All fields optional with defaults.

Key settings:
- `port` - REST API port (default: 3838)
- `dataDir` - Storage location (default: ~/.engram)
- `defaults.namespace` - Default memory namespace
- `defaults.recallLimit` - Max recall results (default: 5)
- `defaults.confidenceThreshold` - Minimum confidence (default: 0.3)
- `embedding.model` - Embedding model name
- `consolidation.enabled` - Auto-consolidation toggle
- `security.secretDetection` - Secret detection toggle

## Common Patterns

### Storing embeddings
```javascript
// Write
const embedding = new Float32Array([...]);
const buffer = Buffer.from(embedding.buffer);
db.prepare('INSERT ... VALUES (?, ...)').run(buffer);

// Read
const buffer = row.embedding;
const embedding = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
```

### Cosine similarity
```javascript
function cosineSimilarity(a, b) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### UUID generation
```javascript
import { randomUUID } from 'crypto';
const id = randomUUID(); // Node.js built-in, no dependency
```

## Success Criteria

- [ ] `npm install -g engram && engram start` works zero-config
- [ ] Claude Code can connect and use all 4 MCP tools
- [ ] Memories persist across sessions
- [ ] Recall returns semantically relevant results
- [ ] Dashboard works at localhost:3838
- [ ] Secret detection blocks API keys/passwords
- [ ] Agent auto-discovery finds local AI agents
- [ ] One-click agent connection writes proper MCP config with backup
- [ ] Runs fully offline, zero internet required
- [ ] Clean, readable, well-documented JavaScript
