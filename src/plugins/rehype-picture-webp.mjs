/**
 * rehype-picture-webp.mjs
 *
 * Rehype plugin that wraps local <img> tags in a <picture> element
 * with a WebP <source> so browsers that support WebP get the smaller file
 * while others fall back to the original.
 *
 * Only applies to images whose src starts with /images/ (i.e. files that live
 * in public/images/ and have a pre-generated .webp sibling from optimize-images.py).
 *
 * Remote images (http/https) are left untouched.
 */

import { visit } from 'unist-util-visit';

/** Convert e.g. /images/foo.jpg  →  /images/foo.webp */
function toWebp(src) {
  return src.replace(/\.[^.]+$/, '.webp');
}

/**
 * @returns {import('unified').Plugin}
 */
export default function rehypePictureWebp() {
  return function (tree) {
    visit(tree, 'element', (node, index, parent) => {
      if (
        node.tagName !== 'img' ||
        !parent ||
        index === null ||
        index === undefined
      ) {
        return;
      }

      const src = node.properties?.src;
      if (typeof src !== 'string' || !src.startsWith('/images/')) {
        return;
      }

      // Already wrapped (guard against double-wrapping)
      if (parent.tagName === 'picture') {
        return;
      }

      const webpSrc = toWebp(src);

      /** @type {import('hast').Element} */
      const source = {
        type: 'element',
        tagName: 'source',
        properties: {
          type: 'image/webp',
          srcSet: webpSrc,
        },
        children: [],
      };

      /** @type {import('hast').Element} */
      const picture = {
        type: 'element',
        tagName: 'picture',
        properties: {},
        children: [source, node],
      };

      parent.children[index] = picture;
    });
  };
}
