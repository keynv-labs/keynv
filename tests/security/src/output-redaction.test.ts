import { redact } from '@keynv/redactor';
import { describe, expect, it } from 'vitest';

/**
 * Threat model: docs/02-threat-model.md §pattern-bank.
 *
 * The exhaustive pattern-by-pattern coverage lives in
 * packages/redactor/src/patterns.test.ts (one test per supported
 * pattern, plus the streaming variants in streaming.test.ts).
 *
 * What this file does is the *integration* check: imports
 * @keynv/redactor at its package boundary, runs a representative
 * sample through redact(), and asserts both true-positive coverage
 * (every secret-shaped fixture below disappears) and false-positive
 * containment (UUIDs and git SHAs are left alone).
 *
 * Fixtures use the concat-prefix trick from
 * packages/redactor/src/patterns.test.ts so this file doesn't trip
 * GitHub's push-protection on its own source bytes.
 */

const X = (n: number) => 'X'.repeat(n);

const FIXTURES = {
  postgresUrl: `postgres://user:${'p'}assword@db.example.com:5432/myapp`,
  mysqlUrl: `mysql://root:${'p'}assword@db.example.com:3306/myapp`,
  mongoUrl: `mongodb+srv://user:${'p'}ass@cluster0.example.net/test`,
  awsKey: `AKIA${'EXAMPLE'.repeat(2)}EX`,
  ghClassic: `${'ghp'}_${X(36)}`,
  ghFine: `${'github'}_${'pat'}_${X(82)}`,
  slackBot: `${'xoxb'}-${X(10)}-${X(13)}-${X(24)}`,
  stripe: `${'sk'}_${'live'}_${X(26)}`,
  jwt: `${'eyJ'}${X(20)}.${'eyJ'}${X(20)}.${X(20)}`,
  openaiProj: `${'sk'}-${'proj'}-${X(36)}`,
  anthropic: `${'sk'}-${'ant'}-${'api03'}-${X(36)}`,
  googleApi: `${'AIza'}${X(35)}`,
};

const BENIGN = {
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  gitShortSha: '0a1b2c3',
  gitLongSha: '0a1b2c3d4e5f6789012345678901234567890abc',
  // 32 lowercase hex (looks high-entropy but is just a hash digest)
  hexDigest: 'd41d8cd98f00b204e9800998ecf8427e0a1b2c3d',
};

describe('output-redaction (integration): pattern bank', () => {
  it.each([
    ['postgres URI', FIXTURES.postgresUrl],
    ['mysql URI', FIXTURES.mysqlUrl],
    ['mongodb+srv URI', FIXTURES.mongoUrl],
    ['AWS access key id', FIXTURES.awsKey],
    ['GitHub classic PAT', FIXTURES.ghClassic],
    ['GitHub fine-grained PAT', FIXTURES.ghFine],
    ['Slack bot token', FIXTURES.slackBot],
    ['Stripe live secret key', FIXTURES.stripe],
    ['OpenAI project key', FIXTURES.openaiProj],
    ['Anthropic key', FIXTURES.anthropic],
    ['Google API key', FIXTURES.googleApi],
    ['JWT', FIXTURES.jwt],
  ])('redacts %s', (_label, fixture) => {
    const result = redact(`leading text ${fixture} trailing text`);
    expect(result.text).not.toContain(fixture);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('redacts a multi-line RSA private-key block', () => {
    const block = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEAfake',
      'fakekeydatafakekey',
      '-----END RSA PRIVATE KEY-----',
    ].join('\n');
    const result = redact(`prefix\n${block}\nsuffix`);
    expect(result.text).not.toContain('fakekeydatafakekey');
    expect(result.matches.some((m) => m.pattern.toLowerCase().includes('private'))).toBe(true);
  });
});

describe('output-redaction (integration): false-positive containment', () => {
  it('does not redact a v4 UUID', () => {
    const result = redact(`request_id=${BENIGN.uuid}`);
    expect(result.text).toContain(BENIGN.uuid);
  });

  it('does not redact a 7-char git short SHA', () => {
    const result = redact(`commit ${BENIGN.gitShortSha}`);
    expect(result.text).toContain(BENIGN.gitShortSha);
  });

  it('does not redact a 40-char git long SHA in plain context', () => {
    const result = redact(`HEAD ${BENIGN.gitLongSha}`);
    expect(result.text).toContain(BENIGN.gitLongSha);
  });

  it('does not redact a 32-char hex digest in a non-secret context', () => {
    const result = redact(`md5 ${BENIGN.hexDigest}`);
    expect(result.text).toContain(BENIGN.hexDigest);
  });
});

describe('output-redaction (integration): match metadata', () => {
  it('returns a preview that is bounded and does not leak the full secret', () => {
    const result = redact(`token: ${FIXTURES.ghClassic}`);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    for (const m of result.matches) {
      // Preview is the first few chars + ellipsis; never the full secret.
      expect(m.preview.length).toBeLessThanOrEqual(16);
      expect(m.preview).not.toEqual(FIXTURES.ghClassic);
    }
  });

  it('preserves text length only via redaction placeholders, never the original substring', () => {
    const result = redact(`secret=${FIXTURES.stripe}`);
    expect(result.text).not.toContain(FIXTURES.stripe);
    // Replacement reads `<REDACTED:{name}>` by default.
    expect(result.text).toMatch(/<REDACTED:/);
  });
});
