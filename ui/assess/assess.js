// /assess/ — showcase-based assessment screen (cookbook #16 order c5719384228, slice 1).
// Starting page: the app-flows composition (sidebar · title · phase tabs · two-column body · lens survey rows).
// Data: existing /v2 endpoints only, same-origin session (cookie or the legacy facilitatorToken). No fictional model.
// Anything the showcase draws that this slice does not wire is omitted, never rendered as a working control.
import { redactDiagnosticPath } from '/diagnostic-path.js';
import { loadBlankPrint, renderBlankPrint, printAllowed } from '/stage-screens.js';
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
//                                                  | 'unauthenticated' (session expired/revoked — sign in again or retry; never durable)
//   inflight     Map<pid, Promise>                 one read per project at a time; overlapping callers share it, and only the
//                                                  newest issued read may write (seq), so a slower failure cannot clobber a success
//   counts       Map<sid, {status, responses, respondents}>  per included ACTIVE survey (cut 2A): 'loaded' | 'failed' (transient,
//                                                  Retry) | 'gone' (refusal-class: no longer visible here → assessment marked dirty,
//                                                  Refresh) | 'unauthenticated'. Every result is bound to (aid, sid, generation) and a
//                                                  mismatch never paints (Auditor 2A-3).
//   generation   counter                           a later render supersedes an earlier one's DOM write (supplier 1114cb1)
let generation = 0;
const state = { principal: null, projects: [], lists: new Map(), inflight: new Map(), seq: new Map(), templates: null, current: null, busy: false, message: null, dirty: new Set(), counts: new Map(), print: null };
// Bugbot 4040745881: authentication failures are NOT authorization refusals — they recover by signing in again / retry.
const UNAUTHENTICATED = new Set(['NOT_AUTHENTICATED', '401']);
const REFUSED = new Set(['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_AUTHORIZED', '403', '404']); // visibility/authz codes (supplier 97f7402 + policy.ts)
const SIGNIN = '<a href="/v2/auth/access">Sign in again</a>';
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
  // Auditor 2A-4: the survey child route is explicit; anything else after the assessment id is ignored (no silent fall-through elsewhere).
  if (parts[2] === 'survey' && parts[3]) return { kind: 'survey', id: parts[1], sid: parts[3] };
  return { kind: 'assessment', id: parts[1] };
}

