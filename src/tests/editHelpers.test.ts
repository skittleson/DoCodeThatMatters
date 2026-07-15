import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate, getBlogPosts } from '../lib/githubClient';
import {
  parseFrontmatter,
  sortPostsByDate,
} from '../lib/editHelpers';

describe('parseFrontmatter', () => {
  it('parses date and modified from valid frontmatter', () => {
    const content = '---\ndate: 2024-06-15\nmodified: 2024-07-20\n---\nbody';
    const { date, modified } = parseFrontmatter(content);
    expect(date).toEqual(new Date('2024-06-15'));
    expect(modified).toEqual(new Date('2024-07-20'));
  });

  it('returns 1970-01-01 when date field is missing', () => {
    const content = '---\nmodified: 2024-07-20\n---\nbody';
    const { date, modified } = parseFrontmatter(content);
    expect(date).toEqual(new Date('1970-01-01'));
    expect(modified).toEqual(new Date('2024-07-20'));
  });

  it('returns undefined modified when field is missing', () => {
    const content = '---\ndate: 2024-06-15\n---\nbody';
    const { date, modified } = parseFrontmatter(content);
    expect(date).toEqual(new Date('2024-06-15'));
    expect(modified).toBeUndefined();
  });

  it('handles partial frontmatter with only title', () => {
    const content = '---\ntitle: My Post\n---\nbody';
    const { date, modified, raw } = parseFrontmatter(content);
    expect(date).toEqual(new Date('1970-01-01'));
    expect(modified).toBeUndefined();
    expect(raw.title).toBe('My Post');
  });

  it('throws when no frontmatter delimiters exist', () => {
    const content = 'just plain text';
    expect(() => parseFrontmatter(content)).toThrow('No frontmatter found');
  });

  it('preserves values with colons in them', () => {
    const content = '---\ndescription: foo: bar\n---\nbody';
    const { raw } = parseFrontmatter(content);
    expect(raw.description).toBe('foo: bar');
  });

  it('handles empty frontmatter via lenient parser', () => {
    const content = '---\n---\nbody';
    const { date, modified, raw } = parseFrontmatter(content, true);
    expect(date).toEqual(new Date('1970-01-01'));
    expect(modified).toBeUndefined();
    expect(Object.keys(raw)).toHaveLength(0);
  });

  it('lenient parser returns defaults when no frontmatter at all', () => {
    const content = 'just text';
    const { date, modified, raw } = parseFrontmatter(content, true);
    expect(date).toEqual(new Date('1970-01-01'));
    expect(modified).toBeUndefined();
    expect(Object.keys(raw)).toHaveLength(0);
  });
});

describe('getBlogPosts sorting', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sorts by modified descending', async () => {
    const listMock = {
      ok: true,
      json: async () => [
        { name: 'post-a.md', path: 'src/content/blog/post-a.md', sha: 'aaa' },
        { name: 'post-b.md', path: 'src/content/blog/post-b.md', sha: 'bbb' },
      ],
    };
    const aMock = {
      ok: true,
      json: async () => ({ content: Buffer.from('---\ndate: 2024-01-01\nmodified: 2024-03-01\n---\nbody a').toString('base64') }),
    };
    const bMock = {
      ok: true,
      json: async () => ({ content: Buffer.from('---\ndate: 2024-02-01\nmodified: 2024-06-01\n---\nbody b').toString('base64') }),
    };
    global.fetch = vi.fn()
      .mockResolvedValueOnce(listMock)
      .mockResolvedValueOnce(aMock)
      .mockResolvedValueOnce(bMock);
    const posts = await getBlogPosts('tok');
    expect(posts[0].name).toBe('post-b.md');
    expect(posts[1].name).toBe('post-a.md');
  });

  it('falls back to date when modified is missing', async () => {
    const listMock = {
      ok: true,
      json: async () => [
        { name: 'post-a.md', path: 'src/content/blog/post-a.md', sha: 'aaa' },
        { name: 'post-b.md', path: 'src/content/blog/post-b.md', sha: 'bbb' },
      ],
    };
    const aMock = {
      ok: true,
      json: async () => ({ content: Buffer.from('---\ndate: 2024-06-01\n---\nbody a').toString('base64') }),
    };
    const bMock = {
      ok: true,
      json: async () => ({ content: Buffer.from('---\ndate: 2024-01-01\n---\nbody b').toString('base64') }),
    };
    global.fetch = vi.fn()
      .mockResolvedValueOnce(listMock)
      .mockResolvedValueOnce(aMock)
      .mockResolvedValueOnce(bMock);
    const posts = await getBlogPosts('tok');
    expect(posts[0].name).toBe('post-a.md');
    expect(posts[1].name).toBe('post-b.md');
  });
});

describe('sortPostsByDate', () => {
  it('handles null dates', () => {
    const posts = sortPostsByDate([
      { modified: null, date: null },
      { modified: new Date('2024-01-01'), date: new Date('2024-01-01') },
      { modified: undefined, date: new Date('2024-03-01') },
      { modified: new Date('2024-06-01'), date: null },
    ]);
    // 2024-06-01 (modified) > 2024-03-01 (date fallback) > 2024-01-01 (modified) > null
    expect(posts[0].modified?.toISOString().slice(0, 10)).toBe('2024-06-01');
    expect(posts[1].date?.toISOString().slice(0, 10)).toBe('2024-03-01');
    expect(posts[2].modified?.toISOString().slice(0, 10)).toBe('2024-01-01');
    expect(posts[3].modified).toBeNull();
    expect(posts[3].date).toBeNull();
  });
});
