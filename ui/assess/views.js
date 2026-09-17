// ui/assess/views.js — understand / improve / permissions page modules for the assessment shell (UI overhaul, R1/I1).
// Module contract: { load(ctx, params) → model, render(ctx, model) → html, bind(ctx, root, model) }.
// ctx = { api, esc, enc, go, note, state, routes, cards, current, refresh? }; params = { aid, scope?, id? }.
// Rules carried: per-survey counts only (respondents are NEVER summed across surveys); results render the server's held
// literal; no Build/Preview report control; recommendations are "not built" statically; RESERVED_NOT_BUILT/501 never hits
// the generic retry; refusals read "Not visible to you"; permissions are per scope (nothing inherited); danger twins never GET.
import { renderReport } from '../report-view.js'; // relative: resolves at /report-view.js in the browser and under node --test

export const LENSES = ['Translation Team', 'Church', 'Community'];
const OTHER = 'Other perspective';
const DOTS = { 'Translation Team': '', Church: 'blue', Community: 'gold', [OTHER]: '' };
const UNAUTHENTICATED = new Set(['NOT_AUTHENTICATED', '401']);
const REFUSED = new Set(['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_AUTHORIZED', '403', '404']);
const NOT_BUILT = new Set(['RESERVED_NOT_BUILT', '501']);
const SIGNIN = '<a href="/v2/auth/access">Sign in again</a>';
export const NOTES_VISIBILITY = 'Everyone with access to this assessment can read these notes.';
export const RECOMMENDATIONS_NOT_BUILT = 'Recommendations are not built yet.';
export const NOT_VISIBLE = 'Not visible to you';
// Live API path segment is the SINGULAR scope noun (observed DEV 2026-09-17: /v2/assessment/{id}/grants ok; plural → NOT_FOUND_OR_NOT_VISIBLE).
const SCOPE_SEG = { workspaces: 'workspace', projects: 'project', assessments: 'assessment' };
const SCOPE_NOUN = { workspaces: 'workspace', projects: 'project', assessments: 'assessment' };
const ROLES = ['viewer', 'member', 'owner'];
const RANK = { viewer: 1, member: 2, owner: 3 };

export const css = `
.lens-block{margin:18px 0 6px}.lens-block h3{margin-bottom:4px}.lens-sum{font-size:14px}
.grants{width:100%;border-collapse:collapse;margin-top:12px}.grants th,.grants td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:14px}.grants th{color:var(--muted);font-weight:600}
.grants select{margin-top:0;min-height:38px;padding:6px 10px;width:auto;display:inline-block}.grants button{min-height:38px;padding:6px 12px}
.inline-form{display:grid;gap:12px;margin-top:14px}.inline-form .actions{margin-top:0}
`;

// Classify an api() failure into the four honest states the contract names. Never a generic retry for NOT_BUILT.
export function classify(e) {
  const code = String(e?.code ?? '');
  if (UNAUTHENTICATED.has(code)) return 'unauthenticated';
  if (REFUSED.has(code)) return 'refused';
  if (NOT_BUILT.has(code)) return 'not_built';
  return 'failed';
}
const settle = p => p.then(value => ({ status: 'loaded', value }), e => ({ status: classify(e), error: String(e?.message || 'Request could not be completed.') }));
const isEditor = role => role === 'owner' || role === 'member';
const activeSurveys = surveys => (surveys || []).filter(s => s.state === 'selected' && !s.archived_at);
const lensFor = s => LENSES.includes(s.perspective) ? s.perspective : OTHER;
function refusalLine(ctx, status, retryAttr, what) {
  const esc = ctx.esc;
  if (status === 'unauthenticated') return `<p class="small muted" role="alert">Your sign-in is no longer active. ${SIGNIN} or <a href="#" ${retryAttr}>Retry</a>.</p>`;
  if (status === 'refused') return `<p class="small muted" role="alert">${esc(NOT_VISIBLE)}.</p>`;
  if (status === 'not_built') return `<p class="small muted">${esc(what)} is not built yet.</p>`;
  return `<p class="small muted" role="alert">${esc(what)} could not be loaded. <a href="#" ${retryAttr}>Retry</a></p>`;
}

