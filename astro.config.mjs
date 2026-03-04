// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { EnumChangefreq } from 'sitemap';
import tailwindcss from '@tailwindcss/vite';

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
    shikiConfig: {
      theme: 'one-dark-pro',
      wrap: true,
    },
  },
});
