/**
 * Log levels
 */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Current log level (defaults to INFO)
 */
let currentLevel = LOG_LEVELS.INFO;

/**
 * Set the log level
 * @param {number} level - Log level from LOG_LEVELS
 */
export function setLogLevel(level) {
  currentLevel = level;
}

/**
 * Format a log message
 * @param {string} level - Log level name
 * @param {string} message - Log message
 * @param {Object} [meta] - Optional metadata
 * @returns {string} Formatted log message
 */
function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level}: ${message}${metaStr}`;
}

/**
 * Log a debug message
 * @param {string} message - Log message
 * @param {Object} [meta] - Optional metadata
 */
export function debug(message, meta) {
  if (currentLevel <= LOG_LEVELS.DEBUG) {
    console.log(formatMessage('DEBUG', message, meta));
  }
}

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {Object} [meta] - Optional metadata
 */
export function info(message, meta) {
  if (currentLevel <= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', message, meta));
  }
}

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {Object} [meta] - Optional metadata
 */
export function warn(message, meta) {
  if (currentLevel <= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', message, meta));
  }
}

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {Object} [meta] - Optional metadata
 */
export function error(message, meta) {
  if (currentLevel <= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', message, meta));
  }
}
