/**
 * remark-mermaid-fence.mjs
 *
 * Converts ```mermaid fenced blocks into raw <pre class="mermaid"> HTML nodes
 * BEFORE Shiki runs, so that rehype-mermaid can find and render them at build time.
 *
 * rehype-mermaid (with inline-svg strategy) looks for <pre class="mermaid">
 * elements in the rehype tree.
 */
import { visit } from 'unist-util-visit';

export default function remarkMermaidFence() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid') return;

      const escaped = node.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const rawHtml = `<pre class="mermaid">${escaped}</pre>`;

      parent.children.splice(index, 1, {
        type: 'html',
        value: rawHtml,
      });
    });
  };
}
