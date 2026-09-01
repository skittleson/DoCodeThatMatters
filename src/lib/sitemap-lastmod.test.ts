import { describe, it, expect } from 'vitest';
import { slugFromUrl, lastmodForSlug } from './sitemap-lastmod';

const posts = new Map([
  ['running-local-llms-for-coding', { date: new Date('2026-01-01'), modified: new Date('2026-07-15') }],
  ['asp-net-xss-protection', { date: new Date('2017-09-06'), modified: new Date('2026-07-16') }],
  ['old-post-no-modified', { date: new Date('2015-05-01'), modified: undefined }],
]);

describe('slugFromUrl', () => {
  it('extracts the slug from a post URL', () => {
    expect(slugFromUrl('https://docodethatmatters.com/running-local-llms-for-coding/')).toBe('running-local-llms-for-coding');
  });

  it('returns undefined for non-post paths', () => {
    expect(slugFromUrl('https://docodethatmatters.com/')).toBeUndefined();
    expect(slugFromUrl('https://docodethatmatters.com/blog/')).toBeUndefined();
    expect(slugFromUrl('https://docodethatmatters.com/about/')).toBeUndefined();
  });
});

describe('lastmodForSlug', () => {
  it('prefers modified over date', () => {
    expect(lastmodForSlug('running-local-llms-for-coding', posts).toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('falls back to date when modified is missing', () => {
    expect(lastmodForSlug('old-post-no-modified', posts).toISOString()).toBe('2015-05-01T00:00:00.000Z');
  });

  it('returns undefined for unknown slugs', () => {
    expect(lastmodForSlug('not-a-post', posts)).toBeUndefined();
  });
});
