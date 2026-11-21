// Bundles src/viewer3d.js + three.js + the .glb models into one classic script,
// so index.html keeps working when opened straight from disk (file://).
import { build } from 'esbuild';

await build({
  entryPoints: ['src/viewer3d.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  loader: { '.glb': 'binary', '.wasm': 'binary', '.txt': 'text' },
  outfile: 'viewer3d.bundle.js',
  legalComments: 'none',
  logLevel: 'info',
});
