# My Personal Blog

Go check it out here: [https://docodethatmatters.com](https://docodethatmatters.com)

## Creating a Post

1. Create a new file in `src/content/blog/<slug>.md` — the filename becomes the URL path (e.g. `my-post.md` → `/my-post/`)
2. Add images to `public/images/` and reference them as `/images/my-image.png`
3. Use `draft: true` to hide a post from the site until it's ready
4. Preview locally with `npm run dev`

Frontmatter template:

```md
---
title: Your Post Title Here
description: A short summary of the post.
date: 2024-01-15
modified: 2024-01-20
image: /images/my-image.png
alt: Description of the image for accessibility.
imageWidth: 800
imageHeight: 600
keywords:
  - keyword one
  - keyword two
priority: 0.7
draft: false
---
```

| Field         | Required | Notes                                       |
|---------------|----------|---------------------------------------------|
| `title`       | Yes      | 5–100 characters                            |
| `description` | No       | Used in meta tags and post listings         |
| `date`        | No       | Original publish date (`YYYY-MM-DD`)        |
| `modified`    | No       | Last updated date (`YYYY-MM-DD`)            |
| `image`       | No       | Hero image path                             |
| `alt`         | No       | Alt text for hero image                     |
| `imageWidth`  | No       | Image width in pixels                       |
| `imageHeight` | No       | Image height in pixels                      |
| `keywords`    | No       | Array of SEO keywords                       |
| `priority`    | No       | Sitemap priority (0.0–1.0)                  |
| `draft`       | No       | Defaults to `false`; hides post when `true` |

## Building & Deploying to GitHub Pages

The site is served from the `docs/` directory on the `master` branch.

1. `npm run build` — builds the site, generates audio for changed posts, and patches `docs/rss.xml`
2. `git add docs/` — stage the build output
3. `git commit -m "your message"`
4. `git push` — GitHub Pages picks up the changes automatically

To preview the build locally before pushing: `npm run preview`

The build pipeline runs three steps automatically:
```
astro build       → generates docs/ including per-post index.txt files
python main.py    → generates index.mp3 for new/changed posts, patches docs/rss.xml
```

## Python Setup (uv)

This project uses [uv](https://docs.astral.sh/uv/) to manage Python dependencies with a single `.venv` pinned to Python 3.12.

### Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/) — `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`
- `ffmpeg` — required for WAV→MP3 conversion (`sudo apt install ffmpeg` / `brew install ffmpeg`)

### First-time setup

```sh
# Create .venv pinned to Python 3.12 and install base + dev deps
uv sync --group dev

# Install the heavy ML/TTS deps (KittenTTS, PyTorch, etc.) into the same .venv
VIRTUAL_ENV=.venv uv pip install \
  "kittentts @ https://github.com/KittenML/KittenTTS/releases/download/0.8.1/kittentts-0.8.1-py3-none-any.whl" \
  soundfile
```

### Running tests

```sh
uv run pytest
```

### Generating audio (TTS)

```sh
# Single post (for testing/previewing)
uv run python main.py --slug your-post-slug

# All posts (run automatically as part of npm run build)
uv run python main.py
```

## Resources

- https://www.meziantou.net/how-to-publish-a-dotnet-global-tool-with-dotnet-core-2-1.htm
- https://www.favicon-generator.org/
