import { describe, it, expect } from 'vitest';
import { validateArgs, parseArgs } from '../../bench/lib/common.mjs';

const E2E_SPEC = {
  model: 'string',
  judgeModel: 'string',
  judge: 'boolean',
  think: 'boolean',
  k: 'number',
  host: 'string',
  seed: 'number'
};

describe('bench validateArgs (fail loud)', () => {
  it('accepts valid flags including --judge-model and --think', () => {
    expect(() =>
      validateArgs(['--model', 'a', '--judge-model', 'b', '--judge', '--think', '--k', '5'], E2E_SPEC)
    ).not.toThrow();
    const args = parseArgs(['--model', 'a', '--judge-model', 'b', '--judge']);
    expect(args.model).toBe('a');
    expect(args.judgeModel).toBe('b');
    expect(args.judge).toBe(true);
  });

  it('errors when a boolean flag swallowed a value (the --judge <model> masking bug)', () => {
    expect(() => validateArgs(['--judge', 'qwen3.5:9b'], E2E_SPEC)).toThrow(/boolean flag and takes no value/);
  });

  it('errors on an unknown flag', () => {
    expect(() => validateArgs(['--bogus', 'x'], E2E_SPEC)).toThrow(/Unknown argument "--bogus"/);
  });

  it('errors on a stray positional', () => {
    expect(() => validateArgs(['qwen3.5:9b'], E2E_SPEC)).toThrow(/Unexpected argument/);
  });

  it('errors when a value-taking flag is missing its value', () => {
    expect(() => validateArgs(['--model'], E2E_SPEC)).toThrow(/--model expects a value/);
  });

  it('accepts --flag=value form', () => {
    expect(() => validateArgs(['--model=a', '--judge'], E2E_SPEC)).not.toThrow();
  });
});
