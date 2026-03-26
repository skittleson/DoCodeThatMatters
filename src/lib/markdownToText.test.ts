import { describe, it, expect } from 'vitest';
import { markdownToText, markdownToTTSPlainText, markdownToPlainText, byteLength } from './markdownToText';

describe('markdownToText', () => {
  describe('links', () => {
    it('converts markdown link to text with url in parens', () => {
      expect(markdownToText('[Click here](https://example.com)')).toBe(
        'Click here (https://example.com)'
      );
    });

    it('handles multiple links in one string', () => {
      const input = 'See [foo](https://foo.com) and [bar](https://bar.com)';
      expect(markdownToText(input)).toBe(
        'See foo (https://foo.com) and bar (https://bar.com)'
      );
    });

    it('leaves link with empty text unchanged (regex requires at least one char in [])', () => {
      // The link regex [([^\]]+)\] requires 1+ chars inside brackets.
      // An empty [](url) is not matched and passes through unchanged.
      expect(markdownToText('[](https://example.com)')).toBe('[](https://example.com)');
    });
  });

  describe('headings', () => {
    it('strips h1', () => expect(markdownToText('# Title')).toBe('Title'));
    it('strips h2', () => expect(markdownToText('## Title')).toBe('Title'));
    it('strips h3', () => expect(markdownToText('### Title')).toBe('Title'));
    it('strips h4', () => expect(markdownToText('#### Title')).toBe('Title'));
    it('strips h5', () => expect(markdownToText('##### Title')).toBe('Title'));
    it('strips h6', () => expect(markdownToText('###### Title')).toBe('Title'));

    it('does not strip # in the middle of a line', () => {
      expect(markdownToText('color #ff0000 is red')).toBe('color #ff0000 is red');
    });
  });

  describe('bold and italic', () => {
    it('strips **bold**', () => expect(markdownToText('**bold**')).toBe('bold'));
    it('strips __bold__', () => expect(markdownToText('__bold__')).toBe('bold'));
    it('strips *italic*', () => expect(markdownToText('*italic*')).toBe('italic'));
    it('strips _italic_', () => expect(markdownToText('_italic_')).toBe('italic'));

    it('strips bold inside a sentence', () => {
      expect(markdownToText('This is **important** text')).toBe(
        'This is important text'
      );
    });

    it('strips italic inside a sentence', () => {
      expect(markdownToText('This is *emphasized* text')).toBe(
        'This is emphasized text'
      );
    });
  });

  describe('list items', () => {
    it('normalizes * list item to -', () => {
      expect(markdownToText('* item')).toBe('- item');
    });

    it('keeps - list item as -', () => {
      expect(markdownToText('- item')).toBe('- item');
    });

    it('normalizes + list item to -', () => {
      expect(markdownToText('+ item')).toBe('- item');
    });

    it('handles multiple list items', () => {
      const input = '* first\n* second\n+ third';
      expect(markdownToText(input)).toBe('- first\n- second\n- third');
    });
  });

  describe('horizontal rules', () => {
    it('removes --- horizontal rule, leaving a blank line in its place', () => {
      // The rule line is replaced with empty string, leaving a blank line between
      // the surrounding lines. The 2-newline threshold is preserved (not collapsed).
      expect(markdownToText('before\n---\nafter')).toBe('before\n\nafter');
    });

    it('*** horizontal rule is NOT removed — interaction bug with italic/list regexes', () => {
      // Step-by-step: bold stripper leaves *** untouched (no content between **)
      // → italic stripper matches ** (empty content) leaving *
      // → list-item regex ^[*-+]\s+ matches *\n (since \s+ includes \n)
      //   and absorbs the newline, collapsing * + \n + "after" into "- after"
      // Net result: the *** and its trailing newline are converted into "- " prefix
      // on the next line. This documents existing behavior.
      expect(markdownToText('before\n***\nafter')).toBe('before\n- after');
    });

    it('removes ___ horizontal rule — NOTE: _ delimiters interact with italic stripper', () => {
      // ___ is processed by the italic stripper (\*|_)(.*?)\1 before the
      // horizontal rule regex. The first and last _ are consumed, leaving a
      // single "_" character. Documents existing behavior.
      expect(markdownToText('before\n___\nafter')).toBe('before\n_\nafter');
    });

    it('removes longer horizontal rule (----), leaving a blank line in its place', () => {
      expect(markdownToText('before\n----\nafter')).toBe('before\n\nafter');
    });
  });

  describe('code blocks', () => {
    it('removes fenced code block, leaving a blank line in its place', () => {
      // The regex replaces the entire ```...``` block with empty string,
      // but leaves the surrounding newlines, resulting in a blank line.
      const input = 'before\n```\nconst x = 1;\n```\nafter';
      expect(markdownToText(input)).toBe('before\n\nafter');
    });

    it('removes fenced code block with language tag, leaving a blank line in its place', () => {
      const input = 'before\n```typescript\nconst x = 1;\n```\nafter';
      expect(markdownToText(input)).toBe('before\n\nafter');
    });

    it('removes inline code including its content', () => {
      expect(markdownToText('Use `npm install` to install')).toBe(
        'Use  to install'
      );
    });

    it('removes multiple inline code spans including their content', () => {
      expect(markdownToText('`foo` and `bar`')).toBe('and');
    });
  });

  describe('blockquotes', () => {
    it('removes blockquote > marker', () => {
      expect(markdownToText('> This is a quote')).toBe('This is a quote');
    });

    it('handles blockquote without trailing space', () => {
      expect(markdownToText('>This is a quote')).toBe('This is a quote');
    });

    it('removes multiple blockquote lines', () => {
      const input = '> line one\n> line two';
      expect(markdownToText(input)).toBe('line one\nline two');
    });
  });

  describe('newline collapsing', () => {
    it('collapses 3 newlines to 1', () => {
      expect(markdownToText('a\n\n\nb')).toBe('a\nb');
    });

    it('collapses 5 newlines to 1', () => {
      expect(markdownToText('a\n\n\n\n\nb')).toBe('a\nb');
    });

    it('preserves exactly 2 consecutive newlines', () => {
      expect(markdownToText('a\n\nb')).toBe('a\n\nb');
    });
  });

  describe('trim', () => {
    it('trims leading whitespace', () => {
      expect(markdownToText('   hello')).toBe('hello');
    });

    it('trims trailing whitespace', () => {
      expect(markdownToText('hello   ')).toBe('hello');
    });

    it('trims leading and trailing newlines', () => {
      expect(markdownToText('\nhello\n')).toBe('hello');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(markdownToText('')).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(markdownToText('   ')).toBe('');
    });

    it('passes through plain text unchanged', () => {
      expect(markdownToText('Just plain text.')).toBe('Just plain text.');
    });

    it('handles a realistic multi-element markdown snippet', () => {
      const input = `## Introduction

This is a **blog post** about _testing_.

- Item one
- Item two

\`\`\`
const x = 1;
\`\`\`

> A wise quote.

See [the docs](https://example.com) for more.`;

      const result = markdownToText(input);
      expect(result).toContain('Introduction');
      expect(result).toContain('blog post');
      expect(result).toContain('testing');
      expect(result).toContain('- Item one');
      expect(result).not.toContain('```');
      expect(result).not.toContain('**');
      expect(result).not.toContain('_testing_');
      expect(result).not.toContain('const x');
      expect(result).toContain('A wise quote.');
      expect(result).toContain('the docs (https://example.com)');
    });
  });
});

