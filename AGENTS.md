---
description: Personal static blog (Astro → GitHub Pages served from docs/ on master). Guides local build, audio-on-demand, commit, and push workflow.
---

# DoCodeThatMatters — Agent Guide

Personal blog (Astro). Live site: https://docodethatmatters.com — served by GitHub
Pages from the committed `docs/` directory on the `master` branch.

## Publish flow (when changing content/code)

Run these in order:

1. `npm run build` — builds the site ONLY (`astro build` → `scripts/generate-epub.mjs`
   → `scripts/validate-xml.mjs` → `scripts/validate-pwa.mjs`). **No audio is generated.**
2. `npm run audio` — OPTIONAL, only when you actually want TTS this publish. Generates
   spoken scripts + `index.mp3`/`index.opus` for posts whose content changed (hash-cached
   via `audio-hashes.json` / `script-hashes.json`). Supports `npm run audio -- --slug <slug>`.
   It prints which posts changed ("These N post(s) changed and will get fresh audio") before generating.
3. `git add docs/` — stage the build output (this is the served artifact).
4. `git commit -m "..."` — concise message (see history style: `feat:`, `fix:`, `build:`).
5. `git push` — Push requires the active gh account to be **`skittleson`**, NOT `spencerkittleson`.

## gh auth gotcha (push 403)

Repo is `skittleson/DoCodeThatMatters`. The default active gh account is
`spencerkittleson`, which only has read access → `git push` fails with
`403 Permission to skittleson/DoCodeThatMatters.git denied to spencerkittleson`.

Fix before pushing:

```sh
gh auth switch --hostname github.com   # pick skittleson as the active account
git push origin master
```

To switch back later: `gh auth switch` again.

## Audio on demand (`npm run audio`)

- Runs `uv run python main.py`. Never runs as part of `npm run build`.
- Two passes: pass 1 calls out which posts changed and will get fresh audio; pass 2
  generates only those. Unchanged posts are skipped via sidecar hashes.
- Per-post opt-out: set `audio: false` in a post's frontmatter to skip it entirely.
- Runtime is seconds when nothing changed (hash-cached no-op).

## Checks

- Tests: `uv run pytest` (Python unit tests for main.py).
- Build gates: xml + PWA validators run automatically at the end of `npm run build`.
