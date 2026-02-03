import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Cached pipeline instance
 */
let cachedPipeline = null;

/**
 * Model configuration
 */
const MODEL_CONFIG = {
  name: 'Xenova/all-MiniLM-L6-v2',
  task: 'feature-extraction'
};

/**
 * Initialize the embedding pipeline
 * Downloads model on first use and caches it
 * @param {string} modelsPath - Path to models directory
 * @returns {Promise<Object>} Pipeline instance
 */
export async function initializePipeline(modelsPath) {
  if (cachedPipeline) {
    logger.debug('Using cached embedding pipeline');
    return cachedPipeline;
  }

  try {
    logger.info('Initializing embedding model', { model: MODEL_CONFIG.name });

    // Ensure models directory exists
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }

    // Set cache directory for transformers
    process.env.TRANSFORMERS_CACHE = modelsPath;

    logger.info('Loading embedding model (this may take a moment on first run)...');

    // Create pipeline
    cachedPipeline = await pipeline(
      MODEL_CONFIG.task,
      MODEL_CONFIG.name,
      {
        quantized: true,
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            const percent = progress.progress ? Math.round(progress.progress) : 0;
            logger.debug(`Downloading model: ${percent}%`);
          }
        }
      }
    );

    logger.info('Embedding model loaded successfully');

    return cachedPipeline;
  } catch (error) {
    logger.error('Failed to initialize embedding pipeline', { error: error.message });
    throw error;
  }
}

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @param {string} modelsPath - Path to models directory
 * @returns {Promise<Float32Array>} Embedding vector
 */
export async function generateEmbedding(text, modelsPath) {
  try {
    const pipe = await initializePipeline(modelsPath);

    logger.debug('Generating embedding', { textLength: text.length });

    // Generate embedding
    const result = await pipe(text, {
      pooling: 'mean',
      normalize: true
    });

    // Extract the embedding array
    // The result is a tensor, we need to convert it to Float32Array
    const embedding = new Float32Array(result.data);

    logger.debug('Embedding generated', { dimensions: embedding.length });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate embedding', { error: error.message });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to embed
 * @param {string} modelsPath - Path to models directory
 * @returns {Promise<Float32Array[]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts, modelsPath) {
  try {
    const pipe = await initializePipeline(modelsPath);

    logger.debug('Generating batch embeddings', { count: texts.length });

    const embeddings = [];

    for (const text of texts) {
      const result = await pipe(text, {
        pooling: 'mean',
        normalize: true
      });

      embeddings.push(new Float32Array(result.data));
    }

    logger.debug('Batch embeddings generated', { count: embeddings.length });

    return embeddings;
  } catch (error) {
    logger.error('Failed to generate batch embeddings', { error: error.message });
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * @param {Float32Array} a - First embedding
 * @param {Float32Array} b - Second embedding
 * @returns {number} Similarity score (0-1)
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

  // Clamp to [0, 1] range (should already be in this range for normalized embeddings)
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Check if embedding model is available (cached)
 * @param {string} modelsPath - Path to models directory (may be overridden)
 * @returns {Object} Object with available flag and actual path
 */
export function isModelAvailable(modelsPath) {
  // First check the provided modelsPath
  if (fs.existsSync(modelsPath) && fs.readdirSync(modelsPath).length > 0) {
    return { available: true, path: modelsPath };
  }

  // Check Xenova transformers cache in node_modules (most common for local dev)
  const possiblePaths = [
    path.resolve(__dirname, '../../node_modules/@xenova/transformers/.cache/Xenova/all-MiniLM-L6-v2'),
  ];

  // Add home directory cache paths
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    possiblePaths.push(path.join(homeDir, '.cache', 'huggingface', 'hub', 'models--Xenova--all-MiniLM-L6-v2'));
  }

  for (const cachePath of possiblePaths) {
    try {
      if (fs.existsSync(cachePath) && fs.readdirSync(cachePath).length > 0) {
        return { available: true, path: cachePath };
      }
    } catch (e) {
      // Continue checking other paths
    }
  }

  return { available: false, path: modelsPath };
}

/**
 * Calculate directory size recursively
 * @param {string} dirPath - Directory path
 * @returns {number} Size in bytes
 */
function getDirectorySize(dirPath) {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          size += stats.size;
        } catch (e) {
          // Skip unreadable files
        }
      } else if (entry.isDirectory()) {
        size += getDirectorySize(fullPath);
      }
    }
  } catch (e) {
    // Return 0 if directory can't be read
  }
  return size;
}

/**
 * Get model information
 * @param {string} modelsPath - Path to models directory
 * @returns {Object} Model information
 */
export function getModelInfo(modelsPath) {
  const modelCheck = isModelAvailable(modelsPath);
  const available = modelCheck.available;
  const actualPath = modelCheck.path;

  let size = 0;
  if (available) {
    size = getDirectorySize(actualPath);
  }

  return {
    name: MODEL_CONFIG.name,
    task: MODEL_CONFIG.task,
    available,
    cached: cachedPipeline !== null,
    sizeBytes: size,
    sizeMB: Math.round(size / (1024 * 1024)),
    path: actualPath
  };
}
