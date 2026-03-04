import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The security.txt handler imports only a type from 'astro' (APIContext), so
 * there is no runtime Astro dependency. We can call the GET function directly.
 *
 * We mock the 'astro' module to satisfy the import without needing the full
 * Astro runtime.
 */
vi.mock('astro', () => ({}));

// Dynamic import after mock setup
const { GET } = await import('../pages/security.txt');

// Minimal stub that satisfies the APIContext type for GET (nothing is used)
const stubContext = {} as Parameters<typeof GET>[0];

describe('security.txt GET handler', () => {
  describe('response metadata', () => {
    it('returns a Response', async () => {
      const res = await GET(stubContext);
      expect(res).toBeInstanceOf(Response);
    });

    it('sets Content-Type to text/plain; charset=utf-8', async () => {
      const res = await GET(stubContext);
      expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });
  });

  describe('response body fields', () => {
    it('contains a Contact field', async () => {
      const text = await (await GET(stubContext)).text();
      expect(text).toMatch(/^Contact:/m);
    });

    it('contains an Expires field', async () => {
      const text = await (await GET(stubContext)).text();
      expect(text).toMatch(/^Expires:/m);
    });

    it('contains a Preferred-Languages field', async () => {
      const text = await (await GET(stubContext)).text();
      expect(text).toMatch(/^Preferred-Languages:/m);
    });

    it('contains a Canonical field', async () => {
      const text = await (await GET(stubContext)).text();
      expect(text).toMatch(/^Canonical:/m);
    });
  });

  describe('Expires date logic', () => {
    it('expires approximately 6 months in the future', async () => {
      const before = Date.now();
      const text = await (await GET(stubContext)).text();
      const after = Date.now();

      const match = text.match(/^Expires:\s*(.+)$/m);
      expect(match).not.toBeNull();

      const expiresDate = new Date(match![1].trim());
      expect(expiresDate.getTime()).toBeGreaterThan(before);

      // Should be roughly 6 months (between 5 and 7 months from now)
      const fiveMonthsMs = 5 * 30 * 24 * 60 * 60 * 1000;
      const sevenMonthsMs = 7 * 30 * 24 * 60 * 60 * 1000;
      const midpoint = (before + after) / 2;
      const diff = expiresDate.getTime() - midpoint;

      expect(diff).toBeGreaterThan(fiveMonthsMs);
      expect(diff).toBeLessThan(sevenMonthsMs);
    });

    it('formats Expires as an ISO string ending in +00:00 (not .000Z)', async () => {
      const text = await (await GET(stubContext)).text();
      const match = text.match(/^Expires:\s*(.+)$/m);
      expect(match).not.toBeNull();

      const expiresStr = match![1].trim();
      // Must end with +00:00
      expect(expiresStr).toMatch(/\+00:00$/);
      // Must NOT contain milliseconds (.000Z form)
      expect(expiresStr).not.toMatch(/\.\d{3}Z/);
    });

    it('Expires date is a valid parseable date', async () => {
      const text = await (await GET(stubContext)).text();
      const match = text.match(/^Expires:\s*(.+)$/m);
      const expiresDate = new Date(match![1].trim());
      expect(isNaN(expiresDate.getTime())).toBe(false);
    });
  });
});
