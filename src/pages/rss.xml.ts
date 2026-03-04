import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { markdownToText, byteLength } from '../lib/markdownToText';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(
    (a, b) => (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0)
  );

  const siteUrl = context.site?.href ?? 'https://docodethatmatters.com/';

  return rss({
    title: 'Do Code That Matters',
    description:
      'Personal blog about software development, 3D printing, DIY, python, personal automations, and C#',
    site: siteUrl,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description ?? '',
      link: `/${post.slug}/`,
      pubDate: post.data.date ?? new Date(),
      customData: `<enclosure url="${siteUrl}${post.slug}/index.txt" type="text/plain" length="${byteLength(markdownToText(post.body))}" />`,
    })),
    customData: `
      <language>en-us</language>
      <copyright>Copyright ${new Date().getFullYear()} Spencer Kittleson</copyright>
      <ttl>30</ttl>
    `,
  });
}
