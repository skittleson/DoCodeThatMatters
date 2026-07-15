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
