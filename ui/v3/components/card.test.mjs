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
test('L1-23 child counts: plain words, zero is words not a bare 0, absent counts draw nothing', () => {
  assert.equal(comp.childCounts([[3, 'assessment'], [91, 'response']]), '3 assessments · 91 responses');
  assert.equal(comp.childCounts([[1, 'project'], [0, 'assessment'], [0, 'response']]), '1 project · no assessments · no responses');
  assert.equal(comp.childCounts([[0, 'response']]), 'No responses yet');
  assert.equal(comp.childCounts([[undefined, 'response']]), '');
  assert.match(comp.assessmentCard({ id: 'a', name: 'A', response_count: 1 }), /data-v3-counts>1 response</);
  assert.match(comp.projectCard({ id: 'p', name: 'P', assessment_count: 2, response_count: 0 }), />2 assessments · no responses</);
  assert.match(comp.workspaceCard({ id: 'w', name: 'W', project_count: 0, assessment_count: 0, response_count: 0 }), />No projects yet</);
  assert.doesNotMatch(comp.projectCard({ id: 'p', name: 'P' }), /data-v3-counts/);
});
