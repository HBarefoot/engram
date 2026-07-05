import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

/**
 * Installer for the bundled `engram-memory` agent skill.
 *
 * The skill is the judgment layer that teaches an agent *when* to recall and
 * *what* to store — the MCP server is the capability, this is the know-how.
 * It's vendored in-repo at `skills/engram-memory/` (source of truth) and copied
 * into an assistant's skill directory on explicit `engram skill install`.
 *
 * Everything here is pure filesystem work (no new dependencies): resolve a
 * destination, copy the tree, and back up any previous version before an
 * overwrite (repo rule #8). Installs are idempotent — an unchanged skill is a
 * no-op, and uninstall removes only the `engram-memory` directory.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SKILL_NAME = 'engram-memory';

/** Supported skill hosts and the dot-directory they read skills from. */
const PLATFORM_DIRS = {
  claude: '.claude', // Claude Code / Claude Desktop
  agents: '.agents'  // cross-framework Agent-Skills spec (anthropics/skills)
};

/**
 * Absolute path to the in-repo source of the skill.
 * Resolves relative to this module so it works from a git checkout, a global
 * npm install, or a bundled sidecar (as long as `skills/` ships — see the
 * `files` array in package.json).
 * @returns {string}
 */
export function getSkillSourceDir() {
  return path.resolve(__dirname, '..', '..', 'skills', SKILL_NAME);
}

/**
 * Resolve where the skill should be installed for a given platform/scope.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.project=false] - install into the current project (`./`) instead of the user home dir
 * @param {'claude'|'agents'} [opts.platform='claude'] - which skill host to target
 * @param {string} [opts.home] - override the home dir (testing)
 * @param {string} [opts.cwd] - override the working dir (testing)
 * @returns {string} Absolute path to the `engram-memory` skill directory
 */
export function resolveSkillDir({ project = false, platform = 'claude', home = os.homedir(), cwd = process.cwd() } = {}) {
  const dot = PLATFORM_DIRS[platform];
  if (!dot) {
    throw new Error(`Unknown platform "${platform}" (expected: ${Object.keys(PLATFORM_DIRS).join(', ')})`);
  }
  const root = project ? cwd : home;
  return path.join(root, dot, 'skills', SKILL_NAME);
}

/**
 * Read every file under a directory into a { relativePath -> Buffer } map.
 * Used to compare an installed skill against the source so unchanged re-runs
 * are true no-ops.
 * @param {string} dir
 * @returns {Map<string, Buffer>}
 */
function readTree(dir) {
  const files = new Map();
  const walk = (current, rel) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(abs, relPath);
      } else if (entry.isFile()) {
        files.set(relPath, fs.readFileSync(abs));
      }
    }
  };
  walk(dir, '');
  return files;
}

/** True when two directory trees contain byte-identical files. */
function treesEqual(a, b) {
  const ta = readTree(a);
  const tb = readTree(b);
  if (ta.size !== tb.size) return false;
  for (const [rel, buf] of ta) {
    const other = tb.get(rel);
    if (!other || !buf.equals(other)) return false;
  }
  return true;
}

/**
 * A filename-safe, collision-resistant timestamp for backup directories.
 * Mirrors the DB backup convention (colons/dots are illegal on some platforms).
 */
function backupPathFor(dest) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let candidate = `${dest}.engram-backup-${stamp}`;
  let n = 1;
  while (fs.existsSync(candidate)) {
    candidate = `${dest}.engram-backup-${stamp}-${n++}`;
  }
  return candidate;
}

/**
 * Install (or update) the bundled skill.
 *
 * @param {Object} [opts] - see {@link resolveSkillDir}
 * @returns {{ status: 'installed'|'updated'|'unchanged', dest: string, source: string, backup: string|null, project: boolean, platform: string }}
 */
export function installSkill(opts = {}) {
  const { project = false, platform = 'claude' } = opts;
  const source = getSkillSourceDir();
  if (!fs.existsSync(source)) {
    throw new Error(`Skill source not found at ${source} — is the package installed correctly?`);
  }
  const dest = resolveSkillDir(opts);

  let status = 'installed';
  let backup = null;

  if (fs.existsSync(dest)) {
    if (treesEqual(source, dest)) {
      return { status: 'unchanged', dest, source, backup: null, project, platform };
    }
    // A previous version exists and differs — preserve it before overwriting.
    backup = backupPathFor(dest);
    fs.renameSync(dest, backup);
    status = 'updated';
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(source, dest, { recursive: true });

  return { status, dest, source, backup, project, platform };
}

/**
 * Uninstall the skill — removes exactly the `engram-memory` directory and
 * nothing else (backups and other skills are left untouched).
 *
 * @param {Object} [opts] - see {@link resolveSkillDir}
 * @returns {{ removed: boolean, dest: string, project: boolean, platform: string }}
 */
export function uninstallSkill(opts = {}) {
  const { project = false, platform = 'claude' } = opts;
  const dest = resolveSkillDir(opts);
  if (!fs.existsSync(dest)) {
    return { removed: false, dest, project, platform };
  }
  fs.rmSync(dest, { recursive: true, force: true });
  return { removed: true, dest, project, platform };
}