// ───────────────────────────────── understand ─────────────────────────────────
const understand = {
  async load(ctx, { aid }) {
    const cur = ctx.current, surveys = activeSurveys(cur?.surveys);
    const [counts, results, reports] = await Promise.all([
      Promise.all(surveys.map(s => settle(ctx.api(`/v2/assessments/${ctx.enc(aid)}/surveys/${ctx.enc(s.id)}`)).then(r => [s.id, r]))),
      settle(ctx.api(`/v2/assessments/${ctx.enc(aid)}/results`)),
      settle(ctx.api(`/v2/assessments/${ctx.enc(aid)}/reports`)),
    ]);
    const countMap = new Map();
    for (const [sid, r] of counts) countMap.set(sid, r.status === 'loaded' ? { status: 'loaded', responses: Number(r.value?.counts?.responses ?? 0), respondents: Number(r.value?.counts?.respondents ?? 0) } : r);
    return { aid, surveys, counts: countMap, results, reports, openReport: null };
  },
  render(ctx, m) {
    const esc = ctx.esc;
    // (1) Counts per lens: each survey row shows its OWN responses/respondents; the lens line sums responses only (A1/A2).
    const groups = [...LENSES, OTHER].map(lens => ({ lens, surveys: m.surveys.filter(s => lensFor(s) === lens) })).filter(g => g.lens !== OTHER || g.surveys.length);
    const countCell = s => { const c = m.counts.get(s.id) || { status: 'failed' };
      if (c.status === 'loaded') return `<span data-count="${esc(s.id)}">${c.responses} response${c.responses === 1 ? '' : 's'} · ${c.respondents} respondent${c.respondents === 1 ? '' : 's'}</span>`;
      if (c.status === 'refused') return `<span data-count="${esc(s.id)}" role="alert">no longer available to you here</span>`;
      if (c.status === 'unauthenticated') return `<span data-count="${esc(s.id)}" role="alert">sign-in no longer active · ${SIGNIN}</span>`;
      return `<span data-count="${esc(s.id)}" role="alert">count unavailable · <a href="#" data-retry="counts">Retry</a></span>`; };
    const lensBlocks = groups.map(g => {
      const loaded = g.surveys.filter(s => m.counts.get(s.id)?.status === 'loaded');
      const sum = loaded.reduce((n, s) => n + m.counts.get(s.id).responses, 0);
      const sumLine = g.surveys.length ? `<p class="muted lens-sum" data-lens-sum="${esc(g.lens)}">${sum} response${sum === 1 ? '' : 's'} across ${loaded.length} of ${g.surveys.length} survey${g.surveys.length === 1 ? '' : 's'}${loaded.length !== g.surveys.length ? ' <strong>(partial)</strong>' : ''}</p>` : '<p class="small muted">No survey included for this lens.</p>';
      const rows = g.surveys.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3><a href="${esc(ctx.routes.survey(m.aid, s.id))}">${esc(s.template_name || s.template_id)}</a></h3><p class="small muted">${countCell(s)}</p></div></div>`).join('');
      return `<section class="lens-block" aria-label="${esc(g.lens)}"><h3>${esc(g.lens)}</h3>${sumLine}${rows}</section>`;
    }).join('');
    // (2) Results: the held literal with the server's reason. No numbers, no bands.
    let results;
    if (m.results.status === 'loaded') { const r = m.results.value || {}; results = `<p><span class="badge">${esc(r.status || 'held')}</span></p><p class="muted" data-results-reason>${esc(r.reason || '')}</p>`; }
    else results = refusalLine(ctx, m.results.status, 'data-retry="results"', 'Results');
    // (3) Reports: list from the server; opening one renders it with report-view.js. No build control (A5).
    let reports;
    if (m.reports.status === 'loaded') {
      const r = m.reports.value || {};
      if (r.suppressed || r.status === 'held') reports = `<p class="muted" data-reports-held>${esc(r.reason || 'Reports are held.')}</p>`;
      else { const list = Array.isArray(r.reports) ? r.reports : [];
        reports = list.length ? `<ul class="links" data-report-list>${list.map(x => `<li data-report-id="${esc(x.id)}"><button type="button" data-open-report="${esc(x.id)}">Built ${esc(x.created_at)} · ${esc(x.id)}</button></li>`).join('')}</ul>` : '<p class="muted">No reports have been built for this assessment.</p>'; }
    } else if (m.reports.status === 'refused') reports = '<p class="muted" data-reports-unavailable>Reports are unavailable for this assessment.</p>';
    else reports = refusalLine(ctx, m.reports.status, 'data-retry="reports"', 'Reports');
    const open = m.openReport ? (m.openReport.status === 'held' ? `<p class="muted" data-open-report-reason>${esc(m.openReport.reason)}</p>` : m.openReport.status === 'error' ? `<p class="small muted" role="alert">${esc(m.openReport.text)}</p>` : '') : '';
    return `<div class="grid"><section class="panel"><p class="eyebrow">Understand</p><h2>Bring the perspectives together</h2>${lensBlocks}<p class="small muted line">Counts are per survey. Respondents are counted within each survey and are not added across surveys.</p></section><aside class="stack"><section class="panel" data-results><p class="eyebrow">Results</p>${results}</section><section class="panel" data-reports><p class="eyebrow">Reports</p>${reports}<div data-report-view>${open}</div><p class="status" role="status" aria-live="polite" data-report-status></p></section></aside></div>`;
  },
  bind(ctx, root, m) {
    root.querySelectorAll('[data-retry]').forEach(el => el.onclick = e => { e.preventDefault(); ctx.go(ctx.routes.assessment(m.aid, 'understand'), { reload: true }); });
    root.querySelectorAll('[data-open-report]').forEach(btn => btn.onclick = async () => {
      const id = btn.dataset.openReport, view = root.querySelector('[data-report-view]'), status = root.querySelector('[data-report-status]');
      const all = root.querySelectorAll('[data-open-report]'); all.forEach(b => b.disabled = true); if (status) status.textContent = 'Opening report…';
      try {
        const r = await ctx.api(`/v2/reports/${ctx.enc(id)}`);
        if (r.suppressed) { m.openReport = { status: 'held', reason: String(r.reason || '') }; if (view) view.textContent = m.openReport.reason; }
        else { const ok = renderReport({ doc: root.ownerDocument || globalThis.document, root: view, report: r.report }); m.openReport = ok ? { status: 'shown', id } : { status: 'error', text: 'This report could not be displayed.' }; if (!ok && view) view.textContent = m.openReport.text; }
        if (status) status.textContent = '';
      } catch (e) {
        const k = classify(e); m.openReport = { status: 'error', text: k === 'refused' ? NOT_VISIBLE : k === 'not_built' ? 'Reports are not built yet.' : k === 'unauthenticated' ? 'Your sign-in is no longer active.' : String(e.message || 'Report could not be opened.') };
        if (view) view.textContent = m.openReport.text; if (status) status.textContent = '';
      } finally { all.forEach(b => b.disabled = false); }
    });
  },
};

// ───────────────────────────────── improve ─────────────────────────────────
const improve = {
  async load(ctx, { aid }) {
    const a = ctx.current?.assessment || {};
    return { aid, role: a.role, notes_reflection: a.notes_reflection ?? '', notes_next_steps: a.notes_next_steps ?? '', editable: isEditor(a.role) };
  },
  render(ctx, m) {
    const esc = ctx.esc;
    const notes = m.editable
      ? `<form data-notes-form><label class="field">Reflection<textarea name="notes_reflection" maxlength="4000">${esc(m.notes_reflection)}</textarea></label><label class="field">Next steps<textarea name="notes_next_steps" maxlength="4000">${esc(m.notes_next_steps)}</textarea></label><p class="small muted">${esc(NOTES_VISIBILITY)}</p><div class="actions"><button class="primary" type="submit" data-save-notes>Save notes</button></div><p class="status" role="status" aria-live="polite" data-notes-status></p></form>`
      : `<h3>Reflection</h3><p data-notes-reflection>${m.notes_reflection ? esc(m.notes_reflection) : '<span class="muted">No reflection recorded.</span>'}</p><h3>Next steps</h3><p data-notes-next-steps>${m.notes_next_steps ? esc(m.notes_next_steps) : '<span class="muted">No next steps recorded.</span>'}</p><p class="small muted">${esc(NOTES_VISIBILITY)} Your role here is ${esc(m.role || 'viewer')}; editing needs a member or owner role.</p>`;
    return `<div class="grid"><section class="panel"><p class="eyebrow">Improve</p><h2>What comes next?</h2>${notes}</section><aside class="panel" data-recommendations><p class="eyebrow">Recommendations</p><p class="muted">${esc(RECOMMENDATIONS_NOT_BUILT)}</p></aside></div>`;
  },
  bind(ctx, root, m) {
    const form = root.querySelector('[data-notes-form]'); if (!form) return;
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('[data-save-notes]'), status = form.querySelector('[data-notes-status]');
      const body = { notes_reflection: form.querySelector('[name=notes_reflection]').value, notes_next_steps: form.querySelector('[name=notes_next_steps]').value };
      btn.disabled = true; if (status) { status.textContent = 'Saving…'; status.setAttribute('role', 'status'); }
      try {
        const r = await ctx.api(`/v2/assessments/${ctx.enc(m.aid)}/notes`, { method: 'PATCH', body });
        const a = r?.assessment || {}; m.notes_reflection = a.notes_reflection ?? body.notes_reflection; m.notes_next_steps = a.notes_next_steps ?? body.notes_next_steps;
        if (status) status.textContent = 'Notes saved.';
        if (typeof ctx.refresh === 'function') await ctx.refresh();
      } catch (err) {
        const k = classify(err);
        if (status) { status.setAttribute('role', 'alert'); status.textContent = k === 'refused' ? `${NOT_VISIBLE}: the notes were not saved.` : k === 'unauthenticated' ? 'Your sign-in is no longer active. Sign in again; the notes were not saved.' : k === 'not_built' ? 'Notes are not built yet.' : `Notes could not be saved: ${String(err.message || 'request failed')}`; }
      } finally { btn.disabled = false; }
    };
  },
};

// ───────────────────────────────── permissions ─────────────────────────────────
// One page per scope. Reads: GET /v2/{scope}/{id}/grants → { scope, grants:[{id, principal_id, role, created_at}], pending_invitations }.
// Writes: invite (danger two-step: dry_run → execute with confirm_token), revoke (DELETE), update_role (danger two-step),
// transfer_owner (danger two-step). Request-body shape follows the legacy client's danger calls: { params, mode, confirm_token }.
const permissions = {
  async load(ctx, { scope, id, role }) {
    if (!SCOPE_NOUN[scope]) return { scope, id, status: 'refused', grants: [], pending: [], myRole: null };
    const r = await settle(ctx.api(`/v2/${SCOPE_SEG[scope]}/${ctx.enc(id)}/grants`));
    const grants = r.status === 'loaded' ? (r.value?.grants || []) : [], pending = r.status === 'loaded' ? (r.value?.pending_invitations || []) : [];
    const me = ctx.state?.principal?.id;
    const myRole = role || (scope === 'assessments' && ctx.current?.assessment?.id === id ? ctx.current.assessment.role : null) || grants.find(g => g.principal_id === me)?.role || null;
    return { scope, id, status: r.status, error: r.error, grants, pending, myRole, me, confirm: null };
  },
  render(ctx, m) {
    const esc = ctx.esc, noun = SCOPE_NOUN[m.scope] || m.scope;
    const head = `<p class="eyebrow">Permissions</p><h2>Who can open this ${esc(noun)}</h2><p class="note small">Permissions apply to this ${esc(noun)} only; nothing is inherited.</p>`;
    if (m.status !== 'loaded') return `<section class="panel narrow" data-permissions>${head}${refusalLine(ctx, m.status, 'data-retry="grants"', 'Permissions')}</section>`;
    const owner = m.myRole === 'owner', editor = isEditor(m.myRole);
    const mayRevoke = g => g.role !== 'owner' && (owner || RANK[g.role] <= RANK.member);
    const rows = m.grants.map(g => `<tr data-grant="${esc(g.id)}"><td>${esc(g.principal_id)}${g.principal_id === m.me ? ' <span class="small muted">(you)</span>' : ''}</td><td>${owner && g.role !== 'owner' ? `<select data-role-for="${esc(g.id)}" aria-label="Role">${ROLES.map(r => `<option value="${r}" ${r === g.role ? 'selected' : ''}>${r}</option>`).join('')}</select> <button type="button" data-change-role="${esc(g.id)}">Change role</button> <button type="button" data-confirm="role:${esc(g.id)}" hidden>Confirm change</button>` : esc(g.role)}</td><td>${mayRevoke(g) && editor ? `<button type="button" class="quiet" data-revoke="${esc(g.id)}">Remove</button>` : ''}</td></tr>`).join('');
    const pending = m.pending.length ? `<h3 style="margin-top:22px">Pending invitations</h3><table class="grants"><thead><tr><th>Role</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>${m.pending.map(i => `<tr data-invitation="${esc(i.id)}"><td>${esc(i.role)}</td><td>${esc(i.status)}</td><td>${esc(i.expires_at || '')}</td><td>${editor && (owner || RANK[i.role] <= RANK.member) ? `<button type="button" class="quiet" data-revoke-invitation="${esc(i.id)}">Revoke</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '';
    const invite = editor ? `<form class="inline-form line" data-invite-form><h3>Invite someone</h3><label>Email<input name="email" type="email" required autocomplete="off"></label><label>Role<select name="role">${ROLES.filter(r => owner || r !== 'owner').map(r => `<option value="${r}">${r}</option>`).join('')}</select></label><div class="actions"><button type="submit" data-invite-preview>Preview invitation</button><button type="button" class="primary" data-confirm="invite" hidden>Send invitation</button></div><p class="small muted">An invitation sends an email. Nothing is sent until you confirm.</p></form>` : '';
    const transfer = owner ? `<form class="inline-form line" data-transfer-form><h3>Transfer ownership</h3><p class="small muted">Ownership moves to another signed-up principal. This cannot be undone from here.</p><label>New owner's principal id<input name="to" required autocomplete="off"></label><label class="check"><input name="step_down" type="checkbox"> Step down to member after the transfer</label><div class="actions"><button type="submit" data-transfer-preview>Preview transfer</button><button type="button" class="primary" data-confirm="transfer" hidden>Confirm transfer</button></div></form>` : '';
    return `<section class="panel" data-permissions>${head}<table class="grants"><thead><tr><th>Principal</th><th>Role</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">No grants listed.</td></tr>'}</tbody></table>${pending}${invite}${transfer}<p class="status" role="status" aria-live="polite" data-permissions-status></p></section>`;
  },
  bind(ctx, root, m) {
    const base = `/v2/${SCOPE_SEG[m.scope]}/${ctx.enc(m.id)}`, status = root.querySelector('[data-permissions-status]');
    const say = (text, alert = false) => { if (status) { status.setAttribute('role', alert ? 'alert' : 'status'); status.textContent = text; } };
    const fail = (e, what) => { const k = classify(e); say(k === 'refused' ? `${NOT_VISIBLE}: ${what} was not applied.` : k === 'unauthenticated' ? `Your sign-in is no longer active; ${what} was not applied.` : k === 'not_built' ? `${what} is not built yet.` : `${what} failed: ${String(e.message || 'request failed')}`, true); };
    const reload = () => ctx.go(ctx.routes.permissions ? ctx.routes.permissions(m.scope, m.id) : `#permissions/${ctx.enc(m.scope)}/${ctx.enc(m.id)}`, { reload: true });
    const buttons = () => root.querySelectorAll('button');
    const busy = async (fn) => { const bs = buttons(); bs.forEach(b => b.disabled = true); try { return await fn(); } finally { bs.forEach(b => b.disabled = false); } };
    root.querySelectorAll('[data-retry]').forEach(el => el.onclick = e => { e.preventDefault(); reload(); });
    // Danger two-step: dry_run → impact + confirm_token shown; the confirm button executes with that token. Never a GET.
    const danger = async (url, params, key, what, describe) => {
      const r = await ctx.api(url, { method: key === 'role' ? 'PATCH' : 'POST', body: { params, mode: 'dry_run' } });
      m.confirm = { key, url, params, token: r.confirm_token, expires: Date.now() + Number(r.expires_in || 300) * 1000 };
      const btn = root.querySelector(`[data-confirm="${key}"]`); if (btn) btn.hidden = false;
      say(`${describe(r)} Nothing has changed yet; confirm to ${what}.${r.expires_in ? ` This confirmation expires in ${r.expires_in} seconds.` : ''}`);
    };
    const execute = async (key, what, onDone) => {
      const c = m.confirm; if (!c || c.key !== key || !c.token || Date.now() > c.expires) { m.confirm = null; say(`Preview ${what} again before confirming.`, true); return; }
      m.confirm = null; const btn = root.querySelector(`[data-confirm="${key}"]`); if (btn) btn.hidden = true;
      const r = await ctx.api(c.url, { method: key === 'role' ? 'PATCH' : 'POST', body: { params: c.params, mode: 'execute', confirm_token: c.token } });
      onDone(r);
    };
    const inviteForm = root.querySelector('[data-invite-form]');
    if (inviteForm) {
      inviteForm.onsubmit = e => { e.preventDefault(); busy(async () => { try {
        const params = { email: inviteForm.querySelector('[name=email]').value.trim(), role: inviteForm.querySelector('[name=role]').value };
        await danger(`${base}/invitations`, params, 'invite', 'send the invitation', () => `Inviting as ${params.role}: they will see this ${SCOPE_NOUN[m.scope]}'s contents at that role.`);
      } catch (err) { fail(err, 'The invitation preview'); } }); };
      const c = root.querySelector('[data-confirm="invite"]'); if (c) c.onclick = () => busy(async () => { try { await execute('invite', 'the invitation', r => { say(r.delivered ? 'Invitation sent; the recipient has not accepted it yet.' : `Invitation recorded as ${r.status || 'pending'}; ${r.note || 'nothing was sent.'}`); reload(); }); } catch (err) { fail(err, 'The invitation'); } });
    }
    root.querySelectorAll('[data-revoke]').forEach(b => b.onclick = () => busy(async () => { try { const r = await ctx.api(`${base}/grants/${ctx.enc(b.dataset.revoke)}`, { method: 'DELETE' }); if (r?.revoked) { say('Access removed.'); reload(); } else say('The server did not confirm the removal.', true); } catch (err) { fail(err, 'Removing access'); } }));
    root.querySelectorAll('[data-revoke-invitation]').forEach(b => b.onclick = () => busy(async () => { try { const r = await ctx.api(`/v2/invitations/${ctx.enc(b.dataset.revokeInvitation)}`, { method: 'DELETE' }); if (r?.status === 'revoked') { say('Invitation revoked (an email already sent is not unsent).'); reload(); } else say('The server did not confirm the revocation.', true); } catch (err) { fail(err, 'Revoking the invitation'); } }));
    root.querySelectorAll('[data-change-role]').forEach(b => b.onclick = () => busy(async () => { try {
      const gid = b.dataset.changeRole, role = root.querySelector(`[data-role-for="${gid}"]`).value, cur = m.grants.find(g => g.id === gid);
      if (cur && cur.role === role) { say('That is already the role.'); return; }
      await danger(`${base}/grants/${ctx.enc(gid)}`, { role }, `role:${gid}`, 'change the role', () => `Changing ${cur?.principal_id || gid} from ${cur?.role || '?'} to ${role}.`);
    } catch (err) { fail(err, 'The role change preview'); } }));
    root.querySelectorAll('[data-confirm^="role:"]').forEach(b => b.onclick = () => busy(async () => { try { await execute(b.dataset.confirm, 'the role change', r => { say(`Role is now ${r.role}.`); reload(); }); } catch (err) { fail(err, 'The role change'); } }));
    const transferForm = root.querySelector('[data-transfer-form]');
    if (transferForm) {
      transferForm.onsubmit = e => { e.preventDefault(); busy(async () => { try {
        const params = { to: transferForm.querySelector('[name=to]').value.trim(), step_down: !!transferForm.querySelector('[name=step_down]').checked };
        await danger(`${base}/transfer`, params, 'transfer', 'transfer ownership', r => { const a = r.impact?.affected?.[0]; return a ? `${a.to} becomes owner; you become ${a.caller_becomes}.` : `${params.to} becomes owner.`; });
      } catch (err) { fail(err, 'The transfer preview'); } }); };
      const c = root.querySelector('[data-confirm="transfer"]'); if (c) c.onclick = () => busy(async () => { try { await execute('transfer', 'the transfer', r => { say(r.transferred ? `Ownership transferred to ${r.new_owner}; your role is now ${r.caller_role}.` : 'The server did not confirm the transfer.', !r.transferred); reload(); }); } catch (err) { fail(err, 'The transfer'); } });
    }
  },
};

export const views = { understand, improve, permissions };
export default views;
