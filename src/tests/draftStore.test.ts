import { describe, it, expect } from 'vitest';
import {
  draftKey,
  saveDraft,
  loadDraft,
  clearDraft,
  formatRelativeTime,
  type DraftStorage,
} from '../lib/editHelpers';

// A minimal in-memory storage that satisfies the injectable DraftStorage shape.
function makeStorage(initial: Record<string, string> = {}): DraftStorage & {
  _store: Map<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    _store: store,
  };
}

const sampleData = {
  title: 'ASP.NET XSS Protection',
  description: 'A short summary',
  date: '2024-01-01',
  modified: '2024-06-01',
  image: '/images/xss.png',
  alt: 'xss',
  imageWidth: '800',
  imageHeight: '600',
  keywords: 'security, aspnet',
  priority: '0.5',
  draft: false,
  body: '# Hello world',
};

describe('draftKey', () => {
  it('prefixes the slug with gh_blog_draft_', () => {
    expect(draftKey('asp-net-xss-protection')).toBe(
      'gh_blog_draft_asp-net-xss-protection',
    );
  });

  it('uses the stable "new" key when the slug is empty', () => {
    expect(draftKey('')).toBe('gh_blog_draft_new');
  });

  it('uses the "new" key when the slug is only whitespace', () => {
    expect(draftKey('   ')).toBe('gh_blog_draft_new');
  });
});

describe('saveDraft / loadDraft round-trip', () => {
  it('persists all fields plus a savedAt timestamp', () => {
    const storage = makeStorage();
    saveDraft('asp-net-xss-protection', sampleData, storage);

    const loaded = loadDraft('asp-net-xss-protection', storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe(sampleData.title);
    expect(loaded!.body).toBe(sampleData.body);
    expect(loaded!.keywords).toBe(sampleData.keywords);
    expect(loaded!.draft).toBe(false);
    // savedAt is an ISO-8601 timestamp string.
    expect(typeof loaded!.savedAt).toBe('string');
    expect(Number.isNaN(Date.parse(loaded!.savedAt))).toBe(false);
  });

  it('writes under the draftKey-derived storage key', () => {
    const storage = makeStorage();
    saveDraft('asp-net-xss-protection', sampleData, storage);
    expect(storage._store.has('gh_blog_draft_asp-net-xss-protection')).toBe(true);
  });

  it('stores a new-post draft under the "new" key', () => {
    const storage = makeStorage();
    saveDraft('', sampleData, storage);
    expect(storage._store.has('gh_blog_draft_new')).toBe(true);
    const loaded = loadDraft('', storage);
    expect(loaded!.title).toBe(sampleData.title);
  });

  it('does not persist savedAt from the input data (always fresh)', () => {
    const storage = makeStorage();
    saveDraft('slug', { ...sampleData, savedAt: 'bogus' }, storage);
    const loaded = loadDraft('slug', storage);
    expect(loaded!.savedAt).not.toBe('bogus');
    expect(Number.isNaN(Date.parse(loaded!.savedAt))).toBe(false);
  });
});

describe('loadDraft edge cases', () => {
  it('returns null when no draft exists', () => {
    const storage = makeStorage();
    expect(loadDraft('missing', storage)).toBeNull();
  });

  it('returns null when the stored JSON is invalid', () => {
    const storage = makeStorage({
      'gh_blog_draft_broken': '{not valid json',
    });
    expect(loadDraft('broken', storage)).toBeNull();
  });

  it('returns null when the stored value is a JSON primitive, not an object', () => {
    const storage = makeStorage({ 'gh_blog_draft_prim': '"just a string"' });
    expect(loadDraft('prim', storage)).toBeNull();
  });
});

describe('clearDraft', () => {
  it('removes a saved draft', () => {
    const storage = makeStorage();
    saveDraft('slug', sampleData, storage);
    expect(loadDraft('slug', storage)).not.toBeNull();

    clearDraft('slug', storage);
    expect(loadDraft('slug', storage)).toBeNull();
    expect(storage._store.has('gh_blog_draft_slug')).toBe(false);
  });

  it('is a no-op when nothing is stored', () => {
    const storage = makeStorage();
    expect(() => clearDraft('slug', storage)).not.toThrow();
  });
});

describe('save/load/clear resilience (private mode / quota)', () => {
  it('saveDraft swallows storage errors', () => {
    const throwing: DraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(() => saveDraft('slug', sampleData, throwing)).not.toThrow();
  });

  it('loadDraft returns null when storage throws', () => {
    const throwing: DraftStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadDraft('slug', throwing)).toBeNull();
  });

  it('clearDraft swallows storage errors', () => {
    const throwing: DraftStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(() => clearDraft('slug', throwing)).not.toThrow();
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2024-06-01T12:00:00.000Z');

  it('reports "just now" for very recent timestamps', () => {
    const iso = new Date(now.getTime() - 5_000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe('just now');
  });

  it('reports minutes (singular)', () => {
    const iso = new Date(now.getTime() - 60_000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe('1 minute ago');
  });

  it('reports minutes (plural)', () => {
    const iso = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe('5 minutes ago');
  });

  it('reports hours', () => {
    const iso = new Date(now.getTime() - 3 * 3_600_000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe('3 hours ago');
  });

  it('reports days', () => {
    const iso = new Date(now.getTime() - 2 * 86_400_000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe('2 days ago');
  });

  it('returns a fallback for invalid timestamps', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('unknown time');
  });
});
