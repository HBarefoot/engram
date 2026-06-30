import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  breakerOpen,
  breakerRecordFailure,
  breakerRecordSuccess,
  getBreakerState,
  resetBreaker
} from '../../src/llm/breaker.js';
import { llmComplete } from '../../src/llm/index.js';
import { reset as resetStats } from '../../src/llm/stats.js';

const realFetch = global.fetch;
beforeEach(() => {
  resetBreaker();
  resetStats();
});
afterEach(() => {
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('circuit breaker logic', () => {
  it('opens after N consecutive failures', () => {
    const t = 1000;
    breakerRecordFailure(3, 60000, t);
    expect(breakerOpen(t)).toBe(false);
    breakerRecordFailure(3, 60000, t);
    expect(breakerOpen(t)).toBe(false);
    breakerRecordFailure(3, 60000, t);
    expect(breakerOpen(t)).toBe(true); // 3rd consecutive -> open
    expect(getBreakerState(t).open).toBe(true);
  });

  it('half-open after cooldown; success closes it', () => {
    const t = 1000;
    for (let i = 0; i < 3; i++) breakerRecordFailure(3, 60000, t);
    expect(breakerOpen(t)).toBe(true);
    expect(breakerOpen(t + 60001)).toBe(false); // cooldown elapsed -> half-open trial allowed
    breakerRecordSuccess();
    expect(breakerOpen(t + 60001)).toBe(false);
    expect(getBreakerState().consecutiveFailures).toBe(0);
  });

  it('re-opens if the half-open trial fails', () => {
    const t = 1000;
    for (let i = 0; i < 3; i++) breakerRecordFailure(3, 60000, t);
    const after = t + 60001;
    expect(breakerOpen(after)).toBe(false);
    breakerRecordFailure(3, 60000, after); // failed trial
    expect(breakerOpen(after)).toBe(true);
  });
});

describe('llmComplete honors the breaker', () => {
  it('short-circuits with NO network call while open', async () => {
    // Trip the breaker (3 failures) using real time so breakerOpen() is true.
    for (let i = 0; i < 3; i++) breakerRecordFailure(3, 60000);
    expect(breakerOpen()).toBe(true);

    global.fetch = vi.fn();
    const r = await llmComplete(
      { llm: { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'm' } },
      { prompt: 'hi' }
    );
    expect(r).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled(); // breaker open -> no network, instant fallback
  });
});
