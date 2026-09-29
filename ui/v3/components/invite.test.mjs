import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteView, inviteFailure, mountInvite } from './invite.js';
const tick = () => new Promise(r => setTimeout(r, 0));
function fakeRoot() {
  const handlers = {};
  return { handlers, set innerHTML(v) { this.html = v; for (const k of Object.keys(handlers)) delete handlers[k]; }, get innerHTML() { return this.html; },
    querySelector(sel) { const key = sel.slice(1, -1); return this.html.includes(key) ? { addEventListener: (_e, fn) => { handlers[key] = fn; } } : null; } };
}
test('ready: what was shared (kind + role) and ONE Accept action; no ids', () => {
  const h = inviteView({ status: 'ready', kind: 'assessment', role: 'viewer' });
  assert.match(h, /You were invited to an assessment as a viewer\./);
  assert.equal((h.match(/<button/g) || []).length, 1); assert.match(h, /data-invite-accept/);
  assert.doesNotMatch(h, /proj_|asm_|tok/);
});
test('signed out: sign in, then back here', () => {
  const h = inviteView({ status: 'signin' });
  assert.match(h, /href="\/v2\/auth\/access"/); assert.match(h, /you come back here after signing in/);
});
test('server codes map to plain screens, never raw text', () => {
  assert.equal(inviteFailure({ code: 'NOT_AUTHENTICATED' }), 'signin');
  assert.equal(inviteFailure({ code: 'INVALID_PARAMS', message: 'invitation_used' }), 'used');
  assert.equal(inviteFailure({ code: 'INVALID_PARAMS', message: 'invitation_expired' }), 'expired');
  assert.equal(inviteFailure({ code: 'NOT_FOUND_OR_NOT_VISIBLE', message: 'x' }), 'refused');
  assert.equal(inviteFailure(new Error('boom')), 'failed');
  assert.doesNotMatch(inviteView({ status: 'refused' }), /NOT_FOUND/);
});
test('dry run → Accept executes with the confirm token → forget + onAccepted(scope)', async () => {
  const calls = [], root = fakeRoot(); let forgot = 0, accepted = null;
  const api = async (url, o) => { calls.push([url, o.body]); return o.body.mode === 'dry_run' ? { impact: { affected: [{ scope: { type: 'assessment', id: 'a1' }, role: 'viewer' }] }, confirm_token: 'ct' } : { granted: true, scope: { type: 'assessment', id: 'a1' }, role: 'viewer' }; };
  mountInvite(root, { api, token: 'tok/1', forget: () => forgot++, onAccepted: s => { accepted = s; } });
  await tick();
  assert.match(root.innerHTML, /as a viewer/);
  root.handlers['data-invite-accept'](); await tick();
  assert.deepEqual(calls.map(c => c[0]), ['/v2/invitations/tok%2F1/accept', '/v2/invitations/tok%2F1/accept']);
  assert.deepEqual(calls[1][1], { mode: 'execute', confirm_token: 'ct' });
  assert.equal(forgot, 1); assert.deepEqual(accepted, { type: 'assessment', id: 'a1' });
});
test('a used invitation clears the stored token; a transient failure keeps it and offers Try again', async () => {
  let forgot = 0; const root = fakeRoot();
  mountInvite(root, { api: async () => { throw Object.assign(new Error('invitation_used'), { code: 'INVALID_PARAMS' }); }, token: 't', forget: () => forgot++ });
  await tick(); assert.match(root.innerHTML, /Already accepted/); assert.equal(forgot, 1);
  const r2 = fakeRoot(); let f2 = 0;
  mountInvite(r2, { api: async () => { throw new Error('API unavailable'); }, token: 't', forget: () => f2++ });
  await tick(); assert.match(r2.innerHTML, /data-invite-retry/); assert.equal(f2, 0);
});
test('token parser: same rule as the legacy parser (and this module never mounts anything on import)', async () => {
  const { parseInvitationFragment } = await import('./invite.js');
  const legacy = (await import('../../public-entry.js')).parseInvitationFragment;
  for (const h of ['#invite=SECRET_abc-12', '#invite=', '#invite=%ZZ', '#invite=abc&survey=def', '#invite=' + 'a'.repeat(4097), '#invite=abc%0A', '#survey=x']) assert.equal(parseInvitationFragment(h), legacy(h), h.slice(0, 40));
});
// S9 (B04 step c, captain 2026-09-28): the signed-in person's own invitations — accept by id, no token.
import { pendingInvitations } from './invite.js';
test('S9: pendingInvitations keeps only well-formed rows from GET /v2/me/invitations; anything else is []', () => {
  const ok = { id: 'inv_1', scope: { type: 'project', id: 'p1', name: 'River Valley', path: ['North', 'River Valley'] }, role: 'viewer', inviter_display_name: null, expires_at: '2026-10-05T00:00:00Z' };
  assert.deepEqual(pendingInvitations({ invitations: [ok, null, { id: '' }, { id: 'inv_2', role: 'viewer' }, { id: 'inv_3', scope: { type: 'project' } }] }), [ok]);
  for (const bad of [undefined, null, {}, { invitations: 'x' }, []]) assert.deepEqual(pendingInvitations(bad), []);
  // S19: name/path normalised — an older server (no name) or junk reads as name null, path of strings only.
  assert.deepEqual(pendingInvitations({ invitations: [{ id: 'inv_4', scope: { type: 'project', id: 'p4' }, role: 'owner' }] })[0].scope, { type: 'project', id: 'p4', name: null, path: [] });
  assert.deepEqual(pendingInvitations({ invitations: [{ id: 'inv_5', scope: { type: 'project', id: 'p5', name: 7, path: ['A', 3, null, 'B'] }, role: 'owner' }] })[0].scope, { type: 'project', id: 'p5', name: null, path: ['A', 'B'] });
});

