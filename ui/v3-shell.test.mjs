import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {V3_SHELL, STATE_WORDS, stateWord, onePrimary} from './v3-shell.js';
import {mountShell} from './kit/tree.js';
import {fixture} from '../test/fixtures/kit-shell-data.js';
test('v3 shell flag is on and state words cover every app stage id',()=>{assert.equal(V3_SHELL,true);assert.equal(stateWord('collect'),'Collecting responses');assert.equal(stateWord('prepare'),'Setup not finished');assert.equal(stateWord('understand'),'Ready to look at results');assert.equal(stateWord('improve'),'Reviewed');assert.equal(stateWord('constructor'),'');assert.equal(stateWord(undefined),'');assert.ok(Object.isFrozen(STATE_WORDS));});
test('onePrimary keeps the first primary and demotes the rest, ignoring dialogs',()=>{const d=new JSDOM('<div id="r"><button class="primary" id="a">A</button><button class="primary" id="b">B</button><dialog><button class="primary" id="c">C</button></dialog></div>');const r=d.window.document.getElementById('r');assert.equal(onePrimary(r),1);assert.ok(r.querySelector('#a').classList.contains('primary'));assert.ok(!r.querySelector('#b').classList.contains('primary'));assert.ok(r.querySelector('#c').classList.contains('primary'));assert.equal(onePrimary(null),0);});
test('contextTree:false omits the context tree but keeps crumbs, header host and content mount',()=>{const d=new JSDOM('<div id="app"></div>',{url:'https://fixture.invalid/'});const root=d.window.document.querySelector('#app');const shell=mountShell(root,{...fixture(),contextTree:false},{});assert.equal(root.querySelector('aside.tree'),null);assert.equal(root.querySelector('[data-search]'),null);assert.ok(root.querySelector('.shell.no-tree'));assert.ok(root.querySelector('nav.crumbs'));assert.ok(shell.content);assert.ok(shell.headerHost);shell.update(fixture());assert.ok(root.querySelector('aside.tree'));shell.destroy();});

test('cards.js STAGE_LABEL and stage-screens.js carry the same v3 state words (neither may import v3-shell)', async () => {
  const { STAGE_LABEL } = await import('./assess/cards.js');
  const { STAGE_STATE_WORDS } = await import('./stage-screens.js');
  const { CTX_STAGE_WORDS } = await import('./assess/scope.js');
  for (const k of ['prepare', 'collect', 'understand', 'improve']) assert.equal(CTX_STAGE_WORDS[k], stateWord(k), 'scope.js ' + k);
  for (const k of ['prepare', 'collect', 'understand', 'improve']) { assert.equal(STAGE_LABEL[k], stateWord(k), k); assert.equal(STAGE_STATE_WORDS[k], stateWord(k), k); }
});

test('L1-18 glass restored (ruling 12:22): no flat Bincy override remains in the shell layer', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./v3-shell.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /--bincy-/, 'no --bincy-* tokens: design-system-v3 glass tokens govern');
  assert.doesNotMatch(css, /\.glass\{[^}]*backdrop-filter:none/, '.glass keeps its blur');
  assert.doesNotMatch(css, /\.top\{[^}]*backdrop-filter:none/, 'header keeps its glass');
});

test('P0 12:10 demo exit: header gets Exit demo + Sign in once, logo leaves demo', async () => {
  const { placeDemoExit, DEMO_EXIT_HREF, DEMO_SIGN_IN_HREF } = await import('./v3-shell.js');
  const d = new JSDOM('<div id="app"></div>', { url: 'https://fixture.invalid/?demo=1#assessment/demo-assessment/prepare' });
  const doc = d.window.document; const root = doc.querySelector('#app');
  const shell = mountShell(root, fixture(), {});
  assert.equal(placeDemoExit(doc), true); assert.equal(placeDemoExit(doc), true);
  const exits = doc.querySelectorAll('header.top .v3-demo-exit'); assert.equal(exits.length, 1);
  assert.equal(doc.querySelector('[data-v3-demo-signin]').getAttribute('href'), DEMO_SIGN_IN_HREF);
  assert.equal(doc.querySelector('.v3-demo-exit [data-v3-exit-demo]').textContent, 'Exit demo');
  const brand = doc.querySelector('header.top a.brand'); assert.equal(brand.getAttribute('href'), DEMO_EXIT_HREF); assert.equal(brand.hasAttribute('data-navigate'), false);
  assert.ok(!DEMO_EXIT_HREF.includes('demo') && !DEMO_SIGN_IN_HREF.includes('demo'));
  assert.equal(placeDemoExit(null), false);
  shell.destroy();
});
