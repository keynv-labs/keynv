import { describe, it, expect } from 'vitest';
import { parseChangelog } from './markdown';

function firstSection(raw: string) {
  return parseChangelog(raw).sections[0]!;
}

describe('parseChangelog', () => {
  it('extracts intro text before first h2', () => {
    const raw = '# Changelog\n\nSome intro.\n\n## [1.0.0] - 2025-01-01\n\nChanges.';
    const result = parseChangelog(raw);
    expect(result.intro).toBe('Some intro.');
  });

  it('strips leading h1 and blank lines from intro', () => {
    const raw = '# Changelog\n\n\n## v1.0.0\n\nBody.';
    const result = parseChangelog(raw);
    expect(result.intro).toBe('');
  });

  it('parses version and date from h2', () => {
    const raw = '## [1.0.0] - 2025-06-01\n\nStuff.';
    expect(parseChangelog(raw).sections).toHaveLength(1);
    expect(firstSection(raw).version).toBe('1.0.0');
    expect(firstSection(raw).date).toBe('2025-06-01');
  });

  it('parses version without brackets', () => {
    const raw = '## v0.1.0 — 2025-01-01\n\nBody.';
    expect(firstSection(raw).version).toBe('v0.1.0');
    expect(firstSection(raw).date).toBe('2025-01-01');
  });

  it('handles unreleased sections', () => {
    const raw = '## [Unreleased]\n\nPending.';
    expect(firstSection(raw).version).toBe('Unreleased');
    expect(firstSection(raw).date).toBeNull();
  });

  it('generates anchor from version', () => {
    const raw = '## [1.0.0] - 2025-01-01\n\nBody.';
    expect(firstSection(raw).anchor).toBe('1.0.0');
  });

  it('slugifies version with special characters', () => {
    const raw = '## [v1.0.0-beta.1] - 2025-01-01\n\nBody.';
    expect(firstSection(raw).anchor).toBe('v1.0.0-beta.1');
  });

  it('captures body markdown per section', () => {
    const raw = '## [1.0.0] - 2025-01-01\n\n### Added\n\n- Feature A\n- Feature B\n';
    expect(firstSection(raw).bodyMarkdown).toContain('Feature A');
    expect(firstSection(raw).bodyMarkdown).toContain('Feature B');
  });

  it('parses multiple sections', () => {
    const result = parseChangelog('## [1.0.0] - 2025-01-01\n\nFirst.\n## [0.9.0] - 2024-12-01\n\nSecond.');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]!.version).toBe('1.0.0');
    expect(result.sections[1]!.version).toBe('0.9.0');
  });

  it('returns empty sections for changelog with no h2', () => {
    const raw = '# Just an h1\n\nSome text.';
    const result = parseChangelog(raw);
    expect(result.sections).toHaveLength(0);
  });
});
