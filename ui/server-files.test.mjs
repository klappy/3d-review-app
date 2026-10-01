// S53: every module the pages import (static or dynamic, transitively) and every stylesheet they link is in the local server map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
const ui = fileURLToPath(new URL('.', import.meta.url));
const keys = new Set([...readFileSync(join(ui, 'server.mjs'), 'utf8').matchAll(/'(\/[^']*)':\s*\[/g)].map(m => m[1]));
const roots = ['index.html', 'app.js', 'assess/index.html', 'assess/assess.js', 'v3/wizard.js', 'v3/home.js', 'participate/index.html', 'roadmap/index.html'];
test('every import/link reachable from the served pages resolves to a server.mjs key', () => {
  const seen = new Set(), missing = [];
  const walk = f => {
    if (seen.has(f) || !existsSync(f)) return; seen.add(f);
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(?:import\s*\(\s*|from\s+|import\s+|href=|src=)['"]([^'"]+\.(?:m?js|css))['"]/g)) {
        if (/^[a-z]+:/i.test(m[1])) continue;
        const abs = m[1].startsWith('/') ? join(ui, m[1]) : resolve(dirname(f), m[1]);
        const url = '/' + relative(ui, abs);
        if (!keys.has(url)) missing.push(`${url} <- ${relative(ui, f)}:${i + 1}`);
        if (abs.endsWith('.js')) walk(abs);
      }
    });
  };
  roots.forEach(r => walk(join(ui, r)));
  assert.deepEqual(missing, []);
});
