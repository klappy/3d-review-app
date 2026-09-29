// component: Invitation (Bincy B03, F01/F02 "invitation routing"). A mailed `#invite=<token>` opens INSIDE the v3 app: what was
// shared (kind + role, from the server's own dry run — nothing is disclosed before acceptance) and ONE Accept action. Signed out →
// sign in, then this page again. The token lives only in memory and this tab's sessionStorage (so the sign-in round trip can come
// back); it is never in the address bar after arrival and is cleared on accept, refusal or a used/expired invitation.
export const INVITE_KEY = 'pendingInvite';
// Same rule as the legacy parser (ui/public-entry.js, tested in test/invitation-entry.test.mjs); a copy because that module mounts
// the legacy page on import.
export function parseInvitationFragment(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#invite=') || hash.length > 4104) return null;
  try { const token = decodeURIComponent(hash.slice(8)); return /^[A-Za-z0-9_-]{1,4096}$/.test(token) ? token : null; } catch { return null; }
}
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KIND = { workspace: 'a workspace', project: 'a project', assessment: 'an assessment' };
const ROLE = { viewer: 'a viewer', member: 'a member', owner: 'an owner' };
const panel = (h1, line, actions = '') => `<section class="glass panel narrow" data-invite style="max-width:520px;margin:32px auto 0"><h1 style="font-size:27px">${h1}</h1><p class="muted" data-invite-line>${line}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</section>`;
const home = '<a class="rv-btn" href="#projects">Go to your projects</a>';
// B04 step c (captain ruling 2026-09-28 15:27 ET k0015; captain 16:03 ET "ships tonight"): the signed-in person's own pending
// invitations (GET /v2/me/invitations, matched server-side by hashed email — no token ever reaches the client). Pure: keeps only
// well-formed rows, oldest first as the server sent them. Anything else → [] (the existing landing stands).
// S19: each row's scope may carry its name and path of names (server: own live invitations only); both are normalised here —
// name a string or null, path only strings — and are member-authored text, escaped wherever they are painted.
export function pendingInvitations(result) {
  const rows = Array.isArray(result?.invitations) ? result.invitations : [];
  return rows.filter(i => i && typeof i.id === 'string' && i.id && i.scope && typeof i.scope.type === 'string' && typeof i.role === 'string')
    .map(i => ({ ...i, scope: { ...i.scope, name: typeof i.scope.name === 'string' && i.scope.name ? i.scope.name : null, path: Array.isArray(i.scope.path) ? i.scope.path.filter(n => typeof n === 'string' && n) : [] } }));
}
// Pure: one state → one screen for the mailed link (`#invite=<token>`). States: loading · ready {kind, role} · accepting · signin ·
// used · expired · refused · failed · missing. The link path names no scope before acceptance (unchanged by S19).
export function inviteView(m = {}) {
  switch (m.status) {
    case 'ready': case 'accepting': return panel('You were invited', `You were invited to ${KIND[m.kind] || 'shared work'} as ${ROLE[m.role] || 'a collaborator'}.`, `<button type="button" class="rv-btn primary" data-invite-accept ${m.status === 'accepting' ? 'disabled' : ''}>${m.status === 'accepting' ? 'Accepting…' : 'Accept invitation'}</button>`);
    case 'signin': return panel('Sign in to accept', 'Sign in with the email address that was invited; you come back here after signing in.', '<a class="rv-btn primary" href="/v2/auth/access" data-invite-signin>Sign in with an email code</a>');
    case 'used': return panel('Already accepted', 'This invitation was already accepted.', home);
    case 'expired': return panel('Invitation expired', 'This invitation has expired. Ask the person who invited you for a new one.', home);
    case 'refused': return panel('Invitation not available', 'This invitation is not for the account you are signed in with, or it was withdrawn. Sign in with the invited email address, or ask for a new invitation.', home);
    case 'failed': return panel('Could not open the invitation', ESC(m.message || 'Something went wrong. Try again.'), '<button type="button" class="rv-btn primary" data-invite-retry>Try again</button>');
    case 'missing': return panel('No invitation open', 'Open the invitation link from your email again.', home);
    default: return panel('Opening your invitation…', 'Checking the invitation.');
  }
}
// Server error → screen state. Messages are the server's stable codes (src/handlers/grant.ts accept), never shown raw.
export function inviteFailure(e) {
  const code = String(e?.code || ''), msg = String(e?.message || '');
  if (code === 'NOT_AUTHENTICATED' || code === '401') return 'signin';
  if (msg.includes('invitation_used')) return 'used';
  if (msg.includes('invitation_expired')) return 'expired';
  if (['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED', '403', '404'].includes(code)) return 'refused';
  return 'failed';
}
// Controller (mailed link): dry run (what was shared) → Accept (execute with the dry run's confirm token) → onAccepted(scope).
// `forget()` clears the stored token. `isCurrent()` guards every paint so a later route never receives this page's result.
// The signed-in invitee's own invitations use mountInvitations below (S19), not this one-at-a-time screen.
export function mountInvite(root, { api, token, forget = () => {}, onAccepted = () => {}, isCurrent = () => true }) {
  let m = { status: 'loading' }, confirm = null;
  const url = `/v2/invitations/${encodeURIComponent(token)}/accept`;
  const paint = () => { if (!isCurrent()) return; root.innerHTML = inviteView(m); root.querySelector('[data-invite-accept]')?.addEventListener('click', accept); root.querySelector('[data-invite-retry]')?.addEventListener('click', load); };
  const fail = e => { const status = inviteFailure(e); if (status !== 'failed' && status !== 'signin') forget(); m = { status, message: status === 'failed' ? 'Something went wrong. Try again.' : '' }; paint(); };
  async function load() {
    m = { status: 'loading' }; confirm = null; paint();
    try {
      const r = await api(url, { method: 'POST', body: { mode: 'dry_run' } }); if (!isCurrent()) return;
      const eff = r?.impact?.affected?.[0];
      if (typeof r?.confirm_token !== 'string' || !eff?.scope?.type) throw Object.assign(new Error('Unexpected answer'), { code: 'BAD_RESULT' });
      confirm = r.confirm_token; m = { status: 'ready', kind: eff.scope.type, role: eff.role }; paint();
    } catch (e) { if (isCurrent()) fail(e); }
  }
  async function accept() {
    if (!confirm || m.status !== 'ready') return;
    const t = confirm; confirm = null; m = { ...m, status: 'accepting' }; paint();
    try {
      const r = await api(url, { method: 'POST', body: { mode: 'execute', confirm_token: t } });
      if (r?.granted !== true) throw Object.assign(new Error('Unexpected answer'), { code: 'BAD_RESULT' });
      forget(); if (isCurrent()) onAccepted(r.scope);
    } catch (e) { if (isCurrent()) fail(e); }
  }
  load();
  return { reload: load };
}

