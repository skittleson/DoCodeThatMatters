import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../lib/githubClient';

describe('authenticate', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns true when GitHub API responds 200', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });
    const result = await authenticate('fake-token');
    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: { Authorization: 'Bearer fake-token' },
    });
  });

  it('returns false when GitHub API responds non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await authenticate('bad-token');
    expect(result).toBe(false);
  });
});

import { getBlogPosts } from '../lib/githubClient';

describe('getBlogPosts', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns only .md files', async () => {
    const listMock = {
      ok: true,
      json: async () => [
        { name: 'my-post.md', path: 'src/content/blog/my-post.md', sha: 'abc' },
        { name: 'images', path: 'src/content/blog/images', type: 'dir' },
      ],
    };
    const fileMock = {
      ok: true,
      json: async () => ({ content: Buffer.from('---\ndate: 2024-01-01\n---\nbody').toString('base64') }),
    };
    global.fetch = vi.fn()
      .mockResolvedValueOnce(listMock)
      .mockResolvedValueOnce(fileMock);
    const posts = await getBlogPosts('tok');
    expect(posts).toHaveLength(1);
    expect(posts[0].name).toBe('my-post.md');
  });
});
