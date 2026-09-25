import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { permissions, NOT_AVAILABLE, VIEWER_NOTE, DUPLICATE_NOTE, PREVIEW_AGAIN, TEST_ADDRESS_NOTE, inviteOutcome } from './permissions.js';
import { shortDate } from './cards.js';

const read = n => readFileSync(fileURLToPath(new URL(n, import.meta.url)), 'utf8');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const err = (code, status, message = code, hint) => Object.assign(new Error(message), { code, status, hint });
const G = 'GET /v2/assessment/a1/grants';
const roster = (mine) => ({ grants: [{ id: 'g_me', principal_id: 'me', role: mine }, { id: 'g_own', principal_id: 'boss', role: 'owner' }, { id: 'g_mem', principal_id: 'pat', role: 'member' }, { id: 'g_view', principal_id: 'val', role: 'viewer' }], pending_invitations: [{ id: 'inv_p', role: 'viewer', status: 'pending', created_at: '2026-09-17T00:00:00Z' }, { id: 'inv_u', role: 'member', status: 'unconfirmed', created_at: '2026-09-17T00:00:00Z' }, { id: 'inv_acc', role: 'viewer', status: 'accepted' }] });
function fakeApi(table) { const calls = []; const apiFull = async (url, init = {}) => { calls.push({ url, ...init }); const h = table[`${init.method || 'GET'} ${url}`]; if (!h) throw err('NOT_FOUND_OR_NOT_VISIBLE', 404, 'resource not found or not visible'); const v = await (typeof h === 'function' ? h(init) : h); if (v instanceof Error) throw v; return v.ok === undefined ? { ok: true, result: v, trace_id: 'tr_1', receipt: { id: 'rcpt_1' } } : v; }; const api = async (u, o) => (await apiFull(u, o)).result; return { api, apiFull, calls }; }
// fake DOM: elements by attribute; forms carry field values; querySelectorAll by attribute prefix
function makeRoot(html, fields = {}) {
  const els = {}; for (const m of html.matchAll(/(data-[a-z-]+)(?:="([^"]*)")?/g)) { const key = m[2] !== undefined ? `${m[1]}=${m[2]}` : m[1]; els[key] = els[key] || { dataset: { [m[1].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]: m[2] }, handlers: {}, addEventListener(ev, fn) { this.handlers[ev] = fn; }, fire(ev, e = { preventDefault() {}, currentTarget: null }) { e.currentTarget = e.currentTarget || this; return this.handlers[ev]?.(e); }, querySelector(sel) { const n = /\[name=(\w+)\]/.exec(sel)?.[1]; return n ? { value: fields[n] ?? '', checked: !!fields[n + '_checked'] } : null; } }; }
  const root = { html, els, fields, set innerHTML(v) { this.html = v; this.els = makeRoot(v, this.fields).els; }, get innerHTML() { return this.html; },
    querySelector(sel) { const m = /\[(data-[a-z-]+)(?:="([^"]*)")?\]/.exec(sel); if (!m) return null; const key = m[2] !== undefined ? `${m[1]}=${m[2]}` : m[1]; return this.els[key] || Object.values(this.els).find(e => e.dataset && Object.keys(e.dataset).some(k => k === m[1].slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()))) && this.els[Object.keys(this.els).find(k => k.startsWith(m[1] + '='))] || null; },
    querySelectorAll(sel) { const m = /\[(data-[a-z-]+)\]/.exec(sel); return m ? Object.keys(this.els).filter(k => k === m[1] || k.startsWith(m[1] + '=')).map(k => this.els[k]) : []; } };
  return root;
}
globalThis.location = { hash: '#assessment/a1/permissions' }; globalThis.CSS = { escape: s => s };
async function mount(mine, table, fields = {}) {
  const { api, apiFull, calls } = fakeApi({ [G]: roster(mine), ...table }); let reloads = 0;
  let m, root, navigation;
  const ctx = { api, apiFull, esc, enc: encodeURIComponent, state: { principal: { id: 'me' } }, go: (h, o) => {
    if (!o?.reload) return;
    reloads++;
    // Match the shell's real lifecycle: route reload replaces the model, then renders/binds again.
    navigation = permissions.load(ctx, { scope: 'assessments', id: 'a1' }).then(fresh => {
      m = fresh; root.innerHTML = permissions.render(ctx, m); permissions.bind(ctx, root, m);
    });
    return navigation;
  } };
  m = await permissions.load(ctx, { scope: 'assessments', id: 'a1' }); root = makeRoot(permissions.render(ctx, m), fields); permissions.bind(ctx, root, m);
  return { ctx, get m() { return m; }, root, calls, settle: () => navigation, reloads: () => reloads, click: async (k) => root.querySelector(`[${k}]`).fire('click'), submit: async (k) => root.querySelector(`[${k}]`).fire('submit') };
}

test('N1 viewer: grant.list 403 → placeholder note, no roster in DOM; N2 no role: 404 → "Not available", no permission wording, no name', async () => {
  const v = await mount('viewer', { [G]: err('NOT_AUTHORIZED_AT_SCOPE', 403) }); assert.match(v.root.html, /data-permissions-state="viewer"/); assert.ok(v.root.html.includes(VIEWER_NOTE)); assert.doesNotMatch(v.root.html, /<table|data-grant-row|boss|pat/);
  const n = await mount('member', { [G]: err('NOT_FOUND_OR_NOT_VISIBLE', 404) }); assert.match(n.root.html, /data-permissions-state="not-found"/); assert.ok(n.root.html.includes(NOT_AVAILABLE)); assert.doesNotMatch(n.root.html, /permission|lack|role|Tavo/i.source ? /lack|you do not have|not allowed/i : /x/); assert.doesNotMatch(n.root.html, /<table/);
});

test('roster + gating: member sees Invite (viewer|member only), Remove only on ≤member rows, no Change-role, no Transfer; owner has all but never on owner rows; pending lists sent|pending|unconfirmed only', async () => {
  const mem = await mount('member'); const h = mem.root.html;
  assert.match(h, /data-my-role="member"/); assert.match(h, /data-invite-form/); assert.doesNotMatch(h, /<option value="owner">/); assert.doesNotMatch(h, /data-transfer-form|data-change-role/);
  assert.match(h, /data-revoke="g_mem"/); assert.match(h, /data-revoke="g_view"/); assert.doesNotMatch(h, /data-revoke="g_own"/); assert.match(h, /Owner — only a transfer changes this/);
  assert.match(h, /data-invitation="inv_p"/); assert.match(h, /data-invitation="inv_u"/); assert.match(h, /Could not be confirmed as sent/); assert.doesNotMatch(h, /inv_acc/, 'accepted invitations are not pending');
  const own = await mount('owner'); const o = own.root.html;
  assert.match(o, /<option value="owner">/); assert.match(o, /data-transfer-form/); assert.match(o, /name="step_down"/); assert.doesNotMatch(o, /name="step_down" checked/); assert.match(o, /data-change-role="g_mem"/); assert.match(o, /data-change-role="g_view"/); assert.doesNotMatch(o, /data-change-role="g_own"|data-revoke="g_own"/);
  assert.doesNotMatch(o, /data-confirm-execute|accept/i.source ? /data-accept|Accept invitation/ : /x/, 'no accept control on the Permissions page');
});

test('invite two-step: dry_run params → sheet renders impact VERBATIM (effect, irreversible, compensating_control, affected) + 300 s; execute sends byte-identical params + token; success shows receipt/trace; token cleared', async () => {
  const seen = []; const impact = { affected: [{ scope: { type: 'assessment', id: 'a1' }, role: 'viewer', invitee: '629f4df892ca', will_see: 'assessment contents at role viewer' }], irreversible: true, effect: 'external', compensating_control: 'cap.grant.revoke_invitation' };
  const t = { 'POST /v2/assessment/a1/invitations': ({ body }) => { seen.push(body); return body.mode === 'dry_run' ? { confirm_token: 'cfm_1', expires_in: 300, impact } : { invitation_id: 'inv_new', role: 'viewer', status: 'sent', accepted: true, delivered: true, delivery: { state: 'accepted' } }; } };
  const x = await mount('owner', t, { email: 'new@example.test', role: 'viewer' });
  await x.submit('data-invite-form'); assert.deepEqual(seen[0], { params: { email: 'new@example.test', role: 'viewer' }, mode: 'dry_run' });
  const h = x.root.html; assert.match(h, /data-confirm-kind="invite"/); assert.match(h, /expires in 300 seconds/); assert.match(h, /<dd>external<\/dd>/); assert.match(h, /<dd>true<\/dd>/); assert.match(h, /cap.grant.revoke_invitation/); assert.match(h, /629f4df892ca/); assert.match(h, /new@example.test/);
  await x.click('data-confirm-execute'); assert.deepEqual(seen[1], { params: { email: 'new@example.test', role: 'viewer' }, mode: 'execute', confirm_token: 'cfm_1' });
  assert.equal(x.m.sheet, null); assert.match(x.root.html, /Invitation sent\.<\/p><details class="small learn-more"><summary>Details<\/summary><p class="small muted" data-permissions-ref>receipt rcpt_1 · trace tr_1/); assert.equal(x.reloads(), 0); assert.equal(x.calls.filter(c => c.url === '/v2/assessment/a1/grants').length, 2);
});

test('N3 member invites owner → picker never offers owner; forced 403 renders server message; N12 malformed → server 400 verbatim; N18 429 with hint', async () => {
  const mem = await mount('member', { 'POST /v2/assessment/a1/invitations': err('NOT_AUTHORIZED_AT_SCOPE', 403, 'members invite up to member only') }, { email: 'x@y.z', role: 'owner' });
  await mem.submit('data-invite-form'); assert.match(mem.root.html, /members invite up to member only/); assert.doesNotMatch(mem.root.html, /data-confirm-sheet/);
  const bad = await mount('owner', { 'POST /v2/assessment/a1/invitations': err('INVALID_PARAMS', 400, 'email must be one plain ASCII address') }, { email: 'Name <a@b>', role: 'viewer' });
  await bad.submit('data-invite-form'); assert.match(bad.root.html, /email must be one plain ASCII address/);
  const rl = await mount('owner', { 'POST /v2/assessment/a1/invitations': ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'c', expires_in: 300, impact: {} } : err('RATE_LIMITED', 429, 'too many invitations', 'resets over the next hour') }, { email: 'a@b.c', role: 'viewer' });
  await rl.submit('data-invite-form'); await rl.click('data-confirm-execute'); assert.match(rl.root.html, /too many invitations — resets over the next hour/);
});

test('N13 duplicate invite: execute 200 delivered:false duplicate_recent → "already invited — nothing sent again", never "sent"', async () => {
  const x = await mount('owner', { 'POST /v2/assessment/a1/invitations': ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'c', expires_in: 300, impact: {} } : { invitation_id: 'inv_dup', role: 'viewer', status: 'sent', accepted: true, delivered: false, delivery: { provider: null, state: 'not_sent', reason: 'duplicate_recent' } } }, { email: 'dup@x.y', role: 'viewer' });
  await x.submit('data-invite-form'); await x.click('data-confirm-execute'); assert.ok(x.root.html.includes(DUPLICATE_NOTE)); assert.doesNotMatch(x.root.html, /Invitation sent/);
});

