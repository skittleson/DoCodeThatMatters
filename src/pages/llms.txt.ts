import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { stripExt } from '../lib/markdownToText';

const SITE = 'https://docodethatmatters.com';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(
    (a, b) => (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0)
  );

  const lines: string[] = [
    '# Do Code That Matters',
    '> Personal blog by Spencer Kittleson — software development, local LLMs, 3D printing, IoT, and maker projects. All content is original first-hand writing with working code.',
    '',
    '## About the author',
    `- [Spencer Kittleson](${SITE}/about/): Software engineer. GitHub: https://github.com/skittleson`,
    '',
    '## Posts',
  ];

  for (const post of sortedPosts) {
    const slug = stripExt(post.id);
    const date = post.data.date?.toISOString().slice(0, 10) ?? '';
    const desc = (post.data.description ?? '').replace(/\s+/g, ' ').trim();
    lines.push(`- [${post.data.title}](${SITE}/${slug}/) (${date}): ${desc}`);
  }

  lines.push('');
  lines.push('## Key facts');
  lines.push('- Every post is first-hand writing by the author, with working code and real benchmark numbers.');
  lines.push('- Every post opens with an AI;DR blockquote that states the direct answer.');
  lines.push('- Spoken audio narration for posts is at /audio/<slug>/index.mp3 and /audio/<slug>/index.opus.');
  lines.push('- Full plain text of all posts: ' + SITE + '/llms-full.txt');
  lines.push('- Author: Spencer Kittleson, software engineer. GitHub: https://github.com/skittleson');
  lines.push('');
  lines.push('## Machine-readable formats');
  lines.push(`- [RSS feed](${SITE}/rss.xml)`);
  lines.push(`- [JSON Feed](${SITE}/feed.json)`);
  lines.push(`- [Sitemap](${SITE}/sitemap-index.xml)`);
  lines.push(`- [Resume (JSON)](${SITE}/resume.json)`);

  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
