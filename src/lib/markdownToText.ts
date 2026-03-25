/**
 * Converts a markdown string to plain text.
 * Matches the formatting rules used for index.txt generation.
 */
export function markdownToText(body: string): string {
  let text = body;

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

  // Remove code fences
  text = text.replace(/^```[\s\S]*?```/gm, '');

  // Remove inline code (strip both backticks and content — not useful for TTS)
  text = text.replace(/`[^`]+`/g, '');

  // Remove blockquote markers
  text = text.replace(/^>\s*/gm, '');

  // Collapse 3+ consecutive newlines to a single newline
  text = text.replace(/\n{3,}/g, '\n');

  return text.trim();
}

/**
 * Returns the UTF-8 byte length of a string.
 */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
