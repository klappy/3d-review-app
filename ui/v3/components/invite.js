// component: Invitation (Bincy B03, F01/F02 "invitation routing"). A mailed `#invite=<token>` opens INSIDE the v3 app: what was
// shared (kind + role, from the server's own dry run — nothing is disclosed before acceptance) and ONE Accept action. Signed out →
// sign in, then this page again. The token lives only in memory and this tab's sessionStorage (so the sign-in round trip can come
// back); it is never in the address bar after arrival and is cleared on accept, refusal or a used/expired invitation.
export const INVITE_KEY = 'pendingInvite';
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KIND = { workspace: 'a workspace', project: 'a project', assessment: 'an assessment' };
const ROLE = { viewer: 'a viewer', member: 'a member', owner: 'an owner' };
const panel = (h1, line, actions = '') => `<section class="glass panel narrow" data-invite style="max-width:520px;margin:32px auto 0"><p class="eyebrow">Invitation</p><h1 style="font-size:27px">${h1}</h1><p class="muted" data-invite-line>${line}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</section>`;
const home = '<a class="rv-btn" href="#projects">Go to your projects</a>';
// Pure: one state → one screen. States: loading · ready {kind, role} · accepting · signin · used · expired · refused · failed · missing.
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
// Controller: dry run (what was shared) → Accept (execute with the dry run's confirm token) → onAccepted(scope). `forget()` clears the
// stored token. `isCurrent()` guards every paint so a later route never receives this page's result.
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