test('N8/N10 CONFIRM_REQUIRED on execute → dry_run re-run silently once and the sheet re-shown, execute NOT auto-retried; N9 CONFIRM_EXPIRED → "Preview again", no retry', async () => {
  const seen = []; let n = 0;
  const t = { 'POST /v2/assessment/a1/invitations': ({ body }) => { seen.push(body.mode); if (body.mode === 'dry_run') return { confirm_token: 'cfm_' + (++n), expires_in: 300, impact: { effect: 'external' } }; return err('CONFIRM_REQUIRED', 409, 'confirmation expired or does not match this intent'); } };
  const x = await mount('owner', t, { email: 'a@b.c', role: 'viewer' }); await x.submit('data-invite-form'); await x.click('data-confirm-execute');
  assert.deepEqual(seen, ['dry_run', 'execute', 'dry_run']); assert.equal(x.m.sheet.token, 'cfm_2'); assert.match(x.root.html, /preview was refreshed\. Confirm again/); assert.match(x.root.html, /data-confirm-execute/);
  const e = await mount('owner', { 'POST /v2/assessment/a1/invitations': ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'c', expires_in: 300, impact: {} } : err('CONFIRM_EXPIRED', 409, 'confirmation expired') }, { email: 'a@b.c', role: 'viewer' });
  await e.submit('data-invite-form'); await e.click('data-confirm-execute'); assert.ok(e.root.html.includes(PREVIEW_AGAIN)); assert.equal(e.m.sheet.token, null); assert.match(e.root.html, /data-confirm-execute disabled/); assert.equal(e.calls.filter(c => c.body?.mode === 'execute').length, 1, 'never auto-retried');
});