// S19 (captain 2026-09-29: "it's ridiculous to not see what I'm accepting the invite to! And there's multiple so they just keep
// coming!!!"): every pending invitation on ONE page, named with its path; Accept per row; "Accept all" the primary when ≥2.
import { JSDOM } from 'jsdom';
import { invitationsView, invitationLine, mountInvitations, acceptInvitationById } from './invite.js';
const doc = html => new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
const inv = (id, type, name, path, role = 'viewer') => ({ id, scope: { type, id: 'x_' + id, name, path }, role, inviter_display_name: null });
const THREE = [inv('inv_w', 'workspace', 'North', ['North'], 'owner'), inv('inv_p', 'project', 'Hill Project', ['North', 'Hill Project'], 'member'), inv('inv_a', 'assessment', 'Spring review', ['North', 'Hill Project', 'Spring review'])];
test('S19: one invitation reads as one sentence naming it — one heading, one short line, one primary "Accept"; no ids', () => {
  const h = invitationsView({ invitations: [inv('inv_1', 'project', 'River Valley', ['River Valley'], 'owner')] });
  const d = doc(h);
  assert.equal(d.querySelectorAll('h1').length, 1); assert.equal(d.querySelector('h1').textContent, 'Accept invitation');
  assert.equal(d.querySelectorAll('p').length, 1); assert.equal(d.querySelector('p').textContent, 'You were invited to the project "River Valley" as an owner.');
  const b = d.querySelectorAll('button'); assert.equal(b.length, 1); assert.equal(b[0].textContent, 'Accept'); assert.ok(b[0].classList.contains('primary'));
  assert.equal(d.querySelectorAll('[data-invite-row]').length, 0);
  assert.doesNotMatch(h, /inv_|x_inv|tok/);
  // the path above the scope reads in brackets; no name (older server, scope gone) keeps the S9 wording
  assert.equal(invitationLine(inv('inv_2', 'assessment', 'Spring review', ['North', 'Hill Project', 'Spring review'])), 'You were invited to the assessment "Spring review" (North › Hill Project) as a viewer.');
  assert.equal(invitationLine(inv('inv_3', 'workspace', 'North', ['North'], 'member')), 'You were invited to the workspace "North" as a member.');
  assert.equal(invitationLine(inv('inv_4', 'project', null, [], 'owner')), 'You were invited to a project as an owner.');
  assert.match(invitationsView({ invitations: [inv('inv_1', 'project', 'River Valley', ['River Valley'])], busy: 0 }), /data-invite-accept-one="0" disabled>Accepting…<\/button>/);
});
test('S19: two or more → one row per invitation (kind, name with its path, role, its own Accept) and ONE primary "Accept all"', () => {
  const d = doc(invitationsView({ invitations: THREE }));
  assert.equal(d.querySelectorAll('h1').length, 1); assert.equal(d.querySelector('h1').textContent, 'Accept invitations');
  assert.equal(d.querySelector('[data-invite-line]').textContent, 'You have 3 invitations waiting.');
  const rows = [...d.querySelectorAll('[data-invite-row]')]; assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.querySelector('[data-invite-kind]').textContent), ['Workspace · Owner', 'Project · Member', 'Assessment · Viewer']);
  assert.deepEqual(rows.map(r => r.querySelector('[data-invite-name]').textContent), ['North', 'Hill Project', 'Spring review']);
  assert.deepEqual(rows.map(r => r.querySelector('[data-invite-path]')?.textContent ?? ''), ['', 'North › ', 'North › Hill Project › ']);
  assert.deepEqual(rows.map(r => r.querySelector('button').textContent), ['Accept', 'Accept', 'Accept']);
  assert.ok(rows.every(r => !r.querySelector('button').classList.contains('primary')), 'row Accepts are secondary');
  const primary = d.querySelectorAll('.primary'); assert.equal(primary.length, 1); assert.equal(primary[0].textContent, 'Accept all'); assert.ok(primary[0].hasAttribute('data-invite-accept-all'));
  // while accepting, every button is disabled
  const busy = doc(invitationsView({ invitations: THREE, busy: 'all' }));
  assert.ok([...busy.querySelectorAll('button')].every(b => b.disabled)); assert.equal(busy.querySelector('[data-invite-accept-all]').textContent, 'Accepting…');
});
test('S19: names are member-authored — every name, path and notice is escaped (single sentence and list rows)', () => {
  const evil = '<img src=x onerror="alert(1)">&"\'', pathEvil = '<script>x()</script>';
  const one = invitationsView({ invitations: [inv('inv_e', 'assessment', evil, [pathEvil, 'P&Q', evil])], notice: '<b>boom</b>' });
  const many = invitationsView({ invitations: [inv('inv_e', 'assessment', evil, [pathEvil, 'P&Q', evil]), inv('inv_f', 'project', evil, [evil])] });
  for (const h of [one, many]) { assert.doesNotMatch(h, /<img|<script|<b>/); assert.match(h, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;&amp;&quot;&#39;/); }
  const d1 = doc(one);
  assert.equal(d1.querySelectorAll('img,script,b').length, 0);
  assert.equal(d1.querySelector('[data-invite-line]').textContent, `You were invited to the assessment "${evil}" (${pathEvil} › P&Q) as a viewer.`);
  assert.equal(d1.querySelector('[data-invite-notice]').textContent, '<b>boom</b>');
  const d2 = doc(many);
  assert.equal(d2.querySelectorAll('img,script').length, 0);
  assert.deepEqual([...d2.querySelectorAll('[data-invite-name]')].map(n => n.textContent), [evil, evil]);
  assert.equal(d2.querySelector('[data-invite-path]').textContent, `${pathEvil} › P&Q › `);
});
function domRoot() { const d = doc('<main id="r"></main>'); return d.getElementById('r'); }
function acceptApi(fail = {}) {
  const calls = [];
  const api = async (url, o) => {
    calls.push([url, o.body]);
    const id = decodeURIComponent(url.split('/')[4]);
    if (fail[id]) throw fail[id];
    return o.body.mode === 'dry_run' ? { impact: { affected: [{ scope: { type: 'project', id: 'x_' + id }, role: 'viewer' }] }, confirm_token: 'ct_' + id } : { granted: true, scope: { type: 'project', id: 'x_' + id }, role: 'viewer' };
  };
  return { api, calls };
}
test('S19: "Accept all" runs the same dry run → execute for every invitation, in order, then hands over once', async () => {
  const root = domRoot(), { api, calls } = acceptApi(); let settled = null, n = 0;
  mountInvitations(root, { api, invitations: THREE, onSettled: out => { settled = out; n++; } });
  root.querySelector('[data-invite-accept-all]').click();
  assert.ok([...root.querySelectorAll('button')].every(b => b.disabled), 'buttons disabled while accepting');
  await tick(); await tick(); await tick();
  assert.deepEqual(calls, ['inv_w', 'inv_p', 'inv_a'].flatMap(id => [[`/v2/me/invitations/${id}/accept`, { mode: 'dry_run' }], [`/v2/me/invitations/${id}/accept`, { mode: 'execute', confirm_token: 'ct_' + id }]]));
  assert.equal(n, 1); assert.deepEqual(settled, { accepted: ['inv_w', 'inv_p', 'inv_a'].map(id => ({ type: 'project', id: 'x_' + id })), failed: [] });
});
test('S19: a row\'s Accept accepts only that invitation; a failure is reported as a plain state, never raw', async () => {
  const root = domRoot(), { api, calls } = acceptApi(); let settled = null;
  mountInvitations(root, { api, invitations: THREE, onSettled: out => { settled = out; } });
  root.querySelectorAll('[data-invite-accept-one]')[1].click(); await tick(); await tick();
  assert.deepEqual(calls.map(c => c[0]), ['/v2/me/invitations/inv_p/accept', '/v2/me/invitations/inv_p/accept']);
  assert.deepEqual(settled, { accepted: [{ type: 'project', id: 'x_inv_p' }], failed: [] });
  const r2 = domRoot(), f = acceptApi({ inv_w: new Error('API unavailable'), inv_a: Object.assign(new Error('invitation_expired'), { code: 'INVALID_PARAMS' }) }); let out2 = null;
  mountInvitations(r2, { api: f.api, invitations: THREE, onSettled: out => { out2 = out; } });
  r2.querySelector('[data-invite-accept-all]').click(); await tick(); await tick(); await tick();
  assert.deepEqual(out2, { accepted: [{ type: 'project', id: 'x_inv_p' }], failed: ['failed', 'expired'] });
  // a page that is no longer current never receives the result
  const r3 = domRoot(); let current = true, out3 = 'untouched';
  mountInvitations(r3, { api: acceptApi().api, invitations: THREE, isCurrent: () => current, onSettled: out => { out3 = out; } });
  r3.querySelector('[data-invite-accept-all]').click(); current = false; await tick(); await tick(); await tick();
  assert.equal(out3, 'untouched');
});
test('S19: acceptInvitationById refuses an answer without a confirm token or a grant (no silent success)', async () => {
  await assert.rejects(acceptInvitationById(async () => ({}), 'inv_1'), { code: 'BAD_RESULT' });
  await assert.rejects(acceptInvitationById(async (_u, o) => (o.body.mode === 'dry_run' ? { confirm_token: 'ct' } : { granted: false }), 'inv_1'), { code: 'BAD_RESULT' });
});
