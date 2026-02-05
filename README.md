# Engram

> **Persistent memory for AI agents - SQLite for agent state**

Engram is a production-ready memory system that gives AI agents persistent, searchable memory across conversations. Think of it as SQLite for agent state - simple, fast, and reliable.

[![CI](https://github.com/HBarefoot/engram/actions/workflows/ci.yml/badge.svg)](https://github.com/HBarefoot/engram/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@hbarefoot%2Fengram.svg)](https://www.npmjs.com/package/@hbarefoot/engram)
[![npm downloads](https://img.shields.io/npm/dm/@hbarefoot/engram.svg)](https://www.npmjs.com/package/@hbarefoot/engram)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

## Features

- 🧠 **Hybrid Memory Retrieval** - Combines semantic similarity, recency, confidence, and access patterns
- 🔍 **Full-Text Search** - SQLite FTS5 for fast keyword search
- 🎯 **Vector Embeddings** - Local embeddings with Xenova/all-MiniLM-L6-v2 (~23MB)
- 🔐 **Secret Detection** - Automatic detection and redaction of API keys and credentials
- 🧹 **Auto-Consolidation** - Duplicate detection, contradiction flagging, confidence decay
- 📊 **Web Dashboard** - Modern React UI for visualizing and managing memories
- 🔌 **MCP Server** - Model Context Protocol integration for Claude Desktop/Code
- 🚀 **REST API** - Full-featured HTTP API with CORS support
- 📦 **Zero Config** - Works out of the box with sensible defaults

## Quick Start

### Installation

```bash
# Install globally for CLI usage
npm install -g @hbarefoot/engram

# Or install as a project dependency
npm install @hbarefoot/engram
```

**From source (for development):**

```bash
# Clone the repository
git clone https://github.com/HBarefoot/engram.git
cd engram

# Install dependencies
npm install

# Start the server
npm start
```

The REST API will be available at `http://localhost:3838` and the dashboard at `http://localhost:3838`.

### Basic Usage

```bash
# Store a memory
engram remember "User prefers Fastify over Express for APIs" --category preference

# Search for memories
engram recall "What framework does the user prefer?"

# List all memories
engram list

# Check system status
engram status
```

## Usage Modes

### 1. CLI (Command Line Interface)

Perfect for quick interactions and scripting:

```bash
# Remember something
engram remember "Project uses PostgreSQL 15" --category fact --entity postgresql

# Search with options
engram recall "database" --limit 3 --threshold 0.5

# Filter by namespace
engram list --namespace project-alpha

# Delete a memory
engram forget <memory-id>

# Run consolidation
engram consolidate

# View conflicts
engram conflicts
```

### 2. MCP Server (Claude Desktop/Code)

Integrate with Claude Desktop or Claude Code.

**✨ Easiest Method: Use the Integration Wizard**

1. Run `npm run dev` to start the dashboard
2. Open http://localhost:5173 and go to the **Agents** tab
3. Click **Quick Setup** → **Launch Setup Wizard**
4. Select your platform and copy the auto-generated configuration

**Alternative: Manual Setup**

**macOS**: Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "engram": {
      "command": "engram",
      "args": [
        "start",
        "--mcp-only"
      ]
    }
  }
}
```

Note: If installed globally with `npm install -g @hbarefoot/engram`, the `engram` command will be available in your PATH. For local installations, use the full path: `/path/to/project/node_modules/.bin/engram`

**Available MCP Tools:**
- `engram_remember` - Store a memory
- `engram_recall` - Search for relevant memories
- `engram_forget` - Delete a memory
- `engram_status` - Get system status

See [docs/mcp-setup.md](docs/mcp-setup.md) for detailed configuration.

### 3. REST API

Full HTTP API for programmatic access:

```bash
# Create a memory
curl -X POST http://localhost:3838/api/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "User prefers Svelte for frontend",
    "category": "preference",
    "entity": "svelte",
    "confidence": 0.9
  }'

# Search memories
curl -X POST http://localhost:3838/api/memories/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "frontend preferences",
    "limit": 5
  }'

# Get system status
curl http://localhost:3838/api/status

# List memories with filters
curl "http://localhost:3838/api/memories?namespace=default&limit=10"

# Delete a memory
curl -X DELETE http://localhost:3838/api/memories/<memory-id>
```

See [docs/api.md](docs/api.md) for complete API documentation.

### 4. Programmatic Usage (Node.js Library)

Import and use Engram directly in your Node.js applications:

```javascript
import {
  initDatabase,
  createMemory,
  recallMemories,
  listMemories,
  loadConfig,
  getDatabasePath
} from '@hbarefoot/engram';

