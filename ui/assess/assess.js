// /assess/ — showcase-based assessment screen (cookbook #16 order c5719384228, slice 1).
// Starting page: the app-flows composition (sidebar · title · phase tabs · two-column body · lens survey rows).
// Data: existing /v2 endpoints only, same-origin session (cookie or the legacy facilitatorToken). No fictional model.
// Anything the showcase draws that this slice does not wire is omitted, never rendered as a working control.
import { redactDiagnosticPath } from '/diagnostic-path.js';
const PHASES = ['prepare', 'collect', 'understand', 'improve'];
const LENSES = ['Translation Team', 'Church', 'Community']; // captain's order; server `perspective` decides membership
const DOTS = { 'Translation Team': '', Church: 'blue', Community: 'gold', 'Other perspective': '' };
const app = document.getElementById('app'), who = document.getElementById('who'), note = document.getElementById('note');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const title = v => v.charAt(0).toUpperCase() + v.slice(1);
const stageLabel = s => ({ prepare: 'In preparation', collect: 'Collecting', understand: 'Understanding', improve: 'Improving' })[s] || esc(s);
let token = null; try { token = sessionStorage.getItem('facilitatorToken'); } catch {}
async function api(url, { method = 'GET', body } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let r; try { r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new Error('API unavailable. For a write, its outcome is unknown.'); }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok || !j?.ok) { const e = new Error(j?.error?.message || `Request failed (${r.status})`); e.code = j?.error?.code || String(r.status); e.status = r.status; throw e; }
  return j.result;
}
const redact = m => redactDiagnosticPath(String(m || 'Request could not be completed.'));
// State model (Bugbot 4040525117/137/128/144 — one transition matrix, not per-finding patches):
//   current      { assessment, surveys }          the entity on screen, or null
//   dirty        Set<aid>                          a write COMMITTED on the server whose refresh has not landed yet;
//                                                  render must refetch before trusting current, writes stay disabled
//   message      { aid, text, alert } | null       feedback scoped to the entity it belongs to; other screens never show it
//   lists        Map<pid, {status, list}>          status 'loaded' (authorized, may be empty) | 'refused' (no role on the
//                                                  project — durable for this identity) | 'failed' (transient — retryable)
//   generation   counter                           a later render supersedes an earlier one's DOM write (supplier 1114cb1)
let generation = 0;
const state = { principal: null, projects: [], lists: new Map(), templates: null, current: null, busy: false, message: null, dirty: new Set() };
const REFUSED = new Set(['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_AUTHORIZED', 'NOT_AUTHENTICATED', '401', '403', '404']); // codes from supplier 97f7402 + auth.ts
const listFor = pid => state.lists.get(pid) || { status: 'unloaded', list: null };
const showMessage = current => state.message && current && state.message.aid === current.assessment.id ? state.message : null;

