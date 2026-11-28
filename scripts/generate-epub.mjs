import { readdir, readFile } from 'fs/promises';
import { existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';
import { marked } from 'marked';
import { EPub } from '@lesjoursfr/html-to-epub';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const blogDir = join(rootDir, 'src', 'content', 'blog');
const outputEpub = join(rootDir, 'docs', 'blog.epub');
const publicDir = join(rootDir, 'public');
const coverPath = join(__dirname, 'assets', 'epub-cover.png');
const fontPath = join(publicDir, 'fonts', 'Inconsolata.woff2');
const ttfPath = join(__dirname, 'assets', 'Inconsolata.ttf');

// Collect all non-draft slugs for internal link resolution
const allSlugs = new Set();
const allPosts = [];

async function loadPosts() {
  const files = await readdir(blogDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = join(blogDir, file);
    const raw = await readFile(filePath, 'utf8');
    const { data, content } = matter(raw);
    if (data.draft) continue;
    const slug = file.replace(/\.md$/, '');
    allSlugs.add(slug);
    allPosts.push({ title: data.title, date: data.date ? new Date(data.date) : null, body: content, description: data.description, slug, faq: data.faq });
  }
  allPosts.sort((a, b) => {
    const aTs = a.date?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTs = b.date?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTs - bTs;
  });
}

// ── helpers ──

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtml(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function makeSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// ── image resolution & optimization ──

const cacheDir = '/tmp/opencode/epub-img-cache';

function optimizeImage(src) {
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('file://')) return src;
  if (!src.startsWith('/')) return src;
  const resolved = join(publicDir, src);
  if (!existsSync(resolved)) return null;

  const ext = basename(resolved).split('.').pop().toLowerCase();
  const cachePath = join(cacheDir, basename(resolved));

  if (ext === 'gif') {
    // copy as-is
    if (!existsSync(cachePath) || statSync(resolved).mtimeMs > statSync(cachePath).mtimeMs) {
      mkdirSync(cacheDir, { recursive: true });
      const data = readFileSync(resolved);
      writeFileSync(cachePath, data);
    }
    return pathToFileURL(cachePath).href;
  }

  // jpg/jpeg/png — optimize with ImageMagick
  mkdirSync(cacheDir, { recursive: true });
  if (existsSync(cachePath) && statSync(resolved).mtimeMs <= statSync(cachePath).mtimeMs) {
    return pathToFileURL(cachePath).href;
  }

  const out = cachePath;
  try {
    execFileSync('convert', [resolved, '-strip', '-resize', '1600x1600>', '-quality', '82', out]);
    const outSize = statSync(out).size;
    const origSize = statSync(resolved).size;
    if (outSize >= origSize) {
      // fallback to original
      return pathToFileURL(resolved).href;
    }
    return pathToFileURL(out).href;
  } catch (e) {
    console.warn(`[epub] ImageMagick failed for ${resolved}: ${e.message}`);
    return pathToFileURL(resolved).href;
  }
}

// ── HTML transformation ──

function transformHtml(html, slugSet) {
  // a. Gist embeds: <script src="https://gist.github.com/USER/ID(.js)?"></script>
  html = html.replace(
    /<script\s+src="https:\/\/gist\.github\.com\/([^/]+)\/([^/]+)(?:\.js)?\?[^"]*"[^>]*><\/script>/gi,
    (_, user, id) => {
      const url = `https://gist.github.com/${user}/${id}`;
      return `<p><em>See the gist:</em> <a href="${url}">${url}</a></p>`;
    }
  );

  // b. <iframe> → link
  html = html.replace(
    /<iframe[^>]*src="([^"]+)"[^>]*><\/iframe>/gi,
    (_, url) => {
      const label = (url.includes('youtube.com') || url.includes('youtu.be')) ? 'Video' : 'Embedded content';
      return `<p><em>${label}:</em> <a href="${url}">${url}</a></p>`;
    }
  );
  // Remove any remaining <iframe>
  html = html.replace(/<iframe[^>]*><\/iframe>/gi, '');

  // c. <model-viewer> → link
  html = html.replace(
    /<model-viewer[^>]*src="([^"]+)"[^>]*>.*?<\/model-viewer>/gis,
    (_, url) => {
      return `<p><em>3D model:</em> <a href="${url}">${url}</a></p>`;
    }
  );
  // Remove any remaining <script>...</script>
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // Unwrap <details>/<summary>
  html = html.replace(/<details[^>]*>/gi, '');
  html = html.replace(/<\/details>/gi, '');
  html = html.replace(/<summary[^>]*>([\s\S]*?)<\/summary>/gi, '<p><strong>$1</strong></p>');

  // d. <br> → <br/>
  html = html.replace(/<\/br>/gi, '');
  html = html.replace(/<br\s*\/?\s*>/gi, '<br/>');

  // d2. <hr> → <hr/>
  html = html.replace(/<\/hr>/gi, '');
  html = html.replace(/<hr\s*>/gi, '<hr/>');

  // d3. <img> closing tag
  html = html.replace(/<\/img>/gi, '');

  // h. Add id attributes to headings without one
  const seenIds = new Set();
  html = html.replace(/<h([1-6])(?![^>]*\bid=)([^>]*)>([\s\S]*?)<\/h\1>/gi, (_, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    let slug = makeSlug(text);
    if (!slug) return `<h${level}${attrs}>${inner}</h${level}>`;
    if (seenIds.has(slug)) {
      let i = 1;
      while (seenIds.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    seenIds.add(slug);
    return `<h${level}${attrs} id="${slug}">${inner}</h${level}>`;
  });

  // e. Markdown that leaks inside raw-HTML blocks: **text** → <strong>text</strong>
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // f. <img> with src starting '/' → resolve locally
  html = html.replace(/<img([^>]*)src="\/([^"]*)"/gi, (_, attrs, path) => {
    const src = '/' + path;
    const resolved = optimizeImage(src);
    if (resolved) {
      return `<img${attrs}src="${resolved}"`;
    }
    console.warn(`[epub] missing image: ${src}`);
    return '';
  });

  // g. <a href="X"> where X starts with '/' → resolve to .xhtml or external
  html = html.replace(
    /<a([^>]*)href="\/([^"]*)"/gi,
    (_, attrs, href) => {
      const key = href.replace(/^\/+|\/+$/g, '').split('#')[0].split('?')[0];
      if (key && slugSet.has(key)) {
        return `<a${attrs}href="${key}.xhtml"`;
      }
      return `<a${attrs}href="https://docodethatmatters.com${href.startsWith('/') ? href : '/' + href}"`;
    }
  );

  return html;
}

