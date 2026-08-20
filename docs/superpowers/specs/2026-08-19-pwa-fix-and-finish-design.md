# PWA: fix and finish existing setup — design

## Context

`docodethatmatters.com` (this Astro static blog) already has most of a PWA
built by a prior PWABuilder run:

- `public/manifest.json` — complete (name, icons, theme colors, `display:
  standalone`, `start_url: /`).
- `public/sw.js` — a network-first-with-cache-fallback "offline copy of
  pages" service worker.
- `public/site.js` — registers `sw.js`, and also contains the unrelated
  `fetchContactRelay` logic used by the `/about` contact form.
- `src/pages/offline/index.astro` — offline fallback page, precached at SW
  install time.
- All icon PNGs referenced by the manifest exist under `public/images/`.
- `<link rel="manifest">` and full favicon set are already wired into
  `src/layouts/BaseLayout.astro`, which every page uses.

**The bug:** `site.js` — the file that registers the service worker — is
only loaded on `/about` (`src/pages/about/index.astro:99`). On every other
page (home, every blog post, blog index) the service worker never
registers, so the PWA is currently inert everywhere except `/about`.

There's also `src/pages/admin.astro` and `src/pages/edit.astro`, an
in-browser markdown editor for authoring posts. The current service worker
has no exclusions, so it would cache these full-page-intercept style along
with everything else.

## Outcomes

- The service worker registers on every page, not just `/about`.
- Visitors who go offline can still read cached HTML pages, CSS, JS, fonts,
  and images.
- Admin/editor tooling (`/admin`, `/edit`) and large binary downloads
  (per-post `index.mp3` audio, `blog.epub`) are never intercepted or cached
  by the service worker.
- A build-time check fails the build if the PWA artifacts are missing or
  misconfigured, so this can't silently regress again.

## Non-goals / boundaries

- No changes to `manifest.json` or the icon set — it already satisfies
  Lighthouse's installability criteria (name/short_name, 192px + 512px
  icons, `start_url`, `display: standalone`).
- No custom "Install app" button/banner (`beforeinstallprompt` UI). Rely on
  the browser's native install affordance.
- No change to the contact-form relay behavior (`fetchContactRelayCore`,
  `contact-relay.js`) beyond moving code between files.
- No Lighthouse CI integration — verification is a lightweight,
  dependency-free Node script in the existing `scripts/` style, run as part
  of `npm run build`.

## Design

### 1. Registration: split by concern

`public/site.js` currently mixes two unrelated responsibilities: SW
registration (needed site-wide) and the contact-form relay (needed only on
`/about`). Split them:

- **New `public/register-sw.js`** — the existing `if ("serviceWorker" in
  navigator) {...}` registration IIFE, moved verbatim out of `site.js`.
- **`src/layouts/BaseLayout.astro`** — add
  `<script src="/register-sw.js" defer></script>` in `<head>`, so every
  page that uses `BaseLayout` registers the service worker.
- **`public/site.js`** — keep only `fetchContactRelay`. Still loaded solely
  by `src/pages/about/index.astro` via its existing
  `<script src="/site.js" defer>` tag — that page is unchanged.

This keeps each file single-purpose: `register-sw.js` is PWA plumbing
loaded everywhere, `site.js` is about-page-specific form logic.

### 2. Caching strategy in `sw.js`

Keep the existing network-first, cache-fallback-when-offline model — it
already prefers fresh content whenever the network is available and only
serves from cache when a fetch fails. Add exclusions inside the `fetch`
listener so excluded requests are never intercepted (no `respondWith`, no
`updateCache` call — the browser handles them natively, exactly as if the
service worker didn't exist for that request):

- Path starts with `/admin` or `/edit`.
- Path ends with `.mp3` or `.epub`.
- (Existing exclusions stay: non-GET requests, `googletagmanager.com`.)

Bump `CACHE` from `"pwabuilder-offline-v2"` to `"pwabuilder-offline-v3"`.
The service worker's existing `activate` handler already deletes any cache
whose name doesn't match `CACHE`, so this one-time version bump clears out
whatever got cached during the "only registers on /about" era before the
exclusions existed.

Net effect: HTML, CSS, JS, fonts, and images are cached for offline
reading. Admin/editor pages, blog post audio, and the epub download are
always fetched fresh from the network and never touched by the cache.

### 3. Manifest / icons

No changes. Already meets Lighthouse's PWA installability bar.

### 4. Build-time verification: `scripts/validate-pwa.mjs`

New script, following the existing `scripts/validate-xml.mjs` pattern
(dependency-free Node, defaults to reading the `docs/` build output, honors
an env var override for testability, non-zero exit on any failure):

- `docs/manifest.json` exists, parses as JSON, and has `name`, `icons`
  (non-empty array), `start_url`, and `display`.
- Every icon's `src` in the manifest resolves to a real file under `docs/`.
- `docs/sw.js` and `docs/register-sw.js` exist (confirms Astro copied
  `public/` correctly).
- `docs/offline/index.html` exists (the SW's install-time precache
  target).
- `docs/sw.js`'s source contains the `/admin` and `/edit` exclusion
  strings, so a future edit can't silently drop them without failing the
  build.

Wired into `package.json`'s `build` script immediately after the existing
`validate:xml` step:

```
astro build && node scripts/generate-epub.mjs && uv run python main.py && node scripts/validate-xml.mjs && node scripts/validate-pwa.mjs
```

## Testing

- Run `npm run build`, then `npm run preview`, and manually confirm in
  Chrome DevTools → Application → Service Workers that `register-sw.js`
  registers `sw.js` on the homepage (not just `/about`), and that
  DevTools → Lighthouse reports the site as installable.
- Confirm `/admin` and `/edit` still load correctly and are absent from
  `caches.open('pwabuilder-offline-v3')` after visiting them.
- Confirm a post's audio (`index.mp3`) is not present in the same cache
  after playing it.
- `node scripts/validate-pwa.mjs` (via `npm run build`) exits 0 on a good
  build and exits non-zero if e.g. an icon file is deleted or the `/admin`
  exclusion string is removed from `sw.js` (spot-check by temporarily
  breaking each and re-running).
