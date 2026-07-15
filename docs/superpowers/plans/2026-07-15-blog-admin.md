# Blog Post Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a web-based admin interface on the blog site that lets the owner create and edit blog posts via the GitHub REST API, with GitHub PAT authentication.

**Architecture:** A client-side `/admin` page in the Astro app. It checks for a GitHub PAT in localStorage, fetches existing posts from the repo, renders a post list and a Markdown editor, and writes changes back via `PUT /repos/{owner}/{repo}/contents/...` (which also creates the git commit).

**Tech Stack:** Astro (client-side islands), Tailwind CSS, fetch API, GitHub REST API, localStorage for token storage.

## Global Constraints

- Tailwind CSS via `@tailwindcss/vite` — all styling via Tailwind utility classes.
- Astro 7.0.3, TypeScript.
- Frontmatter schema is defined in `src/content.config.ts` — title (5-100 chars), date/modified (YYYY-MM-DD), keywords (array), priority (0-1), draft (boolean, default false).
- Content lives in `src/content/blog/<slug>.md`.
- No server runtime — everything is client-side.
- DRY, YAGNI, TDD, frequent commits.

---

### Task 1: GitHub API Client

**Files:**
- Create: `src/lib/githubClient.ts` — GitHub API wrapper (reads/writes repo contents, creates commits)
- Modify: `src/content.config.ts` — no changes
- Test: `src/tests/githubClient.test.ts` — unit tests mocking fetch

**Interfaces:**
- Consumes: none
- Produces: `getBlogPosts(branch: string): Promise<PostFile[]>`, `createOrUpdatePost(slug: string, content: string, message: string): Promise<void>`, `getBranchSha(branch: string): Promise<string>`, `authenticate(token: string): Promise<boolean>`

```ts
interface PostFile {
  name: string;
  path: string;
  sha: string;
  download_url: string;
}
```

- [ ] **Step 1: Write failing test — authenticate validates token**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate } from '../githubClient';

