import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(
    (a, b) => (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0)
  );

  const siteUrl = context.site!.href.replace(/\/$/, '');

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Do Code That Matters',
    home_page_url: siteUrl,
    feed_url: `${siteUrl}/feed.json`,
    description:
      'Personal blog about software development, 3D printing, DIY, python, personal automations, and C#',
    authors: [
      {
        name: 'Spencer Kittleson',
        url: `${siteUrl}/about/`,
      },
    ],
    items: sortedPosts.map((post) => ({
      id: `${siteUrl}/${post.slug}/`,
      url: `${siteUrl}/${post.slug}/`,
      title: post.data.title,
      summary: post.data.description ?? '',
      image: post.data.image ?? '',
      date_published: post.data.date?.toISOString() ?? new Date().toISOString(),
      date_modified: post.data.modified?.toISOString() ?? post.data.date?.toISOString() ?? new Date().toISOString(),
      tags: post.data.keywords ?? [],
      authors: [{ name: 'Spencer Kittleson' }],
    })),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
    },
  });
}
