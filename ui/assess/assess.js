import { isDemo, demoApi, memoryStorage, sampleResponses } from '/demo.js';
// /assess/ — showcase-based assessment screen (cookbook #16 order c5719384228, slice 1).
// Starting page: the app-flows composition (sidebar · title · phase tabs · two-column body · lens survey rows).
// Data: existing /v2 endpoints only, same-origin session (cookie or the legacy facilitatorToken). No fictional model.
// Anything the showcase draws that this slice does not wire is omitted, never rendered as a working control.
import { redactDiagnosticPath } from '/diagnostic-path.js';
import { loadBlankPrint, renderBlankPrint, printAllowed, rememberTab, recalledTab, STAGES } from '/stage-screens.js';
import { whatsHere } from '/assess/whats-here.js';
import * as cards from '/assess/cards.js';
import { pages, css as scopeCss } from '/assess/scope.js';
import { views, css as viewsCss } from '/assess/views.js';
import * as share from '/assess/share.js';
const PHASES = ['prepare', 'collect', 'understand', 'improve'];
// Product overhaul (cookbook #16 c5721465315): five VIEWS on one assessment page. A view is a tab; a tab never mutates stage.
const VIEWS = ['prepare', 'collect', 'understand', 'improve', 'permissions'];
const LENSES = ['Translation Team', 'Church', 'Community']; // captain's order; server `perspective` decides membership
const DOTS = { 'Translation Team': '', Church: 'blue', Community: 'gold', 'Other perspective': '' };
const app = document.getElementById('app'), who = document.getElementById('who'), note = document.getElementById('note');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const title = v => v.charAt(0).toUpperCase() + v.slice(1);
const stageLabel = s => ({ prepare: 'In preparation', collect: 'Collecting', understand: 'Understanding', improve: 'Improving' })[s] || esc(s);
const demo = typeof location !== 'undefined' && isDemo(location.search);
let tabStorage = memoryStorage(); if (!demo) { try { tabStorage = sessionStorage; } catch {} }
let token = null; if (!demo) { try { token = sessionStorage.getItem('facilitatorToken'); } catch {} }
async function api(url, { method = 'GET', body } = {}) {
  if (demo) return demoApi(url, { method, body });
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let r; try { r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new Error('API unavailable. For a write, its outcome is unknown.'); }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok || !j?.ok) { const e = new Error(j?.error?.message || `Request failed (${r.status})`); e.code = j?.error?.code || String(r.status); e.status = r.status; e.hint = j?.error?.hint; throw e; }
  return j.result;
}
// Same call, whole envelope (result + receipt + trace_id) — G1 shows receipt/trace on the row after a write.
async function apiFull(url, { method = 'GET', body } = {}) {
  if (demo) return { ok: true, result: await demoApi(url, { method, body }) };
  const headers = { accept: 'application/json' }; if (body !== undefined) headers['content-type'] = 'application/json'; if (token) headers.authorization = `Bearer ${token}`;
  let r; try { r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin', cache: 'no-store' }); } catch { throw new Error('API unavailable. For a write, its outcome is unknown.'); }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok || !j?.ok) { const e = new Error(j?.error?.message || `Request failed (${r.status})`); e.code = j?.error?.code || String(r.status); e.status = r.status; e.hint = j?.error?.hint; throw e; }
  return j;
}
const redact = m => redactDiagnosticPath(String(m || 'Request could not be completed.'));
// State model (Bugbot 4040525117/137/128/144 — one transition matrix, not per-finding patches):
//   current      { assessment, surveys }          the entity on screen, or null
//   dirty        Map<aid, 'write'|'visibility'>    'write': a write COMMITTED on the server whose refresh has not landed yet;
//                                                  'visibility': a read showed the survey set is no longer what is on screen.
//                                                  Either way render must refetch before trusting current and writes stay disabled;
//                                                  the banner copy differs (Bugbot 4041134440).
//   epoch        counter                           bumped whenever state.current is REPLACED (fresh entity data). A count read is
//                                                  bound to (aid, epoch): a result from an older survey set is discarded even if the
//                                                  entity id matches (Bugbot 4041134428). Paints within the same data do not bump it.
//   message      { aid, text, alert } | null       feedback scoped to the entity it belongs to; other screens never show it
//   lists        Map<pid, {status, list}>          status 'loaded' (authorized, may be empty) | 'refused' (no role on the
//                                                  project — durable for this identity) | 'failed' (transient — retryable)
//                                                  | 'unauthenticated' (session expired/revoked — sign in again or retry; never durable)
//   inflight     Map<pid, Promise>                 one read per project at a time; overlapping callers share it, and only the
//                                                  newest issued read may write (seq), so a slower failure cannot clobber a success
//   counts       Map<sid, {status, responses, respondents}>  per included ACTIVE survey (cut 2A): 'loaded' | 'failed' (transient,
//                                                  Retry) | 'gone' (refusal-class: no longer visible here → dirty 'visibility',
//                                                  Refresh) | 'unauthenticated'. All four are SETTLED: a paint never re-issues a
//                                                  settled or in-flight read; only an explicit user Retry or fresh entity data does
//                                                  (Bugbot 4041134416). Results are bound to (aid, epoch) (Auditor 2A-3).
//   generation   counter                           a later render supersedes an earlier one's DOM write (supplier 1114cb1)
let generation = 0, epoch = 0, identityGeneration = 0;
const state = { principal: null, projects: [], workspaces: new Map(), openProjects: new Set(), lists: new Map(), inflight: new Map(), seq: new Map(), templates: null, current: null, busy: false, message: null, dirty: new Map(), counts: new Map(), countInflight: new Set(), print: null };
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
  // AS1 A3(b): availability is keyed by (template_id, template_version) — the server keys select by both (survey.ts:46-49), so a newer
  // version stays offerable while an older one is included.
  for (const t of latest.values()) if (!included.some(s => s.template_id === t.id && s.template_version === t.version)) groupFor(t.perspective).available.push(t);
  return other.included.length || other.available.length ? [...groups, other] : groups;
}
export function route(hash) {
  const parts = hash.replace(/^#/, '').split('/').map(p => { try { return decodeURIComponent(p); } catch { return ''; } });
  // One page per scope: entry → workspaces → ONE workspace → ONE project → ONE assessment (five views) → survey.
  if (!parts[0]) return { kind: 'entry' };
  if (['how', 'example', 'signin', 'survey'].includes(parts[0]) && !parts[1]) return { kind: 'entry', intent: parts[0] };
  if (parts[0] === 'workspaces') return { kind: 'workspaces' };
  if (parts[0] === 'workspace' && parts[1]) return { kind: 'workspace', id: parts[1] };
  if (parts[0] === 'projects') return { kind: 'projects' };
  if (parts[0] === 'project' && parts[1]) return { kind: 'project', id: parts[1] };
  if (parts[0] === 'permissions' && ['workspaces', 'projects', 'assessments'].includes(parts[1]) && parts[2]) return { kind: 'permissions', scope: parts[1], id: parts[2] };
  if (parts[0] !== 'assessment' || !parts[1]) return { kind: 'projects' };
  // Auditor 2A-4: the survey child route is explicit; anything else after the assessment id is ignored (no silent fall-through elsewhere).
  if (parts[2] === 'survey' && parts[3]) return { kind: 'survey', id: parts[1], sid: parts[3] };
  // A view segment selects a tab; an unknown segment falls back to the stage view (never to a different assessment).
  return { kind: 'assessment', id: parts[1], view: VIEWS.includes(parts[2]) ? parts[2] : null };
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
  const identity = identityGeneration;
  const seq = (state.seq.get(pid) || 0) + 1; state.seq.set(pid, seq);
  const run = (async () => {
    let next;
    try { const r = await api(`/v2/projects/${encodeURIComponent(pid)}/assessments`); next = { status: 'loaded', list: r.assessments || [] }; }
    catch (e) { const code = String(e.code); next = { status: UNAUTHENTICATED.has(code) ? 'unauthenticated' : REFUSED.has(code) ? 'refused' : 'failed', list: null, error: redact(e.message) }; }
    finally { if (identity === identityGeneration && state.seq.get(pid) === seq) state.inflight.delete(pid); }
    if (identity === identityGeneration && state.seq.get(pid) === seq) state.lists.set(pid, next);
    return listFor(pid);
  })();
  state.inflight.set(pid, run);
  return run;
}
const activeSurveys = current => current.surveys.filter(s => s.state === 'selected' && !s.archived_at);
const countFor = sid => state.counts.get(sid) || { status: 'loading' };
// Cut 2A counts: one cap.survey.get_status read per included active survey, in parallel. Results are bound to the entity
// (aid, sid): they are stored and painted only while that entity is current; cells for other entities never exist, so
// nothing can land elsewhere (Auditor 2A-3). `gen` is kept for the refusal repaint only.
function loadCounts(current, { retry = null, only = null } = {}) {
  const aid = current.assessment.id, ep = epoch;
  for (const s of activeSurveys(current)) {
    if (retry && s.id !== retry) continue;
    if (only && s.id !== only) continue;
    // Settled (loaded/failed/gone/unauthenticated) or in-flight reads are never re-issued by a paint; only the user's Retry
    // for that one row, or fresh entity data (which clears state.counts), issues a new read (Bugbot 4041134416).
    if (!retry && (state.counts.has(s.id) || state.countInflight.has(s.id))) continue;
    if (state.countInflight.has(s.id)) continue;
    state.counts.set(s.id, { status: 'loading' }); state.countInflight.add(s.id);
    const fresh = () => ep === epoch && state.current?.assessment.id === aid; // same entity AND same survey-set data (Bugbot 4041134428)
    api(`/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(s.id)}`).then(r => {
      if (!fresh()) return; // stale survey set or another entity: never stored, never painted
      state.countInflight.delete(s.id);
      state.counts.set(s.id, { status: 'loaded', responses: Number(r.counts?.responses ?? 0), respondents: Number(r.counts?.respondents ?? 0), collection_status: r.survey?.collection_status });
      paintCounts(state.current);
    }).catch(e => {
      if (!fresh()) return;
      state.countInflight.delete(s.id);
      const code = String(e.code);
      // Auditor 2A-2: a refusal is not a transient failure — the survey is no longer visible to this identity here. The assessment
      // is marked dirty for VISIBILITY (not a saved write) so the next render refetches; the whole screen repaints once, and the
      // 'gone' status is settled, so the repaint issues no further read (Bugbot 4041134416/4041134440).
      if (REFUSED.has(code)) { state.counts.set(s.id, { status: 'gone' }); if (!state.dirty.has(aid)) state.dirty.set(aid, 'visibility'); paint(); return; }
      else if (UNAUTHENTICATED.has(code)) state.counts.set(s.id, { status: 'unauthenticated' });
      else state.counts.set(s.id, { status: 'failed', error: redact(e.message) });
      paintCounts(state.current);
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
  return `<div data-total><p class="count" style="margin:0">${total}</p><p class="muted" style="margin:4px 0 0">responses across ${loaded.length} of ${act.length} included survey${act.length === 1 ? '' : 's'} counted${partial ? ' <strong>(partial)</strong>' : ''}</p><p class="small muted" style="margin:4px 0 0">Responses only. Respondents are counted per survey and are never added up as people.</p></div>`;
}
function paintCounts(current) {
  for (const s of activeSurveys(current)) { const el = app.querySelector(`[data-count="${CSS.escape(s.id)}"]`); if (el) el.outerHTML = countCell(s); }
  const t = app.querySelector('[data-total]'); if (t) t.outerHTML = totalTile(current);
  for (const s of activeSurveys(current)) { const tile = app.querySelector(`[data-tile="${CSS.escape(s.id)}"]`); if (tile) tile.outerHTML = asideTile(s); }
  bindCounts(current);
}
function bindCounts(current) {
  app.querySelectorAll('[data-retry-count]').forEach(el => el.onclick = e => { e.preventDefault(); loadCounts(state.current, { retry: el.dataset.retryCount }); paintCounts(state.current); });
  app.querySelectorAll('[data-refresh]').forEach(el => el.onclick = e => { e.preventDefault(); render(); });
}
function lensFor(s) { return LENSES.includes(s.perspective) ? s.perspective : 'Other perspective'; }
function collectPanel(current) {
  const a = current.assessment, groups = groupByLens({ surveys: current.surveys, templates: [] });
  const rows = groups.map(g => g.included.length ? `<h3 style="margin:18px 0 6px">${esc(g.lens)}</h3>${g.included.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3><a href="#assessment/${encodeURIComponent(a.id)}/survey/${encodeURIComponent(s.id)}">${esc(s.template_name)}</a></h3><p class="small muted">collection ${esc(s.collection_status)} · ${countCell(s)}</p></div><a class="button" href="#assessment/${encodeURIComponent(a.id)}/survey/${encodeURIComponent(s.id)}">Open survey</a></div>`).join('')}` : '').join('');
  return `<section class="panel"><p class="eyebrow">Collect</p><h2>Collect perspectives</h2>${totalTile(current)}${rows || '<p class="muted">No survey is included yet. Choose surveys in the survey set.</p>'}<p class="small muted line">Open a survey for its own screen: counts and a printable blank questionnaire. Changing the stage, invitations, links, reports and notes are not on this screen yet.</p></section>`;
}
// Cut 2A child screen: ONE survey. Counts for any grant; Print survey only when the API role allows it (O, M — survey.ts:76).
function surveyScreen(current, s) {
  const a = current.assessment, lens = lensFor(s), mayPrint = printAllowed(a.role);
  const back = `<a class="back" href="#assessment/${encodeURIComponent(a.id)}">← Back to ${esc(a.name)}</a>`;
  const printBlock = mayPrint ? `<section class="panel" id="print-panel"><p class="eyebrow">Paper</p><h2>Print survey</h2><p class="muted">A blank questionnaire with this survey's actual questions — nothing personal, no codes or links on the page.</p><p><button class="primary" id="print-load" ${state.dirty.has(a.id) ? 'disabled' : ''}>Print survey</button></p><div id="print-root"></div><p class="status" role="status" aria-live="polite" id="print-status"></p></section>` : `<section class="panel"><p class="eyebrow">Paper</p><h2>Print survey</h2><p class="muted">Printing the blank questionnaire needs a member or owner role on this assessment; your role here is ${esc(a.role)}.</p></section>`;
  return `${back}<div class="title"><div><p class="eyebrow">Survey · ${esc(lens)}</p><h1>${esc(s.template_name)}</h1><p class="muted" style="margin:0">${esc(a.name)} · v${esc(s.template_version)} · collection ${esc(s.collection_status)}</p></div><span class="badge">${countCell(s)}</span></div><div class="grid start">${printBlock}<div id="share-root">${share.render({ esc, enc: encodeURIComponent }, { current, survey: s, share: share.shareFor(state, a.id, s.id, epoch) })}</div><aside class="panel"><p class="eyebrow">This survey</p>${asideTile(s)}${dirtyBanner(a.id)}<p class="status" role="${showMessage(current)?.alert ? 'alert' : 'status'}" aria-live="polite">${esc(showMessage(current)?.text || '')}</p></aside></div>`;
}
// The child's aside tile is derived from the same cached count as the badge and repainted with it (MED 4040990763).
function asideTile(s) {
  const c = countFor(s.id);
  if (c.status === 'loaded') return `<div data-tile="${esc(s.id)}"><p class="count">${c.responses}</p><p class="muted">responses received from ${c.respondents} respondent${c.respondents === 1 ? '' : 's'}</p></div>`;
  if (c.status === 'loading') return `<div data-tile="${esc(s.id)}"><p class="count">—</p><p class="muted">counting…</p></div>`;
  return `<div data-tile="${esc(s.id)}"><p class="count">—</p><p class="muted" role="alert">${c.status === 'gone' ? 'no longer available to you here' : c.status === 'unauthenticated' ? 'sign-in no longer active' : 'count unavailable'}</p></div>`;
}
// Read vs write invalidation are told apart on screen (Bugbot 4041134440).
function dirtyBanner(aid) {
  const why = state.dirty.get(aid); if (!why) return '';
  return why === 'write'
    ? `<p class="note" role="alert">Your change was saved on the server, but this screen could not be refreshed and may be out of date. <a href="#" data-refresh="${esc(aid)}">Refresh now</a></p>`
    : `<p class="note" role="alert">This assessment's survey set changed, or part of it is no longer visible to you. Nothing was written. <a href="#" data-refresh="${esc(aid)}">Refresh now</a></p>`;
}
function surveyUnavailable(aid, sid) { return `<div class="narrow panel"><h1>Survey unavailable</h1><p class="muted">No survey with this address is visible to you in this assessment.</p><a class="button" href="#assessment/${encodeURIComponent(aid)}">Back to assessment</a></div>`; }
function bindPrint(current, s) {
  const btn = app.querySelector('#print-load'); if (!btn) return;
  btn.onclick = async () => {
    const gen = generation, aid = current.assessment.id;
    state.print = { sid: s.id, status: 'loading', gen }; btn.disabled = true;
    const model = await loadBlankPrint({ request: (url, init) => fetch(url, init), token, aid, sid: s.id, role: current.assessment.role });
    if (gen !== generation) return; // navigated away: nothing paints; the next paint() already reset state.print (HIGH 4040990731)
    btn.disabled = false;
    if (!model.visible) { state.print = { sid: s.id, status: 'error', text: model.reason === 'unsafe-print' ? 'The print payload was refused because it carried credentials.' : `Blank questionnaire unavailable (${redact(model.reason)}).` }; app.querySelector('#print-status').textContent = state.print.text; return; }
    // P2 (Auditor c5721040053): the loaded model is cached keyed to the exact entity data it came from, so a later repaint of
    // the SAME survey with the SAME survey-set data can replay it without a read; anything else drops it (see paint()).
    state.print = { aid, sid: s.id, epoch, status: 'ready', model };
    replayPrint(model);
  };
}
function context(current) {
  // Reference shape (showcase context(), SOURCE-MAP): the ONE current workspace's projects with nested assessments. Projects the
  // identity holds a role on but that sit outside this workspace are reachable from All projects, not listed here. Fallbacks:
  // project without a workspace, or workspace not visible → that project alone; no project role → "Granted to you" (A6).
  const curProj = current && state.projects.find(p => p.id === current.assessment.project_id);
  const ws = curProj?.workspace_id ? state.workspaces.get(curProj.workspace_id) : null;
  const listed = current ? (ws ? state.projects.filter(p => ws.projects.includes(p.id)) : (curProj ? [curProj] : [])) : state.projects;
  const projects = listed.map(p => {
    const l = listFor(p.id);
    const isCurrent = current?.assessment.project_id === p.id;
    const open = isCurrent || state.openProjects.has(p.id);
    const body = !open ? '' : l.status === 'loaded' ? (l.list.map(x => `<a class="assessment-link" href="#assessment/${encodeURIComponent(x.id)}" ${current && x.id === current.assessment.id ? 'aria-current="page"' : ''}>${esc(x.name)}<small>${stageLabel(x.stage)}</small></a>`).join('') || '<p class="small muted" style="margin:4px 0 0 18px">No assessments yet.</p>')
      : l.status === 'refused' ? '<p class="small muted" style="margin:4px 0 0 18px">Not listed: you have no role on this project.</p>'
      : l.status === 'failed' ? `<p class="small muted" style="margin:4px 0 0 18px" role="alert">Could not load assessments. <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>`
      : l.status === 'unauthenticated' ? `<p class="small muted" style="margin:4px 0 0 18px" role="alert">Your sign-in is no longer active. ${SIGNIN} or <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : '<p class="small muted" style="margin:4px 0 0 18px">Loading…</p>';
    // Readable at any tree size: every project is a <details>; only the current one (or ones the reader opened) is expanded.
    return `<details class="context-project" ${open ? 'open' : ''}><summary class="project-name" data-project="${esc(p.id)}">${esc(p.name)}${isCurrent ? '' : `<small>${l.status === 'loaded' ? `${l.list.length} assessment${l.list.length === 1 ? '' : 's'}` : ''}</small>`}</summary>${open ? body : ''}</details>`;
  }).join('');
  // Direct assessment grant without a project role: the open assessment is listed under its own heading, truthfully.
  const direct = current && !state.projects.some(p => p.id === current.assessment.project_id) ? `<div class="context-project"><span class="project-name">Granted to you</span><a class="assessment-link" href="#assessment/${encodeURIComponent(current.assessment.id)}" aria-current="page">${esc(current.assessment.name)}<small>${stageLabel(current.assessment.stage)} · ${esc(current.assessment.role)}</small></a><p class="small muted" style="margin:4px 0 0 18px">You hold this assessment directly; its project is not listed because you have no role on it.</p></div>` : '';
  // Notion-style context: the scope chain above (Workspaces › Projects › this project), siblings at this level below.
  const proj = current && state.projects.find(p => p.id === current.assessment.project_id);
  const chain = `<nav class="crumbs" aria-label="Scope"><a href="${cards.routes.workspaces}">Workspaces</a><span>›</span><a href="${cards.routes.projects}">Projects</a>${proj ? `<span>›</span><a href="${cards.routes.project(proj.id)}">${esc(proj.name)}</a>` : ''}</nav>`;
  const wsHead = ws ? `<a class="project-name" href="${cards.routes.workspace(ws.id)}" style="padding-left:0">${esc(ws.name)}</a>` : '';
  const narrowOpen = typeof matchMedia === 'function' && matchMedia('(max-width:650px)').matches ? '' : 'open';
  const where = [ws?.name, proj?.name, current?.assessment.name].filter(Boolean).map(esc).join(' › ') || 'Workspaces';
  // ≤650px: the whole context collapses into one disclosure (summary = where you are); wider: summary hidden, always open. Links unchanged.
  return `<aside class="context-panel"><details class="context-disclosure" ${narrowOpen}><summary><span class="eyebrow" style="margin:0">Context</span><span class="small">${where}</span></summary>${chain}${wsHead}<p class="eyebrow">${ws ? 'Projects in this workspace' : 'Projects'}</p><nav aria-label="Project and assessment navigation">${direct}${projects || (direct ? '' : '<p class="small muted">No project on this account.</p>')}</nav><div class="line links">${state.projects.length ? `<a href="${cards.routes.projects}">All projects</a>` : ''}<a href="${cards.routes.workspaces}">Workspaces</a></div></details></aside><section class="assessment-body">`;
}
// AMEND 2 (Auditor c5719472446): stage change is not wired, so the phase strip is a non-interactive indicator — no links, no buttons.
function stages(a) { return `<div class="tabs" role="list" aria-label="Assessment stages">${PHASES.map(p => `<span role="listitem" ${p === a.stage ? 'aria-current="step"' : ''}>${title(p)}</span>`).join('')}</div>`; }
function lensRows(current) {
  const mayEdit = current.assessment.role === 'owner' || current.assessment.role === 'member';
  return groupByLens({ surveys: current.surveys, templates: state.templates || [] }).map(g => {
    const included = g.included.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3>${esc(s.template_name)}</h3><p class="small muted">v${esc(s.template_version)} · collection ${esc(s.collection_status)}</p></div>${mayEdit ? `<button class="quiet" data-remove="${esc(s.id)}" ${state.busy || state.dirty.has(current.assessment.id) ? 'disabled' : ''}>Remove from assessment</button>` : ''}</div>`).join('');
    const archivedFor = t => current.surveys.find(s => s.template_id === t.id && s.template_version === t.version && s.state === 'archived');
    const available = mayEdit ? g.available.map(t => { const ar = archivedFor(t); return `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}" style="opacity:.35"></span><div><h3 class="muted" style="font-weight:500">${esc(t.name)}</h3><p class="small muted">v${esc(t.version)} · ${ar ? `Removed · Include again restores it${ar.preserved_responses != null ? ` (${esc(ar.preserved_responses)} response${ar.preserved_responses === 1 ? '' : 's'} preserved)` : ''}` : 'not included'}</p></div><button data-include="${esc(t.id)}" data-version="${esc(t.version)}" ${state.busy || state.dirty.has(current.assessment.id) ? 'disabled' : ''}>${ar ? 'Include again' : 'Include'}</button></div>`; }).join('') : '';
    return `<section aria-label="${esc(g.lens)}"><h3 style="margin:18px 0 6px">${esc(g.lens)} <span class="small muted">· ${g.included.length} included</span></h3>${included || '<p class="small muted">No survey included for this lens yet.</p>'}${available}</section>`;
  }).join('');
}
// View tabs (showcase `tabs()`): links between the five views of ONE assessment. Selecting a tab never calls set_stage.
function viewTabs(a, current) { const vs = (a.role === 'owner' || a.role === 'member') ? VIEWS : VIEWS.filter(v => v !== 'permissions'); return `<nav class="tabs view-tabs" aria-label="Assessment views">${vs.map(v => `<a href="${cards.routes.assessment(a.id, v)}" ${v === current ? 'aria-current="page"' : ''}>${title(v)}</a>`).join('')}</nav>`; }
// Prepare view (showcase `prepareView()`): name + purpose, saved through cap.assessment.update (O/M); viewers read.
function prepareView(current) {
  const a = current.assessment, mayEdit = a.role === 'owner' || a.role === 'member';
  const fields = `<label class="field">Assessment name<input name="name" maxlength="100" required value="${esc(a.name)}" ${mayEdit ? '' : 'readonly'}></label><label class="field">Purpose<textarea name="purpose" maxlength="600" ${mayEdit ? '' : 'readonly'}>${esc(a.purpose || '')}</textarea></label>`;
  const form = mayEdit ? `<form id="prepare-form">${fields}<div class="actions"><button class="primary" type="submit" ${state.busy ? 'disabled' : ''}>Save preparation</button></div></form>` : `<div>${fields}<p class="small muted">Your role here is ${esc(a.role)}: preparation is read-only.</p></div>`;
  const i = PHASES.indexOf(a.stage), prev = PHASES[i - 1], next = PHASES[i + 1], n = activeSurveys(current).length;
  const move = mayEdit ? `<div class="actions">${prev ? `<button type="button" data-stage="${prev}" ${state.busy ? 'disabled' : ''}>← Back to ${title(prev)}</button>` : ''}${next ? `<button type="button" class="primary" data-stage="${next}" ${state.busy ? 'disabled' : ''}>Move to ${title(next)} →</button>` : ''}</div><p class="small muted">One stage at a time, as the server allows. Moving into Collect opens collection; moving out of Collect closes it — for all ${n} included survey${n === 1 ? '' : 's'}.</p>` : '';
  const stage = `<aside class="panel"><p class="eyebrow">Stage</p><h2>${stageLabel(a.stage)}</h2><p class="muted">The stage is the assessment's own state. Browsing these views never changes it.</p>${move}${a.language_id ? `<p class="small muted">Language: ${esc(a.language_id)}</p>` : ''}${a.period ? `<p class="small muted">Period: ${esc(a.period)}</p>` : ''}</aside>`;
  return `<div class="grid"><section class="panel"><h2>Prepare this assessment</h2>${form}</section>${stage}</div>`;
}
function screen(current, view = null) {
  const a = current.assessment, project = state.projects.find(p => p.id === a.project_id);
  const tab = view || (VIEWS.includes(a.stage) ? a.stage : 'prepare');
  const head = `<div class="title"><div><p class="eyebrow">Assessment</p><h1>${esc(a.name)}</h1><p class="muted" style="margin:0">${esc(project?.name || a.project_id)} · your role: ${esc(a.role)}${a.role === 'viewer' ? ' — you can read this assessment; including surveys, printing, stage moves and permissions are owner/member actions' : ''}</p></div><span class="badge">${stageLabel(a.stage)}</span></div>${viewTabs(a, tab)}`; // one strip, as the reference: the stage lives in the badge + Prepare's Stage panel
  if (tab === 'prepare') return head + prepareView(current);
  if (tab !== 'collect') return head + `<div id="view-root" data-view="${tab}"><p class="muted">Loading…</p></div>`;
  return head + collectScreen(current);
}
function collectScreen(current) {
  const surveySet = `<aside class="panel"><p class="eyebrow">Survey set</p><h2>Three lenses</h2><p class="muted">${(current.assessment.role === 'owner' || current.assessment.role === 'member') ? 'Within each lens, choose which surveys this assessment includes.' : 'Your role here is ' + esc(current.assessment.role) + ': you can see the survey set; changing it needs a member or owner role.'} Including a survey while the stage is Collect opens collection at once. Removing a survey that already has responses, codes or invitations archives it and keeps them; including that survey again restores it together with what was collected.${state.templates ? '' : ' Template catalogue not loaded.'}</p>${lensRows(current)}${dirtyBanner(current.assessment.id)}<p class="status" role="${showMessage(current)?.alert ? 'alert' : 'status'}" aria-live="polite">${esc(showMessage(current)?.text || '')}</p></aside>`;
  const left = collectPanel(current);
  return `<div class="grid start">${left}${surveySet}</div>`; // content-height alignment: an empty Collect panel never stretches to the survey-set height
}
function projectsView() {
  if (!state.projects.length) return `<div class="narrow panel"><p class="eyebrow">Your projects</p><h1>No project on this account</h1><p class="muted">This screen lists projects you hold a role on. An assessment you were granted directly, without a project role, is not listed here yet; the current workspace still opens it.</p></div>`;
  return `<div class="title"><div><p class="eyebrow">Your projects</p><h1>Choose an assessment</h1></div></div><div class="project-grid">${state.projects.map(p => { const l = listFor(p.id); return `<div class="panel project-card"><p class="eyebrow">Project</p><h2>${esc(p.name)}</h2>${l.status === 'loaded' ? (l.list.length ? `<div class="links">${l.list.map(x => `<a href="#assessment/${encodeURIComponent(x.id)}">${esc(x.name)} <span class="small muted">· ${stageLabel(x.stage)}</span></a>`).join('')}</div>` : '<p class="small muted">No assessments yet.</p>') : l.status === 'failed' ? `<p class="small muted" role="alert">Could not load assessments. <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : l.status === 'unauthenticated' ? `<p class="small muted" role="alert">Your sign-in is no longer active. ${SIGNIN} or <a href="#" data-retry-list="${esc(p.id)}">Retry</a></p>` : l.status === 'refused' ? '<p class="small muted">Not listed: you have no role on this project.</p>' : `<a href="#" class="small" data-project="${esc(p.id)}">Show assessments</a>`}</div>`; }).join('')}</div>`;
}
function bind(current) {
  app.querySelectorAll('[data-project]').forEach(el => el.onclick = async e => { e.preventDefault(); const pid = el.dataset.project; if (state.openProjects.has(pid)) { state.openProjects.delete(pid); if (state.current) paint(); else render(); return; } state.openProjects.add(pid); await assessmentsFor(pid, { retry: listFor(pid).status !== 'refused' }); render(); });
  app.querySelectorAll('[data-retry-list]').forEach(el => el.onclick = async e => { e.preventDefault(); await assessmentsFor(el.dataset.retryList, { retry: true }); render(); });
  if (!current) return;
  const aid = current.assessment.id;
  app.querySelectorAll('[data-refresh]').forEach(el => el.onclick = e => { e.preventDefault(); render(); });
  bindCounts(current);
  app.querySelectorAll('[data-include]').forEach(b => b.onclick = () => act(aid, 'Including survey…', async () => { const restoring = b.textContent.trim() === 'Include again'; const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys`, { method: 'POST', body: { template_id: b.dataset.include, version: Number(b.dataset.version) } }); return `${restoring ? 'Survey restored with what was collected' : 'Survey included'}; collection ${r.survey?.collection_status || 'status unknown'}.`; }));
  app.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => act(aid, 'Removing survey…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(b.dataset.remove)}`, { method: 'DELETE' }); return r.archived ? `Survey archived: ${r.preserved_responses} response(s), ${r.preserved_codes} code(s), ${r.preserved_invitations} invitation(s) kept. Collection is closed for it; including it again restores it.` : 'Survey removed from this assessment; nothing had been collected for it.'; }));
}
// Share card binding: model keyed to (aid, sid, epoch) and cleared with identity; repaint of the card only (no network in paint).
function bindShare(current, s) {
  const root = app.querySelector('#share-root'); if (!root) return;
  const model = share.shareFor(state, current.assessment.id, s.id, epoch);
  const ctx = { esc, enc: encodeURIComponent };
  const onChange = () => { root.innerHTML = share.render(ctx, { current, survey: s, share: model }); share.bind(ctx, root, { current, survey: s, share: model, api, onChange }); };
  share.bind(ctx, root, { current, survey: s, share: model, api, onChange });
}
function bindPrepare(current) {
  const aid = current.assessment.id, n = activeSurveys(current).length;
  app.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => {
    const to = b.dataset.stage, effect = to === 'collect' ? `opens collection for ${n} included survey${n === 1 ? '' : 's'}` : current.assessment.stage === 'collect' ? `closes collection for ${n} included survey${n === 1 ? '' : 's'}` : 'does not change collection';
    if (!window.confirm(`Move this assessment from ${stageLabel(current.assessment.stage)} to ${stageLabel(to)}? This ${effect}.`)) return;
    act(aid, 'Moving stage…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/stage`, { method: 'POST', body: { stage: to } }); return `Stage is now ${stageLabel(r.assessment.stage)}.`; }); // refusal: act() shows the server error.message verbatim
  });
  const f = app.querySelector('#prepare-form'); if (!f) return;
  f.onsubmit = e => { e.preventDefault(); const fd = new FormData(f); act(current.assessment.id, 'Saving preparation…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(current.assessment.id)}`, { method: 'PATCH', body: { name: String(fd.get('name')).trim(), purpose: String(fd.get('purpose')).trim() } }); return `Saved: ${r.assessment.name}`; }); };
}
// Transition: write → (committed ⇒ dirty) → refresh → (landed ⇒ clean). Every outcome is scoped to `aid`, never to
// whatever is on screen when the promise settles (Bugbot 4040525117 / 4040525128).
async function act(aid, label, fn) {
  if (state.busy) return;
  if (state.dirty.has(aid)) { state.message = { aid, text: state.dirty.get(aid) === 'write' ? 'Your last change is saved but this screen is not refreshed yet. Refresh before making more changes.' : 'This assessment changed on the server. Refresh before making changes.', alert: true }; paint(); return; } // never silent (MED 4040990777)
  const identity = identityGeneration;
  state.busy = true; state.message = null; note.textContent = label; render();
  let text = null;
  try { text = await fn(); if (identity !== identityGeneration) return; state.dirty.set(aid, 'write'); state.message = { aid, text, alert: false }; }
  catch (e) { if (identity === identityGeneration) state.message = { aid, text: redact(e.message), alert: true }; }
  finally { if (identity === identityGeneration) { note.textContent = ''; state.busy = false; render(); } }
}
// The entity read. Returns the data; the caller decides whether it is still wanted. On success for `aid` the dirty
// mark is cleared because the screen now reflects the committed server state.
// Workspace tree read for the sidebar: one call per workspace id, cached; refusal/failure → tree unavailable (project-only fallback).
async function workspaceFor(pid) {
  const p = state.projects.find(x => x.id === pid); const wid = p?.workspace_id; if (!wid) return null;
  const identity = identityGeneration;
  if (!state.workspaces.has(wid)) { try { const r = await api(`/v2/workspaces/${encodeURIComponent(wid)}`); if (identity !== identityGeneration) return null; state.workspaces.set(wid, { id: wid, name: r.workspace.name, projects: (r.projects || []).map(x => x.id) }); } catch { return null; } }
  return state.workspaces.get(wid);
}
async function fetchAssessment(aid) {
  const r = await api(`/v2/assessments/${encodeURIComponent(aid)}`);
  if (!state.templates) { try { state.templates = (await api('/v2/templates')).templates || []; } catch { state.templates = null; } }
  await assessmentsFor(r.assessment.project_id); await workspaceFor(r.assessment.project_id);
  return { assessment: r.assessment, surveys: r.surveys || [] };
}
async function render() {
  const gen = ++generation, r = route(location.hash);
  if (r.kind === 'assessment' || r.kind === 'survey') {
    const aid = r.id;
    if (state.current?.assessment.id !== aid || state.dirty.has(aid)) {
      try { const data = await fetchAssessment(aid); if (gen !== generation) return; state.current = data; epoch += 1; state.dirty.delete(aid); state.counts.clear(); state.countInflight.clear(); state.print = null; }
      catch (e) {
        if (gen !== generation) return;
        if (state.current?.assessment.id === aid) { /* dirty refresh failed: keep the last screen, keep the dirty banner (retry offered) */ }
        else { state.current = null; app.className = ''; const expired = UNAUTHENTICATED.has(String(e.code)); app.innerHTML = `<div class="narrow panel"><h1>${expired ? 'Your sign-in is no longer active' : 'Assessment unavailable'}</h1><p class="muted">${esc(redact(e.message))}</p><p>${expired ? `<a class="button primary" href="/v2/auth/access">Sign in again</a> ` : ''}<a class="button" href="#assessment/${encodeURIComponent(aid)}" data-refresh="${esc(aid)}">Try again</a> <a href="#">All projects</a></p></div>`; app.querySelector('[data-refresh]').onclick = ev => { ev.preventDefault(); render(); }; return; }
      }
    }
    if (gen !== generation || state.current?.assessment.id !== aid) return;
    paint(r, gen);
  } else {
    state.current = null; if (gen !== generation) return;
    // Scope pages (workspace, project, permissions) carry the same context sidebar as the assessment page; entry and the
    // top-level lists stand alone (showcase SOURCE-MAP: the panel is absent from public routes).
    const sidebar = state.principal && ['workspace', 'project', 'permissions'].includes(r.kind);
    app.className = sidebar ? 'workspace-layout' : '';
    if (sidebar) { app.innerHTML = context(null) + '<div id="page-root"><p class="muted">Loading…</p></div></section>'; bind(null); await runPage(pageFor(r), r, gen, app.querySelector('#page-root')); }
    else await runPage(pageFor(r), r, gen);
  }
}
// ---- scope pages + views (product overhaul): one runner for every { load, render, bind } module ----
const setToken = t => { if (demo) return; token = t || null; try { t ? sessionStorage.setItem('facilitatorToken', t) : sessionStorage.removeItem('facilitatorToken'); } catch {} resetIdentity(); boot(); };
function ctxFor(extra = {}) {
  return { api, apiFull, esc, enc: cards.enc, routes: cards.routes, cards, state, setToken, note: (text, alert = false) => { note.textContent = text || ''; note.classList.toggle('alert', !!alert); },
    go: (hash, { reload = false } = {}) => { if (location.hash === hash || reload) render(); else location.hash = hash; }, ...extra };
}
function pageFor(r) { return r.kind === 'permissions' ? views.permissions : pages[r.kind] || pages.projects; }
async function runPage(page, r, gen, root = app, extra = {}) {
  const ctx = ctxFor({ ...extra, isCurrent: () => gen === generation }), params = { ...r, aid: r.id };
  let model;
  try { model = await page.load(ctx, params); }
  catch (e) { if (gen !== generation) return; root.innerHTML = `<div class="narrow panel"><h1>${UNAUTHENTICATED.has(String(e.code)) ? 'Your sign-in is no longer active' : REFUSED.has(String(e.code)) ? 'Not visible to you' : 'Could not load this page'}</h1><p class="muted">${esc(redact(e.message))}</p><p>${UNAUTHENTICATED.has(String(e.code)) ? `<a class="button primary" href="#">Sign in</a>` : `<a class="button" href="#" data-retry-page>Retry</a>`}</p></div>`; root.querySelector('[data-retry-page]')?.addEventListener('click', ev => { ev.preventDefault(); render(); }); return; }
  if (gen !== generation) return;
  root.innerHTML = page.render(ctx, model); page.bind(ctx, root, model);
  document.title = `${r.kind === 'entry' ? 'Welcome' : title(r.kind)} · 3D Review`;
}
// Views mount inside the assessment page after paint(): the shell owns the sidebar/title/tabs, the view owns its panel.
function mountView(current, tab, gen) {
  const root = app.querySelector('#view-root'); if (!root) return;
  runPage(views[tab], { kind: tab, id: current.assessment.id, scope: 'assessments' }, gen, root, { current, refresh: async () => { state.dirty.set(current.assessment.id, 'write'); await render(); } });
}
// Pure replay from the cached model: renderBlankPrint draws the preview + Print button (printing mounts a .stage-print-only
// child DIRECTLY on <body>, Auditor 2A-1); the status line is derived from the model, never from the previous DOM.
function replayPrint(model) {
  renderBlankPrint(document, app.querySelector('#print-root'), model, { paper: 'a4' });
  app.querySelector('#print-status').textContent = `${model.items.length} questions ready. Use Print below.`;
}
// P2 keep test: the cached paper survives a repaint only for the same survey route, the same assessment, the same survey-set
// data (epoch) and a role that still allows printing — read from state.current after any refetch, not from the DOM.
function keepPrint(r) {
  const p = state.print;
  return !!p && p.status === 'ready' && r.kind === 'survey' && p.aid === state.current.assessment.id && p.sid === r.sid && p.epoch === epoch && printAllowed(state.current.assessment.role);
}
// paint(): the DOM from state only — no network. Every rebuild resets per-paint UI state (print preview) and re-derives
// disabled/banner/message from dirty + cached counts, so a state change never leaves controls looking live (MED 4040990777).
function paint(r = route(location.hash), gen = generation) {
  if (!state.current || (r.kind !== 'assessment' && r.kind !== 'survey') || state.current.assessment.id !== r.id) return;
  if (!keepPrint(r)) state.print = null;
  app.className = 'workspace-layout';
  if (r.kind === 'survey') {
    const s = activeSurveys(state.current).find(x => x.id === r.sid);
    app.innerHTML = context(state.current) + (s ? surveyScreen(state.current, s) : surveyUnavailable(r.id, r.sid)) + '</section>';
    // `only` FILTERS the child paint to its own survey; it never forces (settled/in-flight guard intact; only Retry re-reads).
    bind(state.current); if (s) { bindShare(state.current, s); bindPrint(state.current, s); loadCounts(state.current, { only: s.id }); if (state.print && s.id === state.print.sid) replayPrint(state.print.model); }
    document.title = `${s ? s.template_name + ' · ' : ''}${state.current.assessment.name} · 3D Review`;
  } else {
    // A1 precedence: route hash > recalled tab (`stage-tab:<aid>`, stage ids only) > server stage. Permissions is a peer tab but is never
    // written to the recall key (rememberTab rejects non-stage ids) and never carries data-stage, so compositionState never sees it.
    const a0 = state.current.assessment;
    const tab = r.view || recalledTab(tabStorage, a0.id, VIEWS.includes(a0.stage) ? a0.stage : 'prepare');
    if (r.view) rememberTab(tabStorage, a0.id, r.view);
    app.innerHTML = context(state.current) + screen(state.current, tab) + '</section>'; bind(state.current); if (tab === 'collect') loadCounts(state.current);
    bindPrepare(state.current); mountView(state.current, tab, gen);
    document.title = `${title(tab)} · ${state.current.assessment.name} · 3D Review`;
  }
}
// Root entry switch (A7): `/` is the product shell. Hashes the legacy surface owns are forwarded to `/legacy/` unrendered —
// `#survey=` uses the dedicated participant page; `#invite=` (acceptance; Auth A13), `#participant`, `#facilitator`, `#workspace`, `#reports-card`,
// `#evidence`. `#session=` is the Access return leg (src/index.ts:138, callback unchanged): consumed here exactly as legacy does —
// same `facilitatorToken` key, stripped from history before any render, never echoed. Nothing else stores a credential.
const LEGACY_HASHES = new Set(['#facilitator', '#workspace', '#evidence']);
// Returns 'forwarded' (this page is leaving), 'session' (a session was consumed — identity must be re-observed), or null.
// Runs on load AND on every hashchange (Auditor S1): fragment-only navigation after load takes the same path as a fresh load.
function scrubCredentialHash() {
  const h = location.hash || '';
  if (demo) { if (/^#(?:session|invite|survey)=/.test(h) || route(h).kind === 'entry') history.replaceState(null, '', location.pathname + '?demo=1#assessment/demo-assessment/prepare'); return null; }
  if (h === '#how' || h === '#example') { location.replace('/?demo=1#assessment/demo-assessment/prepare'); return 'forwarded'; }
  if (h === '#participant') { location.replace('/legacy/#participant'); return 'forwarded'; }
  if (h === '#reports-card') { location.replace('/#projects'); return 'forwarded'; }
  if (/^#survey=/.test(h)) { try { history.replaceState(null, '', location.pathname); } catch {} location.replace('/participate/' + h); return 'forwarded'; }
  if (/^#invite=/.test(h) || LEGACY_HASHES.has(h)) { try { history.replaceState(null, '', location.pathname); } catch {} location.replace('/legacy/' + h); return 'forwarded'; }
  const m = /^#session=([A-Za-z0-9_]+)$/.exec(h);
  if (m) { try { history.replaceState(null, '', location.pathname + '#workspaces'); } catch {} token = m[1]; try { sessionStorage.setItem('facilitatorToken', m[1]); } catch {} resetIdentity(); return 'session'; }
  if (/^#session=/.test(h)) { try { history.replaceState(null, '', location.pathname); } catch {} } // malformed: drop, never render
  return null;
}
function resetIdentity() {
  identityGeneration += 1; generation += 1; epoch += 1;
  state.share = null; state.principal = null; state.projects = []; state.current = null; state.templates = null;
  state.openProjects.clear(); state.lists.clear(); state.workspaces.clear(); state.inflight.clear(); state.seq.clear();
  state.counts.clear(); state.countInflight.clear(); state.dirty.clear(); state.message = null; state.print = null; state.busy = false;
  if (app) app.innerHTML = ''; if (note) note.textContent = ''; if (who) who.textContent = 'Checking session…';
  for (const id of ['legacy-link', 'whats-here-wrap']) { const el = document.getElementById(id); if (el) el.hidden = true; }
}
function syncContextDisclosure(event) {
  if (!event.matches) { const disclosure = app?.querySelector('.context-disclosure'); if (disclosure) disclosure.open = true; }
}
if (typeof matchMedia === 'function') matchMedia('(max-width:650px)').addEventListener('change', syncContextDisclosure);
let listening = false;
function listen() { if (listening) return; listening = true; window.addEventListener('hashchange', () => { const r = scrubCredentialHash(); if (r === 'forwarded') return; if (r === 'session') { boot(); return; } render(); window.scrollTo(0, 0); }); } // S1: listener path == load path
async function boot() {
  if (scrubCredentialHash() === 'forwarded') return; // 'session' falls through: identity is observed fresh below
  if (demo && !document.getElementById('demo-notice')) { const banner = document.createElement('section'); banner.id = 'demo-notice'; banner.className = 'panel'; banner.innerHTML = '<strong>Explore the real app · demonstration data</strong><p>These are the same screens used for assessments. Viewer access: nothing is sent or saved. Source-pinned synthetic responses and report; no real people.</p><a class="button" href="/participate/?demo=1">Try the sample survey</a> <a class="button" href="/">Close tour</a>'; const samples = document.createElement('p'); samples.append('Inspect a synthetic response in the real survey review: '); for (const sample of sampleResponses) { const link = document.createElement('a'); link.href = `/participate/?demo=1&survey=${sample.survey}&response=1`; link.textContent = `${sample.name} (${sample.count} responses) · `; samples.append(link); } banner.append(samples); app.before(banner); }
  const identity = identityGeneration;
  try { const me = await api('/v2/me'); if (identity !== identityGeneration) return; state.principal = me.principal; }
  catch {
    if (identity !== identityGeneration) return;
    // Public entry: the welcome/tour/example/survey-code/sign-in page needs no session; every other route asks to sign in.
    listen();
    if (route(location.hash).kind === 'entry') { who.textContent = 'Not signed in'; app.className = ''; await render(); return; }
    // Real sign-in only (captain: synthetic-only sign-in rejected). /v2/auth/access is the existing Cloudflare email-code
    // route; it sets the session cookie and returns to the workspace home (/#session=…), not here — stated, not hidden.
    who.textContent = 'Not signed in'; app.className = '';
    const here = /(invite|session)=/.test(location.hash) ? location.pathname : location.pathname + location.hash;
    app.innerHTML = `<div class="narrow panel"><h1>Sign in to open this page</h1><p class="muted">Sign in first, then open this address again:</p><p><code>${esc(here)}</code></p><p><a class="button primary" href="#">Go to sign in</a> <a class="button" href="/v2/auth/access">Sign in with an email code</a></p></div>`;
    return; }
  who.textContent = `${state.principal.kind} · ${state.principal.id}`;
  // E1: signed-in staff get the real-app way back (same-origin session, no token) and the generated functionality statement.
  const back = document.getElementById('legacy-link'); if (back) back.hidden = true;
  const wh = document.getElementById('whats-here'); if (wh) { wh.textContent = whatsHere(); const wrap = document.getElementById('whats-here-wrap'); if (wrap) wrap.hidden = false; else wh.hidden = false; }
  // A12 (R1/I1): a transient failure here renders a retryable message, never a blank page.
  try { const result = await api('/v2/projects'); if (identity !== identityGeneration) return; state.projects = result.projects || []; }
  catch (e) { if (identity !== identityGeneration) return; // Auth A14: a direct #assessment/<id> still renders under "Granted to you"; the project list failure is a retryable notice, not a dead end.
    state.projects = []; note.innerHTML = `Could not load your project list (${esc(redact(e.message))}). <a href="#" data-retry-boot>Retry</a>`; note.querySelector('[data-retry-boot]').onclick = ev => { ev.preventDefault(); note.textContent = ''; boot(); };
    if (route(location.hash).kind !== 'assessment' && route(location.hash).kind !== 'survey') { app.innerHTML = `<div class="narrow panel"><h1>Could not load projects</h1><p class="muted">${esc(redact(e.message))}</p><p><a class="button" href="#" data-retry-boot2>Retry</a></p></div>`; app.querySelector('[data-retry-boot2]').onclick = ev => { ev.preventDefault(); boot(); }; listen(); return; } }
  listen();
  await render();
}
if (typeof window !== 'undefined' && document.getElementById('app')) boot();