describe('markdownToTTSPlainText', () => {
  describe('code blocks', () => {
    it('removes fenced code block entirely', () => {
      const input = 'before\n```\nconst x = 1;\n```\nafter';
      expect(markdownToTTSPlainText(input)).toBe('before\n\nafter');
    });

    it('removes fenced code block with language tag', () => {
      const input = 'before\n```typescript\nconst x = 1;\n```\nafter';
      expect(markdownToTTSPlainText(input)).toBe('before\n\nafter');
    });

    it('keeps inline code text, strips backticks', () => {
      expect(markdownToTTSPlainText('Run `PowerOnState 0` to set state')).toBe(
        'Run PowerOnState 0 to set state'
      );
    });

    it('keeps multiple inline code spans', () => {
      expect(markdownToTTSPlainText('Set `Timezone -8` and run `time`')).toBe(
        'Set Timezone -8 and run time'
      );
    });

    it('inline code in a list item keeps text', () => {
      expect(markdownToTTSPlainText('- Run `STATUS 7` to check status')).toBe(
        '- Run STATUS 7 to check status'
      );
    });
  });

  describe('prose rules work the same as markdownToText', () => {
    it('strips headings', () => {
      expect(markdownToTTSPlainText('## Setup Time')).toBe('Setup Time');
    });

    it('strips bold', () => {
      expect(markdownToTTSPlainText('**important**')).toBe('important');
    });

    it('converts links', () => {
      expect(markdownToTTSPlainText('[docs](https://example.com)')).toBe(
        'docs (https://example.com)'
      );
    });

    it('normalizes list items', () => {
      expect(markdownToTTSPlainText('* item')).toBe('- item');
    });

    it('removes blockquote markers', () => {
      expect(markdownToTTSPlainText('> A quote')).toBe('A quote');
    });
  });
});

