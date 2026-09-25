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