// ── build ──

async function generateEpub() {
  await loadPosts();

  const chapters = allPosts.map((post) => {
    let html = marked.parse(post.body);
    html = transformHtml(html, allSlugs);
    const title = post.title;
    const dateStr = formatDate(post.date);
    const desc = post.description ? `<p class="lede">${escapeHtml(post.description)}</p>` : '';
    const my = post.date ? post.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    let data = `<div class="chapter-head"><p class="post-date">${my}</p></div><h1>${escapeHtml(title)}</h1>${desc}${html}`;
    // Append FAQ if present
    if (Array.isArray(post.faq) && post.faq.length) {
      data += '<h2>Common questions</h2>';
      for (const entry of post.faq) {
        if (typeof entry.q === 'string' && typeof entry.a === 'string') {
          data += `<h3>${escapeHtml(entry.q)}</h3><p>${escapeHtml(entry.a)}</p>`;
        }
      }
    }
    return { title, filename: post.slug, data };
  });
  chapters.unshift({
    title: 'Title Page',
    filename: 'title-page',
    data: '<div class="title-page"><h1 class="tp-title">Code That Matters</h1><p class="tp-sub">Field notes from a builder</p><p class="tp-range">2016 &ndash; 2026</p><p class="tp-url">docodethatmatters.com</p></div>',
  });

  const epub = new EPub(
    {
      title: 'Do Code That Matters',
      description: 'Essays on self-hosting, local AI, embedded hacks, and cameras. Generated from docodethatmatters.com.',
      cover: coverPath,
      publisher: 'docodethatmatters.com',
      author: 'Spencer Kittleson',
      appendChapterTitles: false,
      date: new Date().toISOString().slice(0, 10),
      lang: 'en',
      css: epubCss,
      fonts: existsSync(ttfPath) ? [fontPath, ttfPath] : [fontPath],
      version: 3,
      content: chapters,
    },
    outputEpub
  );

  try {
    await epub.render();
    console.log('EPUB generated successfully at docs/blog.epub');
  } catch (err) {
    console.error('Failed to generate EPUB:', err);
    throw err;
  }
}

const epubCss = `
@font-face { font-family:'Inconsolata'; src:url('Inconsolata.woff2') format('woff2'),url('Inconsolata.ttf') format('truetype'); font-weight:400; font-style:normal; }
* { box-sizing: border-box; }
body { font-family: serif; line-height: 1.6; }
h1,h2,h3,h4 { font-family:'Inconsolata',monospace; font-weight:400; text-align:left; margin:1.6em 0 0.6em 0; }
h1 { font-size:1.6em; page-break-before:always; }
h2 { font-size:1.3em; } h3 { font-size:1.1em; }
a { color:#0b6e75; }
img { max-width:100%; height:auto; }
pre { white-space:pre-wrap; word-break:break-word; font-family:'Inconsolata',monospace; font-size:0.85em; border-left:0.2em solid #0b6e75; padding:0.6em 0.8em; margin:1em 0; background:none; }
code { font-family:'Inconsolata',monospace; font-size:0.85em; }
blockquote { margin:1em 0; padding-left:1em; border-left:0.2em solid #0b6e75; font-style:italic; }
table { border-collapse:collapse; margin:1em 0; }
th,td { border:1px solid #d4d4d8; padding:0.4em 0.6em; text-align:left; }
hr { border:none; border-top:1px solid #d4d4d8; margin:2em 0; }
.post-date { font-family:'Inconsolata',monospace; font-size:0.75em; letter-spacing:0.15em; color:#6b7280; margin:0 0 0.5em; }
.lede { font-style:italic; margin:0 0 1.5em; }
.chapter-head { margin:0; }
.title-page { text-align:center; margin-top:6em; }
.tp-title { font-family:'Inconsolata',monospace; font-size:2.2em; letter-spacing:0.08em; margin-bottom:0.3em; page-break-before:avoid; }
.tp-sub { font-family:'Inconsolata',monospace; font-size:1em; letter-spacing:0.2em; }
.tp-range { font-family:'Inconsolata',monospace; font-size:0.85em; color:#6b7280; letter-spacing:0.15em; }
.tp-url { font-family:'Inconsolata',monospace; font-size:0.8em; letter-spacing:0.1em; margin-top:3em; }
`;

generateEpub().catch((err) => {
  console.error('EPUB generation failed:', err);
  process.exit(1);
});
