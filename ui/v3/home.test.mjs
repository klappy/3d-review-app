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
  assert.match(h, /Your 3D Reviews, newest first\./); assert.match(h, /data-v3-start/);
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
test('L9-2 frame 2: assessments render as whole-card links in one grid, title + project · language sub-line, no nested links', () => {
  const h = homeView({ projects: [{ id: 'p1', name: 'Lake' }], listFor: () => ({ status: 'loaded', list: [{ id: 'a1', name: 'Oct', stage: 'collect', language_name: 'Hindi' }] }), stageLabel: label });
  assert.match(h, /class="v3h-cards"/); assert.match(h, /<a class="v3h-card v3h-acard" href="#assessment\/a1"/);
  assert.match(h, /<h3>Oct<\/h3>/); assert.match(h, /data-v3h-project-line>Lake · Hindi</);
  const card = h.slice(h.indexOf('<a class="v3h-card'), h.indexOf('</a>', h.indexOf('<a class="v3h-card')) + 4);
  assert.equal((card.match(/<a /g) || []).length, 1, 'card holds no inner link');
  assert.match(h, /v3h-projects">Projects: <a href="#project\/p1">Lake<\/a>/, 'project still reachable');
});
test('B17: cards show the response count the list read sent; project cards show assessments and responses; none invented', () => {
  const a = assessmentRow({ id: 'a1', name: 'A', stage: 'understand', response_count: 9 }, label);
  assert.match(a, /data-v3-counts>9 responses</);
  assert.match(assessmentRow({ id: 'a', name: 'A', stage: 'collect', response_count: 1 }, label), /data-v3-counts>1 response</);
  assert.match(assessmentRow({ id: 'a', name: 'A', stage: 'collect', response_count: 0 }, label), /data-v3-counts>No responses yet</);
  assert.doesNotMatch(assessmentRow({ id: 'a', name: 'A', stage: 'collect' }, label), /data-v3-counts/, 'no field → no line');
  const h = homeView({ projects: [{ id: 'p', name: 'P', assessment_count: 0, response_count: 0 }, { id: 'q', name: 'Q', assessment_count: 2, response_count: 5 }], listFor: id => (id === 'p' ? { status: 'loaded', list: [] } : {}) });
  assert.doesNotMatch(h.slice(0, h.indexOf('data-v3h-project="q"')), /data-v3-counts/, 'loaded-empty keeps its one "No assessments yet" line');
  assert.match(h, /data-v3-counts>2 assessments · 5 responses</);
});
test('B03: an assessment shared directly (no project role) is listed with Continue, sub-line "Shared with you", no raw ids', () => {
  const h = homeView({ projects: [], shared: [{ id: 'asm_1', project_id: 'proj_9', name: 'Kapanawa review', stage: 'collect' }], listFor: () => undefined, stageLabel: label });
  assert.doesNotMatch(h, /You have no projects yet/);
  assert.match(h, /Shared with you/); assert.match(h, /Kapanawa review/); assert.match(h, /Continue assessment/); assert.match(h, /href="#assessment\/asm_1"/);
  assert.doesNotMatch(h, /proj_9/);
});
test('B28: one card per review across projects, project name as sub-line, newest first; a project with no review still has a card', () => {
  const lists = { p1: { status: 'loaded', list: [{ id: 'a1', name: 'First', stage: 'collect', response_count: 2, created_at: '2026-09-01T10:00:00Z' }, { id: 'a3', name: 'Third', stage: 'understand', response_count: 0, created_at: '2026-09-20T10:00:00Z' }] },
    p2: { status: 'loaded', list: [{ id: 'a2', name: 'Second', stage: 'collect', response_count: 9, created_at: '2026-09-10T10:00:00Z' }] }, p3: { status: 'loaded', list: [] } };
  const h = homeView({ projects: [{ id: 'p1', name: 'Lake' }, { id: 'p2', name: 'Coast' }, { id: 'p3', name: 'Empty' }], listFor: id => lists[id], stageLabel: label, start: '<a data-v3-start href="#new">+ Start a new 3D Review</a>' });
  assert.ok(h.indexOf('data-v3-start') < h.indexOf('data-v3h-assessment'), 'B18: Start comes first');
  const cards = [...h.matchAll(/<a class="v3h-card v3h-acard"[\s\S]*?<\/a>/g)].map(m => m[0]);
  assert.equal(cards.length, 3, 'one card per review');
  assert.deepEqual(cards.map(c => c.match(/<h3>([^<]*)<\/h3>/)[1]), ['Third', 'Second', 'First'], 'newest first across projects');
  assert.deepEqual(cards.map(c => c.match(/data-v3h-project-line>([^<]*)</)[1]), ['Lake', 'Coast', 'Lake'], 'project name as sub-line');
  assert.match(cards[1], /v3h-pill-progress">Collecting responses</); assert.match(cards[1], /data-v3-counts>9 responses</); assert.match(cards[1], /href="#assessment\/a2"/);
  for (const c of cards) assert.match(c, /Continue assessment <span aria-hidden="true">→<\/span>/);
  assert.match(h, /data-v3h-project="p3"[\s\S]*?<a href="#project\/p3">Empty<\/a>/, 'project with no review still appears and opens the project');
  assert.ok(h.lastIndexOf('data-v3h-assessment') < h.indexOf('data-v3h-project="p3"'), 'review cards before project cards');
});
test('B28: shared reviews sort in with the rest; no created_at sorts last, ties keep list order', () => {
  const h = homeView({ projects: [{ id: 'p', name: 'P' }], shared: [{ id: 's', name: 'S', stage: 'collect', created_at: '2026-09-15T00:00:00Z' }],
    listFor: () => ({ status: 'loaded', list: [{ id: 'x', name: 'X', stage: 'collect' }, { id: 'y', name: 'Y', stage: 'collect', created_at: '2026-09-20T00:00:00Z' }, { id: 'z', name: 'Z', stage: 'collect' }] }), stageLabel: label });
  assert.deepEqual([...h.matchAll(/data-v3h-assessment="([^"]+)"/g)].map(m => m[1]), ['y', 's', 'x', 'z']);
});