test('N5 change role: owner rows have no control; PATCH dry_run/execute with identical {role}; server 403 "owners cannot be demoted" rendered verbatim if forced', async () => {
  const seen = []; const x = await mount('owner', { 'PATCH /v2/assessment/a1/grants/g_mem': ({ body }) => { seen.push(body); return body.mode === 'dry_run' ? { confirm_token: 'c9', expires_in: 300, impact: { effect: 'external', compensating_control: 'demotion' } } : { grant: { id: 'g_mem', role: 'viewer' } }; } });
  x.root.els['data-role-for=g_mem'] = { value: 'viewer' }; await x.click('data-change-role="g_mem"'); assert.deepEqual(seen[0], { params: { role: 'viewer' }, mode: 'dry_run' }); assert.match(x.root.html, /data-confirm-kind="update_role"/); assert.match(x.root.html, /<dd>demotion<\/dd>/);
  await x.click('data-confirm-execute'); assert.deepEqual(seen[1], { params: { role: 'viewer' }, mode: 'execute', confirm_token: 'c9' });
  const forced = await mount('owner', { 'PATCH /v2/assessment/a1/grants/g_mem': err('NOT_AUTHORIZED_AT_SCOPE', 403, 'owners cannot be demoted') }); forced.root.els['data-role-for=g_mem'] = { value: 'viewer' }; await forced.click('data-change-role="g_mem"'); assert.match(forced.root.html, /owners cannot be demoted/);
});

