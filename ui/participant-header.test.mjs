import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read=n=>readFileSync(fileURLToPath(new URL(n,import.meta.url)),'utf8');
const css=read('./participant-view.css');
// Root entry switch (PR65 checkpoint 2): the legacy surface this suite specifies now lives byte-identical at ./legacy/index.html;
// `/` is the product shell (its public-home contract is asserted in assess/scope.test.mjs). Behaviour under test is unchanged.
const html=read('./legacy/index.html');

// The header block is the section appended for the shared participant route.
const block=css.slice(css.indexOf('/* Shared participant route'));
const selectors=block.replace(/\/\*[\s\S]*?\*\//g,'').split('}').flatMap(chunk=>{
  const i=chunk.indexOf('{'); if(i<0) return [];
  return chunk.slice(0,i).split(',').map(s=>s.trim()).filter(s=>s&&!s.startsWith('@')&&!s.startsWith('/*'));
});

test('every new rule is scoped to the participant route or its :not guard',()=>{
  assert.ok(selectors.length>0);
  for(const sel of selectors)
    assert.ok(
      sel.startsWith('body[data-workspace-route="participant"] ')||
      sel.startsWith('body:not([data-workspace-route="participant"]) '),
      `unscoped selector: ${sel}`);
});

test('new rules target only the listed staff-chrome nodes',()=>{
  const allowed=new Set([
    '#workspace > .headrow','#workspace > .introduction','aside.tree','#signout','#identity',
    '#participant','.participant-footer','.shell',
  ]);
  for(const sel of selectors){
    const target=sel.replace(/^body(:not)?\[[^\]]*\]|^body:not\([^)]*\)/,'').trim();
    assert.ok(allowed.has(target),`unexpected target: ${target}`);
  }
});

test('participant mount nodes are never hidden by the new rules',()=>{
  for(const id of ['#participant-error','#participant-resume','#receipt','#recover','#answers','#review'])
    assert.ok(!block.includes(id),`${id} must not appear in the participant header rules`);
});

test('the brand and version badge stay visible on the participant route',()=>{
  assert.ok(!block.includes('.brand'));
  assert.ok(!block.includes('#version'));
  assert.ok(!block.includes('.badge'));
});

test('#identity is hidden from screen and assistive tech, its text untouched',()=>{
  const rule=block.slice(block.indexOf('body[data-workspace-route="participant"] #identity'));
  const body=rule.slice(rule.indexOf('{'),rule.indexOf('}'));
  assert.ok(body.includes('visibility:hidden'),'removed from the accessibility tree, not just the viewport');
  assert.ok(!body.includes('clip-path'));
  assert.ok(!/display\s*:\s*none/.test(body));
  assert.ok(html.includes('id="identity" class="me">Checking session…<'));
});

test('#participant is centred at 640px on the participant route',()=>{
  assert.match(block,/body\[data-workspace-route="participant"\] #participant \{[^}]*max-width:640px/);
});

test('index.html carries the source footer sentence inside #participant',()=>{
  const section=html.slice(html.indexOf('<section id="participant"'));
  const end=section.indexOf('</section>');
  const inner=section.slice(0,end);
  assert.ok(inner.includes('<p class="participant-footer">Participants never sign in. Nothing here shows a project, a workspace or other people\'s answers.</p>'));
});

test('hiding the aside also collapses the shell grid (Bugbot 4036574263) and the test file is asset-ignored',()=>{
  assert.match(css,/body\[data-workspace-route="participant"\] \.shell\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  const ignore=read('./.assetsignore');
  assert.ok(ignore.split('\n').includes('participant-header.test.mjs'));
});
