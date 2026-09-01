export interface PostDates {
  date?: Date;
  modified?: Date;
}

const NON_POST_PATHS = new Set(['', 'blog', 'about']);

export function slugFromUrl(url: string): string | undefined {
  const pathname = new URL(url).pathname.replace(/^\/|\/$/g, '');
  if (!pathname || NON_POST_PATHS.has(pathname)) {
    return undefined;
  }
  return pathname;
}

export function lastmodForSlug(
  slug: string | undefined,
  posts: Map<string, PostDates>
): Date | undefined {
  if (!slug) return undefined;
  const entry = posts.get(slug);
  if (!entry) return undefined;
  return entry.modified ?? entry.date;
}
