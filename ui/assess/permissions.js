// G1 — Permissions page for ONE scope (workspace | project | assessment), per Auth contract
// claude/2026-09-18-3d-g1-permissions-contract.md. Existing APIs only; the UI mirrors the server's gating and never widens it.
//   roster              GET    /v2/{scope}/{id}/grants                    member+ (viewer → 403; no role → 404)
//   invite              POST   /v2/{scope}/{id}/invitations               danger: dry_run → execute (byte-identical params)
//   revoke invitation   DELETE /v2/invitations/{id}                        single call (no mode)
//   change role         PATCH  /v2/{scope}/{id}/grants/{gid}              danger: dry_run → execute; owner only; never on owner rows
//   revoke grant        DELETE /v2/{scope}/{id}/grants/{gid}              single call; never on owner rows; member ≤ member only
//   transfer ownership  POST   /v2/{scope}/{id}/transfer                  danger (destructive): owner only; principal ID; step_down off
// Confirm tokens and the typed invitee address live only in this page's in-memory model: rebuilt on every load (scope change),
// dropped on sign-out with the shell state, cleared after execute. Nothing here touches storage, URLs or logs.
// Acceptance (cap.grant.accept) is NOT here: it stays on the legacy surface at /legacy/, reached through the root's #invite= forwarder.

import { memberList, labelMembers, readAccountEmail } from '../v3/components/member-list.js';

export const SCOPE_SEG = { workspaces: 'workspace', projects: 'project', assessments: 'assessment' };
export const SCOPE_NOUN = { workspaces: 'workspace', projects: 'project', assessments: 'assessment' };
export const RANK = { viewer: 1, member: 2, owner: 3 };
export const ROLES = ['viewer', 'member', 'owner'];
export const NOT_AVAILABLE = 'Not available';
export const VIEWER_NOTE = 'Permissions are managed by members and owners.';
export const DUPLICATE_NOTE = 'Already invited — nothing sent again.';
export const UNCONFIRMED_NOTE = 'Could not be confirmed as sent; the invitation stays live and can be revoked.';
export const PREVIEW_AGAIN = 'Preview again.';

const classify = e => { const c = String(e?.code || e?.status || ''); if (c === 'NOT_AUTHENTICATED' || c === '401') return 'unauthenticated'; if (c === 'NOT_AUTHORIZED_AT_SCOPE' || c === '403') return 'forbidden'; if (c === 'NOT_FOUND_OR_NOT_VISIBLE' || c === '404') return 'not_found'; if (c === 'RESERVED_NOT_BUILT' || c === '501') return 'not_built'; return 'failed'; };
export { classify };

export function blankModel(scope, id) { return { scope, id, status: 'loading', grants: [], pending: [], me: null, myEmail: '', myRole: null, sheet: null, notice: null, alert: false, busy: false, receipts: {} }; }

