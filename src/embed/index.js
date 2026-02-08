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
 * Whether the pipeline is currently being initialized
 */
let pipelineLoading = false;

/**
 * Model configuration
 */
const MODEL_CONFIG = {
  name: 'Xenova/all-MiniLM-L6-v2',
  task: 'feature-extraction'
};

/**
 * Model subdirectory name within a models cache root
 */
const MODEL_SUBDIR = path.join('Xenova', 'all-MiniLM-L6-v2');

/**
 * Build a list of known locations where the embedding model may already be cached.
 * Each entry is the full path to the model subdirectory (e.g. .../Xenova/all-MiniLM-L6-v2).
 * @returns {string[]} Array of candidate model directory paths
 */
function getKnownModelSources() {
  const sources = [
    // Bundled alongside sidecar (production .app bundle — __dirname is the resources dir)
    path.resolve(__dirname, 'models', MODEL_SUBDIR),
    // node_modules cache (local dev / source)
    path.resolve(__dirname, '../../node_modules/@xenova/transformers/.cache', MODEL_SUBDIR),
  ];

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    sources.push(path.join(homeDir, '.cache', 'huggingface', 'hub', 'models--Xenova--all-MiniLM-L6-v2'));
  }

  // Check TRANSFORMERS_CACHE env var (set during initializePipeline)
  if (process.env.TRANSFORMERS_CACHE) {
    sources.push(path.join(process.env.TRANSFORMERS_CACHE, MODEL_SUBDIR));
  }

  return sources;
}

/**
 * Seed the models cache directory from known cache locations.
 * Copies model files to modelsPath so both source and bundled contexts work.
 * @param {string} modelsPath - Target models directory (e.g. ~/.engram/models)
 */
function seedModelCache(modelsPath) {
  const modelSubdir = path.join(modelsPath, MODEL_SUBDIR);

  // Already seeded?
  try {
    if (fs.existsSync(modelSubdir) && fs.readdirSync(modelSubdir).length > 0) {
      return;
    }
  } catch { /* continue */ }

  for (const src of getKnownModelSources()) {
    try {
      if (fs.existsSync(src) && fs.readdirSync(src).length > 0) {
        logger.info('Seeding model cache', { from: src, to: modelSubdir });
        fs.mkdirSync(modelSubdir, { recursive: true });
        fs.cpSync(src, modelSubdir, { recursive: true });
        return;
      }
    } catch (e) {
      logger.debug('Could not seed from source', { src, error: e.message });
    }
  }
}

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
    pipelineLoading = true;
    logger.info('Initializing embedding model', { model: MODEL_CONFIG.name });

    // Ensure models directory exists
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }

    // Seed cache from known locations if empty
    seedModelCache(modelsPath);

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

    pipelineLoading = false;
    logger.info('Embedding model loaded successfully');

    return cachedPipeline;
  } catch (error) {
    pipelineLoading = false;
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
  // If the pipeline is already loaded, the model is definitely available
  if (cachedPipeline) {
    return { available: true, path: modelsPath };
  }

  // Check the model subdirectory within modelsPath (not just the top-level dir)
  const modelSubdir = path.join(modelsPath, MODEL_SUBDIR);
  try {
    if (fs.existsSync(modelSubdir) && fs.readdirSync(modelSubdir).length > 0) {
      return { available: true, path: modelsPath };
    }
  } catch {
    // Continue checking other paths
  }

  // Check known cache locations
  for (const cachePath of getKnownModelSources()) {
    try {
      if (fs.existsSync(cachePath) && fs.readdirSync(cachePath).length > 0) {
        return { available: true, path: cachePath };
      }
    } catch {
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
  const pipelineLoaded = cachedPipeline !== null;
  const available = modelCheck.available || pipelineLoaded;
  const actualPath = modelCheck.path;

  let size = 0;
  if (modelCheck.available) {
    size = getDirectorySize(actualPath);
  }

  return {
    name: MODEL_CONFIG.name,
    task: MODEL_CONFIG.task,
    available,
    loading: pipelineLoading,
    cached: pipelineLoaded,
    sizeBytes: size,
    sizeMB: Math.round(size / (1024 * 1024)),
    path: actualPath
  };
}
