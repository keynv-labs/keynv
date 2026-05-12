import { describe, expect, it, vi } from 'vitest';
import { scrubToastMessage } from './toast';

describe('scrubToastMessage', () => {
  it('passes through innocuous content untouched', () => {
    expect(scrubToastMessage('Project created')).toBe('Project created');
    expect(scrubToastMessage('Could not reach api.keynv.dev')).toBe(
      'Could not reach api.keynv.dev',
    );
  });

  it('redacts Resend API keys', () => {
    // Clearly-synthetic fixture. NEVER use a real (even rotated) key here —
    // the file's purpose is to prove the pattern fires, not to ship a
    // historic credential into git history.
    const fake = 'Resend rejected: re_FAKE_FAKE_FAKE_FAKE_FAKE_FAKE is invalid';
    expect(scrubToastMessage(fake)).toBe('Resend rejected: [redacted] is invalid');
  });

  it('redacts Anthropic / OpenAI keys', () => {
    expect(scrubToastMessage('sk-ant-api03-AbCdEf012345abcdef0123456789')).toContain('[redacted]');
    expect(scrubToastMessage('sk-proj-AbCdEf012345abcdef0123456789')).toContain('[redacted]');
  });

  it('redacts GitHub tokens', () => {
    expect(scrubToastMessage('ghp_abcdefghijklmnopqrstuvwxyz0123456789')).toContain('[redacted]');
    expect(scrubToastMessage('ghs_abcdefghijklmnopqrstuvwxyz0123456789')).toContain('[redacted]');
  });

  it('redacts JWTs', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(scrubToastMessage(`Auth failed: ${jwt}`)).toContain('[redacted]');
  });

  it('redacts AWS access keys', () => {
    expect(scrubToastMessage('AKIAIOSFODNN7EXAMPLE')).toContain('[redacted]');
  });

  it('redacts PEM private keys', () => {
    expect(scrubToastMessage('-----BEGIN RSA PRIVATE KEY-----\nMII...')).toContain('[redacted]');
  });

  it('warns on console when scrubbing occurs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    scrubToastMessage('Failed: re_AAAAAAAAAAAAAAAAAAAAAAAA');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[keynv:toast]'));
    warn.mockRestore();
  });

  it('redacts multiple distinct secret patterns in one message', () => {
    const msg =
      'GET /v1/x failed for ghp_abcdefghijklmnopqrstuvwxyz0123456789 and AKIAIOSFODNN7EXAMPLE';
    const out = scrubToastMessage(msg);
    expect(out).not.toContain('ghp_');
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect((out.match(/\[redacted\]/g) ?? []).length).toBe(2);
  });
});