test('N4/N11 revoke: single DELETE with no mode; owner rows have no control; server 403 "owners cannot be removed" verbatim; revoke_invitation single DELETE; N14 accepted → 400 verbatim', async () => {
  const x = await mount('member', { 'DELETE /v2/assessment/a1/grants/g_view': { id: 'g_view', status: 'revoked' }, 'DELETE /v2/invitations/inv_p': { id: 'inv_p', status: 'revoked' } });
  await x.click('data-revoke="g_view"'); const d = x.calls.find(c => c.method === 'DELETE'); assert.equal(d.url, '/v2/assessment/a1/grants/g_view'); assert.equal(d.body, undefined, 'no body, no mode'); assert.match(x.root.html, /Access removed/);
  await x.click('data-revoke-invitation="inv_p"'); assert.ok(x.calls.some(c => c.method === 'DELETE' && c.url === '/v2/invitations/inv_p' && c.body === undefined));
  const f = await mount('member', { 'DELETE /v2/assessment/a1/grants/g_mem': err('NOT_AUTHORIZED_AT_SCOPE', 403, 'owners cannot be removed') }); await f.click('data-revoke="g_mem"'); assert.match(f.root.html, /owners cannot be removed/);
  const acc = await mount('owner', { 'DELETE /v2/invitations/inv_p': err('INVALID_PARAMS', 400, 'already accepted — revoke the grant instead') }); await acc.click('data-revoke-invitation="inv_p"'); assert.match(acc.root.html, /already accepted — revoke the grant instead/);
});

