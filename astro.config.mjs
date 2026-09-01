// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { EnumChangefreq } from 'sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { unified } from '@astrojs/markdown-remark';
import rehypePictureWebp from './src/plugins/rehype-picture-webp.mjs';
import rehypeMermaid from 'rehype-mermaid';
import remarkMermaidFence from './src/plugins/remark-mermaid-fence.mjs';
import rehypeMermaidRaw from './src/plugins/rehype-mermaid-raw.mjs';
import matter from 'gray-matter';
import { slugFromUrl, lastmodForSlug } from './src/lib/sitemap-lastmod.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const oneDarkProAccessible = JSON.parse(
  readFileSync(join(__dirname, 'src/styles/one-dark-pro-accessible.json'), 'utf-8')
);

const BLOG_DIR = join(__dirname, 'src/content/blog');
const postDateMap = new Map();
for (const file of readdirSync(BLOG_DIR)) {
  if (!file.endsWith('.md')) continue;
  const slug = file.replace(/\.md$/, '');
  const { data } = matter(readFileSync(join(BLOG_DIR, file), 'utf-8'));
  postDateMap.set(slug, {
    date: data.date ? new Date(data.date) : undefined,
    modified: data.modified ? new Date(data.modified) : undefined,
  });
}

export default defineConfig({
  site: 'https://docodethatmatters.com',
  outDir: 'docs',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/offline/') &&
        !page.includes('/admin/') &&
        !page.includes('/edit/'),
      serialize: async (item) => {
        const url = new URL(item.url);
        if (url.pathname === '/') {
          item.changefreq = EnumChangefreq.DAILY;
          item.priority = 1.0;
        } else if (/^\/blog\//.test(url.pathname) || /^\/about\//.test(url.pathname)) {
          item.changefreq = EnumChangefreq.MONTHLY;
          item.priority = 0.5;
        } else {
          // individual blog posts (slug pages)
          item.changefreq = EnumChangefreq.WEEKLY;
          item.priority = 0.9;
        }
        const slug = slugFromUrl(item.url);
        if (slug && postDateMap) {
          const lastmod = lastmodForSlug(slug, postDateMap);
          if (lastmod) {
            item.lastmod = lastmod.toISOString();
          }
        }
        return item;
      },
      namespaces: {
        news: false,
        video: false,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  legacy: {
    collectionsBackwardsCompat: true,
  },
  markdown: {
    processor: unified({
      rehypePlugins: [rehypePictureWebp, rehypeMermaidRaw, [rehypeMermaid, { strategy: 'inline-svg', mermaidConfig: { theme: 'neutral' } }]],
      remarkPlugins: [remarkMermaidFence],
    }),
    shikiConfig: {
      themes: {
        dark: oneDarkProAccessible,
        light: 'github-light',
      },
      wrap: true,
    },
  },
});
