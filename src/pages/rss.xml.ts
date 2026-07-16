import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { markdownToText, byteLength, stripExt } from '../lib/markdownToText';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(
    (a, b) => (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0)
  );

  const siteUrl = context.site!.href;

  return rss({
    xmlns: { dct: 'http://purl.org/dc/terms/' },
    title: 'Do Code That Matters',
    description:
      'Personal blog about software development, 3D printing, DIY, python, personal automations, and C#',
    site: siteUrl,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description ?? '',
      link: `/${stripExt(post.id)}/`,
      pubDate: post.data.date ?? new Date(),
      customData: `<enclosure url="${siteUrl}${stripExt(post.id)}/index.txt" type="text/plain" length="${byteLength(markdownToText(post.body))}" />
        <dct:words>${post.body.split(/\s+/).filter(Boolean).length}</dct:words>`,
    })),
    customData: `
      <xmlns:dct>http://purl.org/dc/terms/</xmlns:dct>
      <language>en-us</language>
      <copyright>Copyright ${new Date().getFullYear()} Spencer Kittleson</copyright>
      <ttl>30</ttl>
      <link rel="alternate" type="application/epub+zip" href="${siteUrl}blog.epub"/>
    `,
  });
}
