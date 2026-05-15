import { describe, expect, it } from 'vitest';
import { allDocSlugs, findDocPage, listAllPages, neighborPages } from './docs-registry';

describe('allDocSlugs', () => {
  it('returns slug for every doc page', () => {
    const slugs = allDocSlugs();
    expect(slugs).toContain('quickstart');
    expect(slugs).toContain('architecture');
    expect(slugs).toContain('api');
    expect(slugs).toContain('decisions/license-choice');
  });

  it('contains no duplicates', () => {
    const slugs = allDocSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('listAllPages', () => {
  it('returns pages with section name', () => {
    const pages = listAllPages();
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0]).toHaveProperty('section');
    expect(pages[0]).toHaveProperty('slug');
    expect(pages[0]).toHaveProperty('title');
  });
});

describe('findDocPage', () => {
  it('finds a page by slug', () => {
    const found = findDocPage('quickstart');
    expect(found).not.toBeNull();
    expect(found?.page.title).toBe('Quickstart');
    expect(found?.section).toBe('Getting started');
  });

  it('returns null for unknown slug', () => {
    expect(findDocPage('non-existent')).toBeNull();
  });
});

describe('neighborPages', () => {
  it('returns nulls for the first page', () => {
    const n = neighborPages('quickstart');
    expect(n.prev).toBeNull();
    expect(n.next).not.toBeNull();
  });

  it('returns nulls for the last page', () => {
    const n = neighborPages('decisions/license-choice');
    expect(n.next).toBeNull();
    expect(n.prev).not.toBeNull();
  });

  it('returns prev and next for a middle page', () => {
    const n = neighborPages('architecture');
    expect(n.prev?.slug).toBe('ai-setup');
    expect(n.next?.slug).toBe('threat-model');
  });

  it('returns nulls for unknown slug', () => {
    const n = neighborPages('nothing');
    expect(n.prev).toBeNull();
    expect(n.next).toBeNull();
  });
});
