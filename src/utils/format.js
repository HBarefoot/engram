import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';

// ── Brand ────────────────────────────────────────────────────────────

/**
 * Print the engram brand header
 * @param {string} version
 */
export function printHeader(version) {
  console.log(
    `\n${chalk.bold.cyan('engram')} ${chalk.dim(`v${version}`)} ${chalk.dim('—')} ${chalk.white('persistent memory for AI agents')}\n`
  );
}

// ── Sections ─────────────────────────────────────────────────────────

/**
 * Print a section divider with title
 * @param {string} title
 */
export function printSection(title) {
  const line = '─'.repeat(Math.max(0, 48 - title.length - 2));
  console.log(`\n${chalk.dim('──')} ${chalk.bold(title)} ${chalk.dim(line)}`);
}

// ── Status messages ──────────────────────────────────────────────────

export function success(msg) {
  console.log(`${chalk.green('✔')} ${msg}`);
}

export function error(msg) {
  console.error(`${chalk.red('✖')} ${msg}`);
}

export function warning(msg) {
  console.log(`${chalk.yellow('!')} ${msg}`);
}

export function info(msg) {
  console.log(`${chalk.blue('i')} ${msg}`);
}

// ── Key-value display ────────────────────────────────────────────────

/**
 * Print aligned key-value pairs
 * @param {Array<[string, string]>} pairs - [[key, value], ...]
 * @param {Object} [opts]
 * @param {number} [opts.indent=2]
 */
export function printKeyValue(pairs, opts = {}) {
  const indent = opts.indent ?? 2;
  const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));
  const pad = ' '.repeat(indent);
  for (const [key, value] of pairs) {
    console.log(`${pad}${chalk.dim(key.padEnd(maxKeyLen))}  ${value}`);
  }
}

// ── Category badge ───────────────────────────────────────────────────

const categoryColors = {
  preference: chalk.magenta,
  fact:       chalk.blue,
  pattern:    chalk.cyan,
  decision:   chalk.yellow,
  outcome:    chalk.green
};

/**
 * Return a colored category label
 * @param {string} cat
 * @returns {string}
 */
export function categoryBadge(cat) {
  const colorFn = categoryColors[cat] || chalk.white;
  return colorFn(cat);
}

// ── Confidence color ─────────────────────────────────────────────────

/**
 * Color a confidence score green/yellow/red
 * @param {number} score
 * @returns {string}
 */
export function confidenceColor(score) {
  const text = score.toFixed(2);
  if (score >= 0.8) return chalk.green(text);
  if (score >= 0.5) return chalk.yellow(text);
  return chalk.red(text);
}

// ── Score display ────────────────────────────────────────────────────

/**
 * Render a score with optional bar
 * @param {number} score - 0-1
 * @param {Object} [opts]
 * @param {boolean} [opts.showBar=false]
 * @param {number} [opts.barWidth=10]
 * @returns {string}
 */
export function scoreDisplay(score, opts = {}) {
  const { showBar = false, barWidth = 10 } = opts;
  let text = confidenceColor(score);
  if (showBar) {
    const filled = Math.round(score * barWidth);
    const empty = barWidth - filled;
    text += ` ${chalk.green('\u2588'.repeat(filled))}${chalk.dim('\u2591'.repeat(empty))}`;
  }
  return text;
}

// ── Short ID ─────────────────────────────────────────────────────────

/**
 * First 8 chars of a UUID, dimmed
 * @param {string} id
 * @returns {string}
 */
export function shortId(id) {
  return chalk.dim(id.substring(0, 8));
}

// ── Truncate ─────────────────────────────────────────────────────────

/**
 * Truncate a string with ellipsis
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 60) {
  if (str.length <= maxLen) return str;
  return `${str.substring(0, maxLen - 1)}\u2026`;
}

// ── Relative time ────────────────────────────────────────────────────

/**
 * Format a unix timestamp (ms) as a relative time string
 * @param {number} timestamp - unix ms
 * @returns {string}
 */
export function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ── Table ────────────────────────────────────────────────────────────

/**
 * Create a cli-table3 table with consistent styling
 * @param {Object} options - cli-table3 options (head, colWidths, etc.)
 * @returns {Table}
 */
export function createTable(options = {}) {
  return new Table({
    chars: {
      top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      left: '│', 'left-mid': '├', mid: '─', 'mid-mid': '┼',
      right: '│', 'right-mid': '┤', middle: '│'
    },
    style: {
      head: ['dim'],
      border: ['dim']
    },
    ...options
  });
}

// ── Box ──────────────────────────────────────────────────────────────

/**
 * Draw a unicode box around text
 * @param {string} text
 * @returns {string}
 */
export function box(text) {
  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => stripAnsi(l).length));
  const top    = `${chalk.dim('\u250c')}${chalk.dim('\u2500'.repeat(maxLen + 2))}${chalk.dim('\u2510')}`;
  const bottom = `${chalk.dim('\u2514')}${chalk.dim('\u2500'.repeat(maxLen + 2))}${chalk.dim('\u2518')}`;
  const body   = lines.map(l => {
    const padding = maxLen - stripAnsi(l).length;
    return `${chalk.dim('\u2502')} ${l}${' '.repeat(padding)} ${chalk.dim('\u2502')}`;
  }).join('\n');
  return `${top}\n${body}\n${bottom}`;
}

/**
 * Minimal ANSI-strip for box width calculation
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// ── Spinner ──────────────────────────────────────────────────────────

/**
 * Create an ora spinner with consistent defaults
 * @param {string} text
 * @returns {ora.Ora}
 */
export function spinner(text) {
  return ora({ text, color: 'cyan' });
}
