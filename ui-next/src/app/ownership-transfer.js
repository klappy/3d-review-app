import { api, enc } from './api.js';

const SCOPES = new Set(['workspace', 'project', 'assessment']);
export function transferBase(scope) {
  if (!SCOPES.has(scope?.type) || !scope?.id) throw new Error('Choose a valid ownership scope.');
  return `/v2/${scope.type}/${enc(scope.id)}`;
}
export function canTransferOwnership(me, scope) {
  return !!me?.principal?.id && me.principal.kind !== 'support' && (me.grants ?? []).some(g => g.scope_type === scope?.type && g.scope_id === scope?.id && g.role === 'owner');
}
export function transferCandidates(grants, me) {
  return (grants ?? []).filter(g => g.principal_id && g.principal_id !== me?.principal?.id);
}
export async function previewOwnershipTransfer(scope, me, to, stepDown, request = api) {
  if (!canTransferOwnership(me, scope)) throw new Error('A direct owner at this scope runs this step.');
  if (!to || to === me.principal.id) throw new Error('Choose another person with access.');
  const params = { to, step_down: !!stepDown };
  const preview = await request(`${transferBase(scope)}/transfer`, { method: 'POST', body: { ...params, mode: 'dry_run' } });
  if (preview?.suppressed || preview?.status === 'held' || !preview?.confirm_token) throw new Error('The ownership preview could not be confirmed.');
  return { scope: { ...scope }, params, token: preview.confirm_token, impact: preview.impact, caller: me.principal.id };
}
export async function executeOwnershipTransfer(preview, request = api) {
  if (!preview?.token) throw new Error('Preview the ownership change first.');
  const result = await request(`${transferBase(preview.scope)}/transfer`, { method: 'POST', body: { ...preview.params, mode: 'execute', confirm_token: preview.token } });
  if (result?.transferred !== true) throw new Error('The ownership change could not be confirmed. Reopen People before taking another action.');
  const readback = await request(`${transferBase(preview.scope)}/grants`);
  const target = readback?.grants?.find(g => g.principal_id === preview.params.to);
  const caller = readback?.grants?.find(g => g.principal_id === preview.caller);
  if (target?.role !== 'owner' || (preview.params.step_down && caller?.role !== 'member')) throw new Error('The ownership readback did not match. Reopen People before taking another action.');
  return readback;
}
