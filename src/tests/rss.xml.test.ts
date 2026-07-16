import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { markdownToText, byteLength } from '../lib/markdownToText';

// The rss endpoint reads audio sizes from public/audio/<slug>/index.mp3 relative
// to process.cwd(). Create a fixture mp3 for post-a so the audio-enclosure path
// is exercised; post-b intentionally has none.
const AUDIO_A_DIR = join(process.cwd(), 'public', 'audio', 'post-a');
const AUDIO_A_MP3 = join(AUDIO_A_DIR, 'index.mp3');
const AUDIO_A_BYTES = 5000;
mkdirSync(AUDIO_A_DIR, { recursive: true });
writeFileSync(AUDIO_A_MP3, Buffer.alloc(AUDIO_A_BYTES));
afterAll(() => {
  rmSync(AUDIO_A_DIR, { recursive: true, force: true });
});

// ── Fake posts ───────────────────────────────────────────────────────────────

const fakePostA = {
  id: 'post-a',
  body: '# Post A\n\nThis is **post A** content.',
  collection: 'blog' as const,
  data: {
    title: 'Post A Title',
    description: 'Description for post A',
    date: new Date('2024-06-01'),
    draft: false,
  },
};

const fakePostB = {
  id: 'post-b',
  body: '## Post B\n\nSomething else.',
  collection: 'blog' as const,
  data: {
    title: 'Post B Title',
    description: 'Description for post B',
    date: new Date('2024-01-10'),
    draft: false,
  },
};

const fakeDraftPost = {
  id: 'draft-post',
  body: 'Draft content',
  collection: 'blog' as const,
  data: {
    title: 'A Draft Post Title',
    draft: true,
    date: new Date('2024-12-01'),
  },
};

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture the args passed to the rss() helper so we can inspect them
let capturedRssArgs: any = null;

vi.mock('@astrojs/rss', () => ({
  default: vi.fn(async (args: any) => {
    capturedRssArgs = args;
    return new Response('<rss/>', {
      headers: { 'Content-Type': 'application/rss+xml' },
    });
  }),
}));

vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
}));

vi.mock('astro', () => ({}));

import { getCollection } from 'astro:content';
const { GET } = await import('../pages/rss.xml');

