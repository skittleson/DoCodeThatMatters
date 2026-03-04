# Migration: Custom C# SSG → Astro

## Overview

Migrating `docodethatmatters.com` from a custom C# .NET 9 static site generator
with Handlebars templates to Astro, hosted on GitHub Pages via the `docs/` folder.

## Decisions

| Area | Decision |
|---|---|
| CSS framework | Tailwind CSS (replaces Bootstrap 4 + jQuery) |
| Syntax highlighting | Shiki built-in (replaces CDN highlight.js) |
| Audio pipeline | Python `main.py` kept as separate post-build step |
| Draft posts | All 29 posts migrated; 9 unpublished marked `draft: true` |
| Project structure | Replace in-place (C# builder and Handlebars files removed) |
| Analytics | Dropped (Universal Analytics was deprecated) |
| PWA | Manual `sw.js` copied to `public/` (low-effort approach) |

## Architecture

### Before

```
src/*.md + src/*.hbs + src/partials/*.hbs
  → StaticSiteBuilder (C# .NET 9, Handlebars.Net, Markdig)
  → docs/
  → main.py (Python: BeautifulSoup + gTTS)
  → docs/**/*.txt + docs/**/*.mp3
```

### After

```
src/content/blog/*.md
  → Astro (astro.config.mjs, content collections, Tailwind, Shiki)
  → docs/
  → main.py (Python: BeautifulSoup + gTTS) -- unchanged
  → docs/**/*.txt + docs/**/*.mp3
```

## File Mapping

### Layouts / Templates

| Old (Handlebars) | New (Astro) |
|---|---|
| `src/partials/header.hbs` | `src/layouts/BaseLayout.astro` |
| `src/partials/nav.hbs` | `src/components/Nav.astro` |
| `src/partials/footer.hbs` | `src/components/Footer.astro` |
| `src/partials/post.hbs` | `src/layouts/PostLayout.astro` |
| `src/partials/standard.hbs` | Folded into `BaseLayout.astro` |
| `src/partials/contactInfo.hbs` | `src/components/ContactInfo.astro` |
| `src/partials/code.hbs` | Removed — Shiki handles this at build time |
| `src/index.hbs` | `src/pages/index.astro` |
| `src/blog.hbs` | `src/pages/blog/index.astro` |
| `src/about.hbs` | `src/pages/about/index.astro` |
| `src/offline.hbs` | `src/pages/offline/index.astro` |
| `src/rss.hbs` | `src/pages/rss.xml.ts` |
| `src/humans.hbs` | `public/humans.txt` (static) |
| `src/security.hbs` | `src/pages/security.txt.ts` (build-time generated expiry) |
| — | `src/pages/feed.json.ts` (JSON Feed 1.1) |
| — | `src/pages/[slug]/index.astro` (dynamic post route) |

### Content

| Old | New |
|---|---|
| `src/*.md` (29 files) | `src/content/blog/*.md` (29 files) |
| `index.yml` (global config) | `astro.config.mjs` + content collection schema |
| `src/css/site.css` | `src/styles/global.css` + Tailwind config |
| `src/javascript/site.js` | `src/scripts/site.js` |
| `src/sw.js` | `public/sw.js` |
| `src/images/` | `public/images/` |

### Static Assets (moved to `public/`)

- `CNAME`
- `favicon.ico`
- `manifest.json`
- `browserconfig.xml`
- `robots.txt`
- `googlef0b8aed37825acd2.html`
- `marlinConfigDiff.html`
- `images/`
- `.well-known/`

### Removed

- `StaticSiteBuilder/` — entire C# project
- `src/*.hbs` — all Handlebars page templates
- `src/partials/` — all Handlebars partials
- `index.yml` — site config (moved to `astro.config.mjs`)
- `node_modules/bootstrap/` — replaced by Tailwind
- `node_modules/jquery/` — no longer needed
- `node_modules/watch/` — replaced by `astro dev`

## Content Collection Schema

```typescript
// src/content/config.ts
const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(5).max(50),
    description: z.string().min(25).max(150),
    date: z.coerce.date(),
    modified: z.coerce.date().optional(),
    image: z.string(),
    alt: z.string(),
    keywords: z.array(z.string()).min(1),
    priority: z.number().optional(),
    draft: z.boolean().optional().default(false),
  }),
});
```

## URL Compatibility

All existing post URLs are preserved. Slug is derived from filename:
- `src/content/blog/onboarding-devs.md` → `/onboarding-devs/`

Dynamic route: `src/pages/[slug]/index.astro`

## Python Script Compatibility

`main.py` uses BeautifulSoup to find:
```python
article = soup.find('article', class_='article-body')
```

The new `PostLayout.astro` **must** render post content inside:
```html
<article class="article-body">...</article>
```

## Build Commands

```json
{
  "build": "astro build && python main.py",
  "dev": "astro dev",
  "preview": "astro preview"
}
```

## Draft Posts (marked draft: true)

These 9 posts exist in `src/` but are not currently published in `docs/`:

- `battery-station.md`
- `bluetooth-relay-toggle.md`
- `bluetooth-wall-of-sheep.md`
- `diy-electric-skateboard.md`
- `fullstack.md`
- `how-automating-my-garage-door-saved-money-and-time.md`
- `kerbal-space-program-with-an-rc-transmitter.md`
- `kicad-to-flatcam-gcode.md`
- `porting-blog-to-csharp.md`
- `stream-with-stats.md`

## Styling Notes

- Background: `#232b32` (dark)
- Text: `whitesmoke` / `#f5f5f5`
- Accent (links, headings): `#9da2ff`
- Font: Inconsolata (Google Fonts, monospace)
- Tailwind plugin: `@tailwindcss/typography` for post body prose
- Shiki theme: `one-dark-pro` (closest to current highlight.js `agate`)

## Phases

- [x] Create design/todo doc
- [ ] Phase 1: Scaffold Astro project
- [ ] Phase 2: Content collections + migrate posts
- [ ] Phase 3: Layouts and components
- [ ] Phase 4: Tailwind styling
- [ ] Phase 5: Static assets
- [ ] Phase 6: PWA / Service Worker
- [ ] Phase 7: Remove old build system
- [ ] Phase 8: Validate and test
