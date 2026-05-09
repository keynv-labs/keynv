import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildAlias, findAliases, parseAlias } from './parser.js';

const projectArb = fc
  .stringMatching(/^[a-z0-9][a-z0-9-]{0,47}$/)
  .filter((s) => s.length >= 1 && s.length <= 48);

const envArb = fc
  .stringMatching(/^[a-z0-9][a-z0-9-]{0,23}$/)
  .filter((s) => s.length >= 1 && s.length <= 24);

const keyArb = fc
  .stringMatching(/^[a-z0-9][a-z0-9_-]{0,63}$/)
  .filter((s) => s.length >= 1 && s.length <= 64);

const aliasPartsArb = fc.record({
  project: projectArb,
  environment: envArb,
  key: keyArb,
});

describe('parseAlias — properties', () => {
  it('round-trips: build → parse yields the same components', () => {
    fc.assert(
      fc.property(aliasPartsArb, (parts) => {
        const built = buildAlias(parts);
        expect(built).not.toBeNull();
        if (!built) return;
        const reparsed = parseAlias(built.literal);
        expect(reparsed).toEqual(built);
      }),
      { numRuns: 500 },
    );
  });

  it('is idempotent: parseAlias(parseAlias(x).literal) equals parseAlias(x)', () => {
    fc.assert(
      fc.property(aliasPartsArb, (parts) => {
        const first = parseAlias(`@${parts.project}.${parts.environment}.${parts.key}`);
        if (!first) return;
        const second = parseAlias(first.literal);
        expect(second).toEqual(first);
      }),
      { numRuns: 500 },
    );
  });

  it('never accepts a string with whitespace', () => {
    fc.assert(
      fc.property(
        aliasPartsArb,
        fc.constantFrom(' ', '\t', '\n', '\r'),
        fc.integer({ min: 0, max: 80 }),
        (parts, ws, position) => {
          const literal = `@${parts.project}.${parts.environment}.${parts.key}`;
          if (position >= literal.length) return;
          const tampered = literal.slice(0, position) + ws + literal.slice(position);
          expect(parseAlias(tampered)).toBeNull();
        },
      ),
      { numRuns: 500 },
    );
  });

  it('never accepts non-string inputs', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.string()),
          fc.object(),
        ),
        (notString) => {
          expect(parseAlias(notString as unknown as string)).toBeNull();
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('findAliases — properties', () => {
  it('every match parses back to itself', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        for (const m of findAliases(text)) {
          const reparsed = parseAlias(m.literal);
          expect(reparsed).not.toBeNull();
          expect(reparsed?.project).toBe(m.project);
          expect(reparsed?.environment).toBe(m.environment);
          expect(reparsed?.key).toBe(m.key);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('match offsets reproduce the literal exactly', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (text) => {
        for (const m of findAliases(text)) {
          expect(text.slice(m.start, m.end)).toBe(m.literal);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('matches do not overlap and are sorted', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (text) => {
        const matches = findAliases(text);
        for (let i = 1; i < matches.length; i++) {
          const cur = matches[i];
          const prev = matches[i - 1];
          if (!cur || !prev) continue;
          expect(cur.start).toBeGreaterThanOrEqual(prev.end);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('embedding a built alias inside neutral context produces exactly one match', () => {
    fc.assert(
      fc.property(
        aliasPartsArb,
        fc.constantFrom('use ', 'see (', '"', "'", ' '),
        fc.constantFrom(' here', ')', '"', "'", '!', '.'),
        (parts, prefix, suffix) => {
          const built = buildAlias(parts);
          if (!built) return;
          const text = `${prefix}${built.literal}${suffix}`;
          const matches = findAliases(text);
          expect(matches).toHaveLength(1);
          expect(matches[0]?.literal).toBe(built.literal);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('findAliases — performance budget', () => {
  it('handles a 10K-line text in under 250ms', () => {
    const lines: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      const project = `proj${i % 1000}`;
      const env = i % 2 === 0 ? 'dev' : 'prod';
      const key = `key_${i}`;
      lines.push(
        i % 5 === 0
          ? `lorem ipsum @${project}.${env}.${key} dolor sit`
          : 'lorem ipsum dolor sit amet consectetur',
      );
    }
    const text = lines.join('\n');
    const start = performance.now();
    const matches = findAliases(text);
    const elapsed = performance.now() - start;
    expect(matches.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(250);
  });
});
