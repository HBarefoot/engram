import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  installSkill,
  uninstallSkill,
  resolveSkillDir,
  getSkillSourceDir,
  SKILL_NAME
} from '../../src/skill/install.js';

const SOURCE_SKILL = path.join(getSkillSourceDir(), 'SKILL.md');

describe('skill installer', () => {
  let tmp;
  let home;
  let cwd;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'engram-skill-test-'));
    home = path.join(tmp, 'home');
    cwd = path.join(tmp, 'project');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });
  });

  afterEach(() => {
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('has a vendored source skill to install', () => {
    expect(fs.existsSync(SOURCE_SKILL)).toBe(true);
    expect(fs.readFileSync(SOURCE_SKILL, 'utf-8')).toContain('name: engram-memory');
  });

  it('installs into ~/.claude/skills/engram-memory by default (no backup on a fresh install)', () => {
    const result = installSkill({ home, cwd });

    expect(result.status).toBe('installed');
    expect(result.backup).toBeNull();

    const dest = path.join(home, '.claude', 'skills', SKILL_NAME);
    expect(result.dest).toBe(dest);

    // Copied content is byte-identical to the vendored source.
    const installed = fs.readFileSync(path.join(dest, 'SKILL.md'));
    const source = fs.readFileSync(SOURCE_SKILL);
    expect(installed.equals(source)).toBe(true);
  });

  it('is idempotent — re-installing unchanged content is a no-op with no backup', () => {
    installSkill({ home, cwd });
    const second = installSkill({ home, cwd });

    expect(second.status).toBe('unchanged');
    expect(second.backup).toBeNull();

    // Only the skill dir exists — no stray backups were created.
    const skillsDir = path.join(home, '.claude', 'skills');
    expect(fs.readdirSync(skillsDir)).toEqual([SKILL_NAME]);
  });

  it('backs up a differing previous version before overwriting, and restores source content', () => {
    installSkill({ home, cwd });
    const dest = path.join(home, '.claude', 'skills', SKILL_NAME);

    // Simulate an older/edited installed version.
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'stale local edit\n');

    const result = installSkill({ home, cwd });

    expect(result.status).toBe('updated');
    expect(result.backup).toBeTruthy();

    // The backup preserves the old content...
    expect(fs.readFileSync(path.join(result.backup, 'SKILL.md'), 'utf-8')).toBe('stale local edit\n');
    // ...and the live skill is back to the vendored source.
    const installed = fs.readFileSync(path.join(dest, 'SKILL.md'));
    expect(installed.equals(fs.readFileSync(SOURCE_SKILL))).toBe(true);

    // Backup sits beside the skill dir with the engram-backup marker, so it is
    // not itself picked up as a skill named "engram-memory".
    expect(path.basename(result.backup)).toMatch(/^engram-memory\.engram-backup-/);
  });

  it('--project installs into ./.claude/skills instead of home', () => {
    const result = installSkill({ home, cwd, project: true });

    expect(result.project).toBe(true);
    expect(result.dest).toBe(path.join(cwd, '.claude', 'skills', SKILL_NAME));
    expect(fs.existsSync(path.join(cwd, '.claude', 'skills', SKILL_NAME, 'SKILL.md'))).toBe(true);
    // Home was left untouched.
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
  });

  it('--platform agents installs into ~/.agents/skills (cross-framework)', () => {
    const result = installSkill({ home, cwd, platform: 'agents' });

    expect(result.dest).toBe(path.join(home, '.agents', 'skills', SKILL_NAME));
    expect(fs.existsSync(path.join(home, '.agents', 'skills', SKILL_NAME, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
  });

  it('rejects an unknown platform', () => {
    expect(() => resolveSkillDir({ home, cwd, platform: 'bogus' })).toThrow(/Unknown platform/);
    expect(() => installSkill({ home, cwd, platform: 'bogus' })).toThrow(/Unknown platform/);
  });

  it('uninstall removes exactly the engram-memory directory and nothing else', () => {
    installSkill({ home, cwd });
    const skillsDir = path.join(home, '.claude', 'skills');

    // A sibling skill and a backup must survive an uninstall.
    const sibling = path.join(skillsDir, 'other-skill');
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, 'SKILL.md'), 'keep me\n');
    const backup = path.join(skillsDir, 'engram-memory.engram-backup-2026-01-01');
    fs.mkdirSync(backup, { recursive: true });

    const result = uninstallSkill({ home, cwd });

    expect(result.removed).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, SKILL_NAME))).toBe(false);
    // Sibling skill and backup are untouched.
    expect(fs.existsSync(sibling)).toBe(true);
    expect(fs.existsSync(backup)).toBe(true);
  });

  it('uninstall on a missing skill is a safe no-op', () => {
    const result = uninstallSkill({ home, cwd });
    expect(result.removed).toBe(false);
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
  });
});
