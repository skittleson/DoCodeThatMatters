# Design System — Code That Matters

Source of truth for the blog (Astro site) and the ebook (`blog.epub`).
Aesthetic: **technical field journal** — typographic only, no decoration.
Mono headings + hairline rules + one teal accent read like an engineer's lab
notebook in any reader.

## Palette

| Token | Value | Use |
|---|---|---|
| `background` | `#0d1117` | Site + cover background |
| `accent` | `#39c5cf` | Bright teal — dark surfaces only (cover, site) |
| `accent-link` | `#0b6e75` | Darkened teal — links, rules, code borders on light pages (the bright teal is illegible on white) |
| `text-muted` | `#6b7280` | Dates, captions, meta |
| `rule` | `#d4d4d8` | Hairlines, table borders |

No CSS variables in EPUB CSS (Kindle strips them). No px in EPUB CSS — em only.

## Typography

- **Headings, meta, cover:** Inconsolata (OFL), embedded in the EPUB as
  `Inconsolata.ttf` + `Inconsolata.woff2` (converted from
  `public/fonts/Inconsolata.woff2` via fonttools; static, no variable axes).
  Weight 400 only — never fake-bold a single weight (e-ink smears synthetic bold).
- **Body (EPUB):** `font-family: serif` as a hint only. KDP requires body text
  to stay unforced so the reader's font/size settings win.
- **Code:** Inconsolata/monospace stack, `0.85em`, `white-space: pre-wrap`,
  teal left border instead of gray boxes.
- Cover title: Inconsolata, wide letter-spacing, all caps.

## Layout rules (EPUB)

- `text-align: left` on everything (Kindle force-justifies otherwise).
- No forced `color` on body text — keeps dark-mode readers legible.
- Headings: `margin: 1.6em 0 0.6em`; paragraphs `margin-bottom: 1em`.
- Images `max-width: 100%; height: auto`.
- Tables: `border-collapse`, 1px `#d4d4d8` borders, left-aligned cells.
- Blockquotes: italic + teal left border, no forced color.

## Chapter furniture

Each chapter gets: `page-break-before: always`, small-caps-style mono date
line ("June 2026", `0.75em`, `letter-spacing: 0.15em`, muted), then H1.
TOC entries carry a muted mono date column. A title page chapter (after the
cover, before the preface) sets the frame: book title, "Field notes from a
builder", "2016–2026", docodethatmatters.com.

## Cover

Programmatically rendered (`scripts/assets/epub-cover.png`, 1600×2560) with
PIL + Inconsolata TTF: `#0d1117` field, hairline teal frame, engineering
registration ticks at the four corners, mono title in `#39c5cf`, short rule,
"FIELD NOTES FROM A BUILDER" in white, author + URL in gray. Regenerate with
the render script in git history / this doc's companion; deterministic.

## Risks accepted

- Mono headings in a book (books use serifs) — deliberate: signals
  "builder's journal" instantly; costs a little gravitas against Apple
  Books' serif defaults.
- Teal-on-dark cover — stands out in a cream library; prints poorly in
  grayscale (acceptable: this is a free ebook).
