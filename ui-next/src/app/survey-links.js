import { token, enc } from './api.js';
import { refusalError } from '../../../ui/rate-limit.js';

// Freeze the bearer for the lifetime of this management page. Cookie identity is checked separately.
export function surveyLinkRequest(bearer = token(), fetcher = globalThis.fetch) {
  return async (url, { method = 'GET', body } = {}) => {
    const headers = { accept: 'application/json' };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    let response;
    try { response = await fetcher(url, { method, headers, credentials: 'same-origin', cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw Object.assign(new Error('The request outcome is unknown.'), { status: 0 }); }
    let out; try { out = await response.json(); } catch { throw Object.assign(new Error('The response could not be read.'), { status: 0 }); }
    if (!response.ok || !out?.ok) throw refusalError(response.status, out?.error, response);
    return out.result;
  };
}
export function createSurveyLinks({ aid, surveys, principalId, role, bearer = token(), request = surveyLinkRequest(bearer), context = () => ({ aid, principalId, bearer: token() }), origin = globalThis.location?.origin ?? '', onchange = () => {}, onrevoked = () => {} }) {
  const selected = (surveys ?? []).filter(s => s?.id && !s.archived_at && (!s.state || s.state === 'selected'));
  const allowed = ['owner', 'member'].includes(role) && !!aid && aid !== 'sample' && !!principalId;
  let alive = true, generation = 0;
  let state = { stage: allowed ? 'idle' : 'refused', sid: selected[0]?.id ?? '', preview: null, link: null, message: allowed ? '' : 'Only a review owner or member can manage participant links.' };
  const update = patch => { state = { ...state, ...patch }; if (alive) onchange(state); };
  const same = () => { const c = context(); return alive && c?.aid === aid && c?.principalId === principalId && c?.bearer === bearer; };
  function invalidate() { generation++; update({ stage: 'changed', preview: null, link: null, message: 'The review or sign-in changed. Link values were cleared. Reopen link management to continue.' }); }
  async function current(gen) {
    if (!same() || gen !== generation) { if (alive) invalidate(); return false; }
    const me = await request('/v2/me');
    if (!same() || gen !== generation || me?.principal?.id !== principalId) { if (alive) invalidate(); return false; }
    return true;
  }
  function select(sid) {
    if (!selected.some(s => s.id === sid) || ['busy', 'uncertain', 'changed'].includes(state.stage)) return;
    generation++; update({ sid, stage: allowed ? 'idle' : 'refused', preview: null, link: null, message: '' });
  }
  function cancel() {
    if (state.stage !== 'preview' && state.stage !== 'revoke-preview') return;
    update({ stage: state.link ? 'shown' : 'idle', preview: null, message: 'Cancelled. No link was issued or revoked.' });
  }
  async function prepare() {
    if (!allowed || state.stage !== 'idle' || !selected.some(s => s.id === state.sid)) return;
    const gen = generation, sid = state.sid;
    update({ stage: 'busy', preview: null, message: 'Preparing the link preview…' });
    try {
      if (!(await current(gen))) return;
      const out = await request(`/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/links`, { method: 'POST', body: { mode: 'dry_run' } });
      if (!(await current(gen))) return;
      if (!out?.confirm_token || out.survey_id !== sid) throw new Error('Invalid preparation');
      update({ stage: 'preview', preview: Object.freeze({ aid, sid, principalId, bearer, confirmToken: out.confirm_token, reuses: !!out.reuses }), message: '' });
    } catch { if (alive && gen === generation) update({ stage: 'idle', message: 'The preview could not be loaded. No link was issued.' }); }
  }
  async function confirm() {
    const preview = state.preview;
    if (state.stage !== 'preview' || !preview || preview.aid !== aid || preview.sid !== state.sid) return;
    const gen = generation; let executed = false;
    update({ stage: 'busy', preview: null, message: 'Issuing the participant link…' });
    try {
      if (!(await current(gen))) return;
      executed = true;
      const out = await request(`/v2/assessments/${enc(aid)}/surveys/${enc(preview.sid)}/links`, { method: 'POST', body: { mode: 'execute', confirm_token: preview.confirmToken } });
      if (!(await current(gen))) return;
      if (!out?.link_id || typeof out.entry_fragment !== 'string' || !/^#survey=[A-Za-z0-9_-]+$/.test(out.entry_fragment)) throw new Error('Invalid issued link');
      update({ stage: 'shown', link: { id: out.link_id, sid: preview.sid, url: `${origin}/next/?ui_next=on${out.entry_fragment}` }, message: out.reused ? 'The current active link was reused. Keep it private.' : 'Link issued. Keep this page open to copy or revoke it.' });
    } catch { if (alive && gen === generation) update({ stage: executed ? 'uncertain' : 'idle', link: null, message: executed ? 'Issuance could not be confirmed. A link may exist. Reopen link management before issuing again.' : 'Your sign-in could not be checked. No link was requested.' }); }
  }
  function prepareRevoke() { if (state.stage === 'shown' && state.link) update({ stage: 'revoke-preview', message: '' }); }
  async function revoke() {
    if (state.stage !== 'revoke-preview' || !state.link) return;
    const gen = generation, link = { ...state.link }; let executed = false;
    update({ stage: 'busy', link: null, message: 'Revoking the link…' });
    try {
      if (!(await current(gen))) return;
      executed = true;
      const out = await request(`/v2/assessments/${enc(aid)}/surveys/${enc(link.sid)}/links/${enc(link.id)}`, { method: 'DELETE' });
      if (!(await current(gen))) return;
      if (out?.id !== link.id || out?.status !== 'revoked') throw new Error('Unconfirmed revocation');
      await onrevoked({ aid, sid: link.sid, id: link.id });
      if (!alive || gen !== generation) return;
      update({ stage: 'idle', message: 'Link revocation was confirmed by the server. Previously shared copies no longer open this survey.' });
    } catch { if (alive && gen === generation) update({ stage: executed ? 'uncertain' : 'shown', link: executed ? null : link, message: executed ? 'Revocation could not be confirmed. The link may still work. Reopen link management before taking another action.' : 'Your sign-in could not be checked. Nothing was revoked.' }); }
  }
  return { get state() { return state; }, surveys: selected, select, prepare, confirm, cancel, prepareRevoke, revoke,
    clear: () => { if (state.stage === 'shown') update({ stage: 'idle', link: null, message: 'Link value cleared from this page. The link remains active.' }); },
    recheck: async () => { try { await current(generation); } catch { if (alive) update({ message: 'Your sign-in could not be checked. Check the connection before continuing.' }); } },
    invalidate,
    dispose: () => { alive = false; generation++; state = { ...state, preview: null, link: null }; },
  };
}
