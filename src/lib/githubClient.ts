const API_BASE = 'https://api.github.com';
const OWNER = 'spencerkittleson';
const REPO = 'DoCodeThatMatters';
const BRANCH = 'master';

export interface PostFile {
  name: string;
  path: string;
  sha: string;
  download_url: string;
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

export async function getBlogPosts(token: string): Promise<PostFile[]> {
  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/src/content/blog`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = await res.json();
  return items.filter((i: PostFile) => i.name.endsWith('.md'));
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
