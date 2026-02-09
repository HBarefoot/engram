import fs from 'fs';
import path from 'path';
import os from 'os';

const SSH_CONFIG_PATH = path.join(os.homedir(), '.ssh/config');

/**
 * Detect if SSH config exists
 */
export function detect() {
  return {
    found: fs.existsSync(SSH_CONFIG_PATH),
    path: fs.existsSync(SSH_CONFIG_PATH) ? SSH_CONFIG_PATH : null
  };
}

/**
 * Parse ~/.ssh/config for host names only.
 * NEVER extracts keys, IdentityFile contents, passwords, or passphrases.
 */
export async function parse(options = {}) {
  const result = { source: 'ssh', memories: [], skipped: [], warnings: [] };

  const filePath = options.filePath || SSH_CONFIG_PATH;

  if (!fs.existsSync(filePath)) {
    result.warnings.push('No ~/.ssh/config found');
    return result;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const hosts = parseSSHConfig(content);

  if (hosts.length === 0) {
    result.warnings.push('No SSH hosts found in config');
    return result;
  }

  // Filter out wildcard-only hosts
  const namedHosts = hosts.filter(h => h.name !== '*' && !h.name.includes('*'));

  if (namedHosts.length === 0) {
    result.warnings.push('Only wildcard SSH hosts found');
    return result;
  }

  // Create a summary memory with all host names
  const hostNames = namedHosts.map(h => h.name);
  result.memories.push({
    content: `SSH configured hosts: ${hostNames.join(', ')}`,
    category: 'fact',
    entity: 'ssh',
    confidence: 0.9,
    tags: ['ssh-config', 'servers'],
    source: 'import:ssh'
  });

  // Individual host entries with hostname (not key info)
  for (const host of namedHosts) {
    if (host.hostname) {
      result.memories.push({
        content: `SSH host "${host.name}" connects to ${host.hostname}${host.user ? ` as ${host.user}` : ''}${host.port ? ` on port ${host.port}` : ''}`,
        category: 'fact',
        entity: 'ssh',
        confidence: 0.9,
        tags: ['ssh-config', 'servers'],
        source: 'import:ssh'
      });
    }
  }

  // Warn about skipped sensitive fields
  const skippedCount = hosts.reduce((sum, h) => sum + (h.identityFile ? 1 : 0), 0);
  if (skippedCount > 0) {
    result.warnings.push(`Skipped ${skippedCount} IdentityFile entries (security)`);
  }

  return result;
}

/**
 * Parse SSH config file into host objects
 * Only extracts safe fields: Host, HostName, User, Port
 */
function parseSSHConfig(content) {
  const hosts = [];
  let current = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const [key, ...valueParts] = line.split(/\s+/);
    const value = valueParts.join(' ');
    const keyLower = key.toLowerCase();

    if (keyLower === 'host') {
      if (current) hosts.push(current);
      current = { name: value };
    } else if (current) {
      // ONLY extract safe, non-secret fields
      switch (keyLower) {
        case 'hostname':
          current.hostname = value;
          break;
        case 'user':
          current.user = value;
          break;
        case 'port':
          current.port = value;
          break;
        case 'identityfile':
          // Note existence but NEVER store the path or contents
          current.identityFile = true;
          break;
        // All other fields are intentionally ignored for security
      }
    }
  }

  if (current) hosts.push(current);
  return hosts;
}

export const meta = {
  name: 'ssh',
  label: '~/.ssh/config',
  description: 'Server names and hosts (NEVER extracts keys)',
  category: 'fact',
  locations: ['~/.ssh/config']
};
