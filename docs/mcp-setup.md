# MCP Server Setup Guide

This guide shows how to configure Engram's MCP server with Claude Desktop or Claude Code.

## ✨ Easiest Method: Web-Based Setup Wizard

For the simplest setup experience, use the **Integration Wizard** in the Engram dashboard:

1. Start Engram: `npm run dev`
2. Open [http://localhost:5173](http://localhost:5173) in your browser
3. Go to the **Agents** tab
4. Click **Quick Setup** → **Launch Setup Wizard**
5. Select your platform and copy the auto-generated configuration

The wizard will auto-detect your installation path and provide copy-paste ready configurations for:
- Claude Desktop
- Claude Code
- Cline (VS Code)
- Custom MCP clients

---

## Manual Configuration (Alternative)

If you prefer manual setup or need advanced customization, follow the instructions below.

## Configuration for Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": [
        "/Users/henrybarefoot/repos-and-projects/MCPs-and-AI/engram/bin/engram.js",
        "start",
        "--mcp-only"
      ]
    }
  }
}
```

**Note**: Update the path to match your installation location.

## Configuration for Claude Code

Add this to your Claude Code configuration:

**macOS/Linux**: `~/.claude/mcp.json`

```json
{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": [
        "/Users/henrybarefoot/repos-and-projects/MCPs-and-AI/engram/bin/engram.js",
        "start",
        "--mcp-only"
      ]
    }
  }
}
```

## Available MCP Tools

Once configured, the following tools will be available:

### 1. engram_remember
Store a memory/fact/preference/pattern.

**Parameters**:
- `content` (required): The memory to store
- `category` (optional): preference|fact|pattern|decision|outcome
- `entity` (optional): What this is about (e.g., "docker", "deployment")
- `confidence` (optional): 0.0-1.0, default 0.8
- `namespace` (optional): Project scope, default "default"
- `tags` (optional): Array of tags

**Example**:
```json
{
  "content": "User prefers Fastify over Express for API development",
  "category": "preference",
  "entity": "fastify",
  "confidence": 0.9
}
```

### 2. engram_recall
Retrieve relevant memories for the current context.

**Parameters**:
- `query` (required): What you want to remember
- `limit` (optional): Max results (1-20), default 5
- `category` (optional): Filter by category
- `namespace` (optional): Filter by namespace
- `threshold` (optional): Minimum relevance score (0.0-1.0), default 0.3

**Example**:
```json
{
  "query": "What are the user's API framework preferences?",
  "limit": 3,
  "category": "preference"
}
```

### 3. engram_forget
Remove a specific memory by ID.

**Parameters**:
- `memory_id` (required): The ID of the memory to remove

**Example**:
```json
{
  "memory_id": "c6c4d4be-7847-4d9d-8f29-5815af0ff8e1"
}
```

### 4. engram_status
Check Engram health and statistics.

No parameters required.

## Testing the Setup

After configuring, restart Claude Desktop/Code. You can verify the setup by asking:

> "Can you check the Engram status?"

This should trigger the `engram_status` tool and return memory statistics.

## CLI Alternative

You can also use the CLI directly for testing:

```bash
# Store a memory
node bin/engram.js remember "User prefers Docker" --category preference

# Recall memories
node bin/engram.js recall "Docker preferences"

# List all memories
node bin/engram.js list

# Check status
node bin/engram.js status

# Delete a memory
node bin/engram.js forget <memory-id>

# Run consolidation
node bin/engram.js consolidate

# View conflicts
node bin/engram.js conflicts
```

## Troubleshooting

### Server not starting
- Check the path in your configuration file
- Ensure Node.js 20+ is installed: `node --version`
- Try running manually: `node bin/engram.js start --mcp-only`

### No tools appearing
- Restart Claude Desktop/Code after configuration changes
- Check logs in the application's developer console

### Embedding model issues
- Model downloads automatically on first use (~23MB)
- Stored in `~/.engram/models/`
- If download fails, check internet connection and disk space
