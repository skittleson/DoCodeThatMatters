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
   Audio lands in `public/audio/<slug>/`, so run `npm run build` again afterwards to copy it
   into `docs/audio/`. Also stage `public/audio/<slug>/`, `audio-hashes.json`, `script-hashes.json`.
3. `git add docs/` — stage the build output (this is the served artifact). Stage named paths only,
   never `git add -A` (untracked skill dirs, `deno.lock`, and a `node_modules` symlink in worktrees).
   First check `git status --short src/`: see "Uncommitted edits in other posts" below.
4. `git commit -m "..."` — concise message (see history style: `feat:`, `fix:`, `build:`).
5. `git push` — Push requires the active gh account to be **`skittleson`**, NOT `spencerkittleson`.

## gh auth gotcha (push 403)

Repo is `skittleson/DoCodeThatMatters`. The default active gh account is
`spencerkittleson`, which only has read access → `git push` fails with
`403 Permission to skittleson/DoCodeThatMatters.git denied to spencerkittleson`.

Fix before pushing:

```sh
gh auth switch --hostname github.com --user skittleson   # non-interactive
git push origin master
```

To switch back later: `gh auth switch` again. The active account drifts back to
`spencerkittleson` between sessions, so switch before every push, not once.

## Uncommitted edits in other posts

`npm run build` rebuilds all of `docs/` from the working tree. Uncommitted edits in any other
post end up in shared files (`rss.xml`, `feed.json`, `llms.txt`, the index pages, and every
page's "recent posts" sidebar), so committing `docs/` would publish them.

If `git status --short src/` shows edits that aren't yours, either:

- build in a clean worktree: `git worktree add --detach /tmp/opencode/<name> HEAD`, symlink
  `node_modules` and `.venv` into it, make your change there, build, copy your changed files
  back, then `git worktree remove --force`; or
- build in place and prove every changed `docs/` file differs only by your change (diff each
  against `git show HEAD:<file>`), and stage only your post's files plus `docs/`.

Leave the other edits uncommitted and tell Spencer they're there.

The reverse also happens: another session's `docs/` commit can publish *your* unfinished post,
because it built from a working tree that had your untracked file. Before your first commit of a
new post, run `git ls-files docs/<slug>/`; if it's already tracked, tell Spencer which commit
published it (`git log --oneline -1 -- docs/<slug>/index.html`).

## Stale output and look-alike slugs

- `draft: true` posts get no page, but an old `docs/<slug>/` from before the post became a draft
  is never cleaned up.
- Slugs can look alike: `i-scanned-the-ble-devices-around-my-house.md` (live) and
  `i-scanned-the-ble-devices-around-my-house-they-are-sharing-everything.md` (deleted draft) once
  led to deleting the live post's output. Before deleting `docs/<slug>/`, open the source file
  with exactly that slug and check its frontmatter.
- The slug comes from the filename, so retitling a post keeps its URL. The new title still
  touches nearly every page (sidebars, feeds), which is expected.

## Checking the deploy

GitHub Pages takes 2–4 minutes after a push. Wait for `built` on your commit before checking
the live site:

```sh
gh api repos/skittleson/DoCodeThatMatters/pages/builds/latest --jq '.status+" "+.commit[0:7]'
```

## Affiliate links

- Tag is `dctm-20`. Prefer `https://www.amazon.com/dp/<ASIN>?tag=dctm-20` over `amzn.to`
  short links, which hide the ASIN.
- Links rot. Check them in Spencer's real Chromium (CDP 127.0.0.1:9223, helper
  `~/.config/opencode/skills/linkedin-post-scheduler/scripts/cdp.py`), not with curl: Amazon
  answers bots with a 200 "Page Not Found" page. Dead = page title `Page Not Found`; unavailable
  = `#availability` says "Currently unavailable".
- Replace with the same product (or its direct successor) and fix the link text to match the
  listing. If nothing equivalent is sold, write "No longer sold on Amazon" instead of quietly
  linking a different product. A different product needs its own row labeled as an alternative.
- Pages with affiliate links carry a disclosure line.

## Sharing on Hacker News

`reports/hn_personal_blogs_top6mo.md` has the analysis. What applies to this site:

- Submit blog posts as plain links, not Show HN. Every Show HN of a post from this domain got
  2–3 points; the best result (9 points) was a plain first-person title.
- HN uses the article's own title, so retitle the post itself: a short stance, about 7 words.
- Top stories cluster at 6–11am PT, Tue–Thu. Post an "Author here" first comment, don't ask
  for votes, don't resubmit.
- To check a title or topic against real HN data, use the `hn-dataset` skill (the
  `open-index/hacker-news` parquet dataset, cached per month with DuckDB). Across 2023–2026,
  "I built / I made" titles reached 300+ points at 24% vs a 15% baseline; question titles 13%.

## Audio on demand (`npm run audio`)

- Runs `uv run python main.py`. Never runs as part of `npm run build`.
- Two passes: pass 1 calls out which posts changed and will get fresh audio; pass 2
  generates only those. Unchanged posts are skipped via sidecar hashes.
- Per-post opt-out: set `audio: false` in a post's frontmatter to skip it entirely.
- Runtime is seconds when nothing changed (hash-cached no-op).
- Don't pipe it into a filter (`npm run audio ... | grep ...`). If the filter exits early, the run
  dies with no error. Redirect to a log file and grep the log.
- The narration reads blockquotes such as the AI;DR note, so regenerate after editing them.

## Checks

- Tests: `uv run pytest` (Python unit tests for main.py).
- Build gates: xml + PWA validators run automatically at the end of `npm run build`.
