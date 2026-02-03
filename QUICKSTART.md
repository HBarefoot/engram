# Engram Quick Start Guide

## Web-Based Setup (Easiest!)

The fastest way to integrate Engram with Claude Desktop, Claude Code, or other AI platforms:

1. **Start Engram:**
   ```bash
   npm run dev
   ```

2. **Open the dashboard:** http://localhost:5173

3. **Launch the Setup Wizard:**
   - Click the **Agents** tab
   - Click **Quick Setup**
   - Click **Launch Setup Wizard**

4. **Follow the wizard:**
   - Select your AI platform (Claude Desktop, Claude Code, etc.)
   - Copy the auto-generated configuration
   - Paste into your platform's config file
   - Restart your AI application

The wizard auto-detects your installation path and provides ready-to-use configurations. No manual path finding required!

---

## Starting Engram

### Option 1: Full Stack (API + Dashboard)

Start both the REST API server and web dashboard:

```bash
npm run dev
```

This will:
- Start REST API on http://localhost:3838
- Start dashboard on http://localhost:5173

### Option 2: API Only

Start just the REST API server:

```bash
npm start
# or
node bin/engram.js start
```

Access API at http://localhost:3838

### Option 3: MCP Server Only

For Claude Desktop/Code integration:

```bash
npm run mcp
# or
node bin/engram.js start --mcp-only
```

### Option 4: CLI Only

No server needed, just run commands:

```bash
node bin/engram.js remember "Your memory here"
node bin/engram.js recall "search query"
node bin/engram.js list
node bin/engram.js status
```

## Stopping Engram

### Stop All Processes

```bash
# Stop any running Engram processes
pkill -f "node bin/engram.js"
pkill -f "vite"

# Or use Ctrl+C in the terminal where it's running
```

### Check if ports are free

```bash
# Check if port 3838 is free (API)
lsof -ti:3838 || echo "Port 3838 is free"

# Check if port 5173 is free (Dashboard)
lsof -ti:5173 || echo "Port 5173 is free"
```

### Kill specific ports

```bash
# Kill process on port 3838
lsof -ti:3838 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

## First Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   cd dashboard && npm install && cd ..
   ```

2. **Verify installation:**
   ```bash
   node bin/engram.js --version
   npm test
   ```

3. **Create your first memory:**
   ```bash
   node bin/engram.js remember "I prefer TypeScript over JavaScript" --category preference
   ```

4. **Check status:**
   ```bash
   node bin/engram.js status
   ```

## Common Tasks

### Store a memory
```bash
node bin/engram.js remember "Project uses Fastify framework" \
  --category fact \
  --entity fastify \
  --namespace my-project
```

### Search memories
```bash
node bin/engram.js recall "What framework does the project use?" --limit 5
```

### List memories
```bash
# All memories
node bin/engram.js list

# Filter by namespace
node bin/engram.js list --namespace my-project

# Filter by category
node bin/engram.js list --category preference
```

### Delete a memory
```bash
node bin/engram.js forget <memory-id>
```

### Run consolidation
```bash
node bin/engram.js consolidate
```

### View conflicts
```bash
node bin/engram.js conflicts
```

## Web Dashboard

1. Start the full stack:
   ```bash
   npm run dev
   ```

2. Open http://localhost:5173 in your browser

3. Use the dashboard to:
   - View system statistics
   - Browse and filter memories
   - Perform semantic searches
   - Create new memories
   - Delete memories
   - Run consolidation
   - View conflicts

## REST API

1. Start the API server:
   ```bash
   npm start
   ```

2. Test with curl:
   ```bash
   # Health check
   curl http://localhost:3838/health

   # Get status
   curl http://localhost:3838/api/status

   # Create memory
   curl -X POST http://localhost:3838/api/memories \
     -H "Content-Type: application/json" \
     -d '{
       "content": "User prefers dark mode",
       "category": "preference"
     }'

   # Search
   curl -X POST http://localhost:3838/api/memories/search \
     -H "Content-Type: application/json" \
     -d '{"query": "user preferences", "limit": 5}'
   ```

## MCP Integration

1. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "engram": {
         "command": "node",
         "args": [
           "/full/path/to/engram/bin/engram.js",
           "start",
           "--mcp-only"
         ]
       }
     }
   }
   ```

2. Restart Claude Desktop

3. Ask Claude to remember or recall information

See [docs/mcp-setup.md](docs/mcp-setup.md) for detailed instructions.

## Configuration

Default config location: `~/.engram/config.yml`

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

## Troubleshooting

### Port already in use

```bash
# Kill the process using the port
lsof -ti:3838 | xargs kill -9

# Or use a different port
node bin/engram.js start --port 8080
```

### Embedding model not downloading

The model (~23MB) downloads automatically on first use. Make sure you have:
- Internet connection
- ~50MB free disk space
- Write access to `~/.engram/models/`

### Database locked

```bash
# Stop all Engram processes
pkill -f "node bin/engram.js"

# Remove lock files
rm ~/.engram/*.db-shm ~/.engram/*.db-wal

# Restart
npm start
```

### Tests failing

```bash
# Clean test artifacts
rm -rf /tmp/engram-*

# Reinstall dependencies
rm -rf node_modules
npm install

# Run tests
npm test
```

## Development

### Run tests
```bash
# Watch mode
npm test

# Run once
npm run test:run
```

### Run linter
```bash
npm run lint
```

### Build dashboard
```bash
cd dashboard
npm run build
```

## Getting Help

- 📖 [Full Documentation](README.md)
- 🏗️ [Architecture](docs/ARCHITECTURE.md)
- 🔌 [API Reference](docs/api.md)
- 💡 [Examples](examples/)
- 🐛 [Report Issues](https://github.com/your-username/engram/issues)

---

**Ready to start?** Try: `npm run dev` and open http://localhost:5173 🚀
