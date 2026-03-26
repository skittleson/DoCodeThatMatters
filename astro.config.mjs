// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { EnumChangefreq } from 'sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rehypePictureWebp from './src/plugins/rehype-picture-webp.mjs';
import remarkMermaidRaw from './src/plugins/remark-mermaid-raw.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const oneDarkProAccessible = JSON.parse(
  readFileSync(join(__dirname, 'src/styles/one-dark-pro-accessible.json'), 'utf-8')
);

export default defineConfig({
  site: 'https://docodethatmatters.com',
  outDir: 'docs',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/offline/'),
      serialize(item) {
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
  markdown: {
    rehypePlugins: [rehypePictureWebp],
    remarkPlugins: [remarkMermaidRaw],
    shikiConfig: {
      themes: {
        dark: oneDarkProAccessible,
        light: 'github-light',
      },
      wrap: true,
    },
  },
});
