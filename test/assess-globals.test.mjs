// node --test test/assess-globals.test.mjs — the vm harnesses' shared helper (test/helpers/assess-globals.mjs) fails loud.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { importsOf, assessGlobals, bindWindowFetch } from './helpers/assess-globals.mjs';

test('importsOf: every ^import line of the real assess.js is matched', () => {
  const src = readFileSync(new URL('../ui/assess/assess.js', import.meta.url), 'utf8');
  assert.equal(importsOf(src).length, (src.match(/^import\b/gm) || []).length);
});

test('importsOf: throws on an import line the regex would skip (strip would still remove it)', () => {
  const ok = "import { a } from '/a.js';\n";
  assert.equal(importsOf(ok).length, 1);
  for (const bad of ['import { b } from "/b.js";\n', "import '/side-effect.js';\n", "import {\n  d,\n} from '/d.js';\n"]) {
    assert.throws(() => importsOf(ok + bad), /2 import lines but 1 matched/, JSON.stringify(bad));
  }
});

test('bindWindowFetch: mountPassages and facilitatorFetch use w.fetch, never Node fetch', async () => {
  const G = await assessGlobals();
  const dom = new JSDOM('<div id="r"></div>', { url: 'http://127.0.0.1:4173/' });
  const w = dom.window, seen = [];
  w.fetch = async (url, init = {}) => { seen.push([String(url), init.headers?.authorization || null]); return { ok: false, status: 404, json: async () => ({ ok: false, error: { message: 'synthetic' } }) }; };
  const nodeFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Node fetch reached'); };
  try {
    bindWindowFetch(w, G);
    w.mountPassages({ root: w.document.getElementById('r'), aid: 'a1', mayEdit: false, esc: s => String(s), token: () => 't1' });
    await new Promise(r => setTimeout(r, 0));
    await w.facilitatorFetch('t2')('/v2/translate', {});
  } finally { globalThis.fetch = nodeFetch; }
  assert.deepEqual(seen, [['/v2/assessments/a1/passages', 'Bearer t1'], ['/v2/translate', 'Bearer t2']]);
});
