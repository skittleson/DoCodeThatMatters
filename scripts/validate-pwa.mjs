import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = process.env.VALIDATE_PWA_DIR || join(__dirname, '..', 'docs');

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function validateManifest(errors) {
  const manifestPath = join(docsDir, 'manifest.json');
  if (!(await fileExists(manifestPath))) {
    errors.push(`manifest.json: missing at ${manifestPath}`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    errors.push(`manifest.json: invalid JSON (${err.message})`);
    return;
  }

  for (const field of ['name', 'start_url', 'display']) {
    if (!manifest[field]) {
      errors.push(`manifest.json: missing required field "${field}"`);
    }
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    errors.push('manifest.json: "icons" must be a non-empty array');
    return;
  }

  for (const icon of manifest.icons) {
    if (!icon.src) {
      errors.push('manifest.json: icon entry missing "src"');
      continue;
    }
    const iconPath = join(docsDir, icon.src.replace(/^\//, ''));
    if (!(await fileExists(iconPath))) {
      errors.push(`manifest.json: icon "${icon.src}" does not resolve to a file in docs/`);
    }
  }
}

async function validateServiceWorkerFiles(errors) {
  for (const file of ['sw.js', 'register-sw.js']) {
    if (!(await fileExists(join(docsDir, file)))) {
      errors.push(`${file}: missing at docs/${file}`);
    }
  }
}

async function validateOfflinePage(errors) {
  const offlinePath = join(docsDir, 'offline', 'index.html');
  if (!(await fileExists(offlinePath))) {
    errors.push("offline/index.html: missing (required as the service worker's install-time precache target)");
  }
}

async function validateExclusions(errors) {
  const swPath = join(docsDir, 'sw.js');
  if (!(await fileExists(swPath))) return; // already reported by validateServiceWorkerFiles

  const source = await readFile(swPath, 'utf8');
  const requiredExclusions = ['/admin', '/edit', '.mp3', '.epub'];
  for (const marker of requiredExclusions) {
    if (!source.includes(marker)) {
      errors.push(`sw.js: missing expected cache-exclusion marker "${marker}"`);
    }
  }
}

async function main() {
  const errors = [];

  await validateManifest(errors);
  await validateServiceWorkerFiles(errors);
  await validateOfflinePage(errors);
  await validateExclusions(errors);

  if (errors.length) {
    console.error('validate-pwa: FAILED');
    for (const err of errors) console.error(`  ✗ ${err}`);
    process.exit(1);
  }

  console.log('validate-pwa: all PWA checks passed');
}

main().catch((err) => {
  console.error('validate-pwa: unexpected error', err);
  process.exit(1);
});
