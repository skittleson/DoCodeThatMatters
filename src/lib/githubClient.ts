const API_BASE = 'https://api.github.com';
const OWNER = 'skittleson';
const REPO = 'DoCodeThatMatters';
const BRANCH = 'master';

export interface PostFile {
  name: string;
  path: string;
  sha: string;
  download_url: string;
  modified?: Date;
  date: Date;
}

export async function authenticate(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getBranchSha(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/branches/${BRANCH}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.commit.sha;
}

async function fetchPostFrontmatter(
  token: string,
  slug: string,
): Promise<{ date: Date; modified?: Date }> {
  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/src/content/blog/${slug}.md`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status} fetching ${slug}`);
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error(`No frontmatter found in ${slug}`);
  const fm = fmMatch[1];
  const dateLine = fm.match(/^date:\s*(.+)$/m);
  const modifiedLine = fm.match(/^modified:\s*(.+)$/m);
  return {
    date: new Date(dateLine ? dateLine[1].trim() : '1970-01-01'),
    modified: modifiedLine ? new Date(modifiedLine[1].trim()) : undefined,
  };
}

export async function getBlogPosts(token: string): Promise<PostFile[]> {
  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/src/content/blog`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
  const items: PostFile[] = await res.json();
  if (!Array.isArray(items)) {
    throw new Error('Unexpected response from GitHub API: not an array');
  }
  const mdPosts = items.filter((i: PostFile) => i.name.endsWith('.md'));
  const results = await Promise.all(
    mdPosts.map(async (post) => {
      const slug = post.name.replace(/\.md$/, '');
      try {
        const { date, modified } = await fetchPostFrontmatter(token, slug);
        return { ...post, date, modified };
      } catch {
        return { ...post, date: new Date('1970-01-01') };
      }
    }),
  );
  return results.sort(
    (a, b) =>
      (b.modified?.valueOf() ?? b.date.valueOf() ?? 0) -
      (a.modified?.valueOf() ?? a.date.valueOf() ?? 0),
  );
}

export async function createOrUpdatePost(
  token: string,
  slug: string,
  content: string,
  message: string,
  existingSha?: string,
): Promise<void> {
  const path = `src/content/blog/${slug}.md`;
  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: BRANCH,
  };
  if (existingSha) {
    body.sha = existingSha;
  } else {
    const branchSha = await getBranchSha(token);
    body.sha = branchSha;
  }
  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${err}`);
  }
}
