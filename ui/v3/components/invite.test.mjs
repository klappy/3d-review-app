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
  const ok = { id: 'inv_1', scope: { type: 'project', id: 'p1' }, role: 'viewer', inviter_display_name: null, expires_at: '2026-10-05T00:00:00Z' };
  assert.deepEqual(pendingInvitations({ invitations: [ok, null, { id: '' }, { id: 'inv_2', role: 'viewer' }, { id: 'inv_3', scope: { type: 'project' } }] }), [ok]);
  for (const bad of [undefined, null, {}, { invitations: 'x' }, []]) assert.deepEqual(pendingInvitations(bad), []);
});
test('S9: the accept-first screen is one heading "Accept invitation", one line, one primary "Accept" — no ids, no token', () => {
  const h = inviteView({ status: 'ready', kind: 'project', role: 'viewer', mine: true });
  assert.equal((h.match(/<h1/g) || []).length, 1); assert.match(h, /<h1[^>]*>Accept invitation<\/h1>/);
  assert.equal((h.match(/<p/g) || []).length, 1); assert.match(h, /You were invited to a project as a viewer\./);
  assert.equal((h.match(/<button/g) || []).length, 1); assert.match(h, /class="rv-btn primary" data-invite-accept\s*>Accept<\/button>/);
  assert.equal((h.match(/<a /g) || []).length, 0);
  assert.doesNotMatch(h, /inv_|proj_|tok/);
  assert.match(inviteView({ status: 'accepting', kind: 'project', role: 'viewer', mine: true }), /disabled>Accepting…<\/button>/);
  // the link-token screen is unchanged
  assert.match(inviteView({ status: 'ready', kind: 'project', role: 'viewer' }), /<h1[^>]*>You were invited<\/h1>[\s\S]*>Accept invitation<\/button>/);
});
test('S9: accept by invitationId posts to /v2/me/invitations/<id>/accept (dry run → execute with the confirm token); no token in any call', async () => {
  const calls = [], root = fakeRoot(); let accepted = null, forgot = 0;
  const api = async (url, o) => { calls.push([url, o.body]); return o.body.mode === 'dry_run' ? { impact: { affected: [{ scope: { type: 'project', id: 'p1' }, role: 'viewer' }] }, confirm_token: 'ct' } : { granted: true, scope: { type: 'project', id: 'p1' }, role: 'viewer' }; };
  mountInvite(root, { api, invitationId: 'inv_1', forget: () => { forgot++; }, onAccepted: s => { accepted = s; } }); await tick();
  assert.match(root.html, /Accept invitation/); assert.match(root.html, />Accept<\/button>/);
  await root.handlers['data-invite-accept'](); await tick();
  assert.deepEqual(calls, [['/v2/me/invitations/inv_1/accept', { mode: 'dry_run' }], ['/v2/me/invitations/inv_1/accept', { mode: 'execute', confirm_token: 'ct' }]]);
  assert.deepEqual(accepted, { type: 'project', id: 'p1' }); assert.equal(forgot, 1);
});
test('S9: someone else\'s / withdrawn invitation (NOT_FOUND_OR_NOT_VISIBLE) → the plain refused screen', async () => {
  const root = fakeRoot();
  mountInvite(root, { api: async () => { throw Object.assign(new Error('invitation not found or not visible'), { code: 'NOT_FOUND_OR_NOT_VISIBLE' }); }, invitationId: 'inv_x' }); await tick();
  assert.match(root.html, /Invitation not available/); assert.doesNotMatch(root.html, /NOT_FOUND|inv_x/);
});
