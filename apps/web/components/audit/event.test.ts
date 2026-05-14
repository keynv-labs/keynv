import { describe, it, expect } from 'vitest';
import { categoryOf, describeEvent, actorInitials, dayBucket, relativeTime } from './event';

describe('categoryOf', () => {
  it('returns the prefix for known event types', () => {
    expect(categoryOf('project.created')).toBe('project');
    expect(categoryOf('secret.rotated')).toBe('secret');
    expect(categoryOf('member.added')).toBe('member');
    expect(categoryOf('auth.login.allowed')).toBe('auth');
    expect(categoryOf('approval.requested')).toBe('approval');
    expect(categoryOf('user.invited')).toBe('user');
  });

  it('returns "other" for unknown prefixes', () => {
    expect(categoryOf('unknown.event')).toBe('other');
    expect(categoryOf('weird.thing')).toBe('other');
  });

  it('returns "other" for event types without a dot', () => {
    expect(categoryOf('plaintext')).toBe('other');
    expect(categoryOf('')).toBe('other');
  });
});

describe('describeEvent', () => {
  it('describes project.created', () => {
    const r = describeEvent('project.created', { name: 'my-project' });
    expect(r.verb).toBe('created project');
    expect(r.subject).toBe('my-project');
  });

  it('describes secret.created with success tone', () => {
    const r = describeEvent('secret.created', { alias: 'DATABASE_URL' });
    expect(r.verb).toBe('created secret');
    expect(r.subject).toBe('DATABASE_URL');
    expect(r.tone).toBe('success');
  });

  it('describes secret.deleted with danger tone', () => {
    const r = describeEvent('secret.deleted', { alias: 'OLD_KEY' });
    expect(r.tone).toBe('danger');
  });

  it('describes approval.requested with warn tone', () => {
    const r = describeEvent('approval.requested', { alias: 'PROD_DB' });
    expect(r.tone).toBe('warn');
  });

  it('describes auth.login.denied with danger tone', () => {
    const r = describeEvent('auth.login.denied', null);
    expect(r.tone).toBe('danger');
  });

  it('handles null/empty payload gracefully', () => {
    const r = describeEvent('member.added', null);
    expect(r.verb).toBe('added member');
    expect(r.subject).toBe('');
  });

  it('falls back to secondary key for subject', () => {
    const r = describeEvent('member.added', { user_id: 'u_abc' });
    expect(r.subject).toBe('u_abc');
  });

  it('falls back to event type for unknown events', () => {
    const r = describeEvent('some.custom.event', null);
    expect(r.verb).toBe('some.custom.event');
  });
});

describe('actorInitials', () => {
  it('extracts first two chars after u_ prefix', () => {
    expect(actorInitials('u_abc123', 'cli')).toBe('AB');
  });

  it('falls back to agent when userId is null', () => {
    expect(actorInitials(null, 'cli')).toBe('⚙');
  });
});

describe('dayBucket', () => {
  it('labels iso timestamp from today as "Today"', () => {
    const now = new Date();
    const iso = now.toISOString();
    expect(dayBucket(iso).label).toBe('Today');
  });

  it('returns "Unknown date" for invalid input', () => {
    const r = dayBucket('not-a-date');
    expect(r.label).toBe('Unknown date');
    expect(r.key).toBe('unknown');
  });
});

describe('relativeTime', () => {
  it('returns "just now" for sub-minute timestamps', () => {
    const recent = new Date(Date.now() - 10_000).toISOString();
    expect(relativeTime(recent)).toBe('just now');
  });

  it('returns minutes ago for recent times', () => {
    const ts = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(ts)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const ts = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(relativeTime(ts)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const ts = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(relativeTime(ts)).toBe('10d ago');
  });

  it('returns empty string for invalid date', () => {
    expect(relativeTime('garbage')).toBe('');
  });
});
