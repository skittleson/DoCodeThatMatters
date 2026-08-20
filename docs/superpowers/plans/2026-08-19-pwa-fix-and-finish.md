# PWA Fix-and-Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-scaffolded PWA on docodethatmatters.com actually work: register the service worker on every page (not just `/about`), stop it from caching admin/editor tooling and large binary downloads, and add a build-time check that keeps it from silently regressing.

**Architecture:** Split `public/site.js`'s two unrelated responsibilities into `public/register-sw.js` (service-worker registration, loaded site-wide from `BaseLayout.astro`) and a trimmed `public/site.js` (contact-form relay, still `/about`-only). Add path/extension exclusions plus a cache-version bump to `public/sw.js`. Add `scripts/validate-pwa.mjs`, following the existing `scripts/validate-xml.mjs` pattern, wired into the `build` npm script.

**Tech Stack:** Astro 7 (static output to `docs/`), plain browser JS (`public/*.js`), Node.js `.mjs` build scripts (no dependencies), npm scripts.

## Global Constraints

- Do not modify `public/manifest.json` or any icon file — the spec marks this out of scope (already meets Lighthouse installability criteria).
- Do not add any "Install app" button/banner or `beforeinstallprompt` handling — out of scope per spec.
- Do not change `fetchContactRelayCore` / `public/contact-relay.js` behavior — only move code between files, never alter contact-form logic.
- Never run `git add docs/` or `git add -A` in this plan. `docs/` is the Astro build output and is committed separately as part of the site's normal deploy process (see `Readme.md`); this plan only touches source files (`public/`, `src/`, `scripts/`, `package.json`). Verification steps run builds locally to inspect output but must not stage or commit anything under `docs/`.
- Follow the existing `scripts/validate-xml.mjs` style for any new validation script: dependency-free Node (`fs/promises`, `path`, `url` only), an env var override for the target directory, `console.log`/`console.error` with `✓`/`✗` markers, non-zero `process.exit(1)` on failure.
- For build verification during this plan, use `npx astro build` (the static-generation step only) rather than the full `npm run build`, since the full chain also runs `uv run python main.py` (a heavyweight local TTS pipeline with GPU/model dependencies not needed to verify these changes).

---

### Task 1: Split service-worker registration out of `site.js` into `register-sw.js`, load it site-wide

**Files:**
- Create: `public/register-sw.js`
- Modify: `public/site.js`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Produces: `register-sw.js` is a standalone script with no exports (runs its registration IIFE on load). Later tasks don't call into it programmatically — Task 2 only needs to know it registers `/sw.js`.

- [ ] **Step 1: Create `public/register-sw.js`**

Create the file with exactly this content (moved verbatim from the top of the current `public/site.js`):

```js
if ("serviceWorker" in navigator) {
  if (navigator.serviceWorker.controller) {
    console.log(
      "[PWA Builder] active service worker found, no need to register"
    );
  } else {
    // Register the service worker
    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
      })
      .then(function (reg) {
        console.log(
          "[PWA Builder] Service worker has been registered for scope: " +
            reg.scope
        );
      });
  }
}
```

- [ ] **Step 2: Trim `public/site.js` down to just the contact-form relay**

Replace the full current contents of `public/site.js` with exactly this (the registration block removed, `fetchContactRelay` unchanged):

```js
async function fetchContactRelay(form) {
  const formElement = document.querySelector("#messageForm");
  const submitButton = formElement.querySelector("input[type=submit]");
  submitButton.disabled = true;
  try {
    // grecaptcha.ready(function () {
    //   const token = await grecaptcha.execute("reCAPTCHA_site_key", {
    //     action: "submit",
    //   });
    // });

    const email = form.querySelector("#emailFormControlInput").value;
    const message = form.querySelector("#messageFormControlInput").value;
    const request = {
      email,
      message,
    };
    const response = await fetchContactRelayCore(request);
    if (response.success) {
      formElement.hidden = true;
      alert("Thank you!");
    } else {
      submitButton.disabled = false;
      alert(response.errorMsg);
    }
  } catch (error) {
    console.log(error);
  }
}
```

- [ ] **Step 3: Load `register-sw.js` site-wide from `BaseLayout.astro`**

In `src/layouts/BaseLayout.astro`, find this line (currently line 104):

```astro
  <link rel="manifest" href="/manifest.json" />
```

Add the new script tag directly after it, so the block reads:

```astro
  <link rel="manifest" href="/manifest.json" />
  <script src="/register-sw.js" defer></script>
```

Leave everything else in `BaseLayout.astro` unchanged. Do **not** touch `src/pages/about/index.astro` — it keeps its own `<script src="/site.js" defer></script>` and `<script src="/contact-relay.js" defer></script>` tags exactly as they are.

- [ ] **Step 4: Verify with a static build (no browser needed)**

Run:

