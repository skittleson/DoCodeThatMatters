# SEO Audit Fixes — Design

**Date:** 2026-08-19
**Site:** docodethatmatters.com (Astro, static, GitHub Pages)
**Approach:** A — single PR, all six fixes, one build, one verify.
**Out of scope:** HSTS proxy, `meta keywords` removal, Sony-post consolidation.

## Background

An SEO audit of the codebase and live site found the site technically healthy
(HTTPS, valid robots.txt + sitemap, GA4, RSS/JSON/EPUB feeds, microdata schema on
posts) with a set of on-page issues and one security/functional bug. This spec
covers the agreed quick-win fixes.

## Fixes

### 1. Canonical tag (High)

Add a self-referencing canonical to every page.

- **File:** `src/layouts/BaseLayout.astro`
- **Change:** After `<title>`, add `<link rel="canonical" href={pageUrl} />`.
- `pageUrl` is already computed (line 25): posts pass `canonicalUrl`; other
  pages derive it from `Astro.url.pathname` + `Astro.site`.
- One line, applies site-wide.

### 2. Contact relay — self-host + CSP allowlist (High)

The About page form loads a remote anti-CSRF relay script that is (a) blocked by
the current CSP so the form is non-functional, and (b) a remote-code-inclusion
risk.

- **Copy** the 1.9 KB relay script to `public/contact-relay.js` (served at
  `/contact-relay.js`).
- **`src/pages/about/index.astro:99`:** change
  `<script src="https://t0aqplp9ri.execute-api.us-east-1.amazonaws.com/latest/script" defer>`
  to `<script src="/contact-relay.js" defer>`.
- **`src/layouts/BaseLayout.astro:48` CSP:** add
  `https://t0aqplp9ri.execute-api.us-east-1.amazonaws.com` to `script-src`,
  `connect-src`, and `form-action`.
- **Why not pure inline:** the script derives its endpoint from
  `document.currentScript.src`, which is undefined when inlined, so it would
  break. Self-hosting the file preserves that.
- **Trade-off (accepted):** the API origin still appears in CSP (the script calls
  it for the anti-CSRF token + message POST), but the arbitrary third-party
  `<script>` injection is removed.

### 3. Title / OG de-duplication (Medium)

Remove the double-brand (`About - Do Code That Matters - Do Code That Matters`)
and give every page a single, branded, descriptive title.

- **`src/layouts/BaseLayout.astro`:** `og:title` and `twitter:title` use `title`
  verbatim (drop the ` - ${company}` suffix).
- **`src/pages/index.astro:16`:** title →
  `Do Code That Matters — Software, 3D Printing & DIY Blog`.
- **`src/pages/about/index.astro:7`:** title → `About — Do Code That Matters`.
- **`src/layouts/PostLayout.astro:49`:** title → `${title} — Do Code That Matters`.

Result: brand appears exactly once per page; no double-branding in SERP or
shares.

### 4. About page H1 (Medium)

- **`src/pages/about/index.astro:27`:** change the first `<h2>`
  (`Hi, I'm Spencer`) to `<h1>`.

### 5. `og:type` / `twitter:card` per page (Low)

- **`src/layouts/BaseLayout.astro`:** add `ogType` (default `website`) and
  `twitterCard` (default `summary`) props; render them on the `og:type` and
  `twitter:card` meta tags.
- Home / blog / about: `ogType=website`, `twitterCard=summary`.
- Posts (`PostLayout.astro`): `ogType=article`, `twitterCard=summary_large_image`
  (larger share preview for posts with a hero image).

### 6. `microsoft-rant.md` description (Low)

- **`src/content/blog/microsoft-rant.md`:** add a unique 150–160 character
  `description` (currently missing, so it falls back to the generic site
  description in SERPs).

## Verification

1. `npm run build`.
2. Confirm in built `docs/`:
   - `<link rel="canonical">` present on home, about, blog, and a post.
   - CSP meta includes the AWS API origin in `script-src`, `connect-src`,
     `form-action`.
   - `<title>` is single-brand on every page; `og:title` matches (no double
     brand).
   - About page has an `<h1>`.
   - `og:type` is `website` on home/blog/about and `article` on posts;
     `twitter:card` is `summary_large_image` on posts.
   - `docs/contact-relay.js` exists and `about/index.html` references
     `/contact-relay.js` (not the remote URL).
   - `microsoft-rant` post has a meta description.
3. Lint/typecheck per repo conventions.
