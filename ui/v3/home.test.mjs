import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeView } from './home.js';
// Owner rule: nobody sees reviews/assessments outside an opened project. Home lists projects only.
test('home lists projects only: no review card, link, pill, name or continue action', () => {
  const h = homeView({ title: 'Welcome', projects: [{ id: 'p1', name: 'Lake' }, { id: 'p2', name: 'Coast' }], start: '<a data-v3-start href="#new">+ Start a new 3D Review</a>',
    // a caller that still passes review data (old contract) must not get it rendered
    listFor: () => ({ status: 'loaded', list: [{ id: 'a1', name: 'Secret review', stage: 'collect' }] }), shared: [{ id: 'asm_1', name: 'Shared review' }] });
  assert.match(h, /Your projects, newest first\./); assert.match(h, /data-v3-start/); assert.match(h, /<h1>Welcome<\/h1>/); assert.match(h, /\/v3\/home\.css/);
  assert.match(h, /data-v3h-project="p1"[\s\S]*href="#project\/p1">Open project/); assert.match(h, /data-v3h-project="p2"/);
  assert.doesNotMatch(h, /Secret review|Shared review|data-v3h-assessment|v3h-acard|#assessment\/|#new\/a|Continue assessment|Continue setup|Shared with you|Your 3D Reviews/);
});
test('empty account still offers the start action', () => {
  const h = homeView({ projects: [], start: '<a data-v3-start href="#new">x</a>' });
  assert.match(h, /You have no projects yet\./); assert.match(h, /data-v3-start/);
});
test('no title when the shell owns it; names escaped', () => {
  const h = homeView({ projects: [{ id: 'p', name: '<x>' }] });
  assert.doesNotMatch(h, /<h1>/); assert.match(h, /&lt;x&gt;/);
});
test('archived project is labelled Archived, no open action', () => {
  const h = homeView({ projects: [{ id: 'z', name: 'Old', archived_at: '2026-01-01' }] });
  assert.match(h, /v3h-pill-done">Archived</); assert.doesNotMatch(h, /Continue|Open project/);
});
test('project cards show only the aggregate counts the server sent; none invented', () => {
  const h = homeView({ projects: [{ id: 'p', name: 'P' }, { id: 'q', name: 'Q', assessment_count: 2, response_count: 5 }] });
  assert.doesNotMatch(h.slice(0, h.indexOf('data-v3h-project="q"')), /data-v3-counts/, 'no fields → no counts line');
  assert.match(h, /data-v3-counts>2 assessments · 5 responses</);
  assert.doesNotMatch(h, /\d+ of \d+/);
});
test('scope.js Home reads /v2/projects (and invitations) only: never a review list, a review read or the grants that list shared reviews', async () => {
  const { pages } = await import('../assess/scope.js');
  const cards = await import('../assess/cards.js');
  const requested = [];
  const ctx = { requested, api: async url => { requested.push(url); if (url === '/v2/projects') return { projects: [{ id: 'p1', name: 'Lake' }] }; if (url === '/v2/me/invitations') return { invitations: [] };
      if (/assessments/.test(url)) return { assessments: [{ id: 'a1', name: 'Secret review', stage: 'collect' }] }; return { grants: [{ scope_type: 'assessment', scope_id: 'a9' }] }; },
    esc: cards.esc, enc: cards.enc, go: () => {}, note: () => {}, state: { principal: null }, routes: cards.routes, cards };
  const h = pages.projects.render(ctx, await pages.projects.load(ctx, {}));
  assert.match(h, /data-v3h-project="p1"/);
  assert.deepEqual(requested.filter(u => /assessments|\/v2\/me$/.test(u)), [], 'Home requests no review data');
  assert.doesNotMatch(h, /Secret review|#assessment\//);
});

// S40 (persona C, gate 0.24.0): a signed-in invitee on Home sees one quiet line with the count and a link to the invitations screen.
import { invitationsHint } from './home.js';
import { pages } from '../assess/scope.js';
import * as cards from '../assess/cards.js';
const INV = (id, type = 'project') => ({ id, role: 'member', scope: { type, id: `${type}_${id}`, name: `N${id}` } });
const homeCtx = map => ({ requested: [], api: async function (url) { this.requested.push(url); const r = map[url]; if (r === undefined || r instanceof Error) throw r || Object.assign(new Error('unmapped'), { code: '500' }); return r; },
  esc: cards.esc, enc: cards.enc, go: () => {}, note: () => {}, state: { principal: null }, routes: cards.routes, cards });
test('S40: n pending invitations → one hint line with the count, linking to #invite; Start stays the one primary', async () => {
  const ctx = homeCtx({ '/v2/projects': { projects: [{ id: 'p1', name: 'Lake' }] }, '/v2/me': { grants: [] }, '/v2/me/invitations': { invitations: [INV('i1'), INV('i2', 'assessment'), INV('i3')] } });
  const h = pages.projects.render(ctx, await pages.projects.load(ctx, {}));
  assert.equal((h.match(/data-v3h-invitations>/g) || []).length, 1);
  assert.match(h, /data-v3h-invitations>You have 3 invitations waiting\. <a href="#invite\/list" data-v3h-invitations-link>See invitations<\/a><\/p>/);
  assert.equal((h.match(/rv-btn primary/g) || []).length, 1, 'one primary action: Start');
  assert.match(invitationsHint(1), /You have 1 invitation waiting\. <a href="#invite\/list"[^>]*>See the invitation<\/a>/);
  assert.match(homeView({ projects: [], listFor: () => ({}), invitations: 2 }), /You have 2 invitations waiting/, 'empty account still shows the hint');
});
test('S40: zero invitations (or a failed read) → no hint', async () => {
  const base = { '/v2/projects': { projects: [{ id: 'p1', name: 'Lake' }] }, '/v2/me': { grants: [] } };
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

test('greet by name (CONTRACT § 4–5): "Welcome, <name>" is the one H1 (escaped), replacing the title; nothing otherwise', () => {
  const named = homeView({ projects: [], listFor: () => ({}), name: ' Ana <Ruiz> ', title: 'Projects', start: '<a data-v3-start href="#new">+</a>' });
  assert.match(named, /<h1 class="fs-h1" data-v3h-welcome>Welcome, Ana &lt;Ruiz&gt;<\/h1>/);
  assert.equal((named.match(/<h1/g) || []).length, 1); assert.doesNotMatch(named, />Projects</);
  assert.match(named, /<\/h1><p class="v3h-sub">Your projects, newest first\.<\/p>/);
  assert.match(homeView({ projects: [], listFor: () => ({}), name: 'ana@example.invalid' }), /<h1 class="fs-h1" data-v3h-welcome>Welcome, ana@example\.invalid<\/h1>/); // § 4 email fallback
  for (const name of ['', '   ', null, undefined, 42]) assert.doesNotMatch(homeView({ projects: [], listFor: () => ({}), name }), /data-v3h-welcome/);
});