```bash
npx astro build
```

Then verify the output with grep (all should print a match; no command should error):

```bash
grep -o '<script src="/register-sw.js" defer></script>' docs/index.html
grep -o '<script src="/register-sw.js" defer></script>' docs/about/index.html
grep -o '<script src="/site.js" defer></script>' docs/about/index.html
grep -o '<script src="/contact-relay.js" defer></script>' docs/about/index.html
test -f docs/register-sw.js && echo "register-sw.js copied: OK"
grep -c 'serviceWorker' docs/register-sw.js
grep -c 'serviceWorker' docs/site.js
```

Expected:
- Both `docs/index.html` and `docs/about/index.html` contain the `register-sw.js` script tag (confirms it's site-wide, fixing the original bug).
- `docs/about/index.html` still contains its `site.js` and `contact-relay.js` tags (confirms the about page's contact form wiring is untouched).
- `docs/register-sw.js` exists and contains `serviceWorker` (count `>= 1`).
- `docs/site.js` no longer contains `serviceWorker` (count `0`) — confirms the registration code actually moved out.

- [ ] **Step 5: Commit**

```bash
git add public/register-sw.js public/site.js src/layouts/BaseLayout.astro
git commit -m "fix(pwa): register service worker site-wide, not just on /about"
```

---

### Task 2: Exclude admin/editor and large binaries from the service worker cache; bump cache version

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing consumed by later tasks directly, but Task 3's `validate-pwa.mjs` greps this file's source for the literal substrings `/admin`, `/edit`, `.mp3`, `.epub` — keep those exact strings present in the new exclusion logic (not, e.g., only regex character classes that never spell them out literally).

- [ ] **Step 1: Bump the cache version**

In `public/sw.js`, find:

```js
const CACHE = "pwabuilder-offline-v2";
```

Replace with:

```js
const CACHE = "pwabuilder-offline-v3";
```

- [ ] **Step 2: Add exclusions to the `fetch` handler**

Find this block in `public/sw.js`:

```js
self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") return;

  // Do not intercept Google Analytics/Tag Manager requests
  if (event.request.url.includes("googletagmanager.com")) return;

  event.respondWith(
```

Replace it with:

```js
self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") return;

  // Do not intercept Google Analytics/Tag Manager requests
  if (event.request.url.includes("googletagmanager.com")) return;

  // Do not intercept admin/editor tooling or large binary downloads
  // (audio + epub) -- let the browser fetch these directly, uncached.
  var requestUrl = new URL(event.request.url);
  var isExcludedPath = requestUrl.pathname.startsWith("/admin") || requestUrl.pathname.startsWith("/edit");
  var isExcludedFile = requestUrl.pathname.endsWith(".mp3") || requestUrl.pathname.endsWith(".epub");
  if (isExcludedPath || isExcludedFile) return;

  event.respondWith(
```

Leave the rest of `public/sw.js` (the `.then`/`.catch`, `fromCache`, `updateCache`) unchanged.

- [ ] **Step 3: Verify with a syntax check and greps (no browser needed)**

```bash
node --check public/sw.js
grep -c 'pwabuilder-offline-v3' public/sw.js
grep -c '"/admin"' public/sw.js
grep -c '"/edit"' public/sw.js
grep -c '".mp3"' public/sw.js
grep -c '".epub"' public/sw.js
```

Expected: `node --check` prints nothing and exits 0 (valid JS syntax); every `grep -c` prints `1` or higher.

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "fix(pwa): exclude admin/editor and large binaries from SW cache; bump cache version"
```

---

### Task 3: Add `scripts/validate-pwa.mjs` and wire it into `npm run build`

**Files:**
- Create: `scripts/validate-pwa.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the `docs/manifest.json`, `docs/sw.js`, `docs/register-sw.js`, `docs/offline/index.html`, and icon files produced by `astro build` (Tasks 1 and 2's changes flow through automatically once `public/` is copied by Astro — no direct code dependency on Tasks 1/2).

- [ ] **Step 1: Create `scripts/validate-pwa.mjs`**

```js
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = process.env.VALIDATE_PWA_DIR || join(__dirname, '..', 'docs');

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function validateManifest(errors) {
  const manifestPath = join(docsDir, 'manifest.json');
  if (!(await fileExists(manifestPath))) {
    errors.push(`manifest.json: missing at ${manifestPath}`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    errors.push(`manifest.json: invalid JSON (${err.message})`);
    return;
  }

  for (const field of ['name', 'start_url', 'display']) {
    if (!manifest[field]) {
      errors.push(`manifest.json: missing required field "${field}"`);
    }
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    errors.push('manifest.json: "icons" must be a non-empty array');
    return;
  }

  for (const icon of manifest.icons) {
    if (!icon.src) {
      errors.push('manifest.json: icon entry missing "src"');
      continue;
    }
    const iconPath = join(docsDir, icon.src.replace(/^\//, ''));
    if (!(await fileExists(iconPath))) {
      errors.push(`manifest.json: icon "${icon.src}" does not resolve to a file in docs/`);
    }
  }
}

async function validateServiceWorkerFiles(errors) {
  for (const file of ['sw.js', 'register-sw.js']) {
    if (!(await fileExists(join(docsDir, file)))) {
      errors.push(`${file}: missing at docs/${file}`);
    }
  }
}

async function validateOfflinePage(errors) {
  const offlinePath = join(docsDir, 'offline', 'index.html');
  if (!(await fileExists(offlinePath))) {
    errors.push("offline/index.html: missing (required as the service worker's install-time precache target)");
  }
}

async function validateExclusions(errors) {
  const swPath = join(docsDir, 'sw.js');
  if (!(await fileExists(swPath))) return; // already reported by validateServiceWorkerFiles

  const source = await readFile(swPath, 'utf8');
  const requiredExclusions = ['/admin', '/edit', '.mp3', '.epub'];
  for (const marker of requiredExclusions) {
    if (!source.includes(marker)) {
      errors.push(`sw.js: missing expected cache-exclusion marker "${marker}"`);
    }
  }
}

async function main() {
  const errors = [];

  await validateManifest(errors);
  await validateServiceWorkerFiles(errors);
  await validateOfflinePage(errors);
  await validateExclusions(errors);

  if (errors.length) {
    console.error('validate-pwa: FAILED');
    for (const err of errors) console.error(`  ✗ ${err}`);
    process.exit(1);
  }

  console.log('validate-pwa: all PWA checks passed');
}

main().catch((err) => {
  console.error('validate-pwa: unexpected error', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it passes against a real build**

```bash
npx astro build
node scripts/validate-pwa.mjs
```

Expected: exits 0, prints `validate-pwa: all PWA checks passed`.

- [ ] **Step 3: Verify it fails loudly when something's broken**

```bash
mv docs/manifest.json docs/manifest.json.bak
node scripts/validate-pwa.mjs; echo "exit code: $?"
mv docs/manifest.json.bak docs/manifest.json
```

Expected: prints `validate-pwa: FAILED` with a line about `manifest.json: missing at ...`, and `exit code: 1`.

Also spot-check the exclusion-marker check:

```bash
cp docs/sw.js /tmp/sw.js.bak
sed -i 's#/admin#REMOVED#' docs/sw.js
node scripts/validate-pwa.mjs; echo "exit code: $?"
cp /tmp/sw.js.bak docs/sw.js
```

Expected: prints `sw.js: missing expected cache-exclusion marker "/admin"` and `exit code: 1`. Restore `docs/sw.js` from the backup afterward (already done by the last `cp`).

- [ ] **Step 4: Wire the script into `npm run build`**

In `package.json`, find:

```json
    "build": "astro build && node scripts/generate-epub.mjs && uv run python main.py && node scripts/validate-xml.mjs",
```

Replace with:

```json
    "build": "astro build && node scripts/generate-epub.mjs && uv run python main.py && node scripts/validate-xml.mjs && node scripts/validate-pwa.mjs",
```

Also add a standalone convenience script, mirroring the existing `validate:xml` entry. Find:

```json
    "validate:xml": "node scripts/validate-xml.mjs",
```

Replace with:

```json
    "validate:xml": "node scripts/validate-xml.mjs",
    "validate:pwa": "node scripts/validate-pwa.mjs",
```

- [ ] **Step 5: Verify the `package.json` edit is valid**

```bash
node -e "const p = require('./package.json'); console.log(p.scripts.build); console.log(p.scripts['validate:pwa'])"
```

Expected: prints the updated `build` string ending in `&& node scripts/validate-pwa.mjs`, then prints `node scripts/validate-pwa.mjs`.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-pwa.mjs package.json
git commit -m "build: validate PWA artifacts (manifest, sw.js, offline page, exclusions) after build"
```

---

## Final End-to-End Check (run after all three tasks are committed)

- [ ] Run the full static-generation + validation path in one shot and confirm the whole chain passes:

```bash
npx astro build && node scripts/validate-xml.mjs && node scripts/validate-pwa.mjs
```

Expected: both validators print their `all ... passed`/`all ... valid` success lines, and the command's exit code is 0. Do not run `git add docs/` — leave the regenerated `docs/` build output unstaged; it is not part of this plan's commits.

- [ ] Optional, human-only (not scriptable by an agentic executor without a real browser): run `npm run preview`, open the site in Chrome, and confirm in DevTools → Application → Service Workers that a worker registers on the homepage (not just `/about`), and that DevTools → Lighthouse reports the site as installable. This matches the design spec's "Testing" section and is a nice-to-have confirmation on top of the scripted checks above, not a blocker for landing the commits.
