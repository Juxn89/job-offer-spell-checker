// Purpose: the one build: bundles the server (dist/server/main.js, with the vendored dictionary beside it)
// and the page (dist/web/: the HTML pages and their content-hashed script and style sheet), so the
// product image serves only what this build wrote (REQ-020: every asset from our own server).

import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

rmSync('dist', { recursive: true, force: true });

// The server: one ESM bundle; fastify and nspell stay in node_modules (installed in the image).
await build({
  entryPoints: ['src/server/main.ts'],
  outfile: 'dist/server/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['fastify', 'nspell'],
  logLevel: 'warning',
});
mkdirSync('dist/server/dictionary', { recursive: true });
// The vendored files keep a .txt suffix in the repository (D-026); their bytes are the upstream ones.
for (const file of ['es.aff.txt', 'es.dic.txt', 'LICENSE.txt']) {
  cpSync(`src/checker/dictionary/${file}`, `dist/server/dictionary/${file}`);
}

// The page: the client script and the style sheet, content-hashed so a new build is never served stale.
const web = await build({
  entryPoints: ['src/web/main.ts', 'src/web/prefs.ts', 'src/web/styles.css'],
  outdir: 'dist/web/assets',
  entryNames: '[name]-[hash]',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome120', 'firefox120', 'safari16'],
  metafile: true,
  logLevel: 'warning',
});
const names = {};
for (const [out, meta] of Object.entries(web.metafile.outputs)) {
  if (meta.entryPoint?.endsWith('main.ts')) names.SCRIPT = basename(out);
  if (meta.entryPoint?.endsWith('prefs.ts')) names.PREFS = basename(out);
  if (meta.entryPoint?.endsWith('styles.css')) names.STYLE = basename(out);
}
if (!names.SCRIPT || !names.PREFS || !names.STYLE) throw new Error('the page build wrote no script or no style sheet');
for (const page of ['index.html', 'privacidad.html']) {
  const html = readFileSync(`src/web/${page}`, 'utf8').replace(/%(SCRIPT|PREFS|STYLE)%/g, (_, key) => names[key]);
  writeFileSync(`dist/web/${page}`, html);
}