function callGET(siteHref = 'https://example.com/') {
  capturedRssArgs = null;
  const ctx = { site: new URL(siteHref) } as Parameters<typeof GET>[0];
  return GET(ctx);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('rss.xml GET handler', () => {
  describe('response', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
    });

    it('returns a Response', async () => {
      const res = await callGET();
      expect(res).toBeInstanceOf(Response);
    });
  });

  describe('rss() call arguments — feed metadata', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
    });

    it('passes feed title', async () => {
      await callGET();
      expect(capturedRssArgs.title).toBe('Do Code That Matters');
    });

    it('passes a non-empty feed description', async () => {
      await callGET();
      expect(typeof capturedRssArgs.description).toBe('string');
      expect(capturedRssArgs.description.length).toBeGreaterThan(0);
    });

    it('passes the site URL from context', async () => {
      await callGET('https://myblog.com/');
      expect(capturedRssArgs.site).toBe('https://myblog.com/');
    });

    it('includes language in customData', async () => {
      await callGET();
      expect(capturedRssArgs.customData).toContain('<language>en-us</language>');
    });

    it('includes copyright with current year in customData', async () => {
      await callGET();
      const year = new Date().getFullYear().toString();
      expect(capturedRssArgs.customData).toContain(year);
      expect(capturedRssArgs.customData).toContain('Spencer Kittleson');
    });

    it('includes ttl in customData', async () => {
      await callGET();
      expect(capturedRssArgs.customData).toContain('<ttl>30</ttl>');
    });
  });

  describe('rss() call arguments — items sorting', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostB, fakePostA] as any);
    });

    it('sorts items newest-first by date', async () => {
      await callGET();
      const dates = capturedRssArgs.items.map((i: any) =>
        (i.pubDate as Date).getTime()
      );
      expect(dates[0]).toBeGreaterThan(dates[1]);
    });
  });

  describe('rss() call arguments — item fields', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
    });

    it('sets item title', async () => {
      await callGET();
      expect(capturedRssArgs.items[0].title).toBe('Post A Title');
    });

    it('sets item description', async () => {
      await callGET();
      expect(capturedRssArgs.items[0].description).toBe('Description for post A');
    });

    it('sets item link to /slug/', async () => {
      await callGET();
      expect(capturedRssArgs.items[0].link).toBe('/post-a/');
    });

    it('sets item pubDate', async () => {
      await callGET();
      expect(capturedRssArgs.items[0].pubDate).toEqual(new Date('2024-06-01'));
    });
  });

  describe('rss() call arguments — enclosure customData', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
    });

    it('includes an <enclosure> tag in item customData', async () => {
      await callGET();
      expect(capturedRssArgs.items[0].customData).toContain('<enclosure');
    });

    it('enclosure url points to the slug index.txt', async () => {
      await callGET('https://example.com/');
      expect(capturedRssArgs.items[0].customData).toContain(
        'url="https://example.com/post-a/index.txt"'
      );
    });

    it('enclosure type is text/plain', async () => {
      await callGET();
      expect(capturedRssArgs.items[0].customData).toContain('type="text/plain"');
    });

    it('enclosure length matches byteLength(markdownToText(post.body))', async () => {
      await callGET();
      const expectedLength = byteLength(markdownToText(fakePostA.body));
      expect(capturedRssArgs.items[0].customData).toContain(
        `length="${expectedLength}"`
      );
    });
  });

  describe('rss() call arguments — markdown enclosure', () => {
    beforeEach(() => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
    });

    it('includes a text/markdown enclosure', async () => {
      await callGET();
      expect(capturedRssArgs.items[0].customData).toContain('type="text/markdown"');
    });

    it('markdown enclosure url points to the slug index.md', async () => {
      await callGET('https://example.com/');
      expect(capturedRssArgs.items[0].customData).toContain(
        'url="https://example.com/post-a/index.md"'
      );
    });

    it('markdown enclosure length matches byteLength(post.body)', async () => {
      await callGET();
      const expectedLength = byteLength(fakePostA.body);
      expect(capturedRssArgs.items[0].customData).toContain(
        `type="text/markdown" length="${expectedLength}"`
      );
    });
  });

  describe('rss() call arguments — audio enclosure', () => {
    it('includes an audio/mpeg enclosure when the mp3 exists', async () => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
      await callGET('https://example.com/');
      const cd = capturedRssArgs.items[0].customData;
      expect(cd).toContain('type="audio/mpeg"');
      expect(cd).toContain('url="https://example.com/audio/post-a/index.mp3"');
      expect(cd).toContain(`length="${AUDIO_A_BYTES}"`);
    });

    it('omits the audio enclosure when no mp3 exists for the slug', async () => {
      vi.mocked(getCollection).mockResolvedValue([fakePostB] as any);
      await callGET('https://example.com/');
      expect(capturedRssArgs.items[0].customData).not.toContain('audio/mpeg');
    });

    it('does not carry a custom hash attribute on the audio enclosure', async () => {
      vi.mocked(getCollection).mockResolvedValue([fakePostA] as any);
      await callGET('https://example.com/');
      expect(capturedRssArgs.items[0].customData).not.toContain('hash=');
    });
  });

  describe('draft filtering', () => {
    it('only passes non-draft posts to rss()', async () => {
      vi.mocked(getCollection).mockImplementation(async (_col, filter: any) => {
        const all = [fakePostA, fakePostB, fakeDraftPost] as any[];
        return filter ? all.filter((p: any) => filter(p)) : all;
      });

      await callGET();
      const slugs = capturedRssArgs.items.map((i: any) => i.link);
      expect(slugs).not.toContain('/draft-post/');
      expect(slugs).toContain('/post-a/');
      expect(slugs).toContain('/post-b/');
    });
  });
});
