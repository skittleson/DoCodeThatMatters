# SEO Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the six agreed SEO quick-wins (canonical, self-hosted contact relay + CSP, single-brand titles, About H1, per-page og:type/twitter:card) in one PR.

**Architecture:** All changes are small edits to the shared `BaseLayout.astro` head, the `PostLayout.astro` BaseLayout invocation, and the `about/index.astro` page, plus one new static asset. No new dependencies, no new pages, no backend.

**Tech Stack:** Astro 7 (static output → `docs/`), Tailwind, GitHub Pages.

## Global Constraints

- Site is `https://docodethatmatters.com`; `trailingSlash: 'always'`.
- CSP is set via `<meta http-equiv>` in `BaseLayout.astro:48` (not server headers).
- Do NOT add JSON-LD; keep the existing microdata schema.
- Brand string is exactly `Do Code That Matters`.
- Verification is `npm run build` (runs `astro build` + EPUB + TTS + XML validation).
- Note: the full `npm run build` includes a TTS step (`uv run python main.py`) that is slow/optional for verifying these HTML changes. For fast iteration use `npx astro build` (the Astro-only step) and confirm the `docs/` HTML; run the full `npm run build` once at the end before committing.

## File Structure

| File | Change |
|------|--------|
| `src/layouts/BaseLayout.astro` | Add canonical; allow relay origin in CSP (`script-src`, `connect-src`, `form-action`); add `ogType`/`twitterCard` props; de-dup `og:title`/`twitter:title`. |
| `public/contact-relay.js` | New — self-hosted copy of the anti-CSRF relay script. |
| `src/pages/about/index.astro` | Title → `About — Do Code That Matters`; first H2 → H1; `<script src>` → `/contact-relay.js`. |
| `src/pages/index.astro` | Title → `Do Code That Matters — Software, 3D Printing & DIY Blog`. |
| `src/layouts/PostLayout.astro` | Title → `${title} — Do Code That Matters`; pass `ogType="article"` and `twitterCard="summary_large_image"`. |

---

### Task 1: BaseLayout — canonical, CSP, og-type props, title de-dup

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: `title`, `description`, `image`, `keywords`, `canonicalUrl` (all existing props).
- Produces: two new optional props `ogType?: string` (default `'website'`) and `twitterCard?: string` (default `'summary'`) that `PostLayout.astro` (Task 4) will set.

- [ ] **Step 1: Add the two props to the interface and destructure**

In `src/layouts/BaseLayout.astro`, change the `Props` interface (lines 6-12) to:

```astro
interface Props {
  title: string;
  description?: string;
  image?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: string;
  twitterCard?: string;
}
```

and the destructure (lines 14-20) to:

```astro
const {
  title,
  description = 'Personal blog about software development, 3D printing, DIY, dotnet, raspberry pis, and C#',
  image = '/images/agile.jpg',
  keywords = ['software engineer blog', 'code', 'raspberry pi', 'maker', 'c#'],
  canonicalUrl,
  ogType = 'website',
  twitterCard = 'summary',
} = Astro.props;
```

- [ ] **Step 2: Add the canonical link after the `<title>`**

Replace line 49 (`  <title>{title}</title>`) with:

```astro
  <title>{title}</title>
  <link rel="canonical" href={pageUrl} />
```

- [ ] **Step 3: Allow the relay origin in CSP**

Replace the CSP meta (line 48) with:

```astro
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://t0aqplp9ri.execute-api.us-east-1.amazonaws.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' https://api.github.com https://www.google-analytics.com https://www.googletagmanager.com https://t0aqplp9ri.execute-api.us-east-1.amazonaws.com; base-uri 'self'; form-action 'self' https://t0aqplp9ri.execute-api.us-east-1.amazonaws.com" />
```

- [ ] **Step 4: De-dup og:title and twitter:title**

Replace line 61 (`  <meta property="og:title" content={`${title} - ${company}`} />`) with:

```astro
  <meta property="og:title" content={title} />
```

and line 71 (`  <meta name="twitter:title" content={`${title} - ${company}`} />`) with:

```astro
  <meta name="twitter:title" content={title} />
```

- [ ] **Step 5: Make og:type and twitter:card use the props**

Replace line 64 (`  <meta property="og:type" content="article" />`) with:

```astro
  <meta property="og:type" content={ogType} />
```

and line 70 (`  <meta name="twitter:card" content="summary" />`) with:

```astro
  <meta name="twitter:card" content={twitterCard} />
```

- [ ] **Step 6: Build and verify the head**

Run: `npx astro build`
Expected: succeeds (or only pre-existing TTS/EPUB steps unrelated to head HTML).

Then verify in the built output:

```bash
grep -o '<link rel="canonical" href="[^"]*"' docs/index.html
grep -o 'property="og:type" content="[^"]*"' docs/index.html
grep -o 'name="twitter:card" content="[^"]*"' docs/index.html
grep -o 'Content-Security-Policy[^>]*t0aqplp9ri[^>]*' docs/index.html | head -c 120
```

