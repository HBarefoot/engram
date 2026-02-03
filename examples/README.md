# Engram Examples

This directory contains practical examples demonstrating how to use Engram in different scenarios.

## Examples

### [basic-usage.js](basic-usage.js)

Demonstrates fundamental operations:
- Creating memories with different categories
- Listing and filtering memories
- Searching for relevant memories
- Namespace organization

**Run:**
```bash
node examples/basic-usage.js
```

### [api-client.js](api-client.js)

Shows how to interact with Engram's REST API:
- Creating an API client class
- Making HTTP requests to all endpoints
- Error handling
- Reusable client for integration

**Prerequisites:**
- Start the REST API server: `node bin/engram.js start`

**Run:**
```bash
node examples/api-client.js
```

## More Examples

### User Preference Tracking

```javascript
import { createMemory } from '../src/memory/store.js';

// Track what the user likes
createMemory(db, {
  content: 'User prefers dark mode in development tools',
  category: 'preference',
  entity: 'dark-mode',
  confidence: 1.0,
  namespace: 'ui-preferences'
});

// Later recall preferences
const prefs = await recallMemories(db, 'user interface preferences', {
  category: 'preference',
  namespace: 'ui-preferences'
});
```

### Project Documentation

```javascript
// Document architecture decisions
createMemory(db, {
  content: 'Chose microservices architecture to allow independent scaling of services',
  category: 'decision',
  entity: 'architecture',
  confidence: 1.0,
  namespace: 'project-alpha',
  tags: ['architecture', 'scalability']
});

// Document infrastructure
createMemory(db, {
  content: 'Production runs on AWS EKS with 3 node groups (t3.medium)',
  category: 'fact',
  entity: 'kubernetes',
  namespace: 'production-infrastructure'
});
```

### Workflow Patterns

```javascript
// Remember recurring workflows
createMemory(db, {
  content: 'Always create a feature branch from main, never commit directly',
  category: 'pattern',
  entity: 'git-workflow',
  confidence: 1.0,
  tags: ['git', 'workflow', 'best-practices']
});

createMemory(db, {
  content: 'Run lint, format, test, and build before pushing to remote',
  category: 'pattern',
  entity: 'pre-push',
  confidence: 1.0,
  tags: ['testing', 'quality']
});
```

### Learning from Outcomes

```javascript
// Track what worked and what didn't
createMemory(db, {
  content: 'Deployment to staging failed due to missing DATABASE_URL env var',
  category: 'outcome',
  entity: 'deployment',
  confidence: 1.0,
  namespace: 'staging',
  tags: ['deployment', 'environment']
});

createMemory(db, {
  content: 'Switching to connection pooling reduced database latency by 60%',
  category: 'outcome',
  entity: 'performance',
  confidence: 1.0,
  tags: ['database', 'optimization']
});
```

### Multi-Namespace Organization

```javascript
// Different projects
await createMemory(db, {
  content: 'Frontend uses Next.js 14 with App Router',
  namespace: 'project-web'
});

await createMemory(db, {
  content: 'API uses Fastify with Swagger documentation',
  namespace: 'project-api'
});

// Search within specific project
const webMemories = await recallMemories(db, 'frontend', {
  namespace: 'project-web',
  limit: 10
});
```

### Secret Detection Example

```javascript
// This will be automatically redacted
const result = await createMemory(db, {
  content: 'API key for OpenAI is sk-1234567890abcdefghijklmnopqrstuv'
});

// Result:
// {
//   content: "API key for OpenAI is [REDACTED]",
//   warnings: ["Redacted OpenAI API Key"]
// }
```

## Integration Examples

### Express/Fastify Middleware

```javascript
import { EngramClient } from './api-client.js';

const engram = new EngramClient('http://localhost:3838');

// Log user actions
app.post('/api/users/:id/preferences', async (req, res) => {
  const { preference } = req.body;

  // Store preference in Engram
  await engram.createMemory({
    content: `User ${req.params.id} prefers ${preference}`,
    category: 'preference',
    namespace: `user-${req.params.id}`
  });

  res.json({ success: true });
});

// Recall user context
app.get('/api/users/:id/context', async (req, res) => {
  const memories = await engram.searchMemories('user preferences', {
    namespace: `user-${req.params.id}`,
    limit: 10
  });

  res.json(memories);
});
```

### Claude Desktop Integration

```json
{
  "mcpServers": {
    "engram": {
      "command": "node",
      "args": [
        "/path/to/engram/bin/engram.js",
        "start",
        "--mcp-only"
      ]
    }
  }
}
```

Then ask Claude:
> "Can you check what I prefer for building APIs?"

Claude will use the `engram_recall` tool to search your memories.

## Tips

1. **Use specific content**: "User prefers Fastify" is better than "User likes frameworks"
2. **Choose appropriate categories**: Decision vs Preference vs Fact makes a difference
3. **Leverage namespaces**: Organize by project, environment, or context
4. **Set confidence levels**: Use 1.0 for explicit statements, 0.7-0.9 for inferences
5. **Add meaningful tags**: They don't affect search but help with organization
6. **Run consolidation regularly**: `engram consolidate` keeps memory quality high

## Need Help?

- Check the [main README](../README.md)
- Read the [API documentation](../docs/api.md)
- Open an [issue](https://github.com/your-username/engram/issues)
