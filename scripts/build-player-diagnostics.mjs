// Called by the existing Git-connected build only; does not deploy anything.
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { CASES } from '../ui-player-matrix/cases.js';
import { renderCase } from '../ui-player-matrix/render.js';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildPlayerDiagnostics({ branch = process.env.WORKERS_CI_BRANCH ?? '', assetsDir = join(root, 'ui') } = {}) {
  // Always clear both outputs first, including a previous DEV build in the same workspace.
  rmSync(join(assetsDir, 'player-matrix'), { recursive: true, force: true });
  rmSync(join(assetsDir, 'player-diagnostic.html'), { force: true });
  if (branch === 'production') return { emitted: false };
  mkdirSync(assetsDir, { recursive: true });
  copyFileSync(join(root, 'ui-player-matrix/legacy.html'), join(assetsDir, 'player-diagnostic.html'));
  const input = {};
  try {
    for (const item of CASES) {
      const path = join(root, 'ui-player-matrix', `${item.id}.html`);
      writeFileSync(path, renderCase(item)); input[item.id] = path;
    }
    // Root entry is the working baseline, not a redirect or a thirteenth loaded player.
    const index = join(root, 'ui-player-matrix/index.html');
    writeFileSync(index, renderCase(CASES[0])); input.index = index;
    await build({ configFile: false, root: join(root, 'ui-player-matrix'), base: './', plugins: [svelte({ compilerOptions: { customElement: false, css: 'external' } })], build: { outDir: join(assetsDir, 'player-matrix'), emptyOutDir: true, assetsDir: 'assets', rolldownOptions: { input } } });
    return { emitted: true };
  } finally {
    for (const item of [...CASES, { id: 'index' }]) rmSync(join(root, 'ui-player-matrix', `${item.id}.html`), { force: true });
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await buildPlayerDiagnostics();