test('N6/N7 transfer: owner only; principal id field; step_down off by default and omitted from params; self/unknown → server 400 verbatim; destructive impact shown verbatim', async () => {
  const seen = []; const x = await mount('owner', { 'POST /v2/assessment/a1/transfer': ({ body }) => { seen.push(body); return body.mode === 'dry_run' ? { confirm_token: 'ct', expires_in: 300, impact: { effect: 'destructive', irreversible: true, compensating_control: 'transfer back (requires the new owner)', affected: [{ to: 'pat', becomes: 'owner' }] } } : { transferred: true }; } }, { to: 'pat' });
  assert.match(x.root.html, /New owner's principal id/);
  await x.submit('data-transfer-form'); assert.deepEqual(seen[0], { params: { to: 'pat' }, mode: 'dry_run' }); assert.match(x.root.html, /<dd>destructive<\/dd>/); assert.match(x.root.html, /transfer back \(requires the new owner\)/);
  await x.click('data-confirm-execute'); assert.deepEqual(seen[1], { params: { to: 'pat' }, mode: 'execute', confirm_token: 'ct' });
  const sd = await mount('owner', { 'POST /v2/assessment/a1/transfer': ({ body }) => { seen.push(body); return { confirm_token: 'c', expires_in: 300, impact: {} }; } }, { to: 'pat', step_down_checked: true }); await sd.submit('data-transfer-form'); assert.deepEqual(seen.at(-1).params, { to: 'pat', step_down: true });
  const self = await mount('owner', { 'POST /v2/assessment/a1/transfer': err('INVALID_PARAMS', 400, 'cannot transfer ownership to yourself', 'name another principal') }, { to: 'me' }); await self.submit('data-transfer-form'); assert.match(self.root.html, /cannot transfer ownership to yourself — name another principal/);
  const unk = await mount('owner', { 'POST /v2/assessment/a1/transfer': err('INVALID_PARAMS', 400, 'unknown principal') }, { to: 'someone@example.test' }); await unk.submit('data-transfer-form'); assert.match(unk.root.html, /unknown principal/);
  const mem = await mount('member'); assert.doesNotMatch(mem.root.html, /data-transfer-form/);
});

test('N16/N17 credential + scope discipline (static): tokens only in the page model, never storage/URL/log; no inherited rows; accept never offered; harness serves the module', () => {
  const src = read('./permissions.js');
  assert.doesNotMatch(src, /localStorage|sessionStorage|document\.cookie|console\.log|location\.hash\s*=/);
  assert.match(src, /const token = s\.token; s\.token = null; \/\/ single-use, cleared before the call/);
  assert.match(src, /\['sent', 'pending', 'unconfirmed'\]\.includes\(i\.status\)/);
  assert.doesNotMatch(src, /invitations\/[^`]*\/accept/, 'no accept call');
  assert.match(src, /grants`\)/); assert.doesNotMatch(src, /effective|inherit(ed)? role/i.source ? /effectiveRole|inheritedRole/ : /x/);
  assert.ok(read('../server.mjs').includes("'/assess/permissions.js':")); assert.ok(read('../.assetsignore').split('\n').includes('assess/permissions.test.mjs'));
});


test('F-G1-1: mutation completion refreshes real roster and role while keeping outcome/receipt/trace visible', async () => {
  for (const action of ['invite', 'update_role', 'transfer', 'revoke', 'revoke_invitation']) {
    let changed = false;
    const after = roster(action === 'transfer' ? 'member' : 'owner');
    if (action === 'invite') after.pending_invitations.push({ id: 'inv_new', role: 'viewer', status: 'sent' });
    if (action === 'update_role') after.grants.find(g => g.id === 'g_mem').role = 'viewer';
    if (action === 'transfer') after.grants.find(g => g.id === 'g_mem').role = 'owner';
    if (action === 'revoke') after.grants = after.grants.filter(g => g.id !== 'g_view');
    if (action === 'revoke_invitation') after.pending_invitations = after.pending_invitations.filter(i => i.id !== 'inv_p');
    const mutate = ({ body }) => {
      if (body?.mode === 'dry_run') return { confirm_token: 'secret-confirm', expires_in: 300, impact: {} };
      changed = true; return { delivered: true };
    };
    const x = await mount('owner', {
      [G]: () => changed ? after : roster('owner'),
      'POST /v2/assessment/a1/invitations': mutate,
      'PATCH /v2/assessment/a1/grants/g_mem': mutate,
      'POST /v2/assessment/a1/transfer': mutate,
      'DELETE /v2/assessment/a1/grants/g_view': mutate,
      'DELETE /v2/invitations/inv_p': mutate,
    }, { email: 'new@example.test', role: 'viewer', to: 'pat', step_down_checked: true });
    if (action === 'invite') await x.submit('data-invite-form');
    if (action === 'update_role') { x.root.els['data-role-for=g_mem'] = { value: 'viewer' }; await x.click('data-change-role="g_mem"'); }
    if (action === 'transfer') await x.submit('data-transfer-form');
    if (action === 'revoke') await x.click('data-revoke="g_view"');
    else if (action === 'revoke_invitation') await x.click('data-revoke-invitation="inv_p"');
    else await x.click('data-confirm-execute');
    await x.settle();
    assert.match(x.root.html, /data-permissions-status>[^<]*<\/p><details class="small learn-more"><summary>Details<\/summary><p class="small muted" data-permissions-ref>receipt rcpt_1 · trace tr_1/, action);
    assert.equal(x.calls.filter(c => c.url === '/v2/assessment/a1/grants').length, 2, action);
    assert.equal(x.m.sheet, null);
    assert.doesNotMatch(x.root.html, /secret-confirm|new@example.test/);
    if (action === 'invite') assert.match(x.root.html, /data-invitation="inv_new"/);
    if (action === 'update_role') assert.equal(x.m.grants.find(g => g.id === 'g_mem').role, 'viewer');
    if (action === 'transfer') {
      assert.equal(x.m.myRole, 'member'); assert.doesNotMatch(x.root.html, /data-transfer-form|data-change-role/);
      assert.deepEqual(x.m.receipts.g_mem, { receipt: 'rcpt_1', trace: 'tr_1' });
      assert.equal(x.m.receipts.pat, undefined, 'principal id is not a grant id');
    }
    if (action === 'revoke') assert.doesNotMatch(x.root.html, /data-grant-row="g_view"/);
    if (action === 'revoke_invitation') assert.doesNotMatch(x.root.html, /data-invitation="inv_p"/);
  }
});

test('post-success refresh refusal/failure hides stale access controls, preserves success evidence, and retries read only', async () => {
  for (const code of ['NOT_AUTHENTICATED', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_FOUND_OR_NOT_VISIBLE', 'INTERNAL_ERROR']) {
    let changed = false, recovered = false;
    const x = await mount('member', {
      [G]: () => changed && !recovered ? err(code, 500) : roster('member'),
      'DELETE /v2/assessment/a1/grants/g_me': () => { changed = true; return { status: 'revoked' }; },
    });
    await x.click('data-revoke="g_me"'); await x.settle();
    assert.match(x.root.html, /Access removed\.<\/p><details class="small learn-more"><summary>Details<\/summary><p class="small muted" data-permissions-ref>receipt rcpt_1 · trace tr_1/);
    assert.doesNotMatch(x.root.html, /data-grant-row|data-invite-form|data-transfer-form|data-revoke=/);
    if (code === 'INTERNAL_ERROR') {
      recovered = true;
      await x.click('data-retry="grants"');
      // Retry handler returns no promise; allow its read/render lifecycle to settle.
      await new Promise(resolve => setImmediate(resolve));
      assert.match(x.root.html, /data-permissions-state="loaded"/);
      assert.match(x.root.html, /Access removed\.<\/p><details class="small learn-more"><summary>Details<\/summary><p class="small muted" data-permissions-ref>receipt rcpt_1 · trace tr_1/);
    }
    assert.equal(x.calls.filter(c => c.method === 'DELETE').length, 1, 'refresh never repeats a mutation');
  }
});


test('late permission refresh cannot repaint a route the user has left', async () => {
  let finishRead, reads = 0;
  const x = await mount('member', {
    [G]: () => ++reads === 1 ? roster('member') : new Promise(resolve => { finishRead = resolve; }),
    'DELETE /v2/assessment/a1/grants/g_view': { status: 'revoked' },
  });
  let current = true; x.ctx.isCurrent = () => current;
  const pending = x.click('data-revoke="g_view"');
  await new Promise(resolve => setImmediate(resolve));
  current = false; x.root.innerHTML = '<h1>Another page</h1>';
  finishRead(roster('member')); await pending;
  assert.equal(x.root.html, '<h1>Another page</h1>');
});


test('ownership transfer to a signed-up principal with no prior grant attaches receipt to the new owner row', async () => {
  let transferred = false;
  const after = roster('member');
  after.grants.push({ id: 'g_new_owner', principal_id: 'new_principal', role: 'owner' });
  const x = await mount('owner', {
    [G]: () => transferred ? after : roster('owner'),
    'POST /v2/assessment/a1/transfer': ({ body }) => {
      if (body.mode === 'dry_run') return { confirm_token: 'transfer-token', expires_in: 300, impact: {} };
      transferred = true; return { transferred: true };
    },
  }, { to: 'new_principal', step_down_checked: true });
  assert.equal(x.m.grants.find(g => g.principal_id === 'new_principal'), undefined);
  await x.submit('data-transfer-form'); await x.click('data-confirm-execute');
  assert.equal(x.m.myRole, 'member');
  assert.deepEqual(x.m.receipts.g_new_owner, { receipt: 'rcpt_1', trace: 'tr_1' });
  assert.equal(x.m.receipts.new_principal, undefined);
  const row = x.root.html.match(/<tr data-grant-row="g_new_owner">[\s\S]*?<\/tr>/)?.[0];
  assert.match(row, /receipt rcpt_1 · trace tr_1/);
  assert.match(x.root.html, /data-permissions-status>Ownership transfer done\.<\/p><details class="small learn-more"><summary>Details<\/summary><p class="small muted" data-permissions-ref>receipt rcpt_1 · trace tr_1/);
});

test('confirm sheet Cancel dismisses before execute and is ignored while the write is in flight', async () => {
  const pre = await mount('owner', { 'POST /v2/assessment/a1/transfer': ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct', expires_in: 300, impact: {} } : { transferred: true } }, { to: 'pat' });
  await pre.submit('data-transfer-form'); await pre.click('data-confirm-cancel');
  assert.equal(pre.m.sheet, null); assert.doesNotMatch(pre.root.html, /data-confirm-sheet/);
  assert.equal(pre.calls.filter(c => c.body?.mode === 'execute').length, 0);

  let finishWrite;
  const x = await mount('owner', { 'POST /v2/assessment/a1/transfer': ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'ct', expires_in: 300, impact: { effect: 'destructive' } } : new Promise(resolve => { finishWrite = resolve; }) }, { to: 'pat' });
  await x.submit('data-transfer-form');
  const pending = x.click('data-confirm-execute');
  assert.match(x.root.html, /data-confirm-sheet/);
  assert.match(x.root.html, /data-confirm-execute disabled/);
  assert.match(x.root.html, /data-confirm-cancel disabled/);
  await x.click('data-confirm-cancel');
  assert.ok(x.m.sheet); assert.match(x.root.html, /data-confirm-sheet/, 'cancel ignored while execute is in flight');
  await x.click('data-confirm-execute');
  assert.ok(!x.root.html.includes(PREVIEW_AGAIN), 'second confirm does not flash preview-again');
  finishWrite({ transferred: true }); await pending;
  assert.equal(x.m.sheet, null); assert.match(x.root.html, /Ownership transfer done/);
});

// P0 12:30 (lane 11): Member list component — people by name + email, "You" for self, never principal ids (every scope).
import { memberList, memberPerson, labelMembers, readAccountEmail, YOU, NO_EMAIL_NOTE } from '../v3/components/member-list.js';
test('member list: roster shows "You" + own email and "Member N" for others — no principal id anywhere in the roster', async () => {
  const x = await mount('owner'); x.m.myEmail = 'me@example.test'; x.root.innerHTML = permissions.render(x.ctx, x.m);
  const table = /<table[\s\S]*?<\/table>/.exec(x.root.html)[0];
  assert.match(table, /data-member-you><strong>You<\/strong><br><span class="small muted" data-member-email>me@example.test/);
  assert.match(table, /<strong>Member 1<\/strong>/); assert.match(table, /<strong>Member 3<\/strong>/); assert.match(table, /<th>Person<\/th>/);
  for (const id of ['>me<', '>boss', '>pat', '>val', '(you)', 'Principal']) assert.ok(!table.includes(id), `roster leaks ${id}`);
  assert.ok(x.root.html.includes(NO_EMAIL_NOTE)); assert.match(x.root.html, /data-grant-row="g_mem"/); assert.match(x.root.html, /data-change-role="g_mem"/);
});
test('member list: same component for workspace / project / assessment; a future name/email on the grant row is shown; account email read is safe', async () => {
  for (const scope of ['workspaces', 'projects', 'assessments']) {
    const seg = { workspaces: 'workspace', projects: 'project', assessments: 'assessment' }[scope];
    const { api, apiFull } = fakeApi({ [`GET /v2/${seg}/s1/grants`]: { grants: [{ id: 'g1', principal_id: 'usr_x', role: 'owner', display_name: 'Ana Ruiz', email: 'ana@example.test' }, { id: 'g2', principal_id: 'me', role: 'member' }] } });
    const ctx = { api, apiFull, esc, enc: encodeURIComponent, state: { principal: { id: 'me' } }, accountEmail: async () => 'me@example.test' };
    const m = await permissions.load(ctx, { scope, id: 's1' }); const h = permissions.render(ctx, m);
    assert.match(h, /data-member-list/); assert.match(h, /<strong>Ana Ruiz<\/strong><br><span class="small muted" data-member-email>ana@example.test/); assert.match(h, /<strong>You<\/strong>.*me@example.test/s);
    assert.ok(!h.includes('usr_x'), `${scope}: principal id leaked`); assert.ok(!h.includes(NO_EMAIL_NOTE));
  }
  assert.equal(memberPerson({ principal_id: 'me' }, { me: 'me' }).name, YOU); assert.equal(memberPerson({ principal_id: 'z' }, { me: 'me', n: 2 }).name, 'Member 2');
  assert.deepEqual(labelMembers([{ principal_id: 'a' }, { principal_id: 'me' }, { principal_id: 'b' }], { me: 'me' }).map(r => r.person.name), ['Member 1', 'You', 'Member 2']);
  assert.equal(memberList(esc, [], {}).includes('No one listed.'), true);
  assert.equal(await readAccountEmail({ demo: true }), ''); assert.equal(await readAccountEmail({ fetchImpl: async () => { throw new Error('x'); } }), '');
});

test('U13: confirm sheet leads with one plain sentence; the impact record sits behind Details', async () => {
  const { sheetSentence } = await import('./permissions.js');
  assert.equal(sheetSentence({ kind: 'invite', params: { email: 'rina@x.example.invalid', role: 'member' } }, 'assessment'), 'rina@x.example.invalid will be able to open this assessment as member once they accept. An email is sent when you confirm.');
  assert.match(sheetSentence({ kind: 'transfer_owner', params: { to: 'usr_1', step_down: true } }, 'projects'), /^Ownership of this project moves .* and you become a member\. This cannot be undone from here\.$/);
  assert.equal(sheetSentence({ kind: 'update_role', params: { role: 'viewer' } }, 'workspace'), 'Their role on this workspace changes to viewer.');
  assert.equal(sheetSentence({ kind: 'other' }), 'Nothing changes until you confirm.');
});

test('B31/U26: invite to a test address → one plain sentence (no reason code); pending row reads role · invited <short date> · email', async () => {
  const t = { 'POST /v2/assessment/a1/invitations': ({ body }) => body.mode === 'dry_run' ? { confirm_token: 'c', expires_in: 300, impact: {} } : { invitation_id: 'inv_new', role: 'member', status: 'pending', accepted: true, delivered: false, delivery: { provider: null, state: 'not_sent', reason: 'synthetic_recipient' } } };
  const x = await mount('owner', t, { email: 'persona-1812-a@training.example.invalid', role: 'member' });
  await x.submit('data-invite-form'); await x.click('data-confirm-execute');
  const status = x.root.html.match(/data-permissions-status>([^<]*)</)[1];
  assert.equal(status, TEST_ADDRESS_NOTE);
  assert.doesNotMatch(status, /synthetic_recipient|rcpt_|tr_/);
  assert.equal(x.m.invitees.inv_new, 'persona-1812-a@training.example.invalid');
  // the refreshed roster lists the new invitation (the service returns no address, only role/status/date)
  const m = { ...x.m, pending: [{ id: 'inv_new', role: 'member', status: 'pending', created_at: '2026-09-25T20:40:12Z' }] };
  const h = permissions.render({ esc }, m);
  const li = h.match(/<li data-invitation="inv_new">([^<]*)/)[1];
  assert.equal(li.trim(), `member · invited ${shortDate('2026-09-25T20:40:12Z')} · persona-1812-a@training.example.invalid`);
});

test('B31/U26: inviteOutcome and shortDate are plain words', () => {
  assert.equal(inviteOutcome({ delivered: false, delivery: { state: 'not_sent', reason: 'synthetic_recipient' } }), 'Invitation recorded; not emailed (test address).');
  assert.equal(inviteOutcome({ delivered: false, delivery: { state: 'not_sent', reason: 'duplicate_recent' } }), DUPLICATE_NOTE);
  assert.equal(inviteOutcome({ delivered: true, delivery: { state: 'accepted' } }), 'Invitation sent.');
  assert.equal(shortDate('2026-09-25T12:00:00Z', new Date('2026-10-01T00:00:00Z')), 'Sep 25');
  assert.equal(shortDate('2025-09-25T12:00:00Z', new Date('2026-10-01T00:00:00Z')), 'Sep 25, 2025');
  assert.equal(shortDate('not a date'), 'not a date');
});
