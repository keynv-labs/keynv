import { describe, expect, it } from 'vitest';
import { redact } from './batch.js';

// Vendor-prefixed fixtures are constructed at runtime from
// concatenated pieces so the LITERAL secret-shape never appears
// verbatim in source. Static scanners (GitHub Push Protection,
// trufflehog, gitleaks) match against contiguous source bytes;
// concatenation keeps our regex tests honest while preventing
// false positives at commit time.
const X = (n: number) => 'X'.repeat(n);
const fix = {
  awsKey: `AKIA${'EXAMPLE'.repeat(2)}EX`,
  awsTemp: `ASIA${'EXAMPLE'.repeat(2)}DD`,
  gcp: `${'AIza'}${X(35)}`,
  ghClassic: `${'ghp'}_${X(36)}`,
  ghFine: `${'github'}_pat_${X(60)}`,
  slackBot: `${'xoxb'}-${X(10)}-${X(13)}-${X(24)}`,
  slackHook: `https://hooks.slack.com/services/${X(10).replace(/X/g, 'T')}/${X(10).replace(/X/g, 'B')}/${X(26)}`,
  stripe: `${'sk'}_${'live'}_${X(26)}`,
  openai: `${'sk'}-proj-${X(24)}`,
  anthropic: `${'sk'}-ant-api03-${X(24)}`,
  jwt: `${'eyJ'}${X(20)}.${'eyJ'}${X(20)}.${X(20)}`,
};

describe('pattern bank — true positives', () => {
  it.each([
    [
      'postgres URI',
      'connect to postgres://app:hunter2@db.example.com:5432/billing for the migration',
      'postgres-uri',
    ],
    ['mysql URI', 'mysql://root:rootpass@10.0.0.5:3306/app', 'mysql-uri'],
    ['mongodb+srv URI', 'mongodb+srv://u:p@cluster0.mongo.net/app?retryWrites=true', 'mongodb-uri'],
    [
      'Redis with password',
      'rediss://default:abc123@redis.example.com:6379/0',
      'redis-uri-with-password',
    ],
    ['Slack webhook', `POST ${fix.slackHook}`, 'slack-webhook'],
    ['AWS AKIA', `AWS_ACCESS_KEY_ID=${fix.awsKey}`, 'aws-access-key-id'],
    ['AWS ASIA temp', `token=${fix.awsTemp}`, 'aws-access-key-id'],
    ['GCP API key', `key: ${fix.gcp}`, 'gcp-api-key'],
    ['GitHub PAT classic', `gh auth login --token ${fix.ghClassic}`, 'github-pat-classic'],
    ['GitHub fine-grained PAT', `PAT=${fix.ghFine}`, 'github-pat-fine-grained'],
    ['Slack bot token', `export SLACK_BOT=${fix.slackBot}`, 'slack-bot-token'],
    ['Stripe live key', `STRIPE_KEY=${fix.stripe}`, 'stripe-live-secret-key'],
    ['OpenAI API key', `OPENAI_API_KEY=${fix.openai}`, 'openai-api-key'],
    ['Anthropic API key', `ANTHROPIC_API_KEY=${fix.anthropic}`, 'anthropic-api-key'],
    ['JWT', `Authorization: Bearer ${fix.jwt}`, 'jwt'],
  ])('redacts %s', (_label, input, expectedPattern) => {
    const { text, matches } = redact(input);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.pattern === expectedPattern)).toBe(true);
    expect(text).toContain(`<REDACTED:${expectedPattern}>`);
  });

  it('redacts multi-line PEM private key blocks', () => {
    const input = [
      'this is a key:',
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEA1234567890abcdef',
      'MIIEpAIBAAKCAQEAabcdef1234567890',
      '-----END RSA PRIVATE KEY-----',
      'continuing',
    ].join('\n');
    const { text, matches } = redact(input);
    expect(matches.some((m) => m.pattern === 'pem-private-key')).toBe(true);
    expect(text).toContain('<REDACTED:pem-private-key>');
    expect(text).not.toContain('MIIEpAIBAAKCAQEA');
  });

  it('redacts multi-line PGP private key blocks', () => {
    const input = [
      '-----BEGIN PGP PRIVATE KEY BLOCK-----',
      'Comment: gpg pretend key',
      'lQOYBGFbS7gBCAD...',
      '-----END PGP PRIVATE KEY BLOCK-----',
    ].join('\n');
    const { text } = redact(input);
    expect(text).toContain('<REDACTED:pgp-private-key>');
  });
});

