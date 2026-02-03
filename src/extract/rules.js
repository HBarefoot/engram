/**
 * Category detection patterns
 */
const CATEGORY_SIGNALS = {
  decision: [
    /\b(decided|chose|picked|went with|switched to|migrated)\b/i,
    /\b(because|reason|rationale|trade-?off)\b/i
  ],
  preference: [
    /\b(prefer|like|love|hate|dislike|always use|never use|favorite|avoid)\b/i,
    /\b(instead of|rather than|over|better than)\b/i
  ],
  pattern: [
    /\b(usually|typically|always|every time|workflow|routine|habit)\b/i,
    /\b(when .+ then|if .+ then|tends to)\b/i
  ],
  outcome: [
    /\b(result|outcome|turned out|ended up|caused|fixed|broke|solved)\b/i,
    /\b(worked|failed|succeeded|improved|degraded)\b/i
  ],
  fact: [] // Default — anything not matching above
};

/**
 * Common technology/tool keywords for entity extraction
 */
const TECH_KEYWORDS = [
  'nginx', 'apache', 'docker', 'kubernetes', 'k8s',
  'postgres', 'postgresql', 'mysql', 'mongodb', 'redis',
  'react', 'vue', 'angular', 'svelte', 'nextjs', 'next.js',
  'fastify', 'express', 'flask', 'django', 'rails',
  'node.js', 'nodejs', 'node', 'python', 'java', 'go', 'rust',
  'aws', 'azure', 'gcp', 'heroku', 'vercel', 'netlify',
  'github', 'gitlab', 'bitbucket',
  'tailwind', 'bootstrap', 'sass', 'css',
  'typescript', 'javascript', 'js', 'ts',
  'vite', 'webpack', 'rollup', 'parcel',
  'jest', 'vitest', 'mocha', 'cypress',
  'git', 'npm', 'yarn', 'pnpm'
];

/**
 * Detect the category of a memory based on its content
 * @param {string} content - Memory content
 * @returns {string} Detected category (preference, fact, pattern, decision, outcome)
 */
export function detectCategory(content) {
  for (const [category, patterns] of Object.entries(CATEGORY_SIGNALS)) {
    if (category === 'fact') continue; // Skip fact (default)

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return category;
      }
    }
  }

  return 'fact'; // Default category
}

/**
 * Extract entity from content (what this memory is about)
 * @param {string} content - Memory content
 * @returns {string|null} Extracted entity or null
 */
export function extractEntity(content) {
  const contentLower = content.toLowerCase();

  // Look for known tech keywords
  for (const keyword of TECH_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword.replace(/\./g, '\\.')}\\b`, 'i');
    if (regex.test(contentLower)) {
      return keyword.toLowerCase().replace(/\./g, '');
    }
  }

  // Try to extract from common patterns
  // Pattern: "uses X", "with X", "via X", "on X"
  const patterns = [
    /\b(?:uses?|using|with|via|on|for)\s+([a-z][a-z0-9-]+(?:\s+[a-z][a-z0-9-]+)?)\b/i,
    /\b([a-z][a-z0-9-]+(?:\s+[a-z][a-z0-9-]+)?)\s+(?:configuration|setup|deployment|server|database|framework|library)\b/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const entity = match[1].toLowerCase().trim();
      // Filter out common words
      const stopWords = ['the', 'a', 'an', 'this', 'that', 'their', 'user', 'users'];
      if (!stopWords.includes(entity) && entity.length > 2) {
        return entity.replace(/\s+/g, '-').replace(/\./g, '');
      }
    }
  }

  return null;
}

/**
 * Determine confidence score based on content signals
 * @param {string} content - Memory content
 * @param {Object} [context] - Additional context
 * @param {boolean} [context.userExplicit] - User explicitly stated this
 * @param {boolean} [context.fromCode] - Extracted from code/config
 * @param {boolean} [context.inferred] - Inferred from context
 * @returns {number} Confidence score (0.0-1.0)
 */
export function calculateConfidence(content, context = {}) {
  if (context.userExplicit) {
    return 1.0;
  }

  if (context.fromCode) {
    return 0.9;
  }

  // Check for explicit statement indicators
  const explicitIndicators = [
    /\b(I use|I prefer|I always|I never|my setup|my workflow)\b/i
  ];

  for (const pattern of explicitIndicators) {
    if (pattern.test(content)) {
      return 0.9;
    }
  }

  // Check for inference indicators
  const inferenceIndicators = [
    /\b(seems|appears|likely|probably|might|could)\b/i
  ];

  for (const pattern of inferenceIndicators) {
    if (pattern.test(content)) {
      return 0.6;
    }
  }

  if (context.inferred) {
    return 0.7;
  }

  // Default confidence for agent-submitted memories
  return 0.8;
}

/**
 * Extract structured memory from raw text
 * @param {string} content - Raw content
 * @param {Object} [options] - Extraction options
 * @param {string} [options.source] - Source of the content
 * @param {string} [options.namespace] - Namespace for the memory
 * @returns {Object} Structured memory object
 */
export function extractMemory(content, options = {}) {
  const category = detectCategory(content);
  const entity = extractEntity(content);
  const confidence = calculateConfidence(content, options);

  return {
    content: content.trim(),
    category,
    entity,
    confidence,
    source: options.source || 'manual',
    namespace: options.namespace || 'default',
    tags: options.tags || []
  };
}

/**
 * Extract multiple memories from longer text
 * @param {string} text - Long text content
 * @param {Object} [options] - Extraction options
 * @returns {Object[]} Array of extracted memories
 */
export function extractMemories(text, options = {}) {
  // Split by sentences or paragraphs
  const sentences = text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Minimum length for a memory

  const memories = [];

  for (const sentence of sentences) {
    // Skip if it's too generic or vague
    if (isGeneric(sentence)) {
      continue;
    }

    const memory = extractMemory(sentence, options);

    // Only include if it has meaningful content
    if (memory.entity || memory.category !== 'fact') {
      memories.push(memory);
    }
  }

  return memories;
}

/**
 * Check if content is too generic to be a useful memory
 * @param {string} content - Content to check
 * @returns {boolean} True if too generic
 */
function isGeneric(content) {
  const genericPatterns = [
    /^(ok|okay|yes|no|sure|thanks|thank you)$/i,
    /^(good|great|nice|cool)$/i,
    /^(I see|I understand|got it)$/i
  ];

  for (const pattern of genericPatterns) {
    if (pattern.test(content.trim())) {
      return true;
    }
  }

  // Too short
  if (content.length < 20) {
    return true;
  }

  // No meaningful words
  const words = content.split(/\s+/).filter(w => w.length > 3);
  if (words.length < 3) {
    return true;
  }

  return false;
}