// S19 (captain 2026-09-29: "it's ridiculous to not see what I'm accepting the invite to! And there's multiple so they just keep
// coming!!!"): every pending invitation of the signed-in person on ONE page, each named with its path.
const THE = { workspace: 'the workspace', project: 'the project', assessment: 'the assessment' };
const KIND_LABEL = { workspace: 'Workspace', project: 'Project', assessment: 'Assessment' };
const ROLE_LABEL = { viewer: 'Viewer', member: 'Member', owner: 'Owner' };
// Pure: one invitation → its escaped parts. `parents` are the path's names above the scope itself (outermost first).
export function invitationParts(inv) {
  const type = inv?.scope?.type, name = typeof inv?.scope?.name === 'string' && inv.scope.name ? inv.scope.name : null;
  const path = Array.isArray(inv?.scope?.path) ? inv.scope.path.filter(n => typeof n === 'string' && n) : [];
  const parents = name && path.length > 1 && path[path.length - 1] === name ? path.slice(0, -1) : [];
  return { kind: KIND_LABEL[type] || 'Shared work', role: ROLE_LABEL[inv?.role] || 'Collaborator', name: name === null ? null : ESC(name), parents: parents.map(ESC) };
}
// Pure: the single-invitation sentence, e.g. You were invited to the project "River Valley" as an owner. A path above the scope
// reads in brackets after the name; with no name (older server, scope gone) the S9 wording stands.
export function invitationLine(inv) {
  const p = invitationParts(inv), role = ROLE[inv?.role] || 'a collaborator';
  if (p.name === null) return `You were invited to ${KIND[inv?.scope?.type] || 'shared work'} as ${role}.`;
  return `You were invited to ${THE[inv.scope.type] || 'shared work'} "${p.name}"${p.parents.length ? ` (${p.parents.join(' › ')})` : ''} as ${role}.`;
}
// Pure: the list page. m = { invitations, busy: null | 'all' | <row index>, notice }. House rules: one heading, one short line,
// one primary. One invitation → its sentence and a primary "Accept". Two or more → one row each (kind, name with its path,
// role, its own Accept) and "Accept all" as the primary. While accepting, every button is disabled. A notice (a failed accept)
// is a separate status line under the short line, so the names stay in view.
export function invitationsView(m = {}) {
  const list = Array.isArray(m.invitations) ? m.invitations : [], busy = m.busy ?? null, off = busy !== null ? ' disabled' : '';
  const notice = m.notice ? `<p class="small" role="status" data-invite-notice>${ESC(m.notice)}</p>` : '';
  const page = (h1, line, body, primary) => `<section class="glass panel narrow" data-invite style="max-width:560px;margin:32px auto 0"><h1 style="font-size:27px">${h1}</h1><p class="muted" data-invite-line>${line}</p>${notice}${body}<div class="actions">${primary}</div></section>`;
  if (list.length === 1) return page('Accept invitation', invitationLine(list[0]), '', `<button type="button" class="rv-btn primary" data-invite-accept-one="0"${off}>${busy !== null ? 'Accepting…' : 'Accept'}</button>`);
  const rows = list.map((inv, i) => {
    const p = invitationParts(inv);
    const name = p.name === null ? '<span class="muted">Name not available</span>' : `${p.parents.length ? `<span class="muted" data-invite-path>${p.parents.join(' › ')} › </span>` : ''}<strong data-invite-name>${p.name}</strong>`;
    return `<li data-invite-row style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(127,127,127,.25)"><div><div class="small muted" data-invite-kind>${p.kind} · ${p.role}</div><div>${name}</div></div><button type="button" class="rv-btn" data-invite-accept-one="${i}"${off}>${busy === i ? 'Accepting…' : 'Accept'}</button></li>`;
  }).join('');
  return page('Accept invitations', `You have ${list.length} invitations waiting.`, `<ul data-invite-list style="list-style:none;margin:12px 0 0;padding:0">${rows}</ul>`,
    `<button type="button" class="rv-btn primary" data-invite-accept-all${off}>${busy === 'all' ? 'Accepting…' : 'Accept all'}</button>`);
}
// One invitation by id: the same cap.grant.accept dry run → execute with its confirm token (POST /v2/me/invitations/{id}/accept;
// the server checks the caller's email against the invitation). Resolves to the granted scope; throws the server's error.
export async function acceptInvitationById(api, id) {
  const url = `/v2/me/invitations/${encodeURIComponent(id)}/accept`;
  const dry = await api(url, { method: 'POST', body: { mode: 'dry_run' } });
  if (typeof dry?.confirm_token !== 'string') throw Object.assign(new Error('Unexpected answer'), { code: 'BAD_RESULT' });
  const r = await api(url, { method: 'POST', body: { mode: 'execute', confirm_token: dry.confirm_token } });
  if (r?.granted !== true) throw Object.assign(new Error('Unexpected answer'), { code: 'BAD_RESULT' });
  return r.scope;
}
// Controller: paints the list; Accept (one row) or Accept all (every row, in order) runs acceptInvitationById per invitation, then
// onSettled({ accepted: [scope…], failed: [state…] }) once — the page re-reads the list (server truth: accepted, withdrawn and
// expired ones drop out) and remounts, or lands when none are left. `isCurrent()` guards every paint and the hand-off.
export function mountInvitations(root, { api, invitations, notice = '', isCurrent = () => true, onSettled = () => {} }) {
  const list = pendingInvitations({ invitations });
  let m = { invitations: list, busy: null, notice };
  const paint = () => {
    if (!isCurrent()) return;
    root.innerHTML = invitationsView(m);
    for (const b of root.querySelectorAll('[data-invite-accept-one]')) b.addEventListener('click', () => run([Number(b.getAttribute('data-invite-accept-one'))]));
    root.querySelector('[data-invite-accept-all]')?.addEventListener('click', () => run(list.map((_, i) => i)));
  };
  async function run(indexes) {
    if (m.busy !== null || !indexes.every(i => list[i])) return;
    m = { ...m, busy: indexes.length > 1 ? 'all' : indexes[0] }; paint();
    const out = { accepted: [], failed: [] };
    for (const i of indexes) {
      try { out.accepted.push(await acceptInvitationById(api, list[i].id)); } catch (e) { out.failed.push(inviteFailure(e)); }
      if (!isCurrent()) return;
    }
    onSettled(out);
  }
  paint();
  return { accept: run };
}
