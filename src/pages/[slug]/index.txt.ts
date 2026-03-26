import { getCollection, type CollectionEntry } from 'astro:content';
import type { GetStaticPaths } from 'astro';
import { markdownToPlainText } from '../../lib/markdownToText';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
};

export async function GET({ props }: { props: { post: CollectionEntry<'blog'> } }) {
  const { post } = props;
  const text = markdownToPlainText(post.body);

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
