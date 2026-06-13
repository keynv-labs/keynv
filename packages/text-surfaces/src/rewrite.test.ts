import { readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rewriteFile } from './rewrite.js';

let workdir: string;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'keynv-ts-rw-'));
});

afterEach(async () => {
  await rm(workdir, { recursive: true, force: true });
});

/** Age the file backwards past the active-write window so rewrite() proceeds. */
async function ageFile(path: string): Promise<void> {
  const past = new Date(Date.now() - 60_000);
  await utimes(path, past, past);
}

describe('rewriteFile', () => {
  it('redacts secret-shaped tokens atomically and writes a backup', async () => {
    const file = join(workdir, 'history');
    await writeFile(
      file,
      'export AWS=AKIAIOSFODNN7EXAMPLE\nexport GH=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
    );
    await ageFile(file);

    const result = await rewriteFile(file);
    expect(result.skipped).toBeFalsy();
    expect(result.matchCount).toBe(2);
    expect(result.backupPath).toBeDefined();
    expect(result.bytesWritten).toBeGreaterThan(0);

    const after = await readFile(file, 'utf8');
    expect(after).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(after).not.toContain('ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(after).toContain('<REDACTED:aws-access-key-id>');
    expect(after).toContain('<REDACTED:github-pat-classic>');

    if (result.backupPath) {
      const backup = await readFile(result.backupPath, 'utf8');
      expect(backup).toContain('AKIAIOSFODNN7EXAMPLE');
    }
  });

  it('is idempotent: no matches → no rewrite, no backup', async () => {
    const file = join(workdir, 'clean');
    await writeFile(file, 'just a plain log line\n');
    await ageFile(file);
    const result = await rewriteFile(file);
    expect(result.matchCount).toBe(0);
    expect(result.bytesWritten).toBe(0);
    expect(result.backupPath).toBeUndefined();
    expect(await readFile(file, 'utf8')).toBe('just a plain log line\n');
  });

  it('skips files actively being written (recent mtime)', async () => {
    const file = join(workdir, 'live');
    await writeFile(file, 'export AWS=AKIAIOSFODNN7EXAMPLE\n');
    // Fresh mtime — within the active-write window.
    const result = await rewriteFile(file);
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toMatch(/actively-written/);
    expect(await readFile(file, 'utf8')).toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('honors includeActive to rewrite a freshly-touched file', async () => {
    const file = join(workdir, 'live');
    await writeFile(file, 'export AWS=AKIAIOSFODNN7EXAMPLE\n');
    const result = await rewriteFile(file, { includeActive: true });
    expect(result.skipped).toBeFalsy();
    expect(result.matchCount).toBe(1);
    expect(await readFile(file, 'utf8')).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('exempts append-only surfaces (shell history) from the active-write skip', async () => {
    const file = join(workdir, 'history');
    // Fresh mtime — would be skipped as "actively-written" for a streaming
    // surface, but shell history is append-only so it must be rewritten.
    await writeFile(file, 'export AWS=AKIAIOSFODNN7EXAMPLE\n');
    const result = await rewriteFile(file, {}, { appendOnly: true });
    expect(result.skipped).toBeFalsy();
    expect(result.matchCount).toBe(1);
    expect(await readFile(file, 'utf8')).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('honors dryRun: computes count but leaves file untouched', async () => {
    const file = join(workdir, 'history');
    const original = 'export AWS=AKIAIOSFODNN7EXAMPLE\n';
    await writeFile(file, original);
    await ageFile(file);
    const result = await rewriteFile(file, { dryRun: true });
    expect(result.matchCount).toBe(1);
    expect(result.bytesWritten).toBe(0);
    expect(result.backupPath).toBeUndefined();
    expect(await readFile(file, 'utf8')).toBe(original);
  });

  it('preserves JSONL validity when rewriting a Claude Code-shaped file', async () => {
    const file = join(workdir, 'session.jsonl');
    const lines = [
      JSON.stringify({
        role: 'user',
        content: 'check this token: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      JSON.stringify({ role: 'assistant', content: 'no problem' }),
      JSON.stringify({ role: 'user', content: 'plain text' }),
    ];
    await writeFile(file, `${lines.join('\n')}\n`);
    await ageFile(file);

    const result = await rewriteFile(file);
    expect(result.matchCount).toBe(1);

    const after = await readFile(file, 'utf8');
    const parsedLines = after
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(parsedLines).toHaveLength(3);
    expect(parsedLines[0].content).toBe('check this token: <REDACTED:github-pat-classic>');
    expect(parsedLines[1].content).toBe('no problem');
    expect(parsedLines[2].content).toBe('plain text');
  });

  it('respects a custom replacement token', async () => {
    const file = join(workdir, 'history');
    await writeFile(file, 'export X=AKIAIOSFODNN7EXAMPLE\n');
    await ageFile(file);
    const result = await rewriteFile(file, { replacement: '[REDACTED:keynv]' });
    expect(result.matchCount).toBe(1);
    expect(await readFile(file, 'utf8')).toBe('export X=[REDACTED:keynv]\n');
  });

  it('reports missing files as skipped', async () => {
    const result = await rewriteFile(join(workdir, 'nope'));
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('missing');
  });

  it('writes the temp file with 0600 perms (no world-readability)', async () => {
    if (process.platform === 'win32') return;

    const file = join(workdir, 'history');
    await writeFile(file, 'export AWS=AKIAIOSFODNN7EXAMPLE\n');
    await ageFile(file);
    await rewriteFile(file);
    const st = await stat(file);
    // The rename preserves the temp file's mode; check that group/other
    // bits aren't broadcasted (read-only check; some umasks make this
    // already-restrictive, others would expose secrets in the rewrite).
    const mode = st.mode & 0o077;
    expect(mode).toBe(0);
  });
});
