import { describe, it, expect } from 'vitest';
import { shouldDefaultToMcp } from '../../src/utils/mcp-default.js';

describe('shouldDefaultToMcp', () => {
  it('defaults to the MCP server on a bare invocation over a non-TTY stdin (proxy/registry)', () => {
    // Glama / mcp-proxy spawn `node bin/engram.js` with piped stdin (isTTY undefined).
    expect(shouldDefaultToMcp([], undefined)).toBe(true);
    expect(shouldDefaultToMcp([], false)).toBe(true);
  });

  it('shows help (does NOT default) for a bare invocation in an interactive terminal', () => {
    expect(shouldDefaultToMcp([], true)).toBe(false);
  });

  it('never overrides an explicit subcommand or flag', () => {
    expect(shouldDefaultToMcp(['start'], undefined)).toBe(false);
    expect(shouldDefaultToMcp(['start', '--mcp-only'], undefined)).toBe(false);
    expect(shouldDefaultToMcp(['-V'], undefined)).toBe(false);
    expect(shouldDefaultToMcp(['--help'], undefined)).toBe(false);
    expect(shouldDefaultToMcp(['remember', 'x'], undefined)).toBe(false);
  });
});