export const permissions = {
  async load(ctx, { scope, id }) {
    const m = blankModel(scope, id); m.me = ctx.state?.principal?.id || null;
    if (!SCOPE_SEG[scope]) { m.status = 'not_found'; return m; }
    try {
      const r = await ctx.api(`/v2/${SCOPE_SEG[scope]}/${ctx.enc(id)}/grants`);
      m.status = 'loaded'; m.grants = r.grants || []; m.pending = (r.pending_invitations || []).filter(i => ['sent', 'pending', 'unconfirmed'].includes(i.status));
      m.myRole = m.grants.find(g => g.principal_id === m.me)?.role || null;
      // P0 12:30: people, not ids — the signed-in account's own email (the only one the service exposes today).
      m.myEmail = ctx.accountEmail ? await ctx.accountEmail().catch(() => '') || '' : await readAccountEmail({ demo: !!ctx.demo });
    } catch (e) { m.status = classify(e); m.error = e; }
    return m;
  },
  render(ctx, m) {
    const esc = ctx.esc, noun = SCOPE_NOUN[m.scope] || m.scope;
    const status = `<p class="small ${m.alert ? 'alert' : 'muted'}" role="status" data-permissions-status>${esc(m.notice || '')}</p>`;
    const head = `<p class="eyebrow">Permissions</p><h2>Who can open this ${esc(noun)}</h2><p class="note small">Permissions apply to this ${esc(noun)} only; nothing is inherited.</p>`;
    if (m.status === 'forbidden') return `<section class="panel narrow" data-permissions data-permissions-state="viewer">${head}<p class="muted">${esc(VIEWER_NOTE)}</p>${status}</section>`;
    if (m.status === 'not_found') return `<section class="panel narrow" data-permissions data-permissions-state="not-found"><p class="eyebrow">Permissions</p><h2>${esc(NOT_AVAILABLE)}</h2><p class="muted">Nothing to show here.</p>${status}</section>`;
    if (m.status === 'unauthenticated') return `<section class="panel narrow" data-permissions data-permissions-state="unauthenticated">${head}<p class="small muted" role="alert">Your sign-in is no longer active. <a href="/v2/auth/access">Sign in again</a></p>${status}</section>`;
    if (m.status !== 'loaded') return `<section class="panel narrow" data-permissions data-permissions-state="failed">${head}<p class="small muted" role="alert">Could not load permissions. <a href="#" data-retry="grants">Retry</a></p>${status}</section>`;
    const owner = m.myRole === 'owner', member = m.myRole === 'member' || owner, busy = m.busy ? 'disabled' : '';
    const canTouch = g => g.role !== 'owner' && (owner || RANK[g.role] <= RANK.member); // D3 ceiling; owners never removed/demoted
    // Member list component (ui/v3/components/member-list.js): name + email, "You" for self, never the principal id.
    const actions = g => { const rc = m.receipts[g.id]; return `${g.role === 'owner' ? '<span class="muted">Owner — only a transfer changes this</span>' : member && canTouch(g) ? `${owner ? `<select data-role-for="${esc(g.id)}" aria-label="New role" ${busy}>${ROLES.map(r => `<option value="${r}" ${r === g.role ? 'selected' : ''}>${r}</option>`).join('')}</select> <button type="button" data-change-role="${esc(g.id)}" ${busy}>Preview role change</button> ` : ''}<button type="button" class="quiet" data-revoke="${esc(g.id)}" ${busy}>Remove</button>` : `<span class="muted">Members manage viewers and members only</span>`}${rc ? `<div class="small muted">receipt ${esc(rc.receipt)} · trace ${esc(rc.trace)}</div>` : ''}`; };
    const roster = memberList(esc, m.grants, { me: m.me, myEmail: m.myEmail, actions, rowAttr: g => `data-grant-row="${esc(g.id)}"`, empty: 'No grants listed.' });
    const pending = m.pending.length ? `<h3 style="margin-top:18px">Pending invitations</h3><ul class="small" data-pending>${m.pending.map(i => `<li data-invitation="${esc(i.id)}">${esc(i.role)} · ${esc(i.status)}${i.status === 'unconfirmed' ? ` · ${esc(UNCONFIRMED_NOTE)}` : ''} · invited ${esc(i.created_at || '')}${member && (owner || RANK[i.role] <= RANK.member) ? ` <button type="button" class="quiet small" data-revoke-invitation="${esc(i.id)}" ${busy}>Revoke invitation</button>` : ''}</li>`).join('')}</ul>` : '<p class="small muted" style="margin-top:14px">No pending invitations.</p>';
    const roleOptions = (owner ? ROLES : ROLES.filter(r => r !== 'owner')).map(r => `<option value="${r}">${r}</option>`).join('');
    const invite = member ? `<form class="line" data-invite-form><h3>Invite someone</h3><label class="field">Email<input name="email" type="email" required autocomplete="off" ${busy}></label><label class="field">Role<select name="role" ${busy}>${roleOptions}</select></label>${owner ? '' : '<p class="small muted">Members invite up to member.</p>'}<div class="actions"><button type="submit" ${busy}>Preview invitation</button></div><p class="small muted">An invitation sends an email. Nothing is sent until you confirm.</p></form>` : '';
    const transfer = owner ? `<form class="line" data-transfer-form><h3>Transfer ownership</h3><p class="small muted">Ownership moves to another signed-up principal. Destructive: it cannot be undone from here.</p><label class="field">New owner's principal id<input name="to" required autocomplete="off" placeholder="usr_… or person_…" ${busy}></label><label class="small"><input type="checkbox" name="step_down"> Step down to member after the transfer</label><div class="actions"><button type="submit" ${busy}>Preview transfer</button></div></form>` : '';
    const sheet = m.sheet ? renderSheet(ctx, m.sheet, m.busy) : '';
    return `<section class="panel" data-permissions data-permissions-state="loaded" data-my-role="${esc(m.myRole || '')}">${head}${roster}${pending}${invite}${transfer}${sheet}${status}<p class="small muted line">Accepting an invitation happens on the legacy surface (a mailed <code>#invite=</code> link opens there); it is never done from this page.</p></section>`;
  },
  bind(ctx, root, m) {
    const base = `/v2/${SCOPE_SEG[m.scope]}/${ctx.enc(m.id)}`;
    const call = ctx.apiFull || (async (url, o) => ({ result: await ctx.api(url, o) }));
    const paint = () => { if (ctx.isCurrent && !ctx.isCurrent()) return; root.innerHTML = permissions.render(ctx, m); permissions.bind(ctx, root, m); };
    const say = (notice, alert = false) => { m.notice = notice; m.alert = alert; paint(); };
    // Refresh server-owned roster/role state without replacing the action outcome.
    // A full route reload constructs a blank model and loses the receipt before it can be read.
    const refresh = async () => {
      const fresh = await permissions.load(ctx, { scope: m.scope, id: m.id });
      Object.assign(m, { status: fresh.status, grants: fresh.grants, pending: fresh.pending,
        me: fresh.me, myEmail: fresh.myEmail, myRole: fresh.myRole, error: fresh.error, busy: false });
      paint();
    };
    const receiptText = env => `${env.receipt?.id ? ` receipt ${env.receipt.id}` : ''}${env.trace_id ? ` · trace ${env.trace_id}` : ''}`;
    const fail = (e, what) => { const k = classify(e); say(k === 'not_found' ? `${what}: ${NOT_AVAILABLE.toLowerCase()}.` : k === 'unauthenticated' ? 'Your sign-in is no longer active.' : `${what}: ${e.message || 'request failed'}${e.hint ? ` — ${e.hint}` : ''}`, true); };
    root.querySelector('[data-retry="grants"]')?.addEventListener('click', e => { e.preventDefault(); return refresh(); });
    // Danger twin: dry_run → sheet (impact verbatim) → execute with byte-identical params. CONFIRM_REQUIRED → silent re-dry_run once;
    // CONFIRM_EXPIRED → "Preview again". Never auto-retry execute.
    const preview = async (kind, url, params, label, extra = {}) => { m.busy = true; paint();
      try { const env = await call(url, { method: extra.method || 'POST', body: { params, mode: 'dry_run' } }); const r = env.result;
        m.sheet = { kind, url, method: extra.method || 'POST', params: Object.freeze(JSON.parse(JSON.stringify(params))), token: r.confirm_token, expiresIn: r.expires_in, impact: r.impact || {}, label, ...extra.display }; m.notice = null; m.alert = false;
      } catch (e) { m.sheet = null; fail(e, label); } finally { m.busy = false; paint(); } };
    const execute = async () => { const s = m.sheet; if (!s || m.busy) return; if (!s.token) { say(PREVIEW_AGAIN, true); return; }
      const token = s.token; s.token = null; // single-use, cleared before the call
      m.busy = true; paint();
      try { const env = await call(s.url, { method: s.method, body: { params: s.params, mode: 'execute', confirm_token: token } }); const r = env.result || {};
        m.sheet = null;
        if (s.kind === 'invite') { if (r.delivered === false && /duplicate/.test(r.delivery?.reason || '')) say(`${DUPLICATE_NOTE}${receiptText(env)}`); else if (r.delivered === false && r.delivery?.state === 'unconfirmed') say(`Invitation recorded — ${UNCONFIRMED_NOTE}${receiptText(env)}`); else if (r.delivered === false) say(`Invitation recorded; not sent (${r.delivery?.reason || 'not sent'}). It can be revoked below.${receiptText(env)}`); else say(`Invitation sent.${receiptText(env)}`); }
        else say(`${s.label} done.${receiptText(env)}`);
        await refresh();
        // Transfer may create the target's first grant; resolve only from the refreshed roster.
        if (s.kind !== 'invite') {
          const gid = s.gid || m.grants.find(g => g.principal_id === s.params.to)?.id;
          if (gid && env.receipt) { m.receipts[gid] = { receipt: env.receipt.id, trace: env.trace_id }; paint(); }
        }
      } catch (e) { m.busy = false;
        const code = String(e.code || '');
        if (code === 'CONFIRM_REQUIRED' && !s.redone) { s.redone = true; try { const env = await call(s.url, { method: s.method, body: { params: s.params, mode: 'dry_run' } }); s.token = env.result.confirm_token; s.expiresIn = env.result.expires_in; s.impact = env.result.impact || s.impact; say('The confirmation no longer matched; the preview was refreshed. Confirm again.', true); } catch (e2) { m.sheet = null; fail(e2, s.label); } return; }
        if (code === 'CONFIRM_EXPIRED' || code === 'CONFIRM_REQUIRED') { s.token = null; say(`The confirmation expired. ${PREVIEW_AGAIN}`, true); return; }
        m.sheet = null; fail(e, s.label);
      } };
    root.querySelector('[data-invite-form]')?.addEventListener('submit', e => { e.preventDefault(); const f = e.currentTarget; const email = f.querySelector('[name=email]').value.trim(), role = f.querySelector('[name=role]').value; return preview('invite', `${base}/invitations`, { email, role }, 'Invitation', { display: { who: email } }); });
    root.querySelectorAll('[data-change-role]').forEach(b => b.addEventListener('click', () => { const gid = b.dataset.changeRole; const role = root.querySelector(`[data-role-for="${CSS.escape(gid)}"]`)?.value; const g = m.grants.find(x => x.id === gid); if (!g || !role || role === g.role) { say('That is already the role.'); return; } const who = labelMembers(m.grants, { me: m.me, myEmail: m.myEmail }).find(x => x.row === g)?.person; return preview('update_role', `${base}/grants/${ctx.enc(gid)}`, { role }, 'Role change', { method: 'PATCH', display: { who: who ? [who.name, who.email].filter(Boolean).join(' · ') : '', gid } }); }));
    root.querySelector('[data-transfer-form]')?.addEventListener('submit', e => { e.preventDefault(); const f = e.currentTarget; const to = f.querySelector('[name=to]').value.trim(); const step_down = !!f.querySelector('[name=step_down]').checked; return preview('transfer_owner', `${base}/transfer`, step_down ? { to, step_down: true } : { to }, 'Ownership transfer', { display: { who: to } }); });
    // single-call writes: mode is never sent (contract §3.5)
    root.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => { m.busy = true; paint(); try { const env = await call(`${base}/grants/${ctx.enc(b.dataset.revoke)}`, { method: 'DELETE' }); say(`Access removed.${receiptText(env)}`); await refresh(); } catch (e) { m.busy = false; fail(e, 'Remove access'); } }));
    root.querySelectorAll('[data-revoke-invitation]').forEach(b => b.addEventListener('click', async () => { m.busy = true; paint(); try { const env = await call(`/v2/invitations/${ctx.enc(b.dataset.revokeInvitation)}`, { method: 'DELETE' }); say(`Invitation revoked.${receiptText(env)}`); await refresh(); } catch (e) { m.busy = false; fail(e, 'Revoke invitation'); } }));
    root.querySelector('[data-confirm-execute]')?.addEventListener('click', execute);
    root.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => { if (m.busy) return; m.sheet = null; say(null); });
  },
};
export default permissions;

