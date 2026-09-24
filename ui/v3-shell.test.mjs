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

test('L1-6 Bincy restyle: light-theme block gives a solid teal primary, white header and flat white cards', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./v3-shell.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('/* L1-6 Bincy restyle'));
  assert.ok(block.length > 100, 'restyle block present');
  assert.match(block, /--bincy-teal:#1c6b5e/);
  assert.match(block, /body\{background:#f1f6f4\}/, 'body ground is a literal (custom props on .rv do not reach body)');
  assert.match(block, /\.rv \.rv-btn\.primary\{background:var\(--bincy-teal\)/);
  assert.match(block, /\.rv \.top\{background:var\(--bincy-card\)/);
  assert.match(block, /\.rv \.glass\{background:var\(--bincy-card\);backdrop-filter:none/);
  for (const rule of block.split('}').filter(r => r.includes('{'))) if (!rule.trim().startsWith('/*')) assert.match(rule.trim(), /^(\/\*[\s\S]*?\*\/\s*)?html:not\(\[data-theme="dark"\]\)/, 'every rule is light-only: ' + rule.slice(0, 60));
});
