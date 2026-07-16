import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';
import Epub from 'epub-gen';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const blogDir = join(rootDir, 'src', 'content', 'blog');
const outputEpub = join(rootDir, 'docs', 'blog.epub');

async function generateEpub() {
  const files = await readdir(blogDir);
  const posts = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = join(blogDir, file);
    const raw = await readFile(filePath, 'utf8');
    const { data, content } = matter(raw);
    if (data.draft) continue;
    posts.push({ title: data.title, date: data.date ? new Date(data.date) : null, body: content });
  }

  // Sort by date, oldest first (posts without a date go last)
  posts.sort((a, b) => {
    const aTs = a.date?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTs = b.date?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTs - bTs;
  });

  const chapters = posts.map((post) => {
    let html = marked.parse(post.body);
    // Remove img tags with relative paths — epub-gen can't embed them and
    // will log confusing download errors. External URLs are kept.
    html = html.replace(/<img[^>]*src=["'](?!https?:\/\/)[^"']+[^>]*>/gi, '');
    return {
      title: post.title,
      data: `<h2>${escapeHtml(post.title)}</h2><p class="post-date">${formatDate(post.date)}</p>${html}`,
    };
  });

  const epub = new Epub(
    {
      title: 'Do Code That Matters',
      author: 'Spencer Kittleson',
      content: chapters,
      lang: 'en',
      css: epubCss,
      version: 3,
    },
    outputEpub
  );

  return new Promise((resolve, reject) => {
    epub.promise.then(
      () => {
        console.log('EPUB generated successfully at docs/blog.epub');
        resolve();
      },
      (err) => {
        console.error('Failed to generate EPUB:', err);
        reject(err);
      }
    );
  });
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const epubCss = `
body {
  font-family: Georgia, serif;
  line-height: 1.6;
  margin: 1em 0.5em;
}
h1, h2, h3, h4, h5, h6 {
  margin-top: 1.2em;
  margin-bottom: 0.5em;
}
h2 {
  font-size: 1.4em;
  border-bottom: 1px solid #ccc;
  padding-bottom: 0.3em;
}
.post-date {
  color: #666;
  font-style: italic;
  margin-bottom: 1em;
}
p {
  margin-bottom: 1em;
}
code {
  background: #f5f5f5;
  border-radius: 3px;
  padding: 0.1em 0.3em;
  font-family: monospace;
}
pre {
  background: #f5f5f5;
  border-radius: 3px;
  padding: 1em;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.9em;
}
pre code {
  background: none;
  padding: 0;
}
a {
  color: #0066cc;
  text-decoration: underline;
}
img {
  max-width: 100%;
  height: auto;
}
blockquote {
  border-left: 3px solid #ccc;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #555;
}
ul, ol {
  margin-bottom: 1em;
}
`;

generateEpub().catch((err) => {
  console.error('EPUB generation failed:', err);
  process.exit(1);
});
