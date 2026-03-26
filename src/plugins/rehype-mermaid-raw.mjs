/**
 * rehype-mermaid-raw.mjs
 *
 * Converts raw HTML <pre class="mermaid">…</pre> nodes (emitted by the remark
 * plugin as html-type nodes, which remark-rehype passes through as hast `raw`
 * nodes) into proper hast element nodes so that rehype-mermaid can find them.
 *
 * Pipeline order: remark-mermaid-fence → remark-rehype → THIS → rehype-mermaid
 */
import { visit } from 'unist-util-visit';
import { fromHtml } from 'hast-util-from-html';

export default function rehypeMermaidRaw() {
  return (tree) => {
    visit(tree, 'raw', (node, index, parent) => {
      if (typeof node.value !== 'string') return;
      const val = node.value.trim();
      if (!val.startsWith('<pre class="mermaid">')) return;

      // Parse the raw HTML string into a proper hast element tree
      const fragment = fromHtml(val, { fragment: true });
      const preNode = fragment.children[0];
      if (preNode && preNode.type === 'element' && preNode.tagName === 'pre') {
        parent.children.splice(index, 1, preNode);
      }
    });
  };
}
