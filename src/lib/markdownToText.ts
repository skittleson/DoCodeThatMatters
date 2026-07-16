/**
 * Shared prose transformations applied by all three converters.
 * Does not touch code fences or inline code — each converter handles those differently.
 */
function _applyProseRules(text: string): string {
  // Convert markdown links [text](url) -> text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // Convert headings (## Heading -> Heading)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Convert bold/italic (**text**, *text*, __text__, _text_)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Convert list items (* item or - item) -> - item (normalize to dash)
  text = text.replace(/^[\*\-\+]\s+/gm, '- ');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove blockquote markers
  text = text.replace(/^>\s*/gm, '');

  // Collapse 3+ consecutive newlines to a single newline
  text = text.replace(/\n{3,}/g, '\n');

  return text;
}

/**
 * Converts a markdown string to plain text.
 * Matches the formatting rules used for index.txt generation.
 * - Fenced code blocks: removed entirely
 * - Inline code: backticks and content removed
 */
export function markdownToText(body: string): string {
  let text = body;

  // Remove code fences (including content)
  text = text.replace(/^```[\s\S]*?```/gm, '');

  // Remove inline code (strip both backticks and content — not useful for TTS)
  text = text.replace(/`[^`]+`/g, '');

  text = _applyProseRules(text);

  return text.trim();
}

/**
 * Converts a markdown string to TTS-optimised plain text for audio generation.
 * - Fenced code blocks: removed entirely (robot shouldn't read raw code dumps)
 * - Inline code: backticks stripped, text content kept (e.g. `PowerOnState 0` → PowerOnState 0)
 * - All other prose rules identical to markdownToText
 */
export function markdownToTTSPlainText(body: string): string {
  let text = body;

  // Remove fenced code blocks entirely (content not useful for TTS)
  text = text.replace(/^```[\s\S]*?```/gm, '');

  // Strip backticks from inline code but keep the inner text
  text = text.replace(/`([^`]+)`/g, '$1');

  text = _applyProseRules(text);

  return text.trim();
}

/**
 * Converts a markdown string to human-readable plain text for index.txt.
 * - Fenced code blocks: fence markers removed, code content preserved as-is
 * - Inline code: backticks stripped, text content kept
 * - All other prose rules identical to markdownToText
 */
export function markdownToPlainText(body: string): string {
  let text = body;

  // Strip fenced code block markers but keep the code content
  text = text.replace(/^```[^\n]*\n([\s\S]*?)```/gm, '$1');

  // Strip backticks from inline code but keep the inner text
  text = text.replace(/`([^`]+)`/g, '$1');

  text = _applyProseRules(text);

  return text.trim();
}

/**
 * Returns the UTF-8 byte length of a string.
 */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Strips the file extension from a content collection entry id.
 * In Astro v7, the built-in glob loader includes the extension in the id
 * (e.g. "small-home-automations.md" instead of "small-home-automations").
 */
export function stripExt(id: string): string {
  const dotIndex = id.lastIndexOf('.');
  return dotIndex > 0 ? id.slice(0, dotIndex) : id;
}

/**
 * Describes an audio enclosure for a post's RSS <item>.
 * `length` is the mp3's byte size (per the RSS spec's enclosure/@length).
 * `path` is the site-relative URL path to the mp3.
 */
export interface AudioEnclosure {
  path: string;
  length: number;
}

/**
 * Look up the TTS audio file for a post slug and return its enclosure info,
 * or null if no audio exists for that slug.
 *
 * Audio is generated into `public/audio/<slug>/index.mp3` (committed to git),
 * which Astro copies to `<outDir>/audio/<slug>/index.mp3` at build time, so the
 * site-relative URL `/audio/<slug>/index.mp3` resolves in the built output.
 *
 * `statSize` is injected for testability; it defaults to a real filesystem stat
 * that returns the file's byte size, or null when the file is absent.
 */
export function audioEnclosureFor(
  slug: string,
  statSize: (slug: string) => number | null = _defaultAudioSize
): AudioEnclosure | null {
  const length = statSize(slug);
  if (length === null || length <= 0) return null;
  return { path: `/audio/${slug}/index.mp3`, length };
}

/**
 * Default `statSize` for {@link audioEnclosureFor}: returns the byte size of
 * `public/audio/<slug>/index.mp3` relative to the project root, or null if the
 * file does not exist. Isolated here so the pure logic above stays testable
 * without touching disk.
 */
function _defaultAudioSize(slug: string): number | null {
  // Lazy, node-only imports — this runs at build time in the Astro endpoint.
  const { statSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const mp3Path = join(process.cwd(), 'public', 'audio', slug, 'index.mp3');
  try {
    return statSync(mp3Path).size;
  } catch {
    return null;
  }
}
