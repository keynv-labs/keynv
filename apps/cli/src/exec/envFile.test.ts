import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EnvFileNotFoundError,
  EnvFileParseError,
  EnvFileTooLargeError,
  findEnvFile,
  loadEnvFile,
  parseEnvFile,
} from './envFile.js';

describe('parseEnvFile', () => {
  const file = '.keynv.env';

  it('parses a happy-path mix of aliases and literals', () => {
    const out = parseEnvFile(
      [
        'OPENAI_API_KEY=@arkeyan.dev.openai-key',
        'NODE_ENV=development',
        'PORT=3000',
        'DB_URL=@arkeyan.prod.db-url',
      ].join('\n'),
      file,
    );
    expect(out.map((e) => [e.name, e.value, e.isAlias])).toEqual([
      ['OPENAI_API_KEY', '@arkeyan.dev.openai-key', true],
      ['NODE_ENV', 'development', false],
      ['PORT', '3000', false],
      ['DB_URL', '@arkeyan.prod.db-url', true],
    ]);
  });

  it('returns an empty list for an empty file', () => {
    expect(parseEnvFile('', file)).toEqual([]);
  });

  it('skips comment-only and blank lines', () => {
    const out = parseEnvFile(
      ['# comment', '   # indented comment', '', '   ', 'KEY=value'].join('\n'),
      file,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('KEY');
    expect(out[0]?.line).toBe(5);
  });

  it('handles double-quoted values, preserving spaces', () => {
    const out = parseEnvFile('GREETING="hello world"', file);
    expect(out[0]?.value).toBe('hello world');
  });

  it('handles single-quoted values', () => {
    const out = parseEnvFile("X='abc def'", file);
    expect(out[0]?.value).toBe('abc def');
  });

  it('strips `export ` prefix', () => {
    const out = parseEnvFile('export FOO=bar', file);
    expect(out[0]?.name).toBe('FOO');
    expect(out[0]?.value).toBe('bar');
  });

  it('treats empty value as empty string', () => {
    const out = parseEnvFile('EMPTY=', file);
    expect(out[0]?.value).toBe('');
  });

  it('strips trailing whitespace on unquoted values', () => {
    const out = parseEnvFile('FOO=bar   ', file);
    expect(out[0]?.value).toBe('bar');
  });

  it('preserves whitespace inside quoted values', () => {
    const out = parseEnvFile('FOO="  bar  "', file);
    expect(out[0]?.value).toBe('  bar  ');
  });

  it('strips a UTF-8 BOM at file start', () => {
    const out = parseEnvFile('﻿KEY=value', file);
    expect(out[0]?.name).toBe('KEY');
  });

  it('normalizes CRLF line endings', () => {
    const out = parseEnvFile('A=1\r\nB=2\r\n', file);
    expect(out.map((e) => e.name)).toEqual(['A', 'B']);
  });

  it('records duplicates in source order (last value resolved by caller)', () => {
    const out = parseEnvFile(['FOO=first', 'FOO=second'].join('\n'), file);
    expect(out).toHaveLength(2);
    expect(out[1]?.value).toBe('second');
  });

  it('rejects keys that start with a digit', () => {
    expect(() => parseEnvFile('1FOO=bar', file)).toThrow(EnvFileParseError);
  });

  it('rejects keys with whitespace', () => {
    expect(() => parseEnvFile('foo bar=baz', file)).toThrow(EnvFileParseError);
  });

  it('rejects lines without `=`', () => {
    expect(() => parseEnvFile('FOO_BAR_BAZ', file)).toThrow(EnvFileParseError);
  });

  it('rejects unclosed quotes', () => {
    expect(() => parseEnvFile('KEY="abc', file)).toThrow(/unclosed/);
  });

  it('rejects content after a closing quote', () => {
    expect(() => parseEnvFile('KEY="abc"def', file)).toThrow(/unexpected content/);
  });

  it('treats an alias-shaped string as alias', () => {
    const out = parseEnvFile('K=@arkeyan.dev.foo', file);
    expect(out[0]?.isAlias).toBe(true);
  });

  it('treats an almost-alias as a literal', () => {
    const out = parseEnvFile('K=@foo.bar', file);
    expect(out[0]?.isAlias).toBe(false);
    expect(out[0]?.value).toBe('@foo.bar');
  });

  it('reports the correct line number for parse errors', () => {
    try {
      parseEnvFile(['# c', 'A=1', 'BAD LINE'].join('\n'), file);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvFileParseError);
      expect((err as EnvFileParseError).line).toBe(3);
    }
  });
});

