import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeView, homeGreeting, assessmentRow } from './home.js';
const label = s => ({ prepare: 'Setup not finished', collect: 'Collecting responses' }[s] || s);
test('greeting uses the principal name, escaped, else plain Welcome', () => {
  assert.equal(homeGreeting({ name: 'Bincy' }), 'Welcome, Bincy!');
  assert.equal(homeGreeting({ name: '<b>' }), 'Welcome, &lt;b&gt;!');
  assert.equal(homeGreeting(null), 'Welcome!');
});
test('prepare → Continue setup; other stages → Continue assessment; pill carries the state word', () => {
  const s = assessmentRow({ id: 'a1', name: 'Kapanawa', stage: 'prepare' }, label);
  assert.match(s, /Continue setup →/); assert.match(s, /v3h-pill-setup">Setup not finished/); assert.match(s, /href="#assessment\/a1"/);
  const c = assessmentRow({ id: 'a 2', name: 'Hindi', stage: 'collect', language_name: 'Hindi' }, label);
  assert.match(c, /Continue assessment →/); assert.match(c, /v3h-pill-progress/); assert.match(c, /#assessment\/a%202/);
});
test('home keeps list states and hooks assess.js binds (data-project, data-retry-list)', () => {
  const lists = { p1: { status: 'loaded', list: [{ id: 'a1', name: 'A', stage: 'collect' }] }, p2: { status: 'failed' }, p3: {} };
  const h = homeView({ principal: { name: 'B' }, projects: [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }, { id: 'p3', name: 'P3' }], listFor: id => lists[id], stageLabel: label, start: '<a data-v3-start href="#new">+ Start a new 3D Review</a>' });
  assert.match(h, /Here are your 3D Review projects\./); assert.match(h, /data-v3-start/);
  assert.match(h, /data-retry-list="p2"/); assert.match(h, /data-project="p3"/); assert.match(h, /\/v3\/home\.css/);
  assert.doesNotMatch(h, /\d+ of \d+/, 'no counts the server did not send');
});
test('empty account still offers the start action', () => {
  const h = homeView({ principal: {}, projects: [], listFor: () => ({}), start: '<a data-v3-start href="#new">x</a>' });
  assert.match(h, /No project on this account yet/); assert.match(h, /data-v3-start/);
});