export function groupByLens({ surveys = [], templates = [] }) {
  const groups = LENSES.map(lens => ({ lens, included: [], available: [] }));
  const other = { lens: 'Other perspective', included: [], available: [] };
  const groupFor = p => groups.find(g => g.lens === p) || other;
  const included = surveys.filter(s => s.state === 'selected' && !s.archived_at); // same rule as the current lens-surveys.js
  for (const s of included) groupFor(s.perspective).included.push(s);
  const latest = new Map();
  for (const t of templates) { const cur = latest.get(t.id); if (!cur || t.version > cur.version) latest.set(t.id, t); }
  for (const t of latest.values()) if (!included.some(s => s.template_id === t.id)) groupFor(t.perspective).available.push(t);
  return other.included.length || other.available.length ? [...groups, other] : groups;
}
export function route(hash) {
  const parts = hash.replace(/^#/, '').split('/').map(p => { try { return decodeURIComponent(p); } catch { return ''; } });
  if (parts[0] !== 'assessment' || !parts[1]) return { kind: 'projects' };
  return { kind: 'assessment', id: parts[1] };
}

async function assessmentsFor(pid, { retry = false } = {}) {
  // AMEND 4: an assessment-only grantee holds no project role, so the list read is REFUSED (durable, not a screen failure).
  // Bugbot 4040525137: a transient failure is FAILED — never cached as empty; every render of it offers Retry and any
  // later call with retry (or an unloaded/failed status) reads again.
  const cur = listFor(pid);
  if (cur.status === 'loaded' || (cur.status === 'refused' && !retry)) return cur;
  try { const r = await api(`/v2/projects/${encodeURIComponent(pid)}/assessments`); state.lists.set(pid, { status: 'loaded', list: r.assessments || [] }); }
  catch (e) { state.lists.set(pid, { status: REFUSED.has(String(e.code)) ? 'refused' : 'failed', list: null, error: redact(e.message) }); }
  return listFor(pid);
}
function context(current) {
  const projects = state.projects.map(p => {
    const l = listFor(p.id);
    const open = current?.assessment.project_id === p.id || l.status !== 'unloaded';
    const body = !open ? '' : l.status === 'loaded' ? (l.list.map(x => `<a class="assessment-link" href="#assessment/${encodeURIComponent(x.id)}" ${current && x.id === current.assessment.id ? 'aria-current="page"' : ''}>${esc(x.name)}<small>${stageLabel(x.stage)}</small></a>`).join('') || '<p class="small muted" style="margin:4px 0 0 18px">No assessments yet.</p>')
      : l.status === 'refused' ? '<p class="small muted" style="margin:4px 0 0 18px">Not listed: you have no role on this project.</p>'
      : l.status === 'failed' ? `<p class="small muted" style="margin:4px 0 0 18px" role="alert">Could not load assessments. <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : '<p class="small muted" style="margin:4px 0 0 18px">Loading…</p>';
    return `<div class="context-project"><a class="project-name" href="#" data-project="${esc(p.id)}">${esc(p.name)}</a>${body}</div>`;
  }).join('');
  // Direct assessment grant without a project role: the open assessment is listed under its own heading, truthfully.
  const direct = current && !state.projects.some(p => p.id === current.assessment.project_id) ? `<div class="context-project"><span class="project-name">Granted to you</span><a class="assessment-link" href="#assessment/${encodeURIComponent(current.assessment.id)}" aria-current="page">${esc(current.assessment.name)}<small>${stageLabel(current.assessment.stage)} · ${esc(current.assessment.role)}</small></a><p class="small muted" style="margin:4px 0 0 18px">You hold this assessment directly; its project is not listed because you have no role on it.</p></div>` : '';
  return `<aside class="context-panel"><p class="eyebrow">Projects</p><nav aria-label="Project and assessment navigation">${direct}${projects || (direct ? '' : '<p class="small muted">No project on this account.</p>')}</nav><div class="line links"><a href="#">All projects</a></div></aside><section class="assessment-body">`;
}
// AMEND 2 (Auditor c5719472446): stage change is not wired, so the phase strip is a non-interactive indicator — no links, no buttons.
function stages(a) { return `<div class="tabs" role="list" aria-label="Assessment stages">${PHASES.map(p => `<span role="listitem" ${p === a.stage ? 'aria-current="step"' : ''}>${title(p)}</span>`).join('')}</div>`; }
function lensRows(current) {
  const mayEdit = current.assessment.role === 'owner' || current.assessment.role === 'member';
  return groupByLens({ surveys: current.surveys, templates: state.templates || [] }).map(g => {
    const included = g.included.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3>${esc(s.template_name)}</h3><p class="small muted">v${esc(s.template_version)} · collection ${esc(s.collection_status)}</p></div>${mayEdit ? `<button class="quiet" data-remove="${esc(s.id)}" ${state.busy || state.dirty.has(current.assessment.id) ? 'disabled' : ''}>Remove from assessment</button>` : ''}</div>`).join('');
    const archivedFor = t => current.surveys.find(s => s.template_id === t.id && s.template_version === t.version && s.state === 'archived');
    const available = mayEdit ? g.available.map(t => { const ar = archivedFor(t); return `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}" style="opacity:.35"></span><div><h3 class="muted" style="font-weight:500">${esc(t.name)}</h3><p class="small muted">v${esc(t.version)} · ${ar ? 'archived earlier; including again restores it with what was collected' : 'not included'}</p></div><button data-include="${esc(t.id)}" data-version="${esc(t.version)}" ${state.busy || state.dirty.has(current.assessment.id) ? 'disabled' : ''}>${ar ? 'Include again' : 'Include'}</button></div>`; }).join('') : '';
    return `<section aria-label="${esc(g.lens)}"><h3 style="margin:18px 0 6px">${esc(g.lens)} <span class="small muted">· ${g.included.length} included</span></h3>${included || '<p class="small muted">No survey included for this lens yet.</p>'}${available}</section>`;
  }).join('');
}
function screen(current) {
  const phase = current.assessment.stage;
  const a = current.assessment, project = state.projects.find(p => p.id === a.project_id);
  const surveySet = `<aside class="panel"><p class="eyebrow">Survey set</p><h2>Three lenses</h2><p class="muted">${(current.assessment.role === 'owner' || current.assessment.role === 'member') ? 'Within each lens, choose which surveys this assessment includes.' : 'Your role here is ' + esc(current.assessment.role) + ': you can see the survey set; changing it needs a member or owner role.'} Including a survey while the stage is Collect opens collection at once. Removing a survey that already has responses, codes or invitations archives it and keeps them; including that survey again restores it together with what was collected.${state.templates ? '' : ' Template catalogue not loaded.'}</p>${lensRows(current)}${state.dirty.has(current.assessment.id) ? `<p class="note" role="alert">Your change was saved on the server, but this screen could not be refreshed and may be out of date. <a href="#" data-refresh="${esc(current.assessment.id)}">Refresh now</a></p>` : ''}<p class="status" role="${showMessage(current)?.alert ? 'alert' : 'status'}" aria-live="polite">${esc(showMessage(current)?.text || '')}</p></aside>`;
  const left = `<section class="panel"><p class="eyebrow">${title(phase)}</p><h2>${{ prepare: 'Prepare this assessment', collect: 'Collect perspectives', understand: 'Bring the perspectives together', improve: 'What comes next?' }[phase]}</h2><p class="muted">Current stage: <strong>${title(a.stage)}</strong>. Changing the stage, invitations, links, reports and notes are not on this screen yet; the current workspace still has them.</p></section>`;
  return `<div class="title"><div><p class="eyebrow">Assessment</p><h1>${esc(a.name)}</h1><p class="muted" style="margin:0">${esc(project?.name || a.project_id)} · your role: ${esc(a.role)}</p></div><span class="badge">${stageLabel(a.stage)}</span></div>${stages(a)}<div class="grid">${left}${surveySet}</div>`;
}
function projectsView() {
  if (!state.projects.length) return `<div class="narrow panel"><p class="eyebrow">Your projects</p><h1>No project on this account</h1><p class="muted">This screen lists projects you hold a role on. An assessment you were granted directly, without a project role, is not listed here yet; the current workspace still opens it.</p></div>`;
  return `<div class="title"><div><p class="eyebrow">Your projects</p><h1>Choose an assessment</h1></div></div><div class="project-grid">${state.projects.map(p => { const l = listFor(p.id); return `<div class="panel project-card"><p class="eyebrow">Project</p><h2>${esc(p.name)}</h2>${l.status === 'loaded' ? (l.list.length ? `<div class="links">${l.list.map(x => `<a href="#assessment/${encodeURIComponent(x.id)}">${esc(x.name)} <span class="small muted">· ${stageLabel(x.stage)}</span></a>`).join('')}</div>` : '<p class="small muted">No assessments yet.</p>') : l.status === 'failed' ? `<p class="small muted" role="alert">Could not load assessments. <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : l.status === 'refused' ? '<p class="small muted">Not listed: you have no role on this project.</p>' : `<a href="#" class="small" data-project="${esc(p.id)}">Show assessments</a>`}</div>`; }).join('')}</div>`;
}
function bind(current) {
  app.querySelectorAll('[data-project]').forEach(el => el.onclick = async e => { e.preventDefault(); await assessmentsFor(el.dataset.project); render(); });
  app.querySelectorAll('[data-retry-list]').forEach(el => el.onclick = async e => { e.preventDefault(); await assessmentsFor(el.dataset.retryList, { retry: true }); render(); });
  if (!current) return;
  const aid = current.assessment.id;
  app.querySelectorAll('[data-refresh]').forEach(el => el.onclick = e => { e.preventDefault(); render(); });
  app.querySelectorAll('[data-include]').forEach(b => b.onclick = () => act(aid, 'Including survey…', async () => { const restoring = b.textContent.trim() === 'Include again'; const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys`, { method: 'POST', body: { template_id: b.dataset.include, version: Number(b.dataset.version) } }); return `${restoring ? 'Survey restored with what was collected' : 'Survey included'}; collection ${r.survey?.collection_status || 'status unknown'}.`; }));
  app.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => act(aid, 'Removing survey…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(b.dataset.remove)}`, { method: 'DELETE' }); return r.archived ? `Survey archived: ${r.preserved_responses} response(s), ${r.preserved_codes} code(s), ${r.preserved_invitations} invitation(s) kept. Collection is closed for it; including it again restores it.` : 'Survey removed from this assessment; nothing had been collected for it.'; }));
}
// Transition: write → (committed ⇒ dirty) → refresh → (landed ⇒ clean). Every outcome is scoped to `aid`, never to
// whatever is on screen when the promise settles (Bugbot 4040525117 / 4040525128).
async function act(aid, label, fn) {
  if (state.busy || state.dirty.has(aid)) return;
  state.busy = true; state.message = null; note.textContent = label; render();
  let text = null;
  try { text = await fn(); state.dirty.add(aid); state.message = { aid, text, alert: false }; }
  catch (e) { state.message = { aid, text: redact(e.message), alert: true }; }
  finally { note.textContent = ''; state.busy = false; render(); }
}
// The entity read. Returns the data; the caller decides whether it is still wanted. On success for `aid` the dirty
// mark is cleared because the screen now reflects the committed server state.
async function fetchAssessment(aid) {
  const r = await api(`/v2/assessments/${encodeURIComponent(aid)}`);
  if (!state.templates) { try { state.templates = (await api('/v2/templates')).templates || []; } catch { state.templates = null; } }
  await assessmentsFor(r.assessment.project_id);
  return { assessment: r.assessment, surveys: r.surveys || [] };
}
async function render() {
  const gen = ++generation, r = route(location.hash);
  if (r.kind === 'assessment') {
    const aid = r.id;
    if (state.current?.assessment.id !== aid || state.dirty.has(aid)) {
      try { const data = await fetchAssessment(aid); if (gen !== generation) return; state.current = data; state.dirty.delete(aid); }
      catch (e) {
        if (gen !== generation) return;
        if (state.current?.assessment.id === aid) { /* dirty refresh failed: keep the last screen, keep the dirty banner (retry offered) */ }
        else { state.current = null; app.className = ''; app.innerHTML = `<div class="narrow panel"><h1>Assessment unavailable</h1><p class="muted">${esc(redact(e.message))}</p><p><a class="button" href="#assessment/${encodeURIComponent(aid)}" data-refresh="${esc(aid)}">Try again</a> <a href="#">All projects</a></p></div>`; app.querySelector('[data-refresh]').onclick = ev => { ev.preventDefault(); render(); }; return; }
      }
    }
    if (gen !== generation || state.current?.assessment.id !== aid) return;
    app.className = 'workspace-layout'; app.innerHTML = context(state.current) + screen(state.current) + '</section>'; bind(state.current);
    document.title = `${state.current.assessment.name} · 3D Review`;
  } else { state.current = null; if (gen !== generation) return; app.className = ''; app.innerHTML = projectsView(); bind(null); document.title = '3D Review · Assessments'; }
}
async function boot() {
  try { const me = await api('/v2/me'); state.principal = me.principal; }
  catch {
    // Real sign-in only (captain: synthetic-only sign-in rejected). /v2/auth/access is the existing Cloudflare email-code
    // route; it sets the session cookie and returns to the workspace home (/#session=…), not here — stated, not hidden.
    who.textContent = 'Not signed in'; app.className = '';
    const here = location.pathname + location.hash;
    app.innerHTML = `<div class="narrow panel"><h1>Sign in to open this assessment</h1><p class="muted">Sign in with the one-time email code. It brings you back to the workspace home in this tab; then open this address again:</p><p><code>${esc(here)}</code></p><a class="button primary" href="/v2/auth/access">Sign in with an email code</a></div>`;
    return; }
  who.textContent = `${state.principal.kind} · ${state.principal.id}`;
  state.projects = (await api('/v2/projects')).projects || [];
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  await render();
}
if (typeof window !== 'undefined' && document.getElementById('app')) boot();
