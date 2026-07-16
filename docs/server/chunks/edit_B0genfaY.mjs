import { et as __exportAll } from "./errors_BiAoVKno.mjs";
import { S as createComponent, h as renderHead, n as renderScript, u as renderTemplate } from "./server_B7Ekrhig.mjs";
import "./compiler_C2Ie72Zi.mjs";
//#region src/pages/edit.astro
var edit_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Edit,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
var $$Edit = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`<html lang="en" data-astro-cid-uolwmesv><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Edit Post</title>${renderHead($$result)}</head><body data-astro-cid-uolwmesv><h1 data-astro-cid-uolwmesv>Edit Post</h1><a href="/admin/" class="back-link" data-astro-cid-uolwmesv>← Back to list</a><form id="post-form" data-astro-cid-uolwmesv><div id="draft-banner" class="draft-banner" role="status" aria-live="polite" hidden data-astro-cid-uolwmesv><span class="draft-banner-msg" id="draft-banner-msg" data-astro-cid-uolwmesv></span><button type="button" id="discard-draft-btn" data-astro-cid-uolwmesv>Discard draft</button></div><details data-astro-cid-uolwmesv><summary data-astro-cid-uolwmesv>Edit Metadata</summary><label for="title" data-astro-cid-uolwmesv>Title *</label><input type="text" id="title" required minlength="5" maxlength="100" placeholder="Post title" data-astro-cid-uolwmesv><label for="description" data-astro-cid-uolwmesv>Description</label><input type="text" id="description" placeholder="Short summary" data-astro-cid-uolwmesv><div class="form-row" data-astro-cid-uolwmesv><div data-astro-cid-uolwmesv><label for="date" data-astro-cid-uolwmesv>Date</label><input type="date" id="date" data-astro-cid-uolwmesv></div><div data-astro-cid-uolwmesv><label for="modified" data-astro-cid-uolwmesv>Modified</label><input type="date" id="modified" data-astro-cid-uolwmesv></div></div><label for="image" data-astro-cid-uolwmesv>Image path</label><input type="text" id="image" placeholder="/images/my-image.png" data-astro-cid-uolwmesv><label for="alt" data-astro-cid-uolwmesv>Alt text</label><input type="text" id="alt" data-astro-cid-uolwmesv><div class="form-row" data-astro-cid-uolwmesv><div data-astro-cid-uolwmesv><label for="imageWidth" data-astro-cid-uolwmesv>Image width</label><input type="number" id="imageWidth" min="0" data-astro-cid-uolwmesv></div><div data-astro-cid-uolwmesv><label for="imageHeight" data-astro-cid-uolwmesv>Image height</label><input type="number" id="imageHeight" min="0" data-astro-cid-uolwmesv></div></div><label for="keywords" data-astro-cid-uolwmesv>Keywords (comma-separated)</label><input type="text" id="keywords" placeholder="keyword1, keyword2" data-astro-cid-uolwmesv><label for="priority" data-astro-cid-uolwmesv>Priority (0-1)</label><input type="number" id="priority" min="0" max="1" step="0.1" data-astro-cid-uolwmesv><label data-astro-cid-uolwmesv><input type="checkbox" id="draft" data-astro-cid-uolwmesv>Draft (not published)</label></details><label for="body" data-astro-cid-uolwmesv>Markdown body — use the toolbar to format, toggle preview for a live render</label><textarea id="body" placeholder="# Your post content here" data-astro-cid-uolwmesv></textarea><div class="btn-row" data-astro-cid-uolwmesv><button type="submit" data-astro-cid-uolwmesv>Save</button><button type="button" id="cancel-btn" data-astro-cid-uolwmesv>Cancel</button></div><div id="status" data-astro-cid-uolwmesv></div></form>${renderScript($$result, "/home/spencerkittleson/repos/DoCodeThatMatters/src/pages/edit.astro?astro&type=script&index=0&lang.ts")}</body></html>`;
}, "/home/spencerkittleson/repos/DoCodeThatMatters/src/pages/edit.astro", void 0);
var $$file = "/home/spencerkittleson/repos/DoCodeThatMatters/src/pages/edit.astro";
var $$url = "/edit/";
//#endregion
//#region \0virtual:astro:page:src/pages/edit@_@astro
var page = () => edit_exports;
//#endregion
export { page };
