/**
 * Time utility functions for temporal queries
 */

const DAY_MS = 86400000;
const WEEK_MS = DAY_MS * 7;
const MONTH_MS = DAY_MS * 30;
const YEAR_MS = DAY_MS * 365;

/**
 * Get start of day for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} Start of day timestamp
 */
function startOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Get end of day for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} End of day timestamp
 */
function endOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Get start of week (Sunday) for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} Start of week timestamp
 */
function startOfWeek(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Get end of week (Saturday) for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} End of week timestamp
 */
function endOfWeek(timestamp) {
  const date = new Date(timestamp);
  const day = date.getDay();
  date.setDate(date.getDate() + (6 - day));
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Get start of month for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} Start of month timestamp
 */
function startOfMonth(timestamp) {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Get end of month for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} End of month timestamp
 */
function endOfMonth(timestamp) {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Get start of year for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} Start of year timestamp
 */
function startOfYear(timestamp) {
  const date = new Date(timestamp);
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Get end of year for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {number} End of year timestamp
 */
function endOfYear(timestamp) {
  const date = new Date(timestamp);
  date.setMonth(11, 31);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

/**
 * Parse a relative time string into a timestamp
 * @param {string} input - Relative time string (e.g., "3 days ago", "last week")
 * @returns {number|null} Unix timestamp in ms, or null if not parseable
 */
export function parseRelativeTime(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const now = Date.now();
  const normalized = input.toLowerCase().trim();

  // Check for ISO date format first
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  // Special keywords
  const keywords = {
    'now': now,
    'today': startOfDay(now),
    'yesterday': startOfDay(now - DAY_MS),
    'tomorrow': startOfDay(now + DAY_MS)
  };

  if (keywords[normalized] !== undefined) {
    return keywords[normalized];
  }

  // Relative patterns: "X days/weeks/months ago"
  const agoMatch = normalized.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)\s*ago$/);
  if (agoMatch) {
    const amount = parseInt(agoMatch[1], 10);
    const unit = agoMatch[2].replace(/s$/, ''); // Remove trailing 's'

    const unitMs = {
      'day': DAY_MS,
      'week': WEEK_MS,
      'month': MONTH_MS,
      'year': YEAR_MS
    };

    return now - (amount * unitMs[unit]);
  }

  // "last X" patterns
  const lastMatch = normalized.match(/^last\s*(day|week|month|year)$/);
  if (lastMatch) {
    const unit = lastMatch[1];
    switch (unit) {
      case 'day':
        return startOfDay(now - DAY_MS);
      case 'week':
        return startOfWeek(now - WEEK_MS);
      case 'month':
        return startOfMonth(now - MONTH_MS);
      case 'year':
        return startOfYear(now - YEAR_MS);
    }
  }

  return null;
}

/**
 * Parse a period shorthand into a time range
 * @param {string} period - Period shorthand (e.g., "today", "this_week", "last_month")
 * @returns {Object|null} Object with start and end timestamps, or null if not parseable
 */
export function parsePeriod(period) {
  if (!period || typeof period !== 'string') {
    return null;
  }

  const now = Date.now();

  const periods = {
    'today': {
      start: startOfDay(now),
      end: endOfDay(now),
      description: 'today'
    },
    'yesterday': {
      start: startOfDay(now - DAY_MS),
      end: endOfDay(now - DAY_MS),
      description: 'yesterday'
    },
    'this_week': {
      start: startOfWeek(now),
      end: now,
      description: 'this week'
    },
    'last_week': {
      start: startOfWeek(now - WEEK_MS),
      end: endOfWeek(now - WEEK_MS),
      description: 'last week'
    },
    'this_month': {
      start: startOfMonth(now),
      end: now,
      description: 'this month'
    },
    'last_month': {
      start: startOfMonth(now - MONTH_MS),
      end: endOfMonth(now - MONTH_MS),
      description: 'last month'
    },
    'this_year': {
      start: startOfYear(now),
      end: now,
      description: 'this year'
    },
    'last_year': {
      start: startOfYear(now - YEAR_MS),
      end: endOfYear(now - YEAR_MS),
      description: 'last year'
    }
  };

  return periods[period] || null;
}

/**
 * Parse a time filter object into start/end timestamps
 * @param {Object} timeFilter - Time filter object
 * @param {string} [timeFilter.after] - Start time (ISO date or relative)
 * @param {string} [timeFilter.before] - End time (ISO date or relative)
 * @param {string} [timeFilter.period] - Period shorthand
 * @returns {Object} Object with start, end, and description
 */
export function parseTimeFilter(timeFilter) {
  if (!timeFilter) {
    return null;
  }

  const now = Date.now();

  // If period is specified, use that
  if (timeFilter.period) {
    return parsePeriod(timeFilter.period);
  }

  // Parse after/before
  let start = null;
  let end = null;
  let description = '';

  if (timeFilter.after) {
    start = parseRelativeTime(timeFilter.after);
    description = `after ${timeFilter.after}`;
  }

  if (timeFilter.before) {
    end = parseRelativeTime(timeFilter.before);
    if (description) {
      description += ` and before ${timeFilter.before}`;
    } else {
      description = `before ${timeFilter.before}`;
    }
  }

  // Default end to now if only after is specified
  if (start && !end) {
    end = now;
  }

  // Default start to beginning of time if only before is specified
  if (!start && end) {
    start = 0;
  }

  if (start === null && end === null) {
    return null;
  }

  return { start, end, description };
}

/**
 * Format a timestamp as ISO string
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string} ISO date string
 */
export function formatTimestamp(timestamp) {
  return new Date(timestamp).toISOString();
}