describe('authenticate', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns true when GitHub API responds 200', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true });
    const result = await authenticate('fake-token');
    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: { Authorization: 'Bearer fake-token' },
    });
  });

  it('returns false when GitHub API responds non-2xx', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await authenticate('bad-token');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/githubClient.test.ts -v`
Expected: FAIL — module does not exist

- [ ] **Step 3: Write minimal implementation**

```ts
const API_BASE = 'https://api.github.com';
const OWNER = 'spencerkittleson';
const REPO = 'DoCodeThatMatters';
const BRANCH = 'master';

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/githubClient.test.ts -v`
Expected: PASS

- [ ] **Step 5: Write additional tests — getBlogPosts filters .md files**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBlogPosts } from '../githubClient';

describe('getBlogPosts', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns only .md files', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      json: async () => [
        { name: 'my-post.md', path: 'src/content/blog/my-post.md', sha: 'abc' },
        { name: 'images', path: 'src/content/blog/images', type: 'dir' },
      ],
    });
    const posts = await getBlogPosts('tok');
    expect(posts).toHaveLength(1);
    expect(posts[0].name).toBe('my-post.md');
  });
});
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run src/tests/githubClient.test.ts -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/githubClient.ts src/tests/githubClient.test.ts
git commit -m "feat: add GitHub API client with unit tests"
```

---

### Task 2: Token Storage & Validation

**Files:**
- Create: `src/lib/tokenStore.ts` — localStorage helpers for GitHub PAT
- Test: `src/tests/tokenStore.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `getToken(): string | null`, `setToken(token: string): void`, `clearToken(): void`

- [ ] **Step 1: Write failing test — setToken and getToken round-trip**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, clearToken } from '../tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clears the token', () => {
    setToken('abc123');
    clearToken();
    expect(getToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/tokenStore.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```ts
const KEY = 'gh_blog_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/tokenStore.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokenStore.ts src/tests/tokenStore.test.ts
git commit -m "feat: add token storage with unit tests"
```

---

### Task 3: Markdown Assembler

**Files:**
- Create: `src/lib/assembler.ts` — serializes form data to a full `.md` file (frontmatter YAML + body)
- Test: `src/tests/assembler.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `assemblePost(data: PostFormData): string`

```ts
interface PostFormData {
  title: string;
  description?: string;
  date?: string;       // YYYY-MM-DD
  modified?: string;   // YYYY-MM-DD
  image?: string;
  alt?: string;
  imageWidth?: number;
  imageHeight?: number;
  keywords?: string[];
  priority?: number;
  draft?: boolean;
  body: string;
}
```

- [ ] **Step 1: Write failing test — assembles full post with all fields**

```ts
import { describe, it, expect } from 'vitest';
import { assemblePost } from '../assembler';

describe('assemblePost', () => {
  it('assembles a post with all fields', () => {
    const result = assemblePost({
      title: 'My Post',
      description: 'A summary',
      date: '2026-07-15',
      modified: '2026-07-16',
      image: '/images/test.png',
      alt: 'Test image',
      imageWidth: 800,
      imageHeight: 600,
      keywords: ['hello', 'world'],
      priority: 0.8,
      draft: false,
      body: '# Hello World',
    });
    expect(result).toContain('---');
    expect(result).toContain('title: My Post');
    expect(result).toContain('date: 2026-07-15');
    expect(result).toContain('keywords:');
    expect(result).toContain('- hello');
    expect(result).toContain('---\n# Hello World');
  });

  it('omits optional fields when empty', () => {
    const result = assemblePost({
      title: 'Minimal Post',
      body: '## Content',
    });
    expect(result).toContain('title: Minimal Post');
    expect(result).not.toContain('date:');
    expect(result).not.toContain('keywords:');
    expect(result).not.toContain('## Content');
  });

  it('escapes title quotes', () => {
    const result = assemblePost({
      title: "It's a test",
      body: '',
    });
    expect(result).toContain("title: \"It's a test\"");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/assembler.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```ts
import type { PostFormData } from './assembler';

interface PostFormData {
  title: string;
  description?: string;
  date?: string;
  modified?: string;
  image?: string;
  alt?: string;
  imageWidth?: number;
  imageHeight?: number;
  keywords?: string[];
  priority?: number;
  draft?: boolean;
  body: string;
}

function needsQuoting(value: string): boolean {
  return /[":#&\[\]{\}|,>!%]/.test(value) || value.includes("'" && value.includes(" "));
}

function yamlValue(value: string): string {
  if (needsQuoting(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

export function assemblePost(data: PostFormData): string {
  const lines: string[] = ['---'];
  lines.push(`title: ${yamlValue(data.title)}`);
  if (data.description) lines.push(`description: ${yamlValue(data.description)}`);
  if (data.date) lines.push(`date: ${data.date}`);
  if (data.modified) lines.push(`modified: ${data.modified}`);
  if (data.image) lines.push(`image: ${data.image}`);
  if (data.alt) lines.push(`alt: ${yamlValue(data.alt)}`);
  if (data.imageWidth) lines.push(`imageWidth: ${data.imageWidth}`);
  if (data.imageHeight) lines.push(`imageHeight: ${data.imageHeight}`);
  if (data.keywords && data.keywords.length > 0) {
    lines.push('keywords:');
    for (const kw of data.keywords) lines.push(`  - ${yamlValue(kw)}`);
  }
  if (data.priority !== undefined) lines.push(`priority: ${data.priority}`);
  if (data.draft !== undefined && data.draft !== false) lines.push(`draft: ${data.draft}`);
  lines.push('---');
  lines.push(data.body);
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/assembler.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/assembler.ts src/tests/assembler.test.ts
git commit -m "feat: add Markdown assembler with frontmatter YAML generation"
```

---

### Task 4: Admin Page — Auth Screen

**Files:**
- Create: `src/pages/admin.astro` — the admin page with auth guard
- Modify: none
- Test: none (client-side UI, tested manually)

**Interfaces:**
- Consumes: `authenticate()` from Task 1, `getToken()` / `setToken()` from Task 2
- Produces: auth screen with token input and test button; navigates to post list on success

- [ ] **Step 1: Write admin.astro with auth screen**

```astro
---
export default {
  prerender: false,
};
---

<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Blog Admin</title>
  <style>
    body {
      font-family: monospace;
      background: #1a1a2e;
      color: #e0e0e0;
      max-width: 600px;
      margin: 4rem auto;
      padding: 0 1rem;
    }
    h1 { color: #9da2ff; }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.5rem;
      margin: 0.5rem 0;
      background: #16213e;
      color: #e0e0e0;
      border: 1px solid #444;
      border-radius: 4px;
      font-family: monospace;
    }
    button {
      padding: 0.5rem 1rem;
      background: #9da2ff;
      color: #1a1a2e;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-weight: bold;
    }
    button:hover { background: #7b82ff; }
    .error { color: #ff6b6b; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>Blog Admin</h1>

  <div id="auth-screen">
    <p>Enter your GitHub Personal Access Token to access the admin.</p>
    <p class="text-xs" style="color:#a0aec0">Requires <code>repo</code> scope.</p>
    <input type="password" id="token-input" placeholder="ghp_xxxxxxxxxxxx" />
    <br />
    <button id="test-btn">Test & Save</button>
    <div id="auth-error" class="error"></div>
  </div>

  <div id="app" style="display:none"></div>

  <script>
    import { authenticate } from '/src/lib/githubClient.ts';
    import { getToken, setToken, clearToken } from '/src/lib/tokenStore.ts';

    const tokenInput = document.getElementById('token-input');
    const testBtn = document.getElementById('test-btn');
    const authError = document.getElementById('auth-error');
    const authScreen = document.getElementById('auth-screen');

    async function testAndSave() {
      const token = tokenInput.value.trim();
      if (!token) {
        authError.textContent = 'Token is required';
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';
      try {
        const ok = await authenticate(token);
        if (ok) {
          setToken(token);
          authScreen.style.display = 'none';
          document.getElementById('app').style.display = 'block';
          // TODO: load post list
        } else {
          authError.textContent = 'Token is invalid or has insufficient permissions';
        }
      } catch (e) {
        authError.textContent = e.message || 'Authentication failed';
      }
      testBtn.disabled = false;
      testBtn.textContent = 'Test & Save';
    }

    testBtn.addEventListener('click', testAndSave);

    // Auto-auth if token already stored
    const stored = getToken();
    if (stored) {
      tokenInput.value = stored;
      // TODO: auto-verify and proceed
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: add admin page with auth screen"
```

---

### Task 5: Post List View

**Files:**
- Modify: `src/pages/admin.astro` — replace TODO with post list logic
- Test: none (UI, tested manually)

**Interfaces:**
- Consumes: `getBlogPosts()`, `authenticate()` from Task 1, token from Task 2
- Produces: rendered list of posts with edit links; "Add New Post" button

- [ ] **Step 1: Update admin.astro with post list rendering**

Add this logic inside the `<script>` block where the TODO is:

```ts
import { getBlogPosts, authenticate } from '/src/lib/githubClient.ts';
import { getToken, setToken, clearToken } from '/src/lib/tokenStore.ts';

// ... existing auth code ...

async function loadPostList() {
  const token = getToken();
  if (!token) return;
  const app = document.getElementById('app');
  app.innerHTML = '<p style="color:#a0aec0">Loading posts...</p>';

  try {
    const posts = await getBlogPosts(token);

    app.innerHTML = `
      <h2>Posts (${posts.length})</h2>
      <button id="add-new-btn">+ Add New Post</button>
      <div id="post-list"></div>
    `;

    const listEl = document.getElementById('post-list');
    posts.forEach(post => {
      const slug = post.name.replace(/\.md$/, '');
      const card = document.createElement('div');
      card.style.cssText = 'padding:1rem;margin:0.5rem 0;background:#16213e;border-radius:4px;';
      card.innerHTML = `
        <div style="font-weight:bold">${slug}</div>
        <a href="/edit/${slug}" style="color:#9da2ff">Edit</a>
      `;
      listEl.appendChild(card);
    });

    document.getElementById('add-new-btn').addEventListener('click', () => {
      window.location.href = '/edit/';
    });
  } catch (e) {
    app.innerHTML = `<p class="error">Failed to load posts: ${e.message}</p>`;
  }
}

// After auth or auto-auth:
// loadPostList();
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: add post list view with edit links"
```

---

### Task 6: Edit Page — Form & Validation

**Files:**
- Create: `src/pages/edit.astro` — editor page with form fields and Markdown textarea
- Test: none (UI, tested manually)

**Interfaces:**
- Consumes: `createOrUpdatePost()`, `getBlogPosts()` from Task 1, `assemblePost()` from Task 3, token from Task 2
- Produces: full editor with save functionality

- [ ] **Step 1: Write edit.astro with form**

```astro
---
export default {
  prerender: false,
};
---

<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Edit Post</title>
  <style>
    body {
      font-family: monospace;
      background: #1a1a2e;
      color: #e0e0e0;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    h1 { color: #9da2ff; }
    label { display: block; margin: 0.75rem 0 0.25rem; color: #a0aec0; font-size: 0.85rem; }
    input[type="text"], input[type="number"], input[type="date"], textarea {
      width: 100%;
      padding: 0.5rem;
      background: #16213e;
      color: #e0e0e0;
      border: 1px solid #444;
      border-radius: 4px;
      font-family: monospace;
      box-sizing: border-box;
    }
    textarea {
      min-height: 400px;
      resize: vertical;
    }
    button {
      padding: 0.75rem 1.5rem;
      background: #9da2ff;
      color: #1a1a2e;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-weight: bold;
      font-size: 1rem;
      margin-top: 1rem;
    }
    button:hover { background: #7b82ff; }
    .error { color: #ff6b6b; }
    .success { color: #51cf66; }
    .form-row { display: flex; gap: 1rem; }
    .form-row > div { flex: 1; }
  </style>
</head>
<body>
  <h1>Edit Post</h1>
  <a href="/admin" style="color:#9da2ff">← Back to list</a>

  <form id="post-form">
    <label for="title">Title *</label>
    <input type="text" id="title" required minlength="5" maxlength="100" placeholder="Post title" />

    <label for="description">Description</label>
    <input type="text" id="description" placeholder="Short summary" />

    <div class="form-row">
      <div>
        <label for="date">Date</label>
        <input type="date" id="date" />
      </div>
      <div>
        <label for="modified">Modified</label>
        <input type="date" id="modified" />
      </div>
    </div>

    <label for="image">Image path</label>
    <input type="text" id="image" placeholder="/images/my-image.png" />

    <label for="alt">Alt text</label>
    <input type="text" id="alt" />

    <div class="form-row">
      <div>
        <label for="imageWidth">Image width</label>
        <input type="number" id="imageWidth" min="0" />
      </div>
      <div>
        <label for="imageHeight">Image height</label>
        <input type="number" id="imageHeight" min="0" />
      </div>
    </div>

    <label for="keywords">Keywords (comma-separated)</label>
    <input type="text" id="keywords" placeholder="keyword1, keyword2" />

    <label for="priority">Priority (0-1)</label>
    <input type="number" id="priority" min="0" max="1" step="0.1" />

    <label>
      <input type="checkbox" id="draft" />
      Draft (not published)
    </label>

    <label for="body">Markdown body</label>
    <textarea id="body" placeholder="# Your post content here"></textarea>

    <button type="submit">Save</button>
    <div id="status"></div>
  </form>

  <script>
    import { getToken, clearToken } from '/src/lib/tokenStore.ts';
    import { getBlogPosts, createOrUpdatePost, authenticate } from '/src/lib/githubClient.ts';
    import { assemblePost } from '/src/lib/assembler.ts';

    const form = document.getElementById('post-form');
    const statusEl = document.getElementById('status');

    // Validate title length
    const titleInput = document.getElementById('title');
    titleInput.addEventListener('input', () => {
      if (titleInput.value.length < 5) {
        titleInput.setCustomValidity('Title must be at least 5 characters');
      } else {
        titleInput.setCustomValidity('');
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const token = getToken();
      if (!token) {
        statusEl.textContent = 'Not authenticated. Please log in first.';
        statusEl.className = 'error';
        return;
      }

      const title = titleInput.value.trim();
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+$/, '')
        .replace(/^-+/, '');

      const data = {
        title,
        description: document.getElementById('description').value.trim() || undefined,
        date: document.getElementById('date').value || undefined,
        modified: document.getElementById('modified').value || undefined,
        image: document.getElementById('image').value.trim() || undefined,
        alt: document.getElementById('alt').value.trim() || undefined,
        imageWidth: document.getElementById('imageWidth').value ? parseInt(document.getElementById('imageWidth').value) : undefined,
        imageHeight: document.getElementById('imageHeight').value ? parseInt(document.getElementById('imageHeight').value) : undefined,
        keywords: document.getElementById('keywords').value ? document.getElementById('keywords').value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        priority: document.getElementById('priority').value ? parseFloat(document.getElementById('priority').value) : undefined,
        draft: document.getElementById('draft').checked,
        body: document.getElementById('body').value,
      };

      const content = assemblePost(data);
      const message = `blog: add ${title}`;

      statusEl.textContent = 'Saving...';
      statusEl.className = '';

      try {
        await createOrUpdatePost(token, slug, content, message);
        statusEl.textContent = `Saved! Post available at /${slug}/`;
        statusEl.className = 'success';
        setTimeout(() => { window.location.href = '/admin'; }, 2000);
      } catch (err) {
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.className = 'error';
      }
    });

    // On page load, check auth
    const token = getToken();
    if (!token) {
      window.location.href = '/admin';
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/edit.astro
git commit -m "feat: add edit page with form and save via GitHub API"
```

---

### Task 7: Edit Existing Post

**Files:**
- Modify: `src/pages/edit.astro` — add logic to load existing post content
- Test: none (UI, tested manually)

**Interfaces:**
- Consumes: `getBlogPosts()` from Task 1
- Produces: pre-filled form when editing an existing post

- [ ] **Step 1: Add query param handling to edit.astro**

Update the `<script>` block to check for a `slug` query param:

```ts
// Before form submit handler, add:
const params = new URLSearchParams(window.location.search);
const editSlug = params.get('slug');

if (editSlug) {
  const token = getToken();
  const posts = await getBlogPosts(token);
  const post = posts.find(p => p.name === `${editSlug}.md`);
  if (post) {
    // Fetch raw content and parse frontmatter
    const raw = await fetch(post.download_url).then(r => r.text());
    // Split frontmatter from body
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      const yamlText = match[1];
      const body = match[2];
      // Parse basic YAML (simple key: value)
      document.getElementById('body').value = body;
      // Fill fields from YAML
      const lines = yamlText.split('\n');
      for (const line of lines) {
        const [key, ...rest] = line.split(':');
        const value = rest.join(':').trim();
        const input = document.getElementById(key.trim());
        if (input && key.trim() !== 'keywords') {
          if (key.trim() === 'draft') {
            (input as HTMLInputElement).checked = value === 'true';
          } else {
            input.value = value;
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Update createOrUpdatePost to include SHA for edits**

The `createOrUpdatePost` already accepts `existingSha`. Update the save handler to pass it:

```ts
// In the form submit handler, before calling createOrUpdatePost:
const existingPost = posts.find(p => p.name === `${slug}.md`);
const existingSha = existingPost?.sha;

await createOrUpdatePost(token, slug, content, message, existingSha);
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/edit.astro
git commit -m "feat: support editing existing posts with pre-filled form"
```

---

### Task 8: Auto-auth on Admin Page Load

**Files:**
- Modify: `src/pages/admin.astro` — auto-verify stored token on load
- Test: none (UI, tested manually)

- [ ] **Step 1: Add auto-auth to admin.astro**

Update the script block to auto-verify the stored token:

```ts
// After the existing auth code:
async function init() {
  const stored = getToken();
  if (stored) {
    const ok = await authenticate(stored);
    if (ok) {
      authScreen.style.display = 'none';
      document.getElementById('app').style.display = 'block';
      loadPostList();
      return;
    } else {
      clearToken();
      authError.textContent = 'Stored token is invalid. Please enter a new one.';
    }
  }
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: auto-authenticate on admin page load"
```

---

### Task 9: End-to-End Manual Testing

**Files:**
- No code changes

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost:4321

- [ ] **Step 2: Visit /admin and authenticate**

Open `http://localhost:4321/admin` in browser. Enter GitHub PAT with `repo` scope. Click "Test & Save". Expected: redirects to post list.

- [ ] **Step 3: Create a new post**

Click "+ Add New Post", fill in title and body, click Save. Expected: commit appears in repo, post is created.

- [ ] **Step 4: Edit an existing post**

Click Edit on a post, modify title, click Save. Expected: commit updates the file.

- [ ] **Step 5: Verify token persistence**

Refresh /admin — should auto-authenticate and show post list without re-entering token.

- [ ] **Step 6: Stop dev server**

Ctrl+C

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: e2e test fixes"  # if any fixes were needed
```

---

### Task 10: Error Handling & Polish

**Files:**
- Modify: `src/pages/admin.astro`, `src/pages/edit.astro` — improve error messages and UX

- [ ] **Step 1: Add error boundary for network failures**

Add retry button and clear error states in both admin and edit pages.

- [ ] **Step 2: Add loading spinner on save**

Show a spinner/disabled state on the Save button while the API call is in progress.

- [ ] **Step 3: Add logout button**

Add a small "Logout" link on admin page that clears the token and redirects to auth screen.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add error handling, loading states, and logout"
```