// Initialize database
const config = loadConfig();
const db = initDatabase(getDatabasePath(config));

// Create a memory
const memory = createMemory(db, {
  content: 'User prefers Fastify over Express for building APIs',
  category: 'preference',
  entity: 'fastify',
  confidence: 0.9,
  namespace: 'backend-preferences',
  tags: ['backend', 'nodejs', 'api'],
  source: 'my-app'
});

// Search for relevant memories
const results = await recallMemories(
  db,
  'What framework does the user prefer for APIs?',
  { limit: 5, threshold: 0.3 }
);

console.log('Found memories:', results);

// List all memories with filters
const allMemories = listMemories(db, {
  namespace: 'backend-preferences',
  category: 'preference',
  limit: 10
});

// Clean up
db.close();
```

See [examples/basic-usage.js](examples/basic-usage.js) for more examples.

### 5. Web Dashboard

Visual interface for managing memories:

```bash
npm start
```

Then open http://localhost:5173 in your browser.

**Dashboard Features:**
- 📊 System overview with statistics
- 📝 Browse and filter memories
- 🔍 Semantic search with score visualization
- ➕ Create new memories
- 🗑️ Delete memories
- 📈 View category and namespace distributions
- ⚠️ Detect and resolve conflicts
- 🔄 Run consolidation

### 6. PM2 Process Manager (Production Service)

Run Engram as a persistent background service using PM2:

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start Engram as a PM2 service
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Restart service
npm run pm2:restart

# Stop service
npm run pm2:stop

# Remove from PM2
npm run pm2:delete

# Monitor in real-time
npm run pm2:monit
```

**Auto-start on boot:**

```bash
# Generate startup script
pm2 startup

# Save current PM2 process list
pm2 save
```

PM2 configuration is in [ecosystem.config.cjs](ecosystem.config.cjs). Logs are stored in `~/.engram/logs/`.

## Architecture

### Memory Categories

Engram organizes memories into five categories:

- **preference** - User likes/dislikes ("prefers Fastify over Express")
- **fact** - Objective truth about their setup ("uses PostgreSQL 15")
- **pattern** - Recurring workflow ("always runs tests before commit")
- **decision** - Choice they made and why ("chose React for its ecosystem")
- **outcome** - Result of an action ("deployment succeeded after fixing port")

### Hybrid Recall Algorithm

Memories are ranked using a weighted formula:

```
score = (similarity × 0.5) + (recency × 0.15) + (confidence × 0.2) + (access × 0.05) + fts_boost
```

- **Similarity**: Cosine similarity of embeddings (0-1)
- **Recency**: Time-based decay using last access time
- **Confidence**: User-specified or auto-calculated confidence (0-1)
- **Access**: Normalized access count (0-1, capped at 10 accesses)
- **FTS Boost**: +0.1 if found via full-text search

### Database Schema

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  entity TEXT,
  category TEXT DEFAULT 'fact',
  confidence REAL DEFAULT 0.8,
  embedding BLOB,
  source TEXT,
  namespace TEXT DEFAULT 'default',
  tags TEXT,  -- JSON array
  access_count INTEGER DEFAULT 0,
  decay_rate REAL DEFAULT 0.01,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_accessed INTEGER
);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE memories_fts USING fts5(
  content, entity, category, namespace,
  content='memories', content_rowid='rowid'
);
```

## Configuration

Engram uses a YAML configuration file at `~/.engram/config.yml`:

```yaml
dataDir: ~/.engram
port: 3838

defaults:
  namespace: default
  recallLimit: 5
  confidenceThreshold: 0.3

security:
  secretDetection: true

consolidation:
  duplicateThreshold: 0.92
  decayEnabled: true
  staleCleanupDays: 90
```

## Advanced Features

### Secret Detection

Engram automatically detects and redacts common secrets:

- OpenAI API keys (`sk-...`)
- Stripe keys (`pk_...`, `sk_live_...`)
- AWS keys (`AKIA...`)
- GitHub tokens (`ghp_...`, `gho_...`)
- Slack tokens (`xoxb-...`, `xoxp-...`)
- Google API keys (`AIza...`)
- Private keys (`BEGIN PRIVATE KEY`)
- Database connection strings
- JWT tokens

### Consolidation

Run periodic consolidation to maintain memory quality:

```bash
node bin/engram.js consolidate
```

**What it does:**
- Removes duplicate memories (>0.92 similarity)
- Detects contradictions between memories
- Applies confidence decay to old, unused memories
- Marks stale memories for review

### Namespaces

Organize memories by project or context:

```bash
# Create memories in different namespaces
engram remember "Uses Docker" --namespace project-alpha
engram remember "Prefers Kubernetes" --namespace project-beta

