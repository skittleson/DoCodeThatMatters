import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { stripExt, markdownToText } from '../lib/markdownToText';

const SITE = 'https://docodethatmatters.com';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(
    (a, b) => (b.data.date?.valueOf() ?? 0) - (a.data.date?.valueOf() ?? 0)
  );

  const siteUrl = context.site ? context.site.href.replace(/\/$/, '') : SITE;

  const lines: string[] = [
    '# Do Code That Matters — full text',
    '> All published posts as plain text for LLM context. Site index: https://docodethatmatters.com/llms.txt',
    '',
  ];

  for (const post of sortedPosts) {
    const slug = stripExt(post.id);
    const date = post.data.date?.toISOString().slice(0, 10) ?? '';
    lines.push(`## ${post.data.title}`);
    lines.push(`URL: ${siteUrl}/${slug}/ | Date: ${date}`);
    lines.push('');
    lines.push(markdownToText(post.body).trim());
    lines.push('');
  }

  return new Response(lines.join('\n').trimEnd() + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
