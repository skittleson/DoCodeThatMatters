import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Mirror of the blog collection schema from config.ts.
 * Tested standalone (no Astro runtime) because defineCollection/getCollection
 * are only available inside the Astro build pipeline.
 */
const blogSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  modified: z.coerce.date().optional(),
  image: z.string().optional(),
  alt: z.string().optional(),
  imageWidth: z.number().optional(),
  imageHeight: z.number().optional(),
  keywords: z.array(z.string()).min(1).optional(),
  priority: z.number().optional(),
  draft: z.boolean().optional().default(false),
});

type BlogData = z.infer<typeof blogSchema>;

const validPost: BlogData = {
  title: 'A Valid Blog Post Title',
  description: 'Some description',
  date: new Date('2024-01-01'),
  keywords: ['typescript', 'testing'],
  draft: false,
};

describe('blog content schema', () => {
  describe('valid data', () => {
    it('accepts a fully populated post', () => {
      const result = blogSchema.safeParse({
        title: 'A Valid Blog Post Title',
        description: 'Some description',
        date: '2024-01-01',
        modified: '2024-06-01',
        image: '/images/post.jpg',
        alt: 'A descriptive alt text',
        imageWidth: 800,
        imageHeight: 600,
        keywords: ['typescript', 'testing'],
        priority: 0.8,
        draft: false,
      });
      expect(result.success).toBe(true);
    });

    it('accepts a minimal post with only title', () => {
      const result = blogSchema.safeParse({ title: 'Short title here' });
      expect(result.success).toBe(true);
    });

    it('defaults draft to false when omitted', () => {
      const result = blogSchema.safeParse({ title: 'A post without draft field' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.draft).toBe(false);
      }
    });

    it('accepts draft: true', () => {
      const result = blogSchema.safeParse({ title: 'A draft post here!', draft: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.draft).toBe(true);
      }
    });
  });

  describe('title validation', () => {
    it('rejects title shorter than 5 characters', () => {
      const result = blogSchema.safeParse({ ...validPost, title: 'Hi' });
      expect(result.success).toBe(false);
    });

    it('accepts title of exactly 5 characters', () => {
      const result = blogSchema.safeParse({ ...validPost, title: 'Hello' });
      expect(result.success).toBe(true);
    });

    it('accepts title of exactly 100 characters', () => {
      const result = blogSchema.safeParse({ ...validPost, title: 'A'.repeat(100) });
      expect(result.success).toBe(true);
    });

    it('rejects title longer than 100 characters', () => {
      const result = blogSchema.safeParse({ ...validPost, title: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('rejects missing title', () => {
      const { title: _, ...withoutTitle } = validPost;
      const result = blogSchema.safeParse(withoutTitle);
      expect(result.success).toBe(false);
    });
  });

  describe('date coercion', () => {
    it('coerces a date string to a Date object', () => {
      const result = blogSchema.safeParse({ ...validPost, date: '2024-03-15' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
        expect(result.data.date?.getFullYear()).toBe(2024);
      }
    });

    it('coerces modified date string to a Date object', () => {
      const result = blogSchema.safeParse({ ...validPost, modified: '2024-09-01' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.modified).toBeInstanceOf(Date);
      }
    });

    it('accepts an already-constructed Date for date', () => {
      const result = blogSchema.safeParse({ ...validPost, date: new Date('2024-01-01') });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date);
      }
    });
  });

  describe('keywords validation', () => {
    it('rejects an empty keywords array', () => {
      const result = blogSchema.safeParse({ ...validPost, keywords: [] });
      expect(result.success).toBe(false);
    });

    it('accepts keywords with one element', () => {
      const result = blogSchema.safeParse({ ...validPost, keywords: ['typescript'] });
      expect(result.success).toBe(true);
    });

    it('accepts keywords with multiple elements', () => {
      const result = blogSchema.safeParse({
        ...validPost,
        keywords: ['typescript', 'vitest', 'testing'],
      });
      expect(result.success).toBe(true);
    });

    it('allows keywords to be omitted entirely', () => {
      const { keywords: _, ...withoutKeywords } = validPost;
      const result = blogSchema.safeParse(withoutKeywords);
      expect(result.success).toBe(true);
    });
  });

  describe('optional numeric fields', () => {
    it('accepts valid imageWidth and imageHeight', () => {
      const result = blogSchema.safeParse({
        ...validPost,
        imageWidth: 1200,
        imageHeight: 630,
      });
      expect(result.success).toBe(true);
    });

    it('accepts a decimal priority value', () => {
      const result = blogSchema.safeParse({ ...validPost, priority: 0.5 });
      expect(result.success).toBe(true);
    });

    it('rejects a string where imageWidth is expected', () => {
      const result = blogSchema.safeParse({ ...validPost, imageWidth: 'wide' });
      expect(result.success).toBe(false);
    });
  });
});
