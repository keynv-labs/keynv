import { describe, expect, it } from 'vitest';
import {
  analyzeScript,
  applyWraps,
  extractFirstCommandWord,
  planScriptWrap,
} from './scriptWrap.js';

describe('extractFirstCommandWord', () => {
  it('returns the first word of a plain command', () => {
    expect(extractFirstCommandWord('next dev')).toBe('next');
  });

  it('skips KEY=value env-var prefixes', () => {
    expect(extractFirstCommandWord('NODE_ENV=production next start')).toBe('next');
    expect(extractFirstCommandWord('FOO=1 BAR=2 vite build')).toBe('vite');
  });

  it('skips cross-env wrapper and its assignments', () => {
    expect(extractFirstCommandWord('cross-env NODE_ENV=production next start')).toBe('next');
  });

  it('skips dotenv wrapper and flags', () => {
    expect(extractFirstCommandWord('dotenv -e .env.local -- next dev')).toBe('next');
  });

  it('strips path prefix to get tool basename', () => {
    expect(extractFirstCommandWord('./node_modules/.bin/next dev')).toBe('next');
  });

  it('returns null for shell -c invocations', () => {
    expect(extractFirstCommandWord('sh -c "next dev"')).toBeNull();
    expect(extractFirstCommandWord('bash -c "echo hi"')).toBeNull();
  });
});

describe('analyzeScript', () => {
  it('flags env-aware tools as wrap', () => {
    const a = analyzeScript('dev', 'next dev');
    expect(a.verdict).toBe('wrap');
    expect(a.wrapped).toBe('keynv exec -- next dev');
  });

  it('handles cross-env prefix and still recognizes inner tool', () => {
    const a = analyzeScript('start', 'cross-env NODE_ENV=production node server.js');
    expect(a.verdict).toBe('wrap');
  });

  it('recognizes vitest, jest, playwright as env-aware', () => {
    expect(analyzeScript('test', 'vitest run').verdict).toBe('wrap');
    expect(analyzeScript('test', 'jest --watch').verdict).toBe('wrap');
    expect(analyzeScript('e2e', 'playwright test').verdict).toBe('wrap');
  });

  it('skips lint/format tools as no-env', () => {
    expect(analyzeScript('lint', 'eslint .').verdict).toBe('skip-no-env-tool');
    expect(analyzeScript('format', 'prettier --write .').verdict).toBe('skip-no-env-tool');
    expect(analyzeScript('typecheck', 'tsc --noEmit').verdict).toBe('skip-no-env-tool');
  });

  it('marks already-wrapped scripts as such', () => {
    const a = analyzeScript('dev', 'keynv exec -- next dev');
    expect(a.verdict).toBe('skip-already-wrapped');
    expect(a.wrapped).toBe(a.original);
  });

  it('marks unknown tools as skip-unknown (let user opt in)', () => {
    const a = analyzeScript('weird', 'mycustomtool --flag');
    expect(a.verdict).toBe('skip-unknown');
  });

  it('cannot parse shell -c, returns skip-unknown', () => {
    const a = analyzeScript('weird', 'sh -c "next dev"');
    expect(a.verdict).toBe('skip-unknown');
  });
});

describe('planScriptWrap', () => {
  it('partitions scripts into the three buckets', () => {
    const plan = planScriptWrap({
      dev: 'next dev',
      build: 'next build',
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      weird: 'somethingnew --x',
      already: 'keynv exec -- node server.js',
    });
    expect(plan.recommended.map((a) => a.name).sort()).toEqual(['build', 'dev']);
    expect(plan.skipped.map((a) => a.name).sort()).toEqual(['already', 'lint', 'typecheck']);
    expect(plan.unknown.map((a) => a.name)).toEqual(['weird']);
  });

  it('returns empty buckets for empty input', () => {
    const plan = planScriptWrap({});
    expect(plan.recommended).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.unknown).toEqual([]);
  });
});

describe('applyWraps', () => {
  it('wraps only the selected scripts', () => {
    const out = applyWraps({ dev: 'next dev', build: 'next build' }, ['dev']);
    expect(out).toEqual({ dev: 'keynv exec -- next dev', build: 'next build' });
  });

  it('does not double-wrap an already-wrapped script even if selected', () => {
    const out = applyWraps({ dev: 'keynv exec -- next dev' }, ['dev']);
    expect(out).toEqual({ dev: 'keynv exec -- next dev' });
  });

  it('returns a new object — does not mutate input', () => {
    const input = { dev: 'next dev' };
    const out = applyWraps(input, ['dev']);
    expect(out).not.toBe(input);
    expect(input.dev).toBe('next dev');
  });

  it('preserves non-selected scripts untouched', () => {
    const out = applyWraps({ a: 'x', b: 'y', c: 'z' }, ['b']);
    expect(out).toEqual({ a: 'x', b: 'keynv exec -- y', c: 'z' });
  });
});