function renderSheet(ctx, s, busy) {
  const esc = ctx.esc, i = s.impact || {};
  const affected = Array.isArray(i.affected) ? i.affected : [];
  return `<section class="note" data-confirm-sheet data-confirm-kind="${esc(s.kind)}"><p class="eyebrow">Confirm: ${esc(s.label)}${s.who ? ` · ${esc(s.who)}` : ''}</p><p class="small">Nothing has changed yet. Confirmation expires in ${esc(s.expiresIn ?? '')} seconds.</p><dl class="small" data-impact><dt>Effect</dt><dd>${esc(i.effect ?? '')}</dd><dt>Irreversible</dt><dd>${esc(String(i.irreversible ?? ''))}</dd><dt>Compensating control</dt><dd>${esc(i.compensating_control ?? '')}</dd><dt>Affected</dt><dd>${affected.length ? `<ul>${affected.map(a => `<li><code>${esc(JSON.stringify(a))}</code></li>`).join('')}</ul>` : '<span class="muted">none listed</span>'}</dd></dl><div class="actions"><button type="button" class="primary" data-confirm-execute ${s.token && !busy ? '' : 'disabled'}>Confirm ${esc(s.label.toLowerCase())}</button><button type="button" class="quiet" data-confirm-cancel ${busy ? 'disabled' : ''}>Cancel</button></div></section>`;
}