describe('markdownToPlainText', () => {
  describe('code blocks', () => {
    it('strips fenced code markers but keeps code content', () => {
      const input = 'before\n```\nconst x = 1;\n```\nafter';
      expect(markdownToPlainText(input)).toBe('before\nconst x = 1;\n\nafter');
    });

    it('strips fenced code markers with language tag but keeps code content', () => {
      const input = 'before\n```typescript\nconst x = 1;\n```\nafter';
      expect(markdownToPlainText(input)).toBe('before\nconst x = 1;\n\nafter');
    });

    it('strips fenced code markers for multi-line code block', () => {
      const input = 'before\n```\nline one\nline two\n```\nafter';
      expect(markdownToPlainText(input)).toBe('before\nline one\nline two\n\nafter');
    });

    it('keeps inline code text, strips backticks', () => {
      expect(markdownToPlainText('Use `npm install` to install')).toBe(
        'Use npm install to install'
      );
    });

    it('keeps multiple inline code spans', () => {
      expect(markdownToPlainText('Set `Timezone -8` and run `time`')).toBe(
        'Set Timezone -8 and run time'
      );
    });

    it('inline code in a list item keeps text and command', () => {
      expect(markdownToPlainText('- Run `STATUS 7` to check status')).toBe(
        '- Run STATUS 7 to check status'
      );
    });
  });

  describe('prose rules work the same as markdownToText', () => {
    it('strips headings', () => {
      expect(markdownToPlainText('## Setup Time')).toBe('Setup Time');
    });

    it('strips bold', () => {
      expect(markdownToPlainText('**important**')).toBe('important');
    });

    it('converts links', () => {
      expect(markdownToPlainText('[docs](https://example.com)')).toBe(
        'docs (https://example.com)'
      );
    });

    it('normalizes list items', () => {
      expect(markdownToPlainText('* item')).toBe('- item');
    });

    it('removes blockquote markers', () => {
      expect(markdownToPlainText('> A quote')).toBe('A quote');
    });
  });
});

describe('byteLength', () => {
  it('returns 0 for empty string', () => {
    expect(byteLength('')).toBe(0);
  });

  it('returns correct length for ASCII string', () => {
    expect(byteLength('hello')).toBe(5);
  });

  it('returns correct length for string with spaces', () => {
    expect(byteLength('hello world')).toBe(11);
  });

  it('counts multi-byte UTF-8 characters correctly', () => {
    // é is 2 bytes in UTF-8
    expect(byteLength('café')).toBe(5);
  });

  it('counts emoji (4-byte UTF-8) correctly', () => {
    // 🚀 is 4 bytes in UTF-8
    expect(byteLength('🚀')).toBe(4);
  });

  it('counts a string with mixed ASCII and multi-byte chars', () => {
    // "日" is 3 bytes, "本" is 3 bytes, "語" is 3 bytes = 9 bytes
    expect(byteLength('日本語')).toBe(9);
  });

  it('returns the same length as TextEncoder for a longer string', () => {
    const str = 'The quick brown fox jumps over the lazy dog';
    expect(byteLength(str)).toBe(new TextEncoder().encode(str).length);
  });
});