async function assessmentsFor(pid, { retry = false } = {}) {
  // AMEND 4: an assessment-only grantee holds no project role, so the list read is REFUSED (durable, not a screen failure).
  // Bugbot 4040525137: a transient failure is FAILED — never cached as empty; every render of it offers Retry and any
  // later call with retry (or an unloaded/failed status) reads again.
  const cur = listFor(pid);
  if (cur.status === 'loaded' || (cur.status === 'refused' && !retry)) return cur;
  // Bugbot 4040745888: dedupe — an overlapping caller joins the read in flight; a fresh read gets a new seq and only the
  // newest seq may write state, so an older, slower response (success or failure) is discarded.
  if (state.inflight.has(pid)) return state.inflight.get(pid);
  const seq = (state.seq.get(pid) || 0) + 1; state.seq.set(pid, seq);
  const run = (async () => {
    let next;
    try { const r = await api(`/v2/projects/${encodeURIComponent(pid)}/assessments`); next = { status: 'loaded', list: r.assessments || [] }; }
    catch (e) { const code = String(e.code); next = { status: UNAUTHENTICATED.has(code) ? 'unauthenticated' : REFUSED.has(code) ? 'refused' : 'failed', list: null, error: redact(e.message) }; }
    finally { state.inflight.delete(pid); }
    if (state.seq.get(pid) === seq) state.lists.set(pid, next);
    return listFor(pid);
  })();
  state.inflight.set(pid, run);
  return run;
}
const activeSurveys = current => current.surveys.filter(s => s.state === 'selected' && !s.archived_at);
const countFor = sid => state.counts.get(sid) || { status: 'loading' };
// Cut 2A counts: one cap.survey.get_status read per included active survey, in parallel, each bound to (aid, sid, gen).
function loadCounts(current, gen, { only = null } = {}) {
  const aid = current.assessment.id;
  for (const s of activeSurveys(current)) {
    if (only && s.id !== only) continue;
    if (!only && countFor(s.id).status === 'loaded') continue;
    state.counts.set(s.id, { status: 'loading' });
    api(`/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(s.id)}`).then(r => {
      if (gen !== generation || state.current?.assessment.id !== aid) return; // late effect for another screen: discard
      state.counts.set(s.id, { status: 'loaded', responses: Number(r.counts?.responses ?? 0), respondents: Number(r.counts?.respondents ?? 0), collection_status: r.survey?.collection_status });
      paintCounts(current);
    }).catch(e => {
      if (gen !== generation || state.current?.assessment.id !== aid) return;
      const code = String(e.code);
      // Auditor 2A-2: a refusal is not a transient failure — the survey is no longer visible to this identity here; the assessment
      // is marked dirty so the next render refetches. Wording claims loss of visibility only, never deletion.
      if (REFUSED.has(code)) { state.counts.set(s.id, { status: 'gone' }); state.dirty.add(aid); }
      else if (UNAUTHENTICATED.has(code)) state.counts.set(s.id, { status: 'unauthenticated' });
      else state.counts.set(s.id, { status: 'failed', error: redact(e.message) });
      paintCounts(current);
    });
  }
}
function countCell(s) {
  const c = countFor(s.id);
  if (c.status === 'loaded') return `<span data-count="${esc(s.id)}">${c.responses} response${c.responses === 1 ? '' : 's'} · ${c.respondents} respondent${c.respondents === 1 ? '' : 's'}</span>`;
  if (c.status === 'failed') return `<span data-count="${esc(s.id)}" role="alert">count unavailable · <a href="#" data-retry-count="${esc(s.id)}">Retry</a></span>`;
  if (c.status === 'gone') return `<span data-count="${esc(s.id)}" role="alert">no longer available to you here · <a href="#" data-refresh="1">Refresh</a></span>`;
  if (c.status === 'unauthenticated') return `<span data-count="${esc(s.id)}" role="alert">sign-in no longer active · ${SIGNIN} or <a href="#" data-retry-count="${esc(s.id)}">Retry</a></span>`;
  return `<span data-count="${esc(s.id)}" class="muted">counting…</span>`;
}
function totalTile(current) {
  const act = activeSurveys(current); const loaded = act.filter(s => countFor(s.id).status === 'loaded');
  const total = loaded.reduce((n, s) => n + countFor(s.id).responses, 0); const partial = loaded.length !== act.length;
  return `<div data-total><p class="count" style="margin:0">${total}</p><p class="muted" style="margin:4px 0 0">responses across ${loaded.length} of ${act.length} included survey${act.length === 1 ? '' : 's'} counted${partial ? ' <strong>(partial)</strong>' : ''}</p></div>`;
}
function paintCounts(current) {
  for (const s of activeSurveys(current)) { const el = app.querySelector(`[data-count="${CSS.escape(s.id)}"]`); if (el) el.outerHTML = countCell(s); }
  const t = app.querySelector('[data-total]'); if (t) t.outerHTML = totalTile(current);
  bindCounts(current);
}
function bindCounts(current) {
  app.querySelectorAll('[data-retry-count]').forEach(el => el.onclick = e => { e.preventDefault(); loadCounts(current, generation, { only: el.dataset.retryCount }); paintCounts(current); });
  app.querySelectorAll('[data-refresh]').forEach(el => el.onclick = e => { e.preventDefault(); render(); });
}
function lensFor(s) { return LENSES.includes(s.perspective) ? s.perspective : 'Other perspective'; }
function collectPanel(current) {
  const a = current.assessment, groups = groupByLens({ surveys: current.surveys, templates: [] });
  const rows = groups.map(g => g.included.length ? `<h3 style="margin:18px 0 6px">${esc(g.lens)}</h3>${g.included.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3><a href="#assessment/${encodeURIComponent(a.id)}/survey/${encodeURIComponent(s.id)}">${esc(s.template_name)}</a></h3><p class="small muted">collection ${esc(s.collection_status)} · ${countCell(s)}</p></div><a class="button" href="#assessment/${encodeURIComponent(a.id)}/survey/${encodeURIComponent(s.id)}">Open survey</a></div>`).join('')}` : '').join('');
  return `<section class="panel"><p class="eyebrow">${title(a.stage)}</p><h2>${{ prepare: 'Prepare this assessment', collect: 'Collect perspectives', understand: 'Bring the perspectives together', improve: 'What comes next?' }[a.stage]}</h2>${totalTile(current)}${rows || '<p class="muted">No survey is included yet. Choose surveys in the survey set.</p>'}<p class="small muted line">Open a survey for its own screen: counts and a printable blank questionnaire. Changing the stage, invitations, links, reports and notes are not on this screen yet.</p></section>`;
}
// Cut 2A child screen: ONE survey. Counts for any grant; Print survey only when the API role allows it (O, M — survey.ts:76).
function surveyScreen(current, s) {
  const a = current.assessment, lens = lensFor(s), mayPrint = printAllowed(a.role);
  const back = `<a class="back" href="#assessment/${encodeURIComponent(a.id)}">← Back to ${esc(a.name)}</a>`;
  const printBlock = mayPrint ? `<section class="panel" id="print-panel"><p class="eyebrow">Paper</p><h2>Print survey</h2><p class="muted">A blank questionnaire with this survey's actual questions — nothing personal, no codes or links on the page.</p><p><button class="primary" id="print-load" ${state.print?.sid === s.id && state.print.status === 'loading' ? 'disabled' : ''}>Print survey</button></p><div id="print-root"></div><p class="status" role="status" aria-live="polite" id="print-status">${state.print?.sid === s.id && state.print.status === 'error' ? esc(state.print.text) : ''}</p></section>` : `<section class="panel"><p class="eyebrow">Paper</p><h2>Print survey</h2><p class="muted">Printing the blank questionnaire needs a member or owner role on this assessment; your role here is ${esc(a.role)}.</p></section>`;
  return `${back}<div class="title"><div><p class="eyebrow">Survey · ${esc(lens)}</p><h1>${esc(s.template_name)}</h1><p class="muted" style="margin:0">${esc(a.name)} · v${esc(s.template_version)} · collection ${esc(s.collection_status)}</p></div><span class="badge">${countCell(s)}</span></div><div class="grid">${printBlock}<aside class="panel"><p class="eyebrow">This survey</p><p class="count">${countFor(s.id).status === 'loaded' ? countFor(s.id).responses : '—'}</p><p class="muted">responses received${countFor(s.id).status === 'loaded' ? ` from ${countFor(s.id).respondents} respondent${countFor(s.id).respondents === 1 ? '' : 's'}` : ''}</p>${state.dirty.has(a.id) ? '<p class="note" role="alert">This assessment changed; <a href="#" data-refresh="1">Refresh</a> to see the current survey set.</p>' : ''}</aside></div>`;
}
function surveyUnavailable(aid, sid) { return `<div class="narrow panel"><h1>Survey unavailable</h1><p class="muted">No survey with this address is visible to you in this assessment.</p><a class="button" href="#assessment/${encodeURIComponent(aid)}">Back to assessment</a></div>`; }
function bindPrint(current, s) {
  const btn = app.querySelector('#print-load'); if (!btn) return;
  btn.onclick = async () => {
    const gen = generation, aid = current.assessment.id;
    state.print = { sid: s.id, status: 'loading' }; btn.disabled = true;
    const model = await loadBlankPrint({ request: (url, init) => fetch(url, init), token, aid, sid: s.id, role: current.assessment.role });
    if (gen !== generation) return; // navigated away: nothing paints
    btn.disabled = false;
    if (!model.visible) { state.print = { sid: s.id, status: 'error', text: model.reason === 'unsafe-print' ? 'The print payload was refused because it carried credentials.' : `Blank questionnaire unavailable (${redact(model.reason)}).` }; app.querySelector('#print-status').textContent = state.print.text; return; }
    state.print = { sid: s.id, status: 'ready' };
    // renderBlankPrint draws the preview + Print button; printing itself mounts a .stage-print-only child DIRECTLY on <body>
    // (stage-screens.js printBlankForm) so stage-screens.css hides every sibling under @media print (Auditor 2A-1).
    renderBlankPrint(document, app.querySelector('#print-root'), model, { paper: 'a4' });
    app.querySelector('#print-status').textContent = `${model.items.length} questions ready. Use Print below.`;
  };
}
function context(current) {
  const projects = state.projects.map(p => {
    const l = listFor(p.id);
    const open = current?.assessment.project_id === p.id || l.status !== 'unloaded';
    const body = !open ? '' : l.status === 'loaded' ? (l.list.map(x => `<a class="assessment-link" href="#assessment/${encodeURIComponent(x.id)}" ${current && x.id === current.assessment.id ? 'aria-current="page"' : ''}>${esc(x.name)}<small>${stageLabel(x.stage)}</small></a>`).join('') || '<p class="small muted" style="margin:4px 0 0 18px">No assessments yet.</p>')
      : l.status === 'refused' ? '<p class="small muted" style="margin:4px 0 0 18px">Not listed: you have no role on this project.</p>'
      : l.status === 'failed' ? `<p class="small muted" style="margin:4px 0 0 18px" role="alert">Could not load assessments. <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>`
      : l.status === 'unauthenticated' ? `<p class="small muted" style="margin:4px 0 0 18px" role="alert">Your sign-in is no longer active. ${SIGNIN} or <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : '<p class="small muted" style="margin:4px 0 0 18px">Loading…</p>';
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
  const left = collectPanel(current);
  return `<div class="title"><div><p class="eyebrow">Assessment</p><h1>${esc(a.name)}</h1><p class="muted" style="margin:0">${esc(project?.name || a.project_id)} · your role: ${esc(a.role)}</p></div><span class="badge">${stageLabel(a.stage)}</span></div>${stages(a)}<div class="grid">${left}${surveySet}</div>`;
}
function projectsView() {
  if (!state.projects.length) return `<div class="narrow panel"><p class="eyebrow">Your projects</p><h1>No project on this account</h1><p class="muted">This screen lists projects you hold a role on. An assessment you were granted directly, without a project role, is not listed here yet; the current workspace still opens it.</p></div>`;
  return `<div class="title"><div><p class="eyebrow">Your projects</p><h1>Choose an assessment</h1></div></div><div class="project-grid">${state.projects.map(p => { const l = listFor(p.id); return `<div class="panel project-card"><p class="eyebrow">Project</p><h2>${esc(p.name)}</h2>${l.status === 'loaded' ? (l.list.length ? `<div class="links">${l.list.map(x => `<a href="#assessment/${encodeURIComponent(x.id)}">${esc(x.name)} <span class="small muted">· ${stageLabel(x.stage)}</span></a>`).join('')}</div>` : '<p class="small muted">No assessments yet.</p>') : l.status === 'failed' ? `<p class="small muted" role="alert">Could not load assessments. <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : l.status === 'unauthenticated' ? `<p class="small muted" role="alert">Your sign-in is no longer active. ${SIGNIN} or <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : l.status === 'refused' ? '<p class="small muted">Not listed: you have no role on this project.</p>' : `<a href="#" class="small" data-project="${esc(p.id)}">Show assessments</a>`}</div>`; }).join('')}</div>`;
}
function bind(current) {
  app.querySelectorAll('[data-project]').forEach(el => el.onclick = async e => { e.preventDefault(); await assessmentsFor(el.dataset.project, { retry: listFor(el.dataset.project).status !== 'refused' }); render(); });
  app.querySelectorAll('[data-retry-list]').forEach(el => el.onclick = async e => { e.preventDefault(); await assessmentsFor(el.dataset.retryList, { retry: true }); render(); });
  if (!current) return;
  const aid = current.assessment.id;
  app.querySelectorAll('[data-refresh]').forEach(el => el.onclick = e => { e.preventDefault(); render(); });
  bindCounts(current);
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
  if (r.kind === 'assessment' || r.kind === 'survey') {
    const aid = r.id;
    if (state.current?.assessment.id !== aid || state.dirty.has(aid)) {
      try { const data = await fetchAssessment(aid); if (gen !== generation) return; state.current = data; state.dirty.delete(aid); state.counts.clear(); state.print = null; }
      catch (e) {
        if (gen !== generation) return;
        if (state.current?.assessment.id === aid) { /* dirty refresh failed: keep the last screen, keep the dirty banner (retry offered) */ }
        else { state.current = null; app.className = ''; const expired = UNAUTHENTICATED.has(String(e.code)); app.innerHTML = `<div class="narrow panel"><h1>${expired ? 'Your sign-in is no longer active' : 'Assessment unavailable'}</h1><p class="muted">${esc(redact(e.message))}</p><p>${expired ? `<a class="button primary" href="/v2/auth/access">Sign in again</a> ` : ''}<a class="button" href="#assessment/${encodeURIComponent(aid)}" data-refresh="${esc(aid)}">Try again</a> <a href="#">All projects</a></p></div>`; app.querySelector('[data-refresh]').onclick = ev => { ev.preventDefault(); render(); }; return; }
      }
    }
    if (gen !== generation || state.current?.assessment.id !== aid) return;
    app.className = 'workspace-layout';
    if (r.kind === 'survey') {
      const s = activeSurveys(state.current).find(x => x.id === r.sid);
      app.innerHTML = context(state.current) + (s ? surveyScreen(state.current, s) : surveyUnavailable(aid, r.sid)) + '</section>';
      bind(state.current); if (s) { bindPrint(state.current, s); loadCounts(state.current, gen, { only: s.id }); }
      document.title = `${s ? s.template_name + ' · ' : ''}${state.current.assessment.name} · 3D Review`;
    } else {
      app.innerHTML = context(state.current) + screen(state.current) + '</section>'; bind(state.current); loadCounts(state.current, gen);
      document.title = `${state.current.assessment.name} · 3D Review`;
    }
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