describe('findEnvFile', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'keynv-envfile-find-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds the file in cwd', () => {
    writeFileSync(join(root, '.keynv.env'), 'X=1');
    expect(findEnvFile(root)).toBe(join(root, '.keynv.env'));
  });

  it('walks upward through parent dirs', () => {
    writeFileSync(join(root, '.keynv.env'), 'X=1');
    const sub = join(root, 'a', 'b', 'c');
    mkdirSync(sub, { recursive: true });
    expect(findEnvFile(sub)).toBe(join(root, '.keynv.env'));
  });

  it('returns null when no file exists anywhere up the tree', () => {
    // tmp dir is somewhere under /tmp or /var; we don't expect a
    // .keynv.env on a CI runner's path. If the runner happens to have
    // one (very unlikely), this assertion would fail — that's
    // intentional, it would reveal an environment issue worth
    // investigating.
    const sub = join(root, 'x');
    mkdirSync(sub);
    expect(findEnvFile(sub)).toBeNull();
  });

  it('does not loop infinitely at the filesystem root', () => {
    // Just confirms no hang — we time out via vitest's default if it does.
    expect(findEnvFile('/')).toBeNull();
  });
});

describe('loadEnvFile', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'keynv-envfile-load-'));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('returns null when disabled', () => {
    writeFileSync(join(cwd, '.keynv.env'), 'X=1');
    expect(loadEnvFile({ cwd, disabled: true })).toBeNull();
  });

  it('returns parsed file when discovery succeeds', () => {
    writeFileSync(join(cwd, '.keynv.env'), 'A=1\nB=@arkeyan.dev.k');
    const out = loadEnvFile({ cwd });
    expect(out?.entries).toHaveLength(2);
    expect(out?.entries[1]?.isAlias).toBe(true);
  });

  it('returns null when discovery finds nothing', () => {
    expect(loadEnvFile({ cwd })).toBeNull();
  });

  it('uses --env-file when given (relative to cwd)', () => {
    writeFileSync(join(cwd, 'custom.env'), 'X=42');
    const out = loadEnvFile({ cwd, explicitPath: 'custom.env' });
    expect(out?.entries[0]?.value).toBe('42');
  });

  it('throws EnvFileNotFoundError when --env-file points at nothing', () => {
    expect(() => loadEnvFile({ cwd, explicitPath: '/nonexistent/file' })).toThrow(
      EnvFileNotFoundError,
    );
  });

  it('honors KEYNV_ENV_FILE when no --env-file is passed', () => {
    const path = join(cwd, 'from-env.env');
    writeFileSync(path, 'Z=z');
    const out = loadEnvFile({ cwd, envVarOverride: path });
    expect(out?.entries[0]?.name).toBe('Z');
  });

  it('--env-file wins over KEYNV_ENV_FILE', () => {
    const a = join(cwd, 'a.env');
    const b = join(cwd, 'b.env');
    writeFileSync(a, 'FROM=flag');
    writeFileSync(b, 'FROM=envvar');
    const out = loadEnvFile({ cwd, explicitPath: a, envVarOverride: b });
    expect(out?.entries[0]?.value).toBe('flag');
  });

  it('rejects files larger than the cap', () => {
    const path = join(cwd, 'big.env');
    writeFileSync(path, 'K='.padEnd(2_000_000, 'x'));
    expect(() => loadEnvFile({ cwd, explicitPath: path })).toThrow(EnvFileTooLargeError);
  });
});
