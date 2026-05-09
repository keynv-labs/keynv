import { describe, expect, it } from 'vitest';
import {
  buildAlias,
  findAliases,
  findAliasesInArgv,
  parseAlias,
  replaceAliases,
} from './parser.js';

describe('parseAlias — happy paths', () => {
  it('parses a canonical alias', () => {
    expect(parseAlias('@billing.prod.db_password')).toEqual({
      literal: '@billing.prod.db_password',
      project: 'billing',
      environment: 'prod',
      key: 'db_password',
    });
  });

  it('parses kebab-case and snake_case keys together', () => {
    expect(parseAlias('@auth-service.staging.jwt-signing-key')).toEqual({
      literal: '@auth-service.staging.jwt-signing-key',
      project: 'auth-service',
      environment: 'staging',
      key: 'jwt-signing-key',
    });
  });

  it('parses numeric components', () => {
    expect(parseAlias('@p1.pr-1234.k_42')).toMatchObject({
      project: 'p1',
      environment: 'pr-1234',
      key: 'k_42',
    });
  });

  it('accepts max-length components', () => {
    const project = `a${'b'.repeat(47)}`;
    const environment = `a${'b'.repeat(23)}`;
    const key = `a${'b'.repeat(63)}`;
    const literal = `@${project}.${environment}.${key}`;
    expect(parseAlias(literal)).toEqual({ literal, project, environment, key });
  });
});

describe('parseAlias — rejections', () => {
  it.each([
    ['no @ prefix', 'billing.prod.db_password'],
    ['empty', ''],
    ['just @', '@'],
    ['too short', '@a.b'],
    ['only two parts', '@billing.prod'],
    ['four parts', '@billing.prod.db.password'],
    ['empty project', '@.prod.key'],
    ['empty env', '@billing..key'],
    ['empty key', '@billing.prod.'],
    ['uppercase project', '@Billing.prod.key'],
    ['uppercase env', '@billing.Prod.key'],
    ['uppercase key', '@billing.prod.Key'],
    ['underscore in project (project allows kebab only)', '@bil_ling.prod.key'],
    ['leading dash in project', '@-billing.prod.key'],
    ['leading dash in env', '@billing.-prod.key'],
    ['leading dash in key', '@billing.prod.-key'],
    ['trailing newline', '@billing.prod.key\n'],
    ['internal whitespace', '@billing. prod.key'],
    ['too long project (49)', `@${'a'.repeat(49)}.prod.key`],
    ['too long env (25)', `@billing.${'a'.repeat(25)}.key`],
    ['too long key (65)', `@billing.prod.${'a'.repeat(65)}`],
    ['extra @', '@@billing.prod.key'],
    ['unicode', '@billing.prod.şifre'],
  ])('rejects %s: %s', (_label, input) => {
    expect(parseAlias(input as string)).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parseAlias(undefined as unknown as string)).toBeNull();
    expect(parseAlias(null as unknown as string)).toBeNull();
    expect(parseAlias(42 as unknown as string)).toBeNull();
  });
});

describe('findAliases — text mode (conservative)', () => {
  it('finds an alias inside a sentence', () => {
    const text = 'Use @billing.prod.db_password before the migration.';
    const matches = findAliases(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.literal).toBe('@billing.prod.db_password');
    expect(text.slice(matches[0]?.start, matches[0]?.end)).toBe('@billing.prod.db_password');
  });

  it('finds an alias inside double quotes', () => {
    const text = 'connect to "@billing.prod.db_url" please';
    expect(findAliases(text).map((m) => m.literal)).toEqual(['@billing.prod.db_url']);
  });

  it('finds an alias inside single quotes', () => {
    const text = "connect to '@billing.prod.db_url'";
    expect(findAliases(text).map((m) => m.literal)).toEqual(['@billing.prod.db_url']);
  });

  it('handles trailing punctuation', () => {
    const text = 'aliases: (@billing.prod.db_password), end.';
    expect(findAliases(text).map((m) => m.literal)).toEqual(['@billing.prod.db_password']);
  });

  it('finds multiple aliases on one line', () => {
    const text = 'Two: @a.b.c and @x-1.y.z42 work.';
    expect(findAliases(text).map((m) => m.literal)).toEqual(['@a.b.c', '@x-1.y.z42']);
  });

  it('does NOT match inside an email address', () => {
    const text = 'contact support@billing.example.com for help';
    expect(findAliases(text)).toEqual([]);
  });

  it('does NOT match inside a URL path', () => {
    const text = 'see https://billing.example.com for details';
    expect(findAliases(text)).toEqual([]);
  });

  it('does NOT match incomplete aliases', () => {
    expect(findAliases('@billing.prod and @billing.prod.')).toEqual([]);
  });
});

describe('findAliases — argv mode (permissive)', () => {
  it('matches an alias glued onto a flag prefix', () => {
    const matches = findAliases('-p@billing.prod.db_password', { mode: 'argv' });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.literal).toBe('@billing.prod.db_password');
  });

  it('matches after =', () => {
    const matches = findAliases('--password=@billing.prod.db_password', { mode: 'argv' });
    expect(matches).toHaveLength(1);
  });
});

describe('findAliasesInArgv', () => {
  it('groups matches by argv element', () => {
    const argv = ['mysql', '-p@billing.prod.db_password', '-h', '@billing.prod.db_host'];
    const result = findAliasesInArgv(argv);
    expect(result).toHaveLength(2);
    expect(result[0]?.argvIndex).toBe(1);
    expect(result[0]?.matches[0]?.literal).toBe('@billing.prod.db_password');
    expect(result[1]?.argvIndex).toBe(3);
    expect(result[1]?.matches[0]?.literal).toBe('@billing.prod.db_host');
  });

  it('ignores argv elements with no aliases', () => {
    expect(findAliasesInArgv(['echo', 'hello'])).toEqual([]);
  });
});

describe('replaceAliases', () => {
  it('substitutes a single alias', () => {
    const result = replaceAliases('@a.b.c', () => 'VALUE');
    expect(result).toBe('VALUE');
  });

  it('substitutes multiple aliases preserving non-alias text', () => {
    const text = 'connect @a.b.c and @x.y.z now';
    const result = replaceAliases(text, (a) => `<${a.project}>`);
    expect(result).toBe('connect <a> and <x> now');
  });

  it('is a no-op when no aliases match', () => {
    expect(replaceAliases('plain text', () => 'X')).toBe('plain text');
  });

  it('preserves email-shaped strings in text mode', () => {
    const text = 'contact support@billing.example.com';
    expect(replaceAliases(text, () => 'X')).toBe(text);
  });

  it('substitutes inside argv-style strings when mode=argv', () => {
    const result = replaceAliases('-p@a.b.c', () => 'PASS', { mode: 'argv' });
    expect(result).toBe('-pPASS');
  });
});

describe('buildAlias', () => {
  it('builds a valid alias from components', () => {
    expect(buildAlias({ project: 'billing', environment: 'prod', key: 'db_password' })).toEqual({
      literal: '@billing.prod.db_password',
      project: 'billing',
      environment: 'prod',
      key: 'db_password',
    });
  });

  it('rejects invalid components', () => {
    expect(buildAlias({ project: 'Billing', environment: 'prod', key: 'k' })).toBeNull();
    expect(buildAlias({ project: 'b', environment: '_p', key: 'k' })).toBeNull();
    expect(buildAlias({ project: 'b', environment: 'p', key: 'şifre' })).toBeNull();
  });
});
