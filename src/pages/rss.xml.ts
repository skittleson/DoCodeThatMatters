import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import {
  markdownToText,
  byteLength,
  stripExt,
  audioEnclosureFor,
} from '../lib/markdownToText';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(
    (a, b) => (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0)
  );

  const siteUrl = context.site!.href;
  // siteUrl ends in "/" (trailingSlash: 'always'); audio paths start with "/".
  const siteOrigin = siteUrl.replace(/\/$/, '');

  return rss({
    xmlns: { dct: 'http://purl.org/dc/terms/' },
    title: 'Do Code That Matters',
    description:
      'Personal blog about software development, 3D printing, DIY, python, personal automations, and C#',
    site: siteUrl,
    items: sortedPosts.map((post) => {
      const slug = stripExt(post.id);
      const audio = audioEnclosureFor(slug);
      const audioEnclosure = audio
        ? `\n        <enclosure url="${siteOrigin}${audio.path}" type="audio/mpeg" length="${audio.length}" />`
        : '';
      return {
        title: post.data.title,
        description: post.data.description ?? '',
        link: `/${slug}/`,
        pubDate: post.data.date ?? new Date(),
        customData: `<enclosure url="${siteUrl}${slug}/index.txt" type="text/plain" length="${byteLength(markdownToText(post.body))}" />
        <enclosure url="${siteUrl}${slug}/index.md" type="text/markdown" length="${byteLength(post.body)}" />${audioEnclosure}
        <dct:words>${post.body.split(/\s+/).filter(Boolean).length}</dct:words>`,
      };
    }),
    customData: `
      <language>en-us</language>
      <copyright>Copyright ${new Date().getFullYear()} Spencer Kittleson</copyright>
      <ttl>30</ttl>
      <link rel="alternate" type="application/epub+zip" href="${siteUrl}blog.epub"/>
    `,
  });
}