Expected:
- canonical = `https://docodethatmatters.com/`
- `og:type` = `website`
- `twitter:card` = `summary`
- CSP contains the `t0aqplp9ri.execute-api.us-east-1.amazonaws.com` origin.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat(seo): add canonical, per-page og:type/twitter:card, CSP relay origin, de-dup titles"
```

---

### Task 2: Self-host the contact relay + point About at it

**Files:**
- Create: `public/contact-relay.js`
- Modify: `src/pages/about/index.astro:99`

**Interfaces:**
- Consumes: the `fetchContactRelay` global the relay script defines (used by the form's `onsubmit` at `about/index.astro:63`).
- Produces: a self-hosted `/contact-relay.js` that defines `fetchContactRelay`.

- [ ] **Step 1: Create the self-hosted relay script**

Create `public/contact-relay.js` with exactly this content (the relay script, with the commented-out `digestMessage` block removed for cleanliness):

```js
const contactRelayLoadedScriptSource = document.currentScript.src;
async function fetchContactRelayCore(request) {
  const endpoint = new URL(contactRelayLoadedScriptSource).origin + "/latest";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  try {
    const fetchTokenResponse = await fetch(endpoint, {
      credentials: "include",
      headers: headers,
    });
    if (fetchTokenResponse.status !== 200) {
      throw new Error("Failed to fetch anticsrf token");
    }
    const tokenResponse = await fetchTokenResponse.json();
    request.token = tokenResponse.token;
  } catch (error) {
    return {
      success: false,
      errorMsg: "Unable to create session with anticsrf",
      error,
    };
  }
  try {
    const fetchMessage = await fetch(endpoint, {
      body: JSON.stringify(request),
      credentials: "include",
      headers: headers,
      method: "POST",
    });
    if (fetchMessage.status !== 200) {
      throw new Error("Failed to fetch anticsrf token");
    }
    const fetchMessageResponse = await fetchMessage.text();
    return {
      success: true,
      errorMsg: "",
      error: null,
      data: fetchMessageResponse,
    };
  } catch (error) {
    return { success: false, errorMsg: "Unable to send message", error };
  }
}
```

> Note: `public/` files are served verbatim at the site root, so this becomes `/contact-relay.js`.

- [ ] **Step 2: Point the About page at the self-hosted script**

In `src/pages/about/index.astro`, replace line 99:

```astro
  <script src="https://t0aqplp9ri.execute-api.us-east-1.amazonaws.com/latest/script" defer></script>
```

with:

```astro
  <script src="/contact-relay.js" defer></script>
```

- [ ] **Step 3: Build and verify**

Run: `npx astro build`
Expected: succeeds.

Verify:

```bash
test -f public/contact-relay.js && echo "source ok"
grep -o '<script src="/contact-relay.js" defer></script>' docs/about/index.html
grep -c 't0aqplp9ri.execute-api.us-east-1.amazonaws.com/latest/script' docs/about/index.html || echo "remote script removed (0 matches)"
```

Expected:
- `source ok`
- the self-hosted `<script src="/contact-relay.js" defer></script>` present in `docs/about/index.html`
- `remote script removed (0 matches)`

- [ ] **Step 4: Commit**

```bash
git add public/contact-relay.js src/pages/about/index.astro
git commit -m "fix(contact): self-host relay script and remove remote script tag"
```

---

### Task 3: About page — single-brand title + H1

**Files:**
- Modify: `src/pages/about/index.astro:7,27`

**Interfaces:**
- Consumes: `BaseLayout` (now with de-duped og:title from Task 1).
- Produces: an About page with `<title>About — Do Code That Matters</title>`, `og:title` identical (no double brand), and an `<h1>`.

- [ ] **Step 1: Set the single-brand title**

In `src/pages/about/index.astro`, replace line 7 (`  title="About - Do Code That Matters"`) with:

```astro
  title="About — Do Code That Matters"
```

- [ ] **Step 2: Promote the first H2 to H1**

In `src/pages/about/index.astro`, replace lines 27-29:

```astro
    <h2 class="text-2xl font-bold mb-4">
      Hi, I'm <strong>Spencer</strong> <span class="wave">👋</span>
    </h2>
```

with:

```astro
    <h1 class="text-2xl font-bold mb-4">
      Hi, I'm <strong>Spencer</strong> <span class="wave">👋</span>
    </h1>
