import { getCollection, type CollectionEntry } from 'astro:content';
import type { GetStaticPaths } from 'astro';
import { markdownToTTSPlainText, stripExt } from '../../lib/markdownToText';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: stripExt(post.id) },
    props: { post },
  }));
};

export async function GET({ props }: { props: { post: CollectionEntry<'blog'> } }) {
  const { post } = props;
  const text = markdownToTTSPlainText(post.body);

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
