import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import * as logger from '../utils/logger.js';

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
 * @param {string} modelsPath - Path to models directory
 * @returns {boolean} True if model is downloaded
 */
export function isModelAvailable(modelsPath) {
  // Check if the models directory contains the model files
  // This is a simplified check - the actual model files might be in subdirectories
  return fs.existsSync(modelsPath) && fs.readdirSync(modelsPath).length > 0;
}

/**
 * Get model information
 * @param {string} modelsPath - Path to models directory
 * @returns {Object} Model information
 */
export function getModelInfo(modelsPath) {
  const available = isModelAvailable(modelsPath);

  let size = 0;
  if (available) {
    // Calculate total size of model files
    const files = fs.readdirSync(modelsPath, { recursive: true, withFileTypes: true });
    for (const file of files) {
      if (file.isFile()) {
        const filePath = path.join(file.path || modelsPath, file.name);
        try {
          const stats = fs.statSync(filePath);
          size += stats.size;
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
  }

  return {
    name: MODEL_CONFIG.name,
    task: MODEL_CONFIG.task,
    available,
    cached: cachedPipeline !== null,
    sizeBytes: size,
    sizeMB: Math.round(size / (1024 * 1024)),
    path: modelsPath
  };
}
