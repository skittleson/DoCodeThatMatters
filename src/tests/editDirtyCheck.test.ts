import { describe, it, expect } from 'vitest';
import {
  METADATA_FIELD_IDS,
  captureSnapshot,
  isDirty,
  assemblePostData,
  type FieldSnapshot,
} from '../lib/editHelpers';

describe('isDirty (dirty-check logic)', () => {
  it('returns false when no fields have changed', () => {
    const values: FieldSnapshot = {
      title: 'Hello', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: false,
    };
    const snap = captureSnapshot(values, 'Hello body');
    expect(isDirty(values, 'Hello body', snap)).toBe(false);
  });

  it('returns true when title is changed', () => {
    const values: FieldSnapshot = {
      title: 'World', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: false,
    };
    const snap: FieldSnapshot = {
      title: 'Hello', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: false,
      body: 'Hello body',
    };
    expect(isDirty(values, 'Hello body', snap)).toBe(true);
  });

  it('returns true when body is changed', () => {
    const values: FieldSnapshot = {
      title: 'Hello', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: false,
    };
    const snap: FieldSnapshot = {
      title: 'Hello', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: false,
      body: 'Original body',
    };
    expect(isDirty(values, 'Changed body', snap)).toBe(true);
  });

  it('returns true when checkbox is toggled', () => {
    const values: FieldSnapshot = {
      title: 'Hello', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: true,
    };
    const snap: FieldSnapshot = {
      title: 'Hello', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: false,
      body: 'Hello body',
    };
    expect(isDirty(values, 'Hello body', snap)).toBe(true);
  });

  it('returns true when any metadata field is changed', () => {
    const values: FieldSnapshot = {
      title: 'Hello', description: 'desc', date: '2024-01-01', modified: '2024-06-01',
      image: '/other.png', alt: 'alt', imageWidth: '800', imageHeight: '600',
      keywords: 'a, b', priority: '0.5', draft: false,
    };
    const snap: FieldSnapshot = {
      title: 'Hello', description: 'desc', date: '2024-01-01', modified: '2024-06-01',
      image: '/img.png', alt: 'alt', imageWidth: '800', imageHeight: '600',
      keywords: 'a, b', priority: '0.5', draft: false,
      body: 'Hello body',
    };
    expect(isDirty(values, 'Hello body', snap)).toBe(true);
  });

  it('returns false when all metadata fields are unchanged', () => {
    const values: FieldSnapshot = {
      title: 'Hello', description: 'desc', date: '2024-01-01', modified: '2024-06-01',
      image: '/img.png', alt: 'alt', imageWidth: '800', imageHeight: '600',
      keywords: 'a, b', priority: '0.5', draft: false,
    };
    const snap: FieldSnapshot = {
      title: 'Hello', description: 'desc', date: '2024-01-01', modified: '2024-06-01',
      image: '/img.png', alt: 'alt', imageWidth: '800', imageHeight: '600',
      keywords: 'a, b', priority: '0.5', draft: false,
      body: 'Hello body',
    };
    expect(isDirty(values, 'Hello body', snap)).toBe(false);
  });
});

describe('captureSnapshot', () => {
  it('captures all 11 metadata field IDs plus body', () => {
    const values: FieldSnapshot = {
      title: 'Hi',
      description: 'd',
      date: '2024-01-01',
      modified: '2024-06-01',
      image: '/i.png',
      alt: 'a',
      imageWidth: '800',
      imageHeight: '600',
      keywords: 'k',
      priority: '0.5',
      draft: true,
    };
    const snap = captureSnapshot(values, 'body text');
    expect(snap.title).toBe('Hi');
    expect(snap.description).toBe('d');
    expect(snap.date).toBe('2024-01-01');
    expect(snap.modified).toBe('2024-06-01');
    expect(snap.image).toBe('/i.png');
    expect(snap.alt).toBe('a');
    expect(snap.imageWidth).toBe('800');
    expect(snap.imageHeight).toBe('600');
    expect(snap.keywords).toBe('k');
    expect(snap.priority).toBe('0.5');
    expect(snap.draft).toBe(true);
    expect(snap.body).toBe('body text');
  });

  it('snapshot has exactly 12 keys (11 metadata + body)', () => {
    const values: FieldSnapshot = {
      title: 'Hi', description: '', date: '', modified: '',
      image: '', alt: '', imageWidth: '', imageHeight: '',
      keywords: '', priority: '', draft: false,
    };
    const snap = captureSnapshot(values, 'body');
    expect(Object.keys(snap)).toHaveLength(12);
  });
});


describe('assemblePostData (save behavior)', () => {
  it('assembles all fields correctly from input values', () => {
    const data = assemblePostData(
      '  Hello World  ', '  desc  ', '2024-01-01', '2024-06-01',
      '  /img.png  ', '  alt  ', '800', '600',
      'a, b, c  ', '0.5', true, '# Hello',
    );
    expect(data.title).toBe('Hello World');
    expect(data.description).toBe('desc');
    expect(data.date).toBe('2024-01-01');
    expect(data.modified).toBe('2024-06-01');
    expect(data.image).toBe('/img.png');
    expect(data.alt).toBe('alt');
    expect(data.imageWidth).toBe(800);
    expect(data.imageHeight).toBe(600);
    expect(data.keywords).toEqual(['a', 'b', 'c']);
    expect(data.priority).toBe(0.5);
    expect(data.draft).toBe(true);
    expect(data.body).toBe('# Hello');
  });

  it('reads body from bodyValue parameter (easyMDE.value equivalent)', () => {
    const data = assemblePostData(
      'Title', '', '', '', '', '', '', '', '', '', false, 'Markdown body content',
    );
    expect(data.body).toBe('Markdown body content');
  });

  it('omits empty optional fields', () => {
    const data = assemblePostData(
      'Hello', '', '', '', '', '', '', '', '', '', false, 'body',
    );
    expect(data.description).toBeUndefined();
    expect(data.date).toBeUndefined();
    expect(data.modified).toBeUndefined();
    expect(data.image).toBeUndefined();
    expect(data.alt).toBeUndefined();
    expect(data.imageWidth).toBeUndefined();
    expect(data.imageHeight).toBeUndefined();
    expect(data.keywords).toBeUndefined();
    expect(data.priority).toBeUndefined();
    expect(data.draft).toBe(false);
  });
});

describe('METADATA_FIELD_IDS', () => {
  it('lists all expected field IDs (no slug — slug is derived from title)', () => {
    expect(METADATA_FIELD_IDS).toContain('title');
    expect(METADATA_FIELD_IDS).not.toContain('slug');
    expect(METADATA_FIELD_IDS).toContain('description');
    expect(METADATA_FIELD_IDS).toContain('date');
    expect(METADATA_FIELD_IDS).toContain('modified');
    expect(METADATA_FIELD_IDS).toContain('image');
    expect(METADATA_FIELD_IDS).toContain('alt');
    expect(METADATA_FIELD_IDS).toContain('imageWidth');
    expect(METADATA_FIELD_IDS).toContain('imageHeight');
    expect(METADATA_FIELD_IDS).toContain('keywords');
    expect(METADATA_FIELD_IDS).toContain('priority');
    expect(METADATA_FIELD_IDS).toContain('draft');
    expect(METADATA_FIELD_IDS).toHaveLength(11);
  });
});
