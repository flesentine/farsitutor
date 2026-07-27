import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const ROOT_EXTENSIONS = new Set([
  '.css', '.gif', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json', '.m4a',
  '.mp3', '.png', '.svg', '.wav', '.webp', '.woff', '.woff2'
]);
const ROOT_EXCLUDES = new Set(['package.json', 'package-lock.json']);
const ASSET_DIRECTORIES = ['assets', 'audio', 'sentence-audio'];
const EARLY_SCRIPTS = new Set(['platform.js?v=1', 'storage.js?v=1']);

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of await readdir(ROOT, { withFileTypes: true })) {
  if (!entry.isFile() || ROOT_EXCLUDES.has(entry.name)) continue;
  if (!ROOT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
  await cp(path.join(ROOT, entry.name), path.join(OUT, entry.name));
}

const copiedAssetDirectories = [];
for (const directory of ASSET_DIRECTORIES) {
  const source = path.join(ROOT, directory);
  if (!(await exists(source))) continue;
  await cp(source, path.join(OUT, directory), { recursive: true });
  copiedAssetDirectories.push(directory);
}

for (const requiredDirectory of ['assets', 'audio']) {
  if (!copiedAssetDirectories.includes(requiredDirectory)) {
    throw new Error(`Native build is missing required asset directory: ${requiredDirectory}`);
  }
}

const indexPath = path.join(OUT, 'index.html');
let index = await readFile(indexPath, 'utf8');
const appScripts = [];
index = index.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/g, (tag, source) => {
  if (EARLY_SCRIPTS.has(source)) return tag;
  appScripts.push(source);
  return '';
});

if (!appScripts.includes('app-main.js?v=3') || appScripts.length < 10) {
  throw new Error(`Native build found an unexpected app script list (${appScripts.length} scripts).`);
}

const nativeBootstrap = [
  `<script>window.__FARSI_NATIVE_APP_SCRIPTS__=${JSON.stringify(appScripts)};<\/script>`,
  '<script type="module" src="native-bridge.js"><\/script>'
].join('\n');
const storageTag = '<script src="storage.js?v=1" defer></script>';
if (!index.includes(storageTag)) throw new Error('Could not find the storage bootstrap script.');
index = index.replace(storageTag, `${storageTag}\n${nativeBootstrap}`);
await writeFile(indexPath, index);

await build({
  entryPoints: [path.join(ROOT, 'native', 'native-bridge.ts')],
  outfile: path.join(OUT, 'native-bridge.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['safari16'],
  minify: false,
  sourcemap: false,
  logLevel: 'info'
});

await writeFile(path.join(OUT, 'native-build-manifest.json'), JSON.stringify({
  earlyScripts: [...EARLY_SCRIPTS],
  deferredAppScripts: appScripts,
  copiedAssetDirectories,
  nativeEntry: 'native-bridge.js',
  startupGate: 'top-level-await'
}, null, 2));

console.log(`Prepared ${OUT} with ${appScripts.length} app scripts gated behind native storage hydration.`);
