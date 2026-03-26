/**
 * remark-mermaid-raw.mjs
 *
 * Remark plugin that converts fenced mermaid code blocks into raw HTML
 * BEFORE Shiki processes them, so they are not syntax-highlighted.
 *
 * Input (mdast code node):
 *   { type: 'code', lang: 'mermaid', value: 'graph TD...' }
 *
 * Output (mdast html node — passed through to the HTML output unchanged):
 *   { type: 'html', value: '<div class="mermaid not-prose">graph TD...</div>' }
 *
 * Mermaid.js (loaded from CDN in BaseLayout.astro) picks up .mermaid divs
 * and renders them client-side.
 */

import { visit } from 'unist-util-visit';

export default function remarkMermaidRaw() {
  return function (tree) {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid' || !parent || index === null || index === undefined) {
        return;
      }

      // Escape any HTML entities in the diagram source
      const escaped = node.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      /** @type {import('mdast').HTML} */
      const htmlNode = {
        type: 'html',
        value: `<div class="mermaid not-prose">${escaped}</div>`,
      };

      parent.children[index] = htmlNode;
    });
  };
}
