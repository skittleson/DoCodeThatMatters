import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
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
  }),
});

export const collections = { blog };
