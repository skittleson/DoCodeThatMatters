import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = process.env.VALIDATE_XML_DIR || join(__dirname, '..', 'docs');

// Minimal, dependency-free XML well-formedness + namespace-prefix check.
// Node has no built-in XML parser, so we tokenize tags and verify:
//   1. Tags are balanced (every open tag has a matching close).
//   2. Every element/attribute prefix (`foo:bar`) is bound to an in-scope
//      xmlns:foo declaration. This catches the exact class of bug that broke
//      rss.xml: a `dct:` prefix used with no `xmlns:dct` in scope, and the
//      reserved `xmlns:` prefix used as an element name.
function validateXml(source, file) {
  const errors = [];
  const tagRe = /<(\/?)([a-zA-Z_][\w.-]*(?::[a-zA-Z_][\w.-]*)?)((?:\s[^<>]*?)?)(\/?)>/g;
  const stack = []; // { name, ns: Map<prefix, uri> }
  let inheritedNs = new Map([['xml', 'reserved'], ['xmlns', 'reserved']]);

  let m;
  let sawRoot = false;
  while ((m = tagRe.exec(source)) !== null) {
    const [, closing, name, attrs, selfClose] = m;

    if (closing) {
      const top = stack.pop();
      if (!top) {
        errors.push(`unexpected closing tag </${name}>`);
      } else if (top.name !== name) {
        errors.push(`mismatched tag: expected </${top.name}> but found </${name}>`);
      }
      continue;
    }

    sawRoot = true;
    // Collect namespace declarations on this element.
    const ns = new Map(stack.length ? stack[stack.length - 1].ns : inheritedNs);
    const attrRe = /([a-zA-Z_][\w.-]*(?::[a-zA-Z_][\w.-]*)?)\s*=\s*"([^"]*)"/g;
    let a;
    const attrNames = [];
    while ((a = attrRe.exec(attrs)) !== null) {
      const [, attrName, attrVal] = a;
      attrNames.push(attrName);
      if (attrName === 'xmlns') {
        ns.set('', attrVal);
      } else if (attrName.startsWith('xmlns:')) {
        ns.set(attrName.slice(6), attrVal);
      }
    }

    // Reserved-prefix element name (the rss.xml bug: <xmlns:dct>).
    const elemPrefix = name.includes(':') ? name.split(':')[0] : '';
    if (elemPrefix === 'xmlns') {
      errors.push(`illegal element name "${name}": "xmlns:" is a reserved prefix, not usable as an element name`);
    } else if (elemPrefix && !ns.has(elemPrefix)) {
      errors.push(`element "${name}" uses undeclared namespace prefix "${elemPrefix}"`);
    }

    // Prefixed attributes must resolve too (ignore xmlns:* declarations).
    for (const attrName of attrNames) {
      if (attrName === 'xmlns' || attrName.startsWith('xmlns:')) continue;
      if (!attrName.includes(':')) continue;
      const p = attrName.split(':')[0];
      if (p !== 'xml' && !ns.has(p)) {
        errors.push(`attribute "${attrName}" uses undeclared namespace prefix "${p}"`);
      }
    }

    if (!selfClose) stack.push({ name, ns });
  }

  if (!sawRoot) errors.push('no XML elements found');
  if (stack.length) {
    errors.push(`unclosed tag(s): ${stack.map((s) => s.name).join(', ')}`);
  }
  return errors;
}

async function main() {
  const entries = await readdir(docsDir);
  const xmlFiles = entries.filter((f) => f.endsWith('.xml')).sort();

  if (xmlFiles.length === 0) {
    console.error('validate-xml: no .xml files found in docs/');
    process.exit(1);
  }

  let failed = false;
  for (const file of xmlFiles) {
    const source = await readFile(join(docsDir, file), 'utf8');
    const errors = validateXml(source, file);
    if (errors.length) {
      failed = true;
      console.error(`✗ docs/${file}`);
      for (const err of errors) console.error(`    ${err}`);
    } else {
      console.log(`✓ docs/${file}`);
    }
  }

  if (failed) {
    console.error('\nvalidate-xml: XML validation FAILED');
    process.exit(1);
  }
  console.log('\nvalidate-xml: all XML files valid');
}

main().catch((err) => {
  console.error('validate-xml: unexpected error', err);
  process.exit(1);
});
