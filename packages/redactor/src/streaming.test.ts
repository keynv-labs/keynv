import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createRedactStream } from './streaming.js';

async function pipe(input: string, stream: ReturnType<typeof createRedactStream>): Promise<string> {
  const reader = Readable.from([Buffer.from(input, 'utf8')]);
  const chunks: Buffer[] = [];
  for await (const chunk of reader.pipe(stream)) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('createRedactStream', () => {
  it('redacts an inline secret and preserves the rest of the line', async () => {
    const out = await pipe(
      'INFO connecting postgres://u:p@db/app for migration\n',
      createRedactStream({ entropy: { enabled: false } }),
    );
    expect(out).toContain('<REDACTED:postgres-uri>');
    expect(out).toContain('INFO connecting');
    expect(out).toContain('for migration');
  });

  it('flushes a trailing line that has no terminating newline', async () => {
    const out = await pipe(
      'tail line ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      createRedactStream({ entropy: { enabled: false } }),
    );
    expect(out).toContain('<REDACTED:github-pat-classic>');
  });

  it('passes innocuous output through unchanged', async () => {
    const input = 'hello\nworld\n';
    const out = await pipe(input, createRedactStream());
    expect(out).toBe(input);
  });

  it('handles many small chunks without losing bytes', async () => {
    const stream = createRedactStream({ entropy: { enabled: false } });
    const input = 'aws=AKIAEXAMPLEEXAMPLEEX done\n';
    const reader = Readable.from(input.split('').map((c) => Buffer.from(c, 'utf8')));
    const chunks: Buffer[] = [];
    for await (const chunk of reader.pipe(stream)) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
    }
    const out = Buffer.concat(chunks).toString('utf8');
    expect(out).toContain('<REDACTED:aws-access-key-id>');
    expect(out).toContain('aws=');
    expect(out).toContain(' done');
  });

  it('does not apply multiline PEM block patterns (documented limitation)', async () => {
    const input = [
      'log line one',
      '-----BEGIN RSA PRIVATE KEY-----',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      '-----END RSA PRIVATE KEY-----',
      'log line last',
      '',
    ].join('\n');
    const out = await pipe(input, createRedactStream({ entropy: { enabled: false } }));
    // Streaming mode does NOT redact across newlines — confirming the
    // limitation. Per-line content remains, so callers must use the
    // batch API when they need multi-line coverage.
    expect(out).toContain('-----BEGIN RSA PRIVATE KEY-----');
  });
});
