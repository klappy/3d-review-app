import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeView, assessmentRow } from './home.js';
const label = s => ({ prepare: 'Setup not finished', collect: 'Collecting responses' }[s] || s);
test('prepare → Continue setup; other stages → Continue assessment; pill carries the state word', () => {
  const s = assessmentRow({ id: 'a1', name: 'Kapanawa', stage: 'prepare' }, label);
  assert.match(s, /Continue setup <span aria-hidden="true">→<\/span>/); assert.match(s, /v3h-pill-setup">Setup not finished/); assert.match(s, /href="#assessment\/a1"/);
  const c = assessmentRow({ id: 'a 2', name: 'Hindi', stage: 'collect', language_name: 'Hindi' }, label);
  assert.match(c, /Continue assessment <span aria-hidden="true">→<\/span>/); assert.match(c, /v3h-pill-progress/); assert.match(c, /#assessment\/a%202/);
});
test('home keeps list states; every project reachable by link', () => {
  const lists = { p1: { status: 'loaded', list: [{ id: 'a1', name: 'A', stage: 'collect' }] }, p2: { status: 'failed' }, p3: {} };
  const h = homeView({ title: 'Welcome', projects: [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }, { id: 'p3', name: 'P3' }], listFor: id => lists[id], stageLabel: label, start: '<a data-v3-start href="#new">+ Start a new 3D Review</a>' });
  assert.match(h, /Here are your 3D Review projects\./); assert.match(h, /data-v3-start/);
  assert.match(h, /<h1>Welcome<\/h1>/); assert.match(h, /Could not load assessments\. <a href="#project\/p2">/); assert.match(h, /v3h-meta"><a href="#project\/p3">Open project/); assert.match(h, /\/v3\/home\.css/);
  assert.doesNotMatch(h, /\d+ of \d+/, 'no counts the server did not send');
});
test('empty account still offers the start action', () => {
  const h = homeView({ projects: [], listFor: () => ({}), start: '<a data-v3-start href="#new">x</a>' });
  assert.match(h, /You have no projects yet\./); assert.match(h, /data-v3-start/);
});
test('no title when the shell owns it; names escaped', () => {
  const h = homeView({ projects: [{ id: 'p', name: '<x>' }], listFor: () => ({ status: 'loaded', list: [] }) });
  assert.doesNotMatch(h, /<h1>/); assert.match(h, /&lt;x&gt;/);
});
test('archived project is labelled Archived, no continue action', () => {
  const h = homeView({ projects: [{ id: 'z', name: 'Old', archived_at: '2026-01-01' }], listFor: () => undefined });
  assert.match(h, /v3h-pill-done">Archived</); assert.doesNotMatch(h, /Continue|Open project/);
});
test('never shows a raw language id', () => {
  assert.doesNotMatch(assessmentRow({ id: 'a', name: 'A', stage: 'collect', language_id: 'lang_123' }, label), /lang_123/);
});
test('L9-2 frame 2: assessments render as whole-card links in one grid, eyebrow project · language, no nested links', () => {
  const h = homeView({ projects: [{ id: 'p1', name: 'Lake' }], listFor: () => ({ status: 'loaded', list: [{ id: 'a1', name: 'Oct', stage: 'collect', language_name: 'Hindi' }] }), stageLabel: label });
  assert.match(h, /class="v3h-cards"/); assert.match(h, /<a class="v3h-card v3h-acard" href="#assessment\/a1"/);
  assert.match(h, /v3h-eyebrow">Lake · Hindi</);
  const card = h.slice(h.indexOf('<a class="v3h-card'), h.indexOf('</a>', h.indexOf('<a class="v3h-card')) + 4);
  assert.equal((card.match(/<a /g) || []).length, 1, 'card holds no inner link');
  assert.match(h, /v3h-projects">Projects: <a href="#project\/p1">Lake<\/a>/, 'project still reachable');
});
