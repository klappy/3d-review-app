import { api, enc } from './api.js';
import { INVITE_KEY, parseInvitationFragment } from '../../../ui/v3/components/invite.js';

export function capturePrivateInvitation(env = globalThis) {
  if (!String(env.location?.hash ?? '').startsWith('#invite=')) return false;
  const value = parseInvitationFragment(env.location.hash);
  // Remove the credential before any route renders or fetch happens, including malformed links.
  env.history.replaceState(null, '', `${env.location.pathname}${env.location.search}#/invitations?private=1`);
  try { if (value) env.sessionStorage.setItem(INVITE_KEY, value); else env.sessionStorage.removeItem(INVITE_KEY); }
  catch { return false; }
  return !!value;
}
export function readPrivateInvitation(storage = null) {
  try { const t = (storage ?? globalThis.sessionStorage).getItem(INVITE_KEY); return t && parseInvitationFragment(`#invite=${t}`) ? t : null; } catch { return null; }
}
export function forgetPrivateInvitation(storage = null) { try { (storage ?? globalThis.sessionStorage).removeItem(INVITE_KEY); } catch { /* memory-only environments have no stored credential */ } }
export function privateInvitationFallback(env = globalThis) {
  let pending; try { pending = readPrivateInvitation(env.sessionStorage); } catch { return false; }
  if (!pending) return false;
  env.location.assign('/#invite'); // current design consumes pendingInvite; no credential rides in the URL.
  return true;
}
export async function previewInvitations(invitations, { token = null, request = api } = {}) {
  const list = token ? [{ id: null, token }] : invitations;
  const previews = [];
  for (const invitation of list ?? []) {
    const url = token ? `/v2/invitations/${enc(token)}/accept` : `/v2/me/invitations/${enc(invitation.id)}/accept`;
    const r = await request(url, { method: 'POST', body: { mode: 'dry_run' } });
    const effect = r?.impact?.affected?.[0];
    if (!r?.confirm_token || !effect?.scope?.type || !effect?.role) throw new Error('This invitation preview could not be verified.');
    previews.push({ id: invitation.id, url, confirmToken: r.confirm_token, scope: effect.scope, role: effect.role, name: invitation.scope?.name ?? null });
  }
  return previews;
}
export async function confirmInvitations(previews, { request = api, onprogress = () => {} } = {}) {
  const accepted = [];
  for (const preview of previews) {
    onprogress(accepted.length, previews.length);
    try {
      const r = await request(preview.url, { method: 'POST', body: { mode: 'execute', confirm_token: preview.confirmToken } });
      if (r?.granted !== true) throw new Error('The invitation acceptance could not be confirmed.');
      const [pending, me] = await Promise.all([request('/v2/me/invitations'), request('/v2/me')]);
      const rank = { viewer: 1, member: 2, owner: 3 };
      const grant = (me?.grants ?? []).find(g => g.scope_type === preview.scope.type && g.scope_id === preview.scope.id && rank[g.role] >= rank[preview.role]);
      if (!grant || (preview.id && (pending?.invitations ?? []).some(i => i.id === preview.id))) throw new Error('The acceptance readback did not match.');
      accepted.push(preview.scope);
    } catch {
      // A failed/uncertain write is never retried and no later invitation is touched.
      return { accepted, failed: true, message: `${accepted.length} of ${previews.length} invitations verified. The next acceptance could not be confirmed; refresh Invitations before trying again.` };
    }
  }
  return { accepted, failed: false, message: `${accepted.length} invitation${accepted.length === 1 ? '' : 's'} accepted and verified.` };
}
export async function revokeWithConfirmation(scope, row, { request = api, confirm = globalThis.confirm?.bind(globalThis) } = {}) {
  if (!confirm?.(row.pending ? 'Withdraw this pending invitation? The person will no longer be able to accept it.' : 'Remove this person’s access at this scope?')) return { cancelled: true };
  const url = row.pending ? `/v2/invitations/${enc(row.key)}` : `/v2/${scope.type}/${enc(scope.id)}/grants/${enc(row.key)}`;
  await request(url, { method: 'DELETE' });
  const readback = await request(`/v2/${scope.type}/${enc(scope.id)}/grants`);
  const list = row.pending ? readback?.pending_invitations : readback?.grants;
  if (!Array.isArray(list) || list.some(i => i.id === row.key)) throw new Error('The removal could not be verified. Refresh People before trying again.');
  return { cancelled: false };
}
