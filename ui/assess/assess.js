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
const state = { principal: null, projects: [], assessmentsByProject: new Map(), templates: null, current: null, busy: false, message: '' };

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

async function assessmentsFor(pid) {
  // AMEND 4: an assessment-only grantee holds no project role, so the project list read is refused; that is not a screen failure.
  if (!state.assessmentsByProject.has(pid)) { try { const r = await api(`/v2/projects/${encodeURIComponent(pid)}/assessments`); state.assessmentsByProject.set(pid, r.assessments || []); } catch { state.assessmentsByProject.set(pid, null); } }
  return state.assessmentsByProject.get(pid);
}
function context(current) {
  const projects = state.projects.map(p => {
    const list = state.assessmentsByProject.get(p.id) || null;
    const open = current?.assessment.project_id === p.id || list;
    const rows = list ? list.map(x => `<a class="assessment-link" href="#assessment/${encodeURIComponent(x.id)}" ${current && x.id === current.assessment.id ? 'aria-current="page"' : ''}>${esc(x.name)}<small>${stageLabel(x.stage)}</small></a>`).join('') : '';
    return `<div class="context-project"><a class="project-name" href="#" data-project="${esc(p.id)}">${esc(p.name)}</a>${open ? (rows || '<p class="small muted" style="margin:4px 0 0 18px">No assessments yet.</p>') : ''}</div>`;
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
    const included = g.included.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3>${esc(s.template_name)}</h3><p class="small muted">v${esc(s.template_version)} · collection ${esc(s.collection_status)}</p></div>${mayEdit ? `<button class="quiet" data-remove="${esc(s.id)}" ${state.busy ? 'disabled' : ''}>Remove from assessment</button>` : ''}</div>`).join('');
    const available = mayEdit ? g.available.map(t => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}" style="opacity:.35"></span><div><h3 class="muted" style="font-weight:500">${esc(t.name)}</h3><p class="small muted">v${esc(t.version)} · not included</p></div><button data-include="${esc(t.id)}" data-version="${esc(t.version)}" ${state.busy ? 'disabled' : ''}>Include</button></div>`).join('') : '';
    return `<section aria-label="${esc(g.lens)}"><h3 style="margin:18px 0 6px">${esc(g.lens)} <span class="small muted">· ${g.included.length} included</span></h3>${included || '<p class="small muted">No survey included for this lens yet.</p>'}${available}</section>`;
  }).join('');
}
function screen(current) {
  const phase = current.assessment.stage;
  const a = current.assessment, project = state.projects.find(p => p.id === a.project_id);
  const surveySet = `<aside class="panel"><p class="eyebrow">Survey set</p><h2>Three lenses</h2><p class="muted">${(current.assessment.role === 'owner' || current.assessment.role === 'member') ? 'Within each lens, choose which surveys this assessment includes.' : 'Your role here is ' + esc(current.assessment.role) + ': you can see the survey set; changing it needs a member or owner role.'} Including a survey while the stage is Collect opens collection at once. Removing a survey that already has responses, codes or invitations archives it and keeps them; it is not undone by including again.${state.templates ? '' : ' Template catalogue not loaded.'}</p>${lensRows(current)}<p class="status" role="${state.message ? 'alert' : 'status'}" aria-live="polite">${esc(state.message)}</p></aside>`;
  const left = `<section class="panel"><p class="eyebrow">${title(phase)}</p><h2>${{ prepare: 'Prepare this assessment', collect: 'Collect perspectives', understand: 'Bring the perspectives together', improve: 'What comes next?' }[phase]}</h2><p class="muted">Current stage: <strong>${title(a.stage)}</strong>. Changing the stage, invitations, links, reports and notes are not on this screen yet; the current workspace still has them.</p></section>`;
  return `<div class="title"><div><p class="eyebrow">Assessment</p><h1>${esc(a.name)}</h1><p class="muted" style="margin:0">${esc(project?.name || a.project_id)} · your role: ${esc(a.role)}</p></div><span class="badge">${stageLabel(a.stage)}</span></div>${stages(a)}<div class="grid">${left}${surveySet}</div>`;
}
function projectsView() {
  if (!state.projects.length) return `<div class="narrow panel"><p class="eyebrow">Your projects</p><h1>No project on this account</h1><p class="muted">This screen lists projects you hold a role on. An assessment you were granted directly, without a project role, is not listed here yet; the current workspace still opens it.</p></div>`;
  return `<div class="title"><div><p class="eyebrow">Your projects</p><h1>Choose an assessment</h1></div></div><div class="project-grid">${state.projects.map(p => { const list = state.assessmentsByProject.get(p.id) || []; return `<div class="panel project-card"><p class="eyebrow">Project</p><h2>${esc(p.name)}</h2>${list.length ? `<div class="links">${list.map(x => `<a href="#assessment/${encodeURIComponent(x.id)}">${esc(x.name)} <span class="small muted">· ${stageLabel(x.stage)}</span></a>`).join('')}</div>` : `<a href="#" class="small" data-project="${esc(p.id)}">Show assessments</a>`}</div>`; }).join('')}</div>`;
}
function bind(current) {
  app.querySelectorAll('[data-project]').forEach(el => el.onclick = async e => { e.preventDefault(); await assessmentsFor(el.dataset.project); render(); });
  if (!current) return;
  const aid = current.assessment.id;
  app.querySelectorAll('[data-include]').forEach(b => b.onclick = () => act('Including survey…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys`, { method: 'POST', body: { template_id: b.dataset.include, version: Number(b.dataset.version) } }); state.message = `Survey included; collection ${r.survey?.collection_status || 'status unknown'}.`; }))
  app.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => act('Removing survey…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(b.dataset.remove)}`, { method: 'DELETE' }); state.message = r.archived ? `Survey archived: ${r.preserved_responses} response(s), ${r.preserved_codes} code(s), ${r.preserved_invitations} invitation(s) kept. Collection is closed for it.` : 'Survey removed from this assessment; nothing had been collected for it.'; }));
}
async function act(label, fn) {
  if (state.busy) return; state.busy = true; state.message = ''; note.textContent = label; render();
  try { await fn(); await load(state.current.assessment.id); note.textContent = ''; }
  catch (e) { state.message = redact(e.message); note.textContent = ''; }
  finally { state.busy = false; render(); }
}
async function load(aid) {
  const r = await api(`/v2/assessments/${encodeURIComponent(aid)}`);
  state.current = { assessment: r.assessment, surveys: r.surveys || [] };
  if (!state.templates) { try { state.templates = (await api('/v2/templates')).templates || []; } catch { state.templates = null; } }
  await assessmentsFor(r.assessment.project_id);
}
async function render() {
  const r = route(location.hash);
  if (r.kind === 'assessment') {
    if (state.current?.assessment.id !== r.id) { try { await load(r.id); } catch (e) { state.current = null; app.className = ''; app.innerHTML = `<div class="narrow panel"><h1>Assessment unavailable</h1><p class="muted">${esc(redact(e.message))}</p><a href="#">All projects</a></div>`; return; } }
    app.className = 'workspace-layout'; app.innerHTML = context(state.current) + screen(state.current) + '</section>'; bind(state.current);
    document.title = `${state.current.assessment.name} · 3D Review`;
  } else { state.current = null; app.className = ''; app.innerHTML = projectsView(); bind(null); document.title = '3D Review · Assessments'; }
}
async function boot() {
  try { const me = await api('/v2/me'); state.principal = me.principal; }
  catch { who.textContent = 'Not signed in'; app.className = ''; app.innerHTML = `<div class="narrow panel"><h1>Sign in to open an assessment</h1><p class="muted">This screen uses your existing session. Sign in on the current workspace in this same tab, then come back to <code>${esc(location.pathname + location.hash)}</code>.</p><a class="button primary" href="/#facilitator">Go to sign in</a></div>`; return; }
  who.textContent = `${state.principal.kind} · ${state.principal.id}`;
  state.projects = (await api('/v2/projects')).projects || [];
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  await render();
}
if (typeof window !== 'undefined' && document.getElementById('app')) boot();