```

- [ ] **Step 3: Build and verify**

Run: `npx astro build`
Expected: succeeds.

Verify:

```bash
grep -o '<title>[^<]*</title>' docs/about/index.html
grep -o 'property="og:title" content="[^"]*"' docs/about/index.html
grep -oc '<h1' docs/about/index.html
```

Expected:
- `<title>About — Do Code That Matters</title>`
- `og:title` content = `About — Do Code That Matters` (brand appears once, not twice)
- `<h1` count ≥ 1

- [ ] **Step 4: Commit**

```bash
git add src/pages/about/index.astro
git commit -m "fix(about): single-brand title and add H1"
```

---

### Task 4: Homepage + post titles and per-page og:type/twitter:card

**Files:**
- Modify: `src/pages/index.astro:16`
- Modify: `src/layouts/PostLayout.astro:48-54`

**Interfaces:**
- Consumes: `BaseLayout` `ogType`/`twitterCard` props from Task 1.
- Produces: homepage title `Do Code That Matters — Software, 3D Printing & DIY Blog` (og:type `website`), posts titled `{title} — Do Code That Matters` with `og:type=article` and `twitter:card=summary_large_image`.

- [ ] **Step 1: Set the homepage title**

In `src/pages/index.astro`, replace line 16 (`<BaseLayout title="Do Code That Matters">`) with:

```astro
<BaseLayout title="Do Code That Matters — Software, 3D Printing & DIY Blog">
```

- [ ] **Step 2: Set post title + og:type + twitter:card**

In `src/layouts/PostLayout.astro`, replace the `BaseLayout` invocation (lines 48-54):

```astro
<BaseLayout
  title={title}
  description={description}
  image={image}
  keywords={keywords}
  canonicalUrl={postUrl}
>
```

with:

```astro
<BaseLayout
  title={`${title} — Do Code That Matters`}
  description={description}
  image={image}
  keywords={keywords}
  canonicalUrl={postUrl}
  ogType="article"
  twitterCard="summary_large_image"
>
```

- [ ] **Step 3: Build and verify**

Run: `npx astro build`
Expected: succeeds.

Pick one built post (e.g. `docs/building-custom-http-proxy-rust-mixed-os-workflows/index.html`) and verify:

```bash
P=docs/building-custom-http-proxy-rust-mixed-os-workflows/index.html
grep -o '<title>[^<]*</title>' "$P"
grep -o 'property="og:title" content="[^"]*"' "$P"
grep -o 'property="og:type" content="[^"]*"' "$P"
grep -o 'name="twitter:card" content="[^"]*"' "$P"
grep -o '<link rel="canonical" href="[^"]*"' "$P"
```

Expected:
- `<title>Building a Custom HTTP Proxy in Rust for Mixed-OS Workflows — Do Code That Matters</title>`
- `og:title` = same single-brand string
- `og:type` = `article`
- `twitter:card` = `summary_large_image`
- canonical = `https://docodethatmatters.com/building-custom-http-proxy-rust-mixed-os-workflows/`

And the homepage:

```bash
grep -o '<title>[^<]*</title>' docs/index.html
grep -o 'property="og:type" content="[^"]*"' docs/index.html
```

Expected:
- `<title>Do Code That Matters — Software, 3D Printing & DIY Blog</title>`
- `og:type` = `website`

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/layouts/PostLayout.astro
git commit -m "feat(seo): branded homepage + post titles; article og:type and large twitter card on posts"
```

---

### Task 5: Full build + final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: `astro build` + `generate-epub` + `main.py` (TTS) + `validate-xml` all succeed. (If the TTS step fails for environment reasons unrelated to these changes — e.g. missing `uv`/model — note it and confirm the `docs/` HTML below is correct.)

- [ ] **Step 2: Final cross-page checks**

```bash
echo "== canonical on home/about/a post =="
grep -o '<link rel="canonical" href="[^"]*"' docs/index.html docs/about/index.html docs/building-custom-http-proxy-rust-mixed-os-workflows/index.html
echo "== no double brand anywhere =="
grep -rl 'Do Code That Matters - Do Code That Matters' docs/ || echo "none"
echo "== about has H1 =="
grep -oc '<h1' docs/about/index.html
echo "== relay self-hosted =="
grep -o '<script src="/contact-relay.js" defer></script>' docs/about/index.html
echo "== og:type per page type =="
grep -o 'property="og:type" content="[^"]*"' docs/index.html docs/about/index.html docs/building-custom-http-proxy-rust-mixed-os-workflows/index.html
```

Expected:
- canonical present on all three.
- `none` (no double-brand).
- About H1 count ≥ 1.
- self-hosted relay script present.
- home + about `og:type` = `website`; post `og:type` = `article`.

- [ ] **Step 3: Confirm no stray remote script remains**

```bash
grep -rn 't0aqplp9ri.execute-api.us-east-1.amazonaws.com/latest/script' src/ public/ || echo "clean"
```

Expected: `clean` (the only remaining references to that host are the CSP allowlist in `BaseLayout.astro`, which is intended).

- [ ] **Step 4: Final commit (only if any files changed) / open PR**

If the build produced any unintended changes, review with `git status` and `git diff`. Otherwise the four feature commits above are the PR. Open the PR per the repo's `pull-request` conventions.

---

## Self-Review Notes

- **Spec coverage:** Fixes 1, 2, 3, 4, 5 all have tasks (1, 2, 3, 4). Fix 6 (`microsoft-rant.md` description) was verified a no-op — every post already has a description — so it was intentionally dropped.
- **Placeholder scan:** All steps contain exact code and exact commands.
- **Type/prop consistency:** `ogType`/`twitterCard` are defined in Task 1 and consumed in Task 4 with matching names.