describe('pattern bank — false positives (innocent fixtures must NOT be redacted)', () => {
  // To reduce flakiness, run the entropy detector with default settings —
  // the patterns themselves should not match any of these.
  const innocent: Array<[string, string]> = [
    ['UUIDv4', '550e8400-e29b-41d4-a716-446655440000'],
    ['short git SHA', 'a3f9b8c'],
    ['long git SHA', 'a3f9b8c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7'],
    ['lorem ipsum', 'lorem ipsum dolor sit amet consectetur adipiscing elit'],
    ['file path', '/usr/local/bin/keynv-server'],
    [
      'public RSA key marker (not private)',
      '-----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----',
    ],
    ['email address', 'support@billing.example.com'],
    ['public GitHub URL', 'https://github.com/anthropic/keynv'],
    ['version string', 'keynv 1.2.3-rc.4'],
  ];

  // We disable the entropy detector here to isolate pattern-only behavior.
  it.each(innocent)('does not pattern-match %s', (_label, input) => {
    const { matches } = redact(input, { entropy: { enabled: false } });
    expect(matches).toEqual([]);
  });
});

describe('redact — overlap and ordering', () => {
  it('renders matches in order without index drift', () => {
    const input = `a=${fix.ghClassic} b=${fix.awsKey}`;
    const { text } = redact(input, { entropy: { enabled: false } });
    expect(text).toBe('a=<REDACTED:github-pat-classic> b=<REDACTED:aws-access-key-id>');
  });

  it('does not double-redact overlapping pattern hits', () => {
    // jwt + entropy could both match; the wider pattern (jwt) wins.
    const jwt = fix.jwt;
    const input = `token: ${jwt}`;
    const { text, matches } = redact(input);
    expect(text).toContain('<REDACTED:jwt>');
    expect(matches.filter((m) => m.start < input.indexOf(jwt) + jwt.length).length).toBe(1);
  });
});

describe('redact — literals (resolved-value pre-emptive redaction)', () => {
  it('redacts an arbitrary literal exact-match', () => {
    const { text, matches } = redact('the password is hunter2 and another hunter2', {
      literals: ['hunter2'],
      entropy: { enabled: false },
    });
    expect(text).not.toContain('hunter2');
    expect(matches.length).toBe(2);
  });

  it('escapes regex metacharacters in literal', () => {
    const { text } = redact('value: a.b+c?d', {
      literals: ['a.b+c?d'],
      entropy: { enabled: false },
    });
    expect(text).not.toContain('a.b+c?d');
  });
});

describe('redact — entropy detector', () => {
  it('catches high-entropy strings (random base64-shaped)', () => {
    const { matches } = redact('payload: A8sJ19sbgZ7GqbkpRXp9-ZQyCPmK3VBh2');
    expect(matches.some((m) => m.pattern === 'high-entropy')).toBe(true);
  });

  it('respects minLength threshold', () => {
    const { matches } = redact('short: A8sJ19sbgZ', { entropy: { minLength: 24 } });
    expect(matches).toEqual([]);
  });

  it('can be disabled', () => {
    const { matches } = redact('payload: A8sJ19sbgZ7GqbkpRXp9-ZQyCPmK3VBh2', {
      entropy: { enabled: false },
    });
    expect(matches).toEqual([]);
  });
});
