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

1. `npm run build` — generates the `docs/` directory
2. `git add docs/` — stage the build output
3. `git commit -m "your message"`
4. `git push` — GitHub Pages picks up the changes automatically

To preview the build locally before pushing: `npm run preview`

## Python Virtual Env

```sh
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## Resources

- https://www.meziantou.net/how-to-publish-a-dotnet-global-tool-with-dotnet-core-2-1.htm
- https://www.favicon-generator.org/
