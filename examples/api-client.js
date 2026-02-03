/**
 * REST API Client Example
 *
 * This example shows how to interact with Engram's REST API
 * programmatically from Node.js or browser JavaScript.
 */

const API_BASE = 'http://localhost:3838';

class EngramClient {
  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async createMemory(data) {
    return this.request('/api/memories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async searchMemories(query, options = {}) {
    return this.request('/api/memories/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...options })
    });
  }

  async listMemories(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/memories${query ? `?${query}` : ''}`);
  }

  async getMemory(id) {
    return this.request(`/api/memories/${id}`);
  }

  async deleteMemory(id) {
    return this.request(`/api/memories/${id}`, {
      method: 'DELETE'
    });
  }

  async getStatus() {
    return this.request('/api/status');
  }

  async consolidate(options = {}) {
    return this.request('/api/consolidate', {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  async getConflicts() {
    return this.request('/api/conflicts');
  }
}

// Usage example
async function main() {
  console.log('🔌 Engram API Client Example\n');

  const client = new EngramClient();

  try {
    // 1. Check system status
    console.log('📊 Checking system status...\n');
    const status = await client.getStatus();
    console.log(`Total memories: ${status.memory.total}`);
    console.log(`With embeddings: ${status.memory.withEmbeddings}`);
    console.log(`Model: ${status.model.name}\n`);

    // 2. Create a memory
    console.log('📝 Creating a memory...\n');
    const createResult = await client.createMemory({
      content: 'User prefers TypeScript over JavaScript for type safety',
      category: 'preference',
      entity: 'typescript',
      confidence: 0.95,
      namespace: 'coding-preferences',
      tags: ['typescript', 'languages']
    });
    console.log(`✓ Created memory: ${createResult.memory.id}`);
    console.log(`  Content: ${createResult.memory.content}\n`);

    // 3. Search for memories
    console.log('🔍 Searching for programming language preferences...\n');
    const searchResults = await client.searchMemories('programming language preferences', {
      limit: 5,
      threshold: 0.3
    });
    console.log(`Found ${searchResults.memories.length} relevant memories:\n`);
    searchResults.memories.forEach((m, i) => {
      console.log(`${i + 1}. ${m.content}`);
      console.log(`   Score: ${m.score.toFixed(3)} | Confidence: ${m.confidence}\n`);
    });

    // 4. List memories with filters
    console.log('📋 Listing preferences...\n');
    const listResult = await client.listMemories({
      category: 'preference',
      limit: 10
    });
    console.log(`Found ${listResult.memories.length} preferences:\n`);
    listResult.memories.forEach(m => {
      console.log(`- ${m.content}`);
    });
    console.log();

    // 5. Get specific memory
    console.log('🔍 Getting specific memory...\n');
    const memory = await client.getMemory(createResult.memory.id);
    console.log(`Memory: ${memory.memory.id.substring(0, 8)}`);
    console.log(`Content: ${memory.memory.content}`);
    console.log(`Created: ${new Date(memory.memory.createdAt).toLocaleString()}\n`);

    // 6. Cleanup
    console.log('🗑️  Deleting example memory...\n');
    await client.deleteMemory(createResult.memory.id);
    console.log('✓ Memory deleted\n');

    console.log('✅ Example completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { EngramClient };
