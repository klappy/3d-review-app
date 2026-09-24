import test from 'node:test'; import assert from 'node:assert/strict'; import { JSDOM } from 'jsdom';
import { placeDemoExit, demoExitMarkup, DEMO_EXIT_HREF, DEMO_SIGN_IN_HREF } from './demo-exit.js';
import * as shell from '../../v3-shell.js';
test('component: one Exit demo + Sign in, logo leaves demo, idempotent', () => {
  const d = new JSDOM('<header class="top"><a class="brand" href="#home" data-navigate>3D</a><div class="right"></div></header>');
  const doc = d.window.document;
  assert.equal(placeDemoExit(doc), true); assert.equal(placeDemoExit(doc), true);
  assert.equal(doc.querySelectorAll('.v3-demo-exit').length, 1);
  assert.equal(doc.querySelector('[data-v3-demo-signin]').getAttribute('href'), DEMO_SIGN_IN_HREF);
  assert.equal(doc.querySelector('a.brand').getAttribute('href'), DEMO_EXIT_HREF);
  assert.ok(!doc.querySelector('a.brand').hasAttribute('data-navigate'));
  assert.ok(doc.querySelector('.v3-demo-exit').nextElementSibling.classList.contains('right'));
  assert.equal(placeDemoExit(new JSDOM('<div></div>').window.document), false);
  assert.match(demoExitMarkup(), /Exit demo.*Sign in/);
});
test('shell re-exports the same component (no copy)', () => { assert.equal(shell.placeDemoExit, placeDemoExit); assert.equal(shell.DEMO_SIGN_IN_HREF, DEMO_SIGN_IN_HREF); });
