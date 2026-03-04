import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared fake post data ────────────────────────────────────────────────────

const fakePostA = {
  slug: 'post-a',
  body: '# Post A\n\nThis is post A.',
  collection: 'blog' as const,
  data: {
    title: 'Post A Title',
    description: 'Description for post A',
    date: new Date('2024-06-01'),
    modified: new Date('2024-06-15'),
    image: '/images/post-a.jpg',
    keywords: ['typescript', 'testing'],
    draft: false,
    priority: 0.8,
  },
};

const fakePostB = {
  slug: 'post-b',
  body: '# Post B\n\nThis is post B.',
  collection: 'blog' as const,
  data: {
    title: 'Post B Title',
    description: 'Description for post B',
    date: new Date('2024-01-10'),
    // no modified, no image, no keywords
    draft: false,
  },
};

const fakeDraftPost = {
  slug: 'draft-post',
  body: 'Draft content',
  collection: 'blog' as const,
  data: {
    title: 'A Draft Post Title',
    draft: true,
    date: new Date('2024-12-01'),
  },
};

// ── Mock astro:content so Vitest can import the handler ──────────────────────

vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
}));

vi.mock('astro', () => ({}));

import { getCollection } from 'astro:content';
const { GET } = await import('../pages/feed.json');

// Convenience: call GET with a fake site URL
function callGET(siteHref = 'https://example.com/') {
  const ctx = { site: new URL(siteHref) } as Parameters<typeof GET>[0];
  return GET(ctx);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('feed.json GET handler', () => {
  describe('response metadata', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA, fakePostB] as any);
    });

    it('returns a Response', async () => {
      const res = await callGET();
      expect(res).toBeInstanceOf(Response);
    });

    it('sets Content-Type to application/feed+json; charset=utf-8', async () => {
      const res = await callGET();
      expect(res.headers.get('Content-Type')).toBe(
        'application/feed+json; charset=utf-8'
      );
    });
  });

  describe('JSON Feed 1.1 top-level fields', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
    });

    it('sets version to JSON Feed 1.1 URL', async () => {
      const json = await (await callGET()).json();
      expect(json.version).toBe('https://jsonfeed.org/version/1.1');
    });

    it('sets feed title', async () => {
      const json = await (await callGET()).json();
      expect(json.title).toBe('Do Code That Matters');
    });

    it('sets home_page_url to site URL without trailing slash', async () => {
      const json = await (await callGET('https://example.com/')).json();
      expect(json.home_page_url).toBe('https://example.com');
    });

    it('sets feed_url to site/feed.json', async () => {
      const json = await (await callGET('https://example.com/')).json();
      expect(json.feed_url).toBe('https://example.com/feed.json');
    });

    it('sets description', async () => {
      const json = await (await callGET()).json();
      expect(typeof json.description).toBe('string');
      expect(json.description.length).toBeGreaterThan(0);
    });

    it('lists Spencer Kittleson as an author', async () => {
      const json = await (await callGET()).json();
      expect(json.authors).toHaveLength(1);
      expect(json.authors[0].name).toBe('Spencer Kittleson');
    });
  });

  describe('items', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA, fakePostB] as any);
    });

    it('returns one item per post', async () => {
      const json = await (await callGET()).json();
      expect(json.items).toHaveLength(2);
    });

    it('sorts items newest-first by date', async () => {
      const json = await (await callGET()).json();
      const dates = json.items.map((i: any) => new Date(i.date_published).getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]);
    });

    it('sets item id and url to site + slug', async () => {
      const json = await (await callGET('https://example.com/')).json();
      const itemA = json.items.find((i: any) => i.id.includes('post-a'));
      expect(itemA.id).toBe('https://example.com/post-a/');
      expect(itemA.url).toBe('https://example.com/post-a/');
    });

    it('sets item title', async () => {
      const json = await (await callGET()).json();
      const itemA = json.items.find((i: any) => i.title === 'Post A Title');
      expect(itemA).toBeDefined();
    });

    it('sets item summary from description', async () => {
      const json = await (await callGET()).json();
      const itemA = json.items.find((i: any) => i.title === 'Post A Title');
      expect(itemA.summary).toBe('Description for post A');
    });

    it('sets item image', async () => {
      const json = await (await callGET()).json();
      const itemA = json.items.find((i: any) => i.title === 'Post A Title');
      expect(itemA.image).toBe('/images/post-a.jpg');
    });

    it('sets date_published as ISO string', async () => {
      const json = await (await callGET()).json();
      const itemA = json.items.find((i: any) => i.title === 'Post A Title');
      expect(itemA.date_published).toBe(new Date('2024-06-01').toISOString());
    });

    it('sets date_modified from modified when present', async () => {
      const json = await (await callGET()).json();
      const itemA = json.items.find((i: any) => i.title === 'Post A Title');
      expect(itemA.date_modified).toBe(new Date('2024-06-15').toISOString());
    });

    it('falls back date_modified to date_published when modified is absent', async () => {
      const json = await (await callGET()).json();
      const itemB = json.items.find((i: any) => i.title === 'Post B Title');
      expect(itemB.date_modified).toBe(new Date('2024-01-10').toISOString());
    });

    it('sets tags from keywords', async () => {
      const json = await (await callGET()).json();
      const itemA = json.items.find((i: any) => i.title === 'Post A Title');
      expect(itemA.tags).toEqual(['typescript', 'testing']);
    });

    it('uses empty array for tags when keywords is absent', async () => {
      const json = await (await callGET()).json();
      const itemB = json.items.find((i: any) => i.title === 'Post B Title');
      expect(itemB.tags).toEqual([]);
    });

    it('sets empty string for image when not provided', async () => {
      const json = await (await callGET()).json();
      const itemB = json.items.find((i: any) => i.title === 'Post B Title');
      expect(itemB.image).toBe('');
    });
  });

  describe('draft filtering', () => {
    it('only passes non-draft posts to the feed', async () => {
      // The getCollection mock gets the filter function as second arg;
      // feed.json passes `({ data }) => !data.draft` — simulate that.
      vi.mocked(getCollection).mockImplementation(async (_col, filter: any) => {
        const all = [fakePostA, fakePostB, fakeDraftPost] as any[];
        return filter ? all.filter((p: any) => filter(p)) : all;
      });

      const json = await (await callGET()).json();
      const titles = json.items.map((i: any) => i.title);
      expect(titles).not.toContain('A Draft Post Title');
      expect(titles).toContain('Post A Title');
      expect(titles).toContain('Post B Title');
    });
  });
});