# Filter by namespace
engram list --namespace project-alpha
engram recall "container tech" --namespace project-alpha
```

## Development

### Project Structure

```
engram/
├── bin/
│   └── engram.js              # CLI entry point
├── src/
│   ├── config/
│   │   └── index.js           # Configuration management
│   ├── memory/
│   │   ├── store.js           # SQLite operations
│   │   ├── recall.js          # Hybrid search
│   │   └── consolidate.js     # Memory consolidation
│   ├── embed/
│   │   └── index.js           # Embedding generation
│   ├── extract/
│   │   ├── rules.js           # Category/entity extraction
│   │   └── secrets.js         # Secret detection
│   ├── server/
│   │   ├── mcp.js             # MCP server
│   │   └── rest.js            # REST API server
│   └── utils/
│       ├── id.js              # UUID generation
│       └── logger.js          # Structured logging
├── dashboard/                  # React web UI
├── test/                      # Test suites
├── docs/                      # Documentation
└── examples/                  # Usage examples
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests once (no watch)
npm run test:run

# Run specific test file
npx vitest test/memory/store.test.js
```

### Building

```bash
# No build step required - uses ESM modules directly
node bin/engram.js start
```

## API Reference

See [docs/api.md](docs/api.md) for complete REST API documentation.

### Key Endpoints

- `POST /api/memories` - Create memory
- `GET /api/memories` - List memories
- `POST /api/memories/search` - Search memories
- `GET /api/memories/:id` - Get single memory
- `DELETE /api/memories/:id` - Delete memory
- `POST /api/consolidate` - Run consolidation
- `GET /api/conflicts` - Get detected conflicts
- `GET /api/status` - System status
- `GET /health` - Health check

## Examples

### Example 1: Project Context Memory

```javascript
// Store project decisions
await api.createMemory({
  content: "Chose Fastify over Express because of better TypeScript support and performance",
  category: "decision",
  entity: "fastify",
  confidence: 1.0,
  namespace: "project-api",
  tags: ["backend", "framework"]
});

// Later, recall why you chose it
const results = await api.searchMemories("why did we choose Fastify?", {
  namespace: "project-api",
  limit: 3
});
```

### Example 2: User Preferences

```javascript
// Store user preferences
await api.createMemory({
  content: "User prefers compact code without unnecessary comments",
  category: "preference",
  entity: "coding-style",
  confidence: 0.9
});

// Recall preferences before generating code
const prefs = await api.searchMemories("coding style preferences", {
  category: "preference",
  limit: 5
});
```

### Example 3: Infrastructure Facts

```javascript
// Document infrastructure
await api.createMemory({
  content: "Production database is PostgreSQL 15 on AWS RDS (db.t3.medium)",
  category: "fact",
  entity: "postgresql",
  namespace: "production"
});

// Quick lookup
const infra = await api.searchMemories("production database", {
  namespace: "production"
});
```

See [examples/](examples/) directory for more detailed examples.

## Performance

- **Memory Storage**: ~1ms per memory (with embedding)
- **Recall Search**: ~10-50ms for 5 results (depends on database size)
- **Database Size**: ~2KB per memory (including embedding)
- **Embedding Model**: 23MB (downloaded on first use)
- **Memory Usage**: ~50MB base + loaded model

## Troubleshooting

### Embedding model not downloading

```bash
# Check internet connection and disk space
# Model downloads to ~/.engram/models/
ls -lh ~/.engram/models/

# Manual download if needed
mkdir -p ~/.engram/models
# The model will auto-download on first use
```

### Port already in use

```bash
# Change the port
node bin/engram.js start --port 8080
```

### Database locked

```bash
# SQLite WAL mode should prevent this, but if it happens:
# Close all connections and restart
pkill -f "node bin/engram.js"
node bin/engram.js start
```

### Tests failing

```bash
# Clean test databases
rm -rf /tmp/engram-*

# Run tests
npm test
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for fast SQLite access
- Embeddings powered by [@xenova/transformers](https://github.com/xenova/transformers.js)
- REST API built with [Fastify](https://www.fastify.io/)
- Dashboard built with [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- MCP integration via [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)

## Support

- 📖 [Documentation](docs/)
- 🐛 [Issue Tracker](https://github.com/your-username/engram/issues)
- 💬 [Discussions](https://github.com/your-username/engram/discussions)

---

**Made with ❤️ for the AI agent community**
