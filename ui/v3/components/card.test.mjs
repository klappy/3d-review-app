import test from 'node:test'; import assert from 'node:assert/strict';
import * as comp from './card.js';
import * as cards from '../../assess/cards.js';
import { readFileSync } from 'node:fs';
test('component: Card re-exports the one card (same bindings, no copy)', () => {
  for (const k of ['card', 'cardGrid', 'workspaceCard', 'projectCard', 'assessmentCard', 'surveyCard', 'routes', 'stageLabel']) assert.equal(comp[k], cards[k], k);
  assert.match(comp.card({ title: 'A<b>', href: '#x' }), /^<a class="panel entity-card" href="#x"><h2>A&lt;b&gt;<\/h2><\/a>$/);
  assert.match(comp.cardGrid([], 'None'), /None/);
});
test('Card served locally, test kept off DEV', () => {
  const here = new URL('.', import.meta.url);
  assert.ok(readFileSync(new URL('../../server.mjs', here), 'utf8').includes("'/v3/components/card.js': ['v3/components/card.js', 'text/javascript']"));
  assert.ok(readFileSync(new URL('../../.assetsignore', here), 'utf8').split('\n').includes('v3/components/card.test.mjs'));
});
