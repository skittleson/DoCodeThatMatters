# Blog Post Admin — Design Spec

## Outcomes

- User can create, edit, and delete blog posts from a web interface on the site itself, accessible from any device.
- Changes are committed directly to the repository via the GitHub REST API.
- The admin is gated behind GitHub authentication.

## Boundaries

- In scope: Markdown editor with frontmatter fields, post list, GitHub API integration, token management.
- Out of scope: Image upload, WYSIWYG editing, multi-user support, real-time preview, push-to-deploy automation.
- Only one user (the site owner); no user management or roles.

## Constraints

- Site is hosted as static GitHub Pages — no server runtime. The admin must be client-side only.
- GitHub REST API is the sole backend (read/write repo contents, create commits).
- Token is stored in the browser; only the site owner has access.
- Post schema is defined in `src/content.config.ts` (title, description, date, modified, image, alt, imageWidth, imageHeight, keywords, priority, draft).

## Architecture

### Components

| Component | Responsibility |
|-----------|---------------|
| `/admin` page (Astro) | Renders the admin UI: post list, editor, auth screen |
| GitHub API client (client-side) | Reads/writes `src/content/blog/*.md` via REST API; creates commits |
| Token storage (`localStorage`) | Persists the user's GitHub PAT; validates on page load |
| Form validation | Enforces content config schema (title 5-100 chars, date formats, etc.) |

### Data Flow

1. User visits `/admin`; page checks `localStorage` for a GitHub PAT. If missing, shows the setup screen.
2. User pastes PAT and clicks "Test & Save". Page calls `GET /user` to verify the token, then stores it.
3. On load, page fetches repo contents at `src/content/blog/` to build the post list. Each entry shows title, slug, date, draft status, and an "Edit" link.
4. Clicking "Add New Post" or "Edit" opens the editor with pre-filled fields.
5. On Save, the editor assembles the full Markdown content (frontmatter YAML + body) and calls the GitHub `PUT /repos/{owner}/{repo}/contents/src/content/blog/{slug}.md` endpoint. For new posts, the `PUT` auto-creates the file and commits it. For edits, the existing file's SHA is used to detect conflicts.
6. Commit message is auto-generated: `blog: add <title>` or `blog: update <title>`.

### Authentication

- Classic GitHub Personal Access Token with `repo` scope.
- Stored in `localStorage` on the browser side.
- Validation happens on the setup screen by calling `GET /user` on GitHub's API.
- Token is only used client-side; never sent to a third-party server.

### Error Handling

- Token validation fails → show error on setup screen, don't persist token.
- GitHub API 401 → clear stored token, redirect to setup screen.
- GitHub API 404 (post deleted externally) → remove from list with notification.
- Conflicting edit (SHA mismatch) → show error, offer to refresh and re-edit.
- Network errors → show user-friendly message, don't discard form content.

### Testing

- Unit tests for the Markdown assembler (frontmatter YAML generation, edge cases: empty fields, special characters in title).
- Unit tests for form validation against the content config schema.
- Integration tests mocking GitHub API responses (post creation, post update, conflict detection).

## Task Breakdown

### Phase 1: Infrastructure
1. Create `/admin` Astro page skeleton with auth check
2. Implement GitHub PAT setup screen (paste token, test, persist to localStorage)
3. Build client-side GitHub API wrapper (fetch posts, create/update file, commit)

### Phase 2: Post List
4. Implement post list view: fetch blog directory from repo, render cards with title/slug/date/draft/edit
5. Add "Add New Post" button and navigation to editor

### Phase 3: Editor
6. Build editor form with all frontmatter fields + Markdown body textarea
7. Implement frontmatter YAML assembler (serialize form data to valid frontmatter)
8. Wire Save button to GitHub API (create or update `.md` file, auto-commit)
9. Add form validation against content config schema

### Phase 4: Polish
10. Implement error handling (auth failures, conflicts, network errors)
11. Add loading states and toast notifications
12. Write unit tests
13. Test end-to-end with a real repo
