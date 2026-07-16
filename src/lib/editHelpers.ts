import type { PostFormData } from './assembler';

export const METADATA_FIELD_IDS = [
  'title', 'description', 'date', 'modified', 'image',
  'alt', 'imageWidth', 'imageHeight', 'keywords',
  'priority', 'draft',
] as const;

export interface FieldSnapshot {
  [id: string]: unknown;
}

// Pure-logic version: accepts a snapshot object of field values.
// Used for testing and as the core comparison engine.
export function captureSnapshot(
  values: FieldSnapshot,
  bodyValue: string,
): FieldSnapshot {
  const snapshot: FieldSnapshot = { ...values };
  snapshot.body = bodyValue;
  return snapshot;
}

// Pure-logic version: compares current values against the snapshot.
export function isDirty(
  values: FieldSnapshot,
  bodyValue: string,
  originalValues: FieldSnapshot,
): boolean {
  for (const key of Object.keys(originalValues)) {
    if (key === 'body') continue;
    if (values[key] !== originalValues[key]) return true;
  }
  if (bodyValue !== originalValues.body) return true;
  return false;
}

// DOM-based wrappers used by edit.astro
export function captureOriginalValues(
  trackedFields: { id: string; type: string }[],
  bodyValue: string,
  document: Document,
): FieldSnapshot {
  const snapshot: FieldSnapshot = {};
  for (const f of trackedFields) {
    const el = document.getElementById(f.id);
    if (!el) continue;
    if (f.type === 'checkbox') {
      snapshot[f.id] = (el as HTMLInputElement).checked;
    } else {
      snapshot[f.id] = (el as HTMLInputElement | HTMLTextAreaElement).value;
    }
  }
  snapshot.body = bodyValue;
  return snapshot;
}

export function isFormDirty(
  trackedFields: { id: string; type: string }[],
  bodyValue: string,
  originalValues: FieldSnapshot,
  document: Document,
): boolean {
  for (const f of trackedFields) {
    const el = document.getElementById(f.id);
    if (!el) continue;
    let current: unknown;
    if (f.type === 'checkbox') {
      current = (el as HTMLInputElement).checked;
    } else {
      current = (el as HTMLInputElement | HTMLTextAreaElement).value;
    }
    if (current !== originalValues[f.id]) return true;
  }
  if (bodyValue !== originalValues.body) return true;
  return false;
}

export function parseFrontmatter(
  content: string,
  allowEmpty = false,
): { date: Date; modified?: Date; raw: Record<string, string> } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch && !allowEmpty) throw new Error('No frontmatter found');
  const fm = fmMatch ? fmMatch[1] : '';
  const raw: Record<string, string> = {};
  const dateLine = fm.match(/^date:\s*(.+)$/m);
  const modifiedLine = fm.match(/^modified:\s*(.+)$/m);
  if (fm) {
    for (const line of fm.split('\n')) {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (key) raw[key.trim()] = value;
    }
  }
  return {
    date: new Date(dateLine ? dateLine[1].trim() : '1970-01-01'),
    modified: modifiedLine ? new Date(modifiedLine[1].trim()) : undefined,
    raw,
  };
}

// Re-exported alias for backwards compatibility.
export const parseFrontmatterLenient = (content: string) => parseFrontmatter(content, true);

export function sortPostsByDate(
  posts: { modified?: Date | null; date: Date | null }[],
): typeof posts {
  return [...posts].sort(
    (a, b) =>
      (b.modified?.valueOf() ?? b.date?.valueOf() ?? 0) -
      (a.modified?.valueOf() ?? a.date?.valueOf() ?? 0),
  );
}

// ---------------------------------------------------------------------------
// Draft auto-save (localStorage) helpers
//
// These back the "restore unsaved draft" feature on the edit page. They accept
// an injectable storage object so they're unit-testable in Node/vitest, and
// fall back to the real `localStorage` global in the browser. Every access is
// wrapped in try/catch because localStorage can throw in private-browsing mode
// or when the quota is exhausted.
// ---------------------------------------------------------------------------

const DRAFT_KEY_PREFIX = 'gh_blog_draft_';

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredDraft {
  [key: string]: unknown;
  body: string;
  savedAt: string;
}

// Resolve the storage backend: an explicitly injected one (tests) or the real
// browser localStorage. Returns null when neither is available (e.g. SSR/Node
// without an injected mock) so callers degrade gracefully.
function resolveStorage(storage?: DraftStorage): DraftStorage | null {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage as DraftStorage;
  return null;
}

// localStorage key for a post's draft. Uses the stable "new" bucket when the
// slug is empty/whitespace so unsaved new posts get their own draft.
export function draftKey(slug: string): string {
  const trimmed = (slug ?? '').trim();
  return `${DRAFT_KEY_PREFIX}${trimmed || 'new'}`;
}

// Persist the current form state as a draft. A fresh `savedAt` ISO timestamp is
// always stamped on write (any incoming savedAt is overwritten).
export function saveDraft(
  slug: string,
  data: Record<string, unknown>,
  storage?: DraftStorage,
): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    const payload: StoredDraft = {
      ...data,
      body: typeof data.body === 'string' ? data.body : '',
      savedAt: new Date().toISOString(),
    };
    store.setItem(draftKey(slug), JSON.stringify(payload));
  } catch {
    // Private mode / quota exceeded — dropping the draft is acceptable.
  }
}

// Read and parse a stored draft. Returns null when absent or malformed.
export function loadDraft(
  slug: string,
  storage?: DraftStorage,
): StoredDraft | null {
  const store = resolveStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(draftKey(slug));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as StoredDraft;
  } catch {
    return null;
  }
}

// Remove a stored draft (used on save, cancel, and explicit discard).
export function clearDraft(slug: string, storage?: DraftStorage): void {
  const store = resolveStorage(storage);
  if (!store) return;
  try {
    store.removeItem(draftKey(slug));
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

// Human-friendly "time ago" string for the restore banner. `now` is injectable
// for deterministic tests.
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'unknown time';
  const diffSec = Math.round((now.getTime() - then) / 1000);
  if (diffSec < 45) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

export function assemblePostData(
  title: string,
  description: string,
  dateVal: string,
  modifiedVal: string,
  image: string,
  alt: string,
  imageWidth: string,
  imageHeight: string,
  keywords: string,
  priority: string,
  draftChecked: boolean,
  bodyValue: string,
): PostFormData {
  return {
    title: title.trim(),
    description: description.trim() || undefined,
    date: dateVal || undefined,
    modified: modifiedVal || undefined,
    image: image.trim() || undefined,
    alt: alt.trim() || undefined,
    imageWidth: imageWidth ? parseInt(imageWidth) : undefined,
    imageHeight: imageHeight ? parseInt(imageHeight) : undefined,
    keywords: keywords ? keywords.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    priority: priority ? parseFloat(priority) : undefined,
    draft: draftChecked,
    body: bodyValue,
  };
}
