# Engram REST API Documentation

Base URL: `http://localhost:3838` (configurable with `--port`)

## Authentication

Currently no authentication. This is a local service intended for development use.

## Endpoints

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T20:58:05.904Z",
  "uptime": 6.856366875
}
```

---

### System Status

**GET** `/api/status`

Get comprehensive system status including memory statistics, model info, and configuration.

**Response:**
```json
{
  "status": "ok",
  "memory": {
    "total": 3,
    "withEmbeddings": 3,
    "byCategory": {
      "fact": 2,
      "preference": 1
    },
    "byNamespace": {
      "default": 2,
      "project-alpha": 1
    }
  },
  "model": {
    "name": "Xenova/all-MiniLM-L6-v2",
    "available": true,
    "cached": true,
    "size": 23,
    "path": "/Users/user/.engram/models"
  },
  "config": {
    "dataDir": "/Users/user/.engram",
    "defaultNamespace": "default",
    "recallLimit": 5,
    "secretDetection": true
  }
}
```

---

### Create Memory

**POST** `/api/memories`

Store a new memory.

**Request Body:**
```json
{
  "content": "User prefers Fastify over Express for API development",
  "category": "preference",
  "entity": "fastify",
  "confidence": 0.9,
  "namespace": "default",
  "tags": ["backend", "nodejs"]
}
```

**Parameters:**
- `content` (required, string): The memory content
- `category` (optional, string): `preference`, `fact`, `pattern`, `decision`, or `outcome`. Default: `fact`. Auto-detected if not provided.
- `entity` (optional, string): What this memory is about. Auto-extracted if not provided.
- `confidence` (optional, number): Confidence score 0.0-1.0. Default: 0.8
- `namespace` (optional, string): Project or scope. Default: `default`
- `tags` (optional, array): Tags for categorization

**Response:**
```json
{
  "success": true,
  "memory": {
    "id": "981b75ca-80f5-4386-948b-7d14bfebf27d",
    "content": "User prefers Fastify over Express for API development",
    "category": "preference",
    "entity": "fastify",
    "confidence": 0.9,
    "namespace": "default",
    "tags": ["backend", "nodejs"],
    "createdAt": 1770065904277
  },
  "warnings": []
}
```

**Secret Detection:**

If secrets are detected, they will be automatically redacted:

```json
{
  "success": true,
  "memory": {
    "id": "...",
    "content": "API key is [REDACTED]",
    ...
  },
  "warnings": ["Redacted OpenAI API Key"]
}
```

If `autoRedact` is disabled in config, requests with secrets will be rejected:

```json
{
  "error": "Cannot store memory",
  "details": ["Detected OpenAI API Key: sk-..."],
  "warnings": ["Content contains sensitive information and was rejected"]
}
```

---

### List Memories

**GET** `/api/memories`

List all memories with optional filtering and pagination.

**Query Parameters:**
- `limit` (optional, number): Max results. Default: 50
- `offset` (optional, number): Pagination offset. Default: 0
- `category` (optional, string): Filter by category
- `namespace` (optional, string): Filter by namespace

**Example:**
```
GET /api/memories?namespace=default&category=preference&limit=10
```

**Response:**
```json
{
  "success": true,
  "memories": [
    {
      "id": "981b75ca-80f5-4386-948b-7d14bfebf27d",
      "content": "User prefers Fastify over Express",
      "category": "preference",
      "entity": "fastify",
      "confidence": 0.9,
      "namespace": "default",
      "tags": ["backend"],
      "accessCount": 5,
      "createdAt": 1770065904277,
      "lastAccessed": 1770066000000
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

---

### Search/Recall Memories

**POST** `/api/memories/search`

Search for relevant memories using hybrid search (embeddings + FTS + recency).

**Request Body:**
```json
{
  "query": "What are the user's frontend framework preferences?",
  "limit": 5,
  "category": "preference",
  "namespace": "default",
  "threshold": 0.3
}
```

**Parameters:**
- `query` (required, string): Search query
- `limit` (optional, number): Max results (1-20). Default: 5
- `category` (optional, string): Filter by category
- `namespace` (optional, string): Filter by namespace
- `threshold` (optional, number): Minimum relevance score (0.0-1.0). Default: 0.3

**Response:**
```json
{
  "success": true,
  "query": "What are the user's frontend framework preferences?",
  "memories": [
    {
      "id": "f8e965b9-0621-4dfe-ac79-c8b0117ad7d4",
      "content": "User prefers React for frontend",
      "category": "preference",
      "entity": "react",
      "confidence": 0.8,
      "namespace": "default",
      "tags": [],
      "score": 0.584,
      "scoreBreakdown": {
        "similarity": 0.548,
        "recency": 0.999,
        "confidence": 0.8,
        "access": 0,
        "ftsBoost": 0,
        "final": 0.584
      },
      "accessCount": 1,
      "createdAt": 1770065500208,
      "lastAccessed": 1770065922075
    }
  ]
}
```

**Scoring Formula:**
```
final_score = (similarity × 0.5) + (recency × 0.15) + (confidence × 0.2) + (access × 0.05) + fts_boost
```

---

### Get Single Memory

**GET** `/api/memories/:id`

Retrieve a specific memory by ID.

**Response:**
```json
{
  "success": true,
  "memory": {
    "id": "981b75ca-80f5-4386-948b-7d14bfebf27d",
    "content": "User prefers Svelte for frontend development",
    "category": "preference",
    "entity": "svelte",
    "confidence": 0.9,
    "namespace": "default",
    "tags": [],
    "accessCount": 1,
    "decayRate": 0.01,
    "createdAt": 1770065904277,
    "updatedAt": 1770065904277,
    "lastAccessed": 1770065922075,
    "hasEmbedding": true
  }
}
```

**Error Response (404):**
```json
{
  "error": "Memory not found"
}
```

---

### Delete Memory

**DELETE** `/api/memories/:id`

Delete a memory by ID.

**Response:**
```json
{
  "success": true,
  "message": "Memory deleted successfully",
  "deletedMemory": {
    "id": "2081332b-7200-4a3a-8ab2-856d1612ce64",
    "content": "Testing memory in project-alpha namespace"
  }
}
```

**Error Response (404):**
```json
{
  "error": "Memory not found"
}
```

---

### Run Consolidation

**POST** `/api/consolidate`

Manually trigger memory consolidation (duplicate detection, contradiction detection, confidence decay, stale cleanup).

**Request Body:**
```json
{
  "detectDuplicates": true,
  "detectContradictions": true,
  "applyDecay": true,
  "cleanupStale": false
}
```

**Parameters (all optional, defaults to true except cleanupStale):**
- `detectDuplicates` (boolean): Find and merge duplicate memories
- `detectContradictions` (boolean): Detect conflicting memories
- `applyDecay` (boolean): Apply confidence decay based on access patterns
- `cleanupStale` (boolean): Mark stale memories. Default: false

**Response:**
```json
{
  "success": true,
  "results": {
    "duplicatesRemoved": 2,
    "contradictionsDetected": 1,
    "memoriesDecayed": 15,
    "staleMemoriesCleaned": 0,
    "duration": 125
  }
}
```

---

### Get Conflicts

**GET** `/api/conflicts`

Retrieve detected contradictions between memories.

**Response:**
```json
{
  "success": true,
  "conflicts": [
    {
      "conflictId": "conflict_abc123",
      "memories": [
        {
          "id": "mem1",
          "content": "User prefers React",
          "category": "preference",
          "entity": "react",
          "confidence": 0.9,
          "createdAt": 1770065500000
        },
        {
          "id": "mem2",
          "content": "User never uses React",
          "category": "preference",
          "entity": "react",
          "confidence": 0.7,
          "createdAt": 1770065600000
        }
      ]
    }
  ]
}
```

---

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK`: Success
- `204 No Content`: Success with no response body (OPTIONS)
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": "Error message here"
}
```

---

## CORS

The API includes CORS headers allowing cross-origin requests from any origin (`Access-Control-Allow-Origin: *`). This is suitable for local development but should be restricted in production.

---

## Examples

### Create and search workflow

```bash
# Create a memory
curl -X POST http://localhost:3838/api/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "User prefers PostgreSQL with pgvector for vector storage",
    "category": "preference",
    "entity": "postgresql"
  }'

# Search for it
curl -X POST http://localhost:3838/api/memories/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database preferences",
    "limit": 3
  }'

# List all memories
curl http://localhost:3838/api/memories

# Get system status
curl http://localhost:3838/api/status

# Run consolidation
curl -X POST http://localhost:3838/api/consolidate \
  -H "Content-Type: application/json" \
  -d '{
    "detectDuplicates": true,
    "applyDecay": true
  }'
```

---

## Starting the Server

```bash
# Start REST API server (default port 3838)
node bin/engram.js start

# Start on custom port
node bin/engram.js start --port 8080

# Start with custom config
node bin/engram.js start --config /path/to/config.yml

# Start MCP server only (stdio mode)
node bin/engram.js start --mcp-only
```

---

## Next Steps

- **Phase 5**: Web Dashboard UI for visualizing and managing memories
- **Phase 6**: Documentation, examples, and final polish
