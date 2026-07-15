import { describe, it, expect } from 'vitest';
import { assemblePost } from '../lib/assembler';

describe('assemblePost', () => {
  it('assembles a post with all fields', () => {
    const result = assemblePost({
      title: 'My Post',
      description: 'A summary',
      date: '2026-07-15',
      modified: '2026-07-16',
      image: '/images/test.png',
      alt: 'Test image',
      imageWidth: 800,
      imageHeight: 600,
      keywords: ['hello', 'world'],
      priority: 0.8,
      draft: false,
      body: '# Hello World',
    });
    expect(result).toContain('---');
    expect(result).toContain('title: My Post');
    expect(result).toContain('date: 2026-07-15');
    expect(result).toContain('keywords:');
    expect(result).toContain('- hello');
    expect(result).toContain('---\n# Hello World');
  });

  it('omits optional fields when empty', () => {
    const result = assemblePost({
      title: 'Minimal Post',
      body: '## Content',
    });
    expect(result).toContain('title: Minimal Post');
    expect(result).not.toContain('date:');
    expect(result).not.toContain('keywords:');
    expect(result).toContain('## Content');
  });

  it('escapes title quotes', () => {
    const result = assemblePost({
      title: "It's a test",
      body: '',
    });
    expect(result).toContain("title: \"It's a test\"");
  });
});
