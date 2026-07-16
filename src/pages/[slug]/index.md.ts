import { getCollection, type CollectionEntry } from 'astro:content';
import type { GetStaticPaths } from 'astro';
import { stripExt } from '../../lib/markdownToText';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: stripExt(post.id) },
    props: { post },
  }));
};

export async function GET({ props }: { props: { post: CollectionEntry<'blog'> } }) {
  const { post } = props;
  return new Response(post.body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
