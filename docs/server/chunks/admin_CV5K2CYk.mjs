import { et as __exportAll } from "./errors_BiAoVKno.mjs";
import { S as createComponent, h as renderHead, n as renderScript, u as renderTemplate } from "./server_B7Ekrhig.mjs";
import "./compiler_C2Ie72Zi.mjs";
//#region src/pages/admin.astro
var admin_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Admin,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
var $$Admin = createComponent(($$result, $$props, $$slots) => {
	return renderTemplate`<html lang="en" data-astro-cid-hfbr3nnz><head><meta charset="utf-8"><title>Blog Admin</title>${renderHead($$result)}</head><body data-astro-cid-hfbr3nnz><h1 data-astro-cid-hfbr3nnz>Blog Admin</h1><div id="auth-screen" data-astro-cid-hfbr3nnz><p data-astro-cid-hfbr3nnz>Enter your GitHub Personal Access Token to access the admin.</p><p class="text-xs" style="color:#a0aec0" data-astro-cid-hfbr3nnz>Requires <code data-astro-cid-hfbr3nnz>repo</code> scope.</p><input type="password" id="token-input" placeholder="ghp_xxxxxxxxxxxx" data-astro-cid-hfbr3nnz><br data-astro-cid-hfbr3nnz><button id="test-btn" data-astro-cid-hfbr3nnz>Test & Save</button><div id="auth-error" class="error" data-astro-cid-hfbr3nnz></div></div><div id="app" style="display:none" data-astro-cid-hfbr3nnz></div>${renderScript($$result, "/home/spencerkittleson/repos/DoCodeThatMatters/src/pages/admin.astro?astro&type=script&index=0&lang.ts")}</body></html>`;
}, "/home/spencerkittleson/repos/DoCodeThatMatters/src/pages/admin.astro", void 0);
var $$file = "/home/spencerkittleson/repos/DoCodeThatMatters/src/pages/admin.astro";
var $$url = "/admin/";
//#endregion
//#region \0virtual:astro:page:src/pages/admin@_@astro
var page = () => admin_exports;
//#endregion
export { page };
