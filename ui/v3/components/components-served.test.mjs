// Every shared component is served by the local server and its tests stay off DEV (ruling 12:34).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
const ui = fileURLToPath(new URL('../../', import.meta.url));
const server = readFileSync(ui + 'server.mjs', 'utf8');
const ignore = readFileSync(ui + '.assetsignore', 'utf8').split('\n').map(s => s.trim());
const files = readdirSync(dir);
test('each component module is in the local server allowlist', () => {
  for (const f of files.filter(f => f.endsWith('.js'))) assert.ok(server.includes(`'/v3/components/${f}'`), f);
});
test('each component test is kept out of DEV assets', () => {
  for (const f of files.filter(f => f.endsWith('.test.mjs'))) assert.ok(ignore.includes(`v3/components/${f}`), f);
});
