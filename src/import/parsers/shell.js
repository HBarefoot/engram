import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectSecrets } from '../../extract/secrets.js';

const HISTORY_LOCATIONS = [
  path.join(os.homedir(), '.zsh_history'),
  path.join(os.homedir(), '.bash_history'),
  path.join(os.homedir(), '.local/share/fish/fish_history')
];

/**
 * Commands that likely contain secrets and should be skipped
 */
const SECRET_COMMAND_PATTERNS = [
  /export\s+\w*(KEY|SECRET|TOKEN|PASSWORD|PASS|API|AUTH)/i,
  /curl.*(-H|--header)\s+['"]?(Authorization|X-Api-Key|Bearer)/i,
  /curl.*(-u|--user)\s+/i,
  /mysql.*-p/,
  /psql.*password/i,
  /echo\s+['"]?(sk-|pk_|ghp_|AKIA)/i,
  /aws\s+configure/i,
  /login.*--password/i,
  /--token\s+\S+/i
];

/**
 * Detect if shell history exists
 * @param {Object} [options] - Detection options
 * @param {string[]} [options.paths] - Additional directories to scan for shell history
 * @returns {{ found: boolean, path: string|null, paths: string[] }}
 */
export function detect(options = {}) {
  const foundPaths = [];
  const seen = new Set();

  for (const loc of HISTORY_LOCATIONS) {
    const resolved = path.resolve(loc);
    if (!seen.has(resolved) && fs.existsSync(resolved)) {
      seen.add(resolved);
      foundPaths.push(resolved);
    }
  }

  // Check additional paths for shell history files
  if (options.paths && Array.isArray(options.paths)) {
    for (const dir of options.paths) {
      for (const name of ['.zsh_history', '.bash_history', '.local/share/fish/fish_history']) {
        const loc = path.join(dir, name);
        const resolved = path.resolve(loc);
        if (!seen.has(resolved) && fs.existsSync(resolved)) {
          seen.add(resolved);
          foundPaths.push(resolved);
        }
      }
    }
  }

  return {
    found: foundPaths.length > 0,
    path: foundPaths[0] || null,
    paths: foundPaths
  };
}

/**
 * Parse shell history to extract command patterns
 */
export async function parse(options = {}) {
  const result = { source: 'shell', memories: [], skipped: [], warnings: [] };

  // Determine which files to parse
  let filesToParse;
  if (options.filePath) {
    filesToParse = [options.filePath];
  } else {
    const detected = detect(options);
    filesToParse = detected.paths;
  }

  if (filesToParse.length === 0) {
    result.warnings.push('No shell history found');
    return result;
  }

  // Merge commands from all history files
  const frequency = {};
  const baseCommands = {};

  for (const filePath of filesToParse) {
    if (!fs.existsSync(filePath)) continue;

    const isZsh = filePath.includes('zsh');
    const isFish = filePath.includes('fish');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const commands = extractCommands(raw, { isZsh, isFish });

    for (const cmd of commands) {
      if (containsSecret(cmd)) {
        result.skipped.push({ content: cmd.substring(0, 50), reason: 'Potential secret in command' });
        continue;
      }

      const base = cmd.split(/\s+/)[0];
      if (!base || base.length < 2) continue;

      baseCommands[base] = (baseCommands[base] || 0) + 1;

      const normalized = normalizeCommand(cmd);
      frequency[normalized] = (frequency[normalized] || 0) + 1;
    }
  }

  // Top base commands (tools the user uses most)
  const topCommands = Object.entries(baseCommands)
    .sort((a, b) => b[1] - a[1])
    .filter(([cmd]) => !isBoringCommand(cmd))
    .slice(0, 15);

  if (topCommands.length > 0) {
    const cmdStr = topCommands
      .map(([cmd, count]) => `${cmd} (${count}x)`)
      .join(', ');

    result.memories.push({
      content: `Most used shell commands: ${cmdStr}`,
      category: 'pattern',
      entity: 'shell',
      confidence: 0.8,
      tags: ['shell-history', 'command-patterns'],
      source: 'import:shell'
    });
  }

  // Detect frequently used tool patterns
  const patterns = detectPatterns(frequency);
  for (const pattern of patterns) {
    result.memories.push({
      content: pattern.description,
      category: 'pattern',
      entity: pattern.entity,
      confidence: pattern.confidence,
      tags: ['shell-history', 'workflow-patterns'],
      source: 'import:shell'
    });
  }

  // Detect package manager preference
  const pmCounts = {
    npm: baseCommands['npm'] || 0,
    yarn: baseCommands['yarn'] || 0,
    pnpm: baseCommands['pnpm'] || 0,
    bun: baseCommands['bun'] || 0
  };
  const topPM = Object.entries(pmCounts).sort((a, b) => b[1] - a[1])[0];
  if (topPM && topPM[1] > 5) {
    result.memories.push({
      content: `Preferred package manager: ${topPM[0]} (used ${topPM[1]} times in history)`,
      category: 'preference',
      entity: topPM[0],
      confidence: 0.75,
      tags: ['shell-history', 'package-manager'],
      source: 'import:shell'
    });
  }

  return result;
}

/**
 * Extract clean commands from history file content
 */
function extractCommands(raw, { isZsh, isFish }) {
  const lines = raw.split('\n');
  const commands = [];

  for (const line of lines) {
    let cmd;

    if (isZsh) {
      // Zsh history format: ": timestamp:0;command"
      const match = line.match(/^:\s*\d+:\d+;(.+)/);
      cmd = match ? match[1] : line;
    } else if (isFish) {
      // Fish history format: "- cmd: command"
      const match = line.match(/^- cmd:\s*(.+)/);
      if (!match) continue;
      cmd = match[1];
    } else {
      cmd = line;
    }

    cmd = cmd.trim();
    if (cmd && cmd.length > 3 && cmd.length < 500) {
      commands.push(cmd);
    }
  }

  return commands;
}

/**
 * Check if a command likely contains secrets
 */
function containsSecret(cmd) {
  for (const pattern of SECRET_COMMAND_PATTERNS) {
    if (pattern.test(cmd)) return true;
  }

  const detection = detectSecrets(cmd);
  return detection.hasSecrets;
}

/**
 * Normalize a command for frequency counting
 */
function normalizeCommand(cmd) {
  // Replace specific paths/args with placeholders
  return cmd
    .replace(/['"]/g, '')
    .replace(/\s+\S*\/\S+/g, ' <path>')
    .replace(/\s+-\w\s+\S+/g, ' -<flag> <arg>')
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim();
}

/**
 * Check if a command is too generic to be interesting
 */
function isBoringCommand(cmd) {
  const boring = ['ls', 'cd', 'pwd', 'echo', 'cat', 'clear', 'exit', 'history',
    'which', 'whoami', 'date', 'cal', 'man', 'true', 'false', 'test'];
  return boring.includes(cmd);
}

/**
 * Detect interesting workflow patterns from command frequency
 */
function detectPatterns(frequency) {
  const patterns = [];

  const dockerCount = Object.entries(frequency)
    .filter(([cmd]) => cmd.startsWith('docker'))
    .reduce((sum, [, c]) => sum + c, 0);
  if (dockerCount > 10) {
    patterns.push({
      description: `Uses Docker frequently (${dockerCount} commands in history)`,
      entity: 'docker',
      confidence: 0.8
    });
  }

  const gitCount = Object.entries(frequency)
    .filter(([cmd]) => cmd.startsWith('git'))
    .reduce((sum, [, c]) => sum + c, 0);
  if (gitCount > 20) {
    patterns.push({
      description: `Heavy git user (${gitCount} commands in history)`,
      entity: 'git',
      confidence: 0.8
    });
  }

  const sshCount = Object.entries(frequency)
    .filter(([cmd]) => cmd.startsWith('ssh'))
    .reduce((sum, [, c]) => sum + c, 0);
  if (sshCount > 5) {
    patterns.push({
      description: `Regularly uses SSH for remote access (${sshCount} connections)`,
      entity: 'ssh',
      confidence: 0.75
    });
  }

  return patterns;
}

export const meta = {
  name: 'shell',
  label: 'Shell history',
  description: 'Frequent commands and workflow patterns',
  category: 'pattern',
  locations: HISTORY_LOCATIONS.map(p => p.replace(os.homedir(), '~'))
};
