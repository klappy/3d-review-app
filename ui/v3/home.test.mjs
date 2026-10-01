import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeView, assessmentRow } from './home.js';
const label = s => ({ prepare: 'Setup not finished', collect: 'Collecting responses' }[s] || s);
test('prepare → Continue setup; other stages → Continue assessment; pill carries the state word', () => {
  const s = assessmentRow({ id: 'a1', name: 'Kapanawa', stage: 'prepare' }, label);
  assert.match(s, /Continue setup <span aria-hidden="true">→<\/span>/); assert.match(s, /v3h-pill-setup">Setup not finished/); assert.match(s, /href="#new\/a1"/, 'B06: Continue setup reopens the setup wizard');
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

test('B06: a review in setup is ONE card whose one action "Continue setup" reopens the wizard (#new/<id>); launched and viewer cards open the review', () => {
  const own = assessmentRow({ id: 'a 1', name: 'Oct', stage: 'prepare', role: 'owner' }, label);
  assert.match(own, /^<a class="v3h-card v3h-acard" href="#new\/a%201"/); assert.equal(own.match(/Continue setup/g).length, 1); assert.doesNotMatch(own, /Continue assessment/);
  assert.match(assessmentRow({ id: 'a1', name: 'Oct', stage: 'prepare', role: 'member' }, label), /href="#new\/a1"/);
  const viewer = assessmentRow({ id: 'a1', name: 'Oct', stage: 'prepare', role: 'viewer' }, label);
  assert.match(viewer, /href="#assessment\/a1"/);
  assert.match(viewer, /Continue assessment/); assert.doesNotMatch(viewer, /Continue setup/, 'B06f: a viewer card says what it does (opens the review)');
  const launched = assessmentRow({ id: 'a1', name: 'Oct', stage: 'collect', role: 'owner' }, label);
  assert.doesNotMatch(launched, /Continue setup|#new\//); assert.match(launched, /href="#assessment\/a1"/);
  const h = homeView({ projects: [{ id: 'p1', name: 'Lake' }], listFor: () => ({ status: 'loaded', list: [{ id: 'a1', name: 'Oct', stage: 'prepare', role: 'owner' }] }), stageLabel: label });
  assert.match(h, /href="#new\/a1"[\s\S]*Continue setup/);
});

// S40 (persona C, gate 0.24.0): a signed-in invitee on Home sees one quiet line with the count and a link to the invitations screen.
import { invitationsHint } from './home.js';
import { pages } from '../assess/scope.js';
import * as cards from '../assess/cards.js';
const INV = (id, type = 'project') => ({ id, role: 'member', scope: { type, id: `${type}_${id}`, name: `N${id}` } });
const homeCtx = map => ({ requested: [], api: async function (url) { this.requested.push(url); const r = map[url]; if (r === undefined || r instanceof Error) throw r || Object.assign(new Error('unmapped'), { code: '500' }); return r; },
  esc: cards.esc, enc: cards.enc, go: () => {}, note: () => {}, state: { principal: null }, routes: cards.routes, cards });
test('S40: n pending invitations → one hint line with the count, linking to #invite; Start stays the one primary', async () => {
  const ctx = homeCtx({ '/v2/projects': { projects: [{ id: 'p1', name: 'Lake' }] }, '/v2/projects/p1/assessments': { assessments: [] }, '/v2/me': { grants: [] }, '/v2/me/invitations': { invitations: [INV('i1'), INV('i2', 'assessment'), INV('i3')] } });
  const h = pages.projects.render(ctx, await pages.projects.load(ctx, {}));
  assert.equal((h.match(/data-v3h-invitations>/g) || []).length, 1);
  assert.match(h, /data-v3h-invitations>You have 3 invitations waiting\. <a href="#invite" data-v3h-invitations-link>See invitations<\/a><\/p>/);
  assert.equal((h.match(/rv-btn primary/g) || []).length, 1, 'one primary action: Start');
  assert.match(invitationsHint(1), /You have 1 invitation waiting\. <a href="#invite"[^>]*>See the invitation<\/a>/);
  assert.match(homeView({ projects: [], listFor: () => ({}), invitations: 2 }), /You have 2 invitations waiting/, 'empty account still shows the hint');
});
test('S40: zero invitations (or a failed read) → no hint', async () => {
  const base = { '/v2/projects': { projects: [{ id: 'p1', name: 'Lake' }] }, '/v2/projects/p1/assessments': { assessments: [] }, '/v2/me': { grants: [] } };
  for (const inv of [{ invitations: [] }, { invitations: [{ id: 'bad' }] }, undefined]) {
    const ctx = homeCtx(inv === undefined ? base : { ...base, '/v2/me/invitations': inv });
    assert.doesNotMatch(pages.projects.render(ctx, await pages.projects.load(ctx, {})), /data-v3h-invitations|#invite/);
  }
  for (const n of [0, undefined, -1, 1.5, '3', NaN]) assert.equal(invitationsHint(n), '');
  assert.doesNotMatch(homeView({ projects: [], listFor: () => ({}) }), /data-v3h-invitations/);
});
test('S40: signed out → no hint, even if the invitations read would answer', async () => {
  const ctx = homeCtx({ '/v2/projects': Object.assign(new Error('no session'), { code: 'NOT_AUTHENTICATED' }), '/v2/me/invitations': { invitations: [INV('i1')] } });
  const h = pages.projects.render(ctx, await pages.projects.load(ctx, {}));
  assert.match(h, /Sign in to continue/); assert.doesNotMatch(h, /data-v3h-invitations|invitation/i);
  assert.deepEqual(ctx.requested, ['/v2/projects'], 'signed out: /v2/me/invitations is never requested');
});
