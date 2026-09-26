import { isDemo, demoApi, memoryStorage, sampleResponses } from '/demo.js';
// /assess/ — showcase-based assessment screen (cookbook #16 order c5719384228, slice 1).
// Starting page: the app-flows composition (sidebar · title · phase tabs · two-column body · lens survey rows).
// Data: existing /v2 endpoints only, same-origin session (cookie or the legacy facilitatorToken). No fictional model.
// Anything the showcase draws that this slice does not wire is omitted, never rendered as a working control.
import { redactDiagnosticPath } from '/diagnostic-path.js';
import { loadBlankPrint, renderBlankPrint, printAllowed, rememberTab, recalledTab, STAGES } from '/stage-screens.js';
import { whatsHere } from '/assess/whats-here.js';
import * as cards from '/assess/cards.js';
import { breadcrumbs } from '/v3/components/breadcrumbs.js';
import { sidebarTree } from '/v3/components/sidebar-tree.js';
// lane 9 L9-24: shared closed-by-default disclosure
import { learnMore } from '/v3/components/learn-more.js';
import { collectLine, periodText } from '/v3/components/active-until.js';
// Bincy B03: `#invite=<token>` is handled here (v3), not forwarded to /legacy/.
import { mountInvite, inviteView, INVITE_KEY, parseInvitationFragment } from '/v3/components/invite.js';
// P0 12:32: the context panel's crumb row is the shared Breadcrumbs component (Home › Workspace › Project › Assessment).
const crumbScope = (ws, proj, a) => ({ workspace: ws ? { id: ws.id, name: ws.name, href: cards.routes.workspace(ws.id) } : null, project: proj ? { id: proj.id, name: proj.name, href: cards.routes.project(proj.id) } : null, assessment: a ? { id: a.id, name: a.name, href: cards.routes.assessment(a.id) } : null });
import { pages, css as scopeCss, landsOnWork, signInLanding, whoLine } from '/assess/scope.js';
import { views, css as viewsCss } from '/assess/views.js';
import * as share from '/assess/share.js';
import { feedback } from '/assess/feedback.js';
import { mountKitRoot, shellModel, bindAccountMenu } from '/kit/app-adapter.js';
import { V3_SHELL, onePrimary, stateWord, placeDemoExit, DEMO_EXIT_HREF } from '/v3-shell.js';
import { v3StagePrimary, v3CountLine, v3StageStepper, ensureStepperStyle, v3ExpectedFor, stageMoveButton, askStageMove, deleteAssessmentButton, deleteAssessmentFlow, DELETED_NOTICE, v3CompleteLock as completeLock, V3_SUGGEST } from '/assess/v3-assessment.js';
import { mountEditableHeading } from '/v3/components/editable-heading.js';
import { showSavedStatus, undoTokenOf } from '/v3/components/saved-status.js';
// v3 lane 1 L1-2: lane 2's four-step wizard mounts at #new / #/new (NEED 2→1). Loaded on demand so the shell never breaks
// if the module is absent; destroyed on any route change.
const WIZARD_JS = '/v3/wizard.js', WIZARD_CSS = '/v3/wizard.css';
let wizardHandle = null;
const startReview = () => V3_SHELL ? '<div class="v3-shell-actions actions"><a class="rv-btn primary" data-v3-start href="#new">Start a review</a></div>' : '';
// v3 shell (lane 1): context tree removed when V3_SHELL; crumbs remain the navigation.
// Bugbot 4094071963: the kit adapter has no 'new' kind; the shell header names the wizard page (title + current link) here.
const v3Model = m => !V3_SHELL ? m : m?.context?.route === 'invite' ? { ...m, contextTree: false, title: 'Invitation', eyebrow: '', currentHref: '#invite', ancestors: [] } : m?.context?.route === 'new' ? { ...m, contextTree: false, title: 'Start a review', eyebrow: 'New review', currentHref: '#new', ancestors: [{ label: 'Projects', href: cards.routes.projects, visible: true }] } : { ...m, contextTree: false };
const PHASES = ['prepare', 'collect', 'understand', 'improve'];
// Product overhaul (cookbook #16 c5721465315): five VIEWS on one assessment page. A view is a tab; a tab never mutates stage.
const VIEWS = ['prepare', 'collect', 'understand', 'improve', 'permissions'];
const LENSES = ['Translation Team', 'Church', 'Community']; // captain's order; server `perspective` decides membership
const DOTS = { 'Translation Team': '', Church: 'blue', Community: 'gold', 'Other perspective': '' };
// K3a normal root: the kit shell is mounted ONCE around a stable content element (#rv → shell.content); the real account/version/
// link controls are MOVED into the shell's header host (same nodes, same listeners — never cloned). Without a kit root (tests,
// legacy harness) `app` is the plain #app element and nothing else changes.
const kitRoot = document.getElementById('rv');
const kit = kitRoot ? mountKitRoot(kitRoot, v3Model(shellModel({ route: route(location.hash), routes: cards.routes, principal: null })), { onNavigate: href => { if (typeof href === 'string' && href.startsWith('#')) { if (location.hash === href) render(); else location.hash = href; } } }) : null;
// Compact chrome: #account (toggle showing #who + menu holding sign-out/switch/version/feedback/roadmap) is the ONLY hosted control.
if (kit) { kit.adoptControls(document, ['account']); document.getElementById('shell-controls')?.remove(); bindAccountMenu(document); }
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width:760px)').matches;
const app = kit ? kit.content : document.getElementById('app'), who = document.getElementById('who'), note = document.getElementById('note');
// Shell sync happens only from render()/boot()/resetIdentity(): the model is derived from loaded, authorized data the controller already holds.
function syncShell(page = null) {
  if (!kit) return;
  const r = route(location.hash);
  // A workspace page has already loaded its workspace: keep it in the same identity-scoped cache workspaceFor() uses (cleared by
  // resetIdentity) so later crumbs can name it without a discovery read. Data only; never a new request.
  if (page?.kind === 'workspace' && page.model?.status === 'loaded' && page.model.workspace?.id) state.workspaces.set(page.model.workspace.id, { id: page.model.workspace.id, name: page.model.workspace.name, role: page.model.workspace.role, projects: (page.model.projects || []).map(x => x.id) });
  kit.update(v3Model(shellModel({ route: r, routes: cards.routes, principal: state.principal, known: { projects: state.projects, workspaces: state.workspaces, lists: state.lists }, current: state.current, page, contextCollapsible: narrow() })));
  placeDemoNotice(); // Bugbot 4073693755: the shell repaint preserves only its content/header hosts; the disclosure is restored by the controller
}
// Demo disclosure (Bugbot 4073693755): ONE controller-owned node, built once, placed before the content element and re-placed by the
// controller's own lifecycle (boot + every syncShell) whenever a shell repaint has detached it. The content element and the mounted
// view inside it are never touched, so form values and listeners survive; the kit gains no new lifecycle authority.
let demoNotice = null;
function placeDemoNotice() {
  if (!demo || !app) return;
  if (!demoNotice) {
    const existing = document.getElementById('demo-notice'); if (existing) demoNotice = existing;
    else { const banner = document.createElement('section'); banner.id = 'demo-notice'; banner.className = 'panel'; banner.innerHTML = '<strong>Explore the real app · demonstration data</strong><p>These are the same screens used for assessments. Viewer access: nothing is sent or saved. Source-pinned synthetic responses and report; no real people.</p><a class="button" href="/participate/?demo=1">Try the sample survey</a> <a class="button" href="/">Close tour</a>'; const samples = document.createElement('p'); samples.append('Inspect a synthetic response in the real survey review: '); for (const sample of sampleResponses) { const link = document.createElement('a'); link.href = `/participate/?demo=1&survey=${sample.survey}&response=1`; link.textContent = `${sample.name} (${sample.count} responses) · `; samples.append(link); } banner.append(samples); demoNotice = banner; }
  }
  if (!demoNotice.isConnected || demoNotice.nextElementSibling !== app) app.before(demoNotice);
  placeDemoExit(document); // CAPTAIN P0 12:10: Exit demo + Sign in on every demo screen; logo leaves demo
  // Kit-internal paints (tree expansion, search, context toggle) never call the controller; they rebuild the shell chrome and keep
  // only the content/header hosts. The controller watches its own kit root and re-places the same node the moment it is detached.
  if (kitRoot && !demoObserver && typeof MutationObserver === 'function') { demoObserver = new MutationObserver(() => { if (demoNotice && !demoNotice.isConnected && app.isConnected) app.before(demoNotice); if (!document.querySelector?.('header.top .v3-demo-exit')) placeDemoExit(document); }); demoObserver.observe(kitRoot, { childList: true, subtree: true }); }
}
let demoObserver = null;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const title = v => v.charAt(0).toUpperCase() + v.slice(1);
const stageLabel = s => (V3_SHELL && stateWord(s)) || ({ prepare: 'In preparation', collect: 'Collecting', understand: 'Understanding', improve: 'Improving' })[s] || esc(s);
// v3 one primary action per page (lane 1): after any content paint, keep the first primary in the content mount and demote the rest (class only).
if (V3_SHELL && app && typeof MutationObserver === 'function') { let queued = false; new MutationObserver(() => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; onePrimary(app); }); }).observe(app, { childList: true, subtree: true }); }
const demo = typeof location !== 'undefined' && isDemo(location.search);
// P0 12:10: a logo tap in demo always leaves demo, even if a kit repaint raced the header rewrite.
if (demo && typeof document?.addEventListener === 'function') document.addEventListener('click', e => { const b = e.target?.closest?.('header.top a.brand'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation(); location.assign(DEMO_EXIT_HREF); }, true);
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
const state = { principal: null, projects: [], workspaces: new Map(), openProjects: new Set(), lists: new Map(), inflight: new Map(), seq: new Map(), templates: null, current: null, busy: false, message: null, dirty: new Map(), counts: new Map(), countInflight: new Set(), print: null, collectLinks: new Map() };
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
  // B06: #new/<assessment id> is Home's "Continue setup" — the wizard reopens that saved draft.
  if (parts[0] === 'new' && parts[1] && !parts[2]) return { kind: 'new', id: parts[1] };
  if ((parts[0] === 'new' || (!parts[0] && parts[1] === 'new')) && !parts[2]) return { kind: 'new' };
  if (!parts[0]) return { kind: 'entry' };
  if (['how', 'example', 'signin', 'survey', 'about'].includes(parts[0]) && !parts[1]) return { kind: 'entry', intent: parts[0] };
  if (parts[0] === 'feedback' && !parts[1]) return { kind: 'feedback' };
  if (parts[0] === 'invite' && !parts[1]) return { kind: 'invite' }; // B03: token already moved out of the address bar
  if (parts[0] === 'workspaces') return { kind: 'workspaces' };
  if (parts[0] === 'workspace' && parts[1]) return { kind: 'workspace', id: parts[1] };
  if (parts[0] === 'projects') return { kind: 'projects' };
  if (parts[0] === 'project' && parts[1]) return { kind: 'project', id: parts[1] };
  if (parts[0] === 'permissions' && ['workspaces', 'projects', 'assessments'].includes(parts[1]) && parts[2]) return { kind: 'permissions', scope: parts[1], id: parts[2] };
  // Ruling 12:53: an unknown hash falls back to the public home, never to a page that shows sign-in.
  if (parts[0] !== 'assessment' || !parts[1]) return { kind: 'entry' };
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
// v3 L10-2 (prototype frame 7 `.total`): one inline line — big metric, "responses", then how many included surveys were
// counted. No denominator (ruling a: none entered here); "not yet confirmed" only if the server ever sends it (ruling b; it does not yet).
function totalTile(current) {
  const act = activeSurveys(current); const loaded = act.filter(s => countFor(s.id).status === 'loaded');
  const total = loaded.reduce((n, s) => n + countFor(s.id).responses, 0); const partial = loaded.length !== act.length;
  return `<div data-total data-collect-total style="margin:6px 0 4px"><div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><span class="count" style="margin:0;font-size:31px;font-weight:600;line-height:1">${total}</span><span>response${total === 1 ? '' : 's'}</span><span class="muted">across ${loaded.length} of ${act.length} included survey${act.length === 1 ? '' : 's'}</span>${partial ? '<span class="badge" title="Not every survey count has loaded yet">partial</span>' : ''}</div></div>`;
}
function paintCounts(current) {
  for (const s of activeSurveys(current)) { const el = app.querySelector(`[data-count="${CSS.escape(s.id)}"]`); if (el) el.outerHTML = countCell(s); }
  const t = app.querySelector('[data-total]'); if (t) t.outerHTML = totalTile(current);
  for (const s of activeSurveys(current)) { const tile = app.querySelector(`[data-tile="${CSS.escape(s.id)}"]`); if (tile) tile.outerHTML = asideTile(s); }
  for (const s of activeSurveys(current)) { const w = app.querySelector(`[data-collect-wrap="${CSS.escape(s.id)}"]`); if (w) w.innerHTML = collectCount(s); }
  bindCounts(current);
}
function bindCounts(current) {
  app.querySelectorAll('[data-retry-count]').forEach(el => el.onclick = e => { e.preventDefault(); loadCounts(state.current, { retry: el.dataset.retryCount }); paintCounts(state.current); });
  app.querySelectorAll('[data-refresh]').forEach(el => el.onclick = e => { e.preventDefault(); render(); });
}
// v3 L1-5 (NEED 3→1, Bincy 07): per-survey counts on Collect read through lane 3's v3CountLine (ruling a/b): "n of N responded"
// when the facilitator entered N in setup on this device (B-07), else "n responded" (never a denominator nobody entered) + respondents. Same data-count hook so
// paintCounts repaints it via data-collect-wrap; non-loaded states keep countCell's retry/refresh wording.
function localStore() { try { return globalThis.localStorage || null; } catch { return null; } }
function collectCount(s) {
  const c = countFor(s.id);
  if (c.status !== 'loaded') return countCell(s);
  return `<span data-count="${esc(s.id)}" data-collect-count>${v3CountLine({ responses: c.responses, expected: demo ? null : v3ExpectedFor(s.id, localStore()) }, esc)} <span aria-hidden="true">·</span> ${c.respondents} respondent${c.respondents === 1 ? '' : 's'}${collectState(c.collection_status || s.collection_status)}</span>`;
}
// v3 L10-1 (prototype frame 7 rrow): each Collect row ends with its plain state word, open / closed (PARITY C6), from the server's collection_status only.
function collectState(status) {
  if (!status) return '';
  const word = ({ open: 'open', closed: 'closed' })[status] || String(status);
  return ` <span aria-hidden="true">·</span> <span class="state" data-collect-state>${esc(word)}</span>`;
}
function lensFor(s) { return LENSES.includes(s.perspective) ? s.perspective : 'Other perspective'; }
// B36: Copy link / Show QR code per group on Collect (owner, member; open surveys). One tap issues the link through the Share
// card's API pair; the link lives in memory only, keyed to (aid, sid) and dropped with identity (state.collectLinks, U36).
function shareable(a, s) { return share.CAN_SHARE.has(a.role) && (s.collection_status === 'open' || a.stage === 'collect'); }
function bindCollectLinks(current) {
  const root = app.querySelector('[data-collect-panel]'); if (!root) return;
  const aid = current.assessment.id, ep = epoch;
  share.bindGroupLinks(root, { resolve: async sid => {
    const k = share.linkKey(aid, sid); // U36: the survey's one active link, whichever page issued it
    const link = await share.cachedLink(state.collectLinks, k, () => share.issueLink(api, { aid, sid, origin: location.origin }));
    if (ep !== epoch || state.current?.assessment.id !== aid) throw share.failure(); // a link may exist but is not shown here
    return link.url;
  } });
  // B43: "Print all" — one page, every shareable survey (title, one line, QR). Same per-survey cache as the rows: a survey
  // whose link was already issued here reuses it; the rest are issued exactly as one Copy tap would.
  const resolveAll = () => Promise.all(current.surveys.filter(s => shareable(current.assessment, s)).map(async s => {
    const k = share.linkKey(aid, s.id);
    const link = await share.cachedLink(state.collectLinks, k, () => share.issueLink(api, { aid, sid: s.id, origin: location.origin }));
    if (ep !== epoch || state.current?.assessment.id !== aid) throw share.failure();
    return { title: s.template_name, line: whoLine(lensFor(s)) || lensFor(s), url: link.url };
  }));
  share.bindPrintAll(root, { heading: current.assessment.name, items: resolveAll });
}
function collectPanel(current) {
  const a = current.assessment, groups = groupByLens({ surveys: current.surveys, templates: [] });
  const rows = groups.map(g => g.included.length ? `<h3 style="margin:18px 0 6px">${esc(g.lens)}</h3>${whoLine(g.lens) ? `<p class="small muted" data-who>${esc(whoLine(g.lens))}</p>` : ''}${g.included.map(s => `<div class="survey"><span class="dot ${DOTS[g.lens] || ''}"></span><div><h3><a href="#assessment/${encodeURIComponent(a.id)}/survey/${encodeURIComponent(s.id)}">${esc(s.template_name)}</a></h3><p class="small muted" data-collect-wrap="${esc(s.id)}">${collectCount(s)}</p>${shareable(a, s) ? share.groupLinks({ esc }, [{ key: s.id, title: s.template_name, line: whoLine(g.lens) || g.lens }]) : ''}</div><a class="button" href="#assessment/${encodeURIComponent(a.id)}/survey/${encodeURIComponent(s.id)}">Open survey</a></div>`).join('')}` : '').join('');
  return `<section class="panel" data-collect-panel><p class="eyebrow">Collect</p><h2>Collect perspectives</h2>${collectLine(a.period) ? `<p class="small muted" data-active-until>${esc(collectLine(a.period))}</p>` : ''}${totalTile(current)}${rows || '<p class="muted">No survey is included yet. Choose them under Change surveys.</p>'}${current.surveys.some(s => shareable(a, s)) ? share.printAllButton({ esc }) : ''}${learnMore('<p class="small muted">Only responses are counted.</p><p class="small muted">Respondents are counted per survey and are never added up as people.</p>')}</section>`;
}
// Cut 2A child screen: ONE survey. B30: one heading (the survey name); Paper/Share are labels, Share is the one primary. Counts for any grant; Print survey only when the API role allows it (O, M — survey.ts:76).
function surveyScreen(current, s) {
  const a = current.assessment, lens = lensFor(s), mayPrint = printAllowed(a.role);
  const back = `<a class="back" href="#assessment/${encodeURIComponent(a.id)}">← Back to ${esc(a.name)}</a>`;
  const printBlock = mayPrint ? `<section class="panel" id="print-panel"><p class="eyebrow">Paper</p><p><button id="print-load" ${state.dirty.has(a.id) ? 'disabled' : ''}>Print survey</button></p>${learnMore('<p class="small muted">A blank questionnaire with this survey\'s actual questions — nothing personal, no codes or links on the page.</p>')}<div id="print-root"></div><p class="status" role="status" aria-live="polite" id="print-status"></p></section>` : `<section class="panel"><p class="eyebrow">Paper</p><p class="muted">Printing the blank questionnaire needs a member or owner role on this assessment; your role here is ${esc(a.role)}.</p></section>`;
  return `${back}<div class="title"><div><p class="eyebrow">Survey · ${esc(lens)}</p><h1>${esc(s.template_name)}</h1><p class="muted" style="margin:0">${esc(a.name)} · v${esc(s.template_version)} · collection ${esc(s.collection_status)}</p></div><span class="badge">${countCell(s)}</span></div><div class="grid start">${printBlock}<div id="share-root">${share.render({ esc, enc: encodeURIComponent }, { current, survey: s, share: shareModel(a.id, s.id) })}</div><aside class="panel"><p class="eyebrow">This survey</p>${asideTile(s)}${dirtyBanner(a.id)}<p class="status" role="${showMessage(current)?.alert ? 'alert' : 'status'}" aria-live="polite">${esc(showMessage(current)?.text || '')}</p></aside></div>`;
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
  const chain = breadcrumbs(crumbScope(ws, proj, current?.assessment), { label: 'Scope' });
  // NEED 9→1 / ruling 12:22 (1): with a workspace in scope the sidebar is the shared Sidebar tree (component: Sidebar tree),
  // fed the SAME scope as the crumb row so the two never disagree; no workspace → the project-only fallback above stays.
  const tree = ws ? sidebarTree([{ id: ws.id, name: ws.name, href: cards.routes.workspace(ws.id), projects: listed.map(p => { const l = listFor(p.id); return { id: p.id, name: p.name, href: cards.routes.project(p.id), assessments: l.status === 'loaded' ? l.list.map(x => ({ id: x.id, name: x.name, href: cards.routes.assessment(x.id) })) : [] }; }) }], crumbScope(ws, proj, current?.assessment), { label: 'Project and assessment navigation' }) : '';
  const curList = curProj ? listFor(curProj.id) : null;
  const treeNote = !curList || curList.status === 'loaded' ? '' : curList.status === 'refused' ? '<p class="small muted">Not listed: you have no role on this project.</p>' : curList.status === 'failed' ? `<p class="small muted" role="alert">Could not load assessments. <a href="#" data-retry-list="${esc(curProj.id)}">Retry</a></p>` : curList.status === 'unauthenticated' ? `<p class="small muted" role="alert">Your sign-in is no longer active. ${SIGNIN} or <a href="#" data-retry-list="${esc(curProj.id)}">Retry</a></p>` : '<p class="small muted">Loading…</p>';
  const wsHead = ws ? `<a class="project-name" href="${cards.routes.workspace(ws.id)}" style="padding-left:0">${esc(ws.name)}</a>` : '';
  const narrowOpen = typeof matchMedia === 'function' && matchMedia('(max-width:650px)').matches ? '' : 'open';
  const where = [ws?.name, proj?.name, current?.assessment.name].filter(Boolean).map(esc).join(' › ') || 'Workspaces';
  // ≤650px: the whole context collapses into one disclosure (summary = where you are); wider: summary hidden, always open. Links unchanged.
  return `<aside class="context-panel"><details class="context-disclosure" ${narrowOpen}><summary><span class="eyebrow" style="margin:0">Context</span><span class="small">${where}</span></summary>${chain}${wsHead}<p class="eyebrow">${ws ? 'Projects in this workspace' : 'Projects'}</p>${tree ? `${tree}${treeNote}` : `<nav aria-label="Project and assessment navigation">${direct}${projects || (direct ? '' : '<p class="small muted">No project on this account.</p>')}</nav>`}<div class="line links">${state.projects.length ? `<a href="${cards.routes.projects}">All projects</a>` : ''}<a href="${cards.routes.workspaces}">Workspaces</a></div></details></aside><section class="assessment-body">`;
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
function viewTabs(a, current) { ensureStepperStyle(globalThis.document); const perm = (a.role === 'owner' || a.role === 'member') ? `<nav class="tabs view-tabs" aria-label="Assessment settings"><a href="${cards.routes.assessment(a.id, 'permissions')}" ${current === 'permissions' ? 'aria-current="page"' : ''}>Permissions</a>${deleteAssessmentButton(a.role, { disabled: state.busy }, esc)}</nav>` : ''; /* U14: owner-only Delete assessment in the assessment settings */ return v3StageStepper(a.stage, v => cards.routes.assessment(a.id, v)) + perm; } // ruling 12:28: stage tabs → shared Stepper (component: Stepper); permissions stays a separate link (lane 11 owns its placement)
// Prepare view (showcase `prepareView()`): purpose, saved through cap.assessment.update (O/M); viewers read. The name is the heading (B07).
function prepareView(current) {
  const a = current.assessment, mayEdit = a.role === 'owner' || a.role === 'member';
  const fields = `<label class="field">Purpose<textarea name="purpose" maxlength="600" ${mayEdit ? '' : 'readonly'}>${esc(a.purpose || '')}</textarea></label>`;
  const form = mayEdit ? `<form id="prepare-form">${fields}<div class="actions"><button class="primary" type="submit" ${state.busy ? 'disabled' : ''}>Save preparation</button></div></form>` : `<div>${fields}${a.complete ? '' : `<p class="small muted">Your role here is ${esc(a.role)}: preparation is read-only.</p>`}</div>`;
  const i = PHASES.indexOf(a.stage), prev = PHASES[i - 1], next = PHASES[i + 1], n = activeSurveys(current).length;
  const move = mayEdit ? `<div class="actions">${prev ? `<button type="button" data-stage="${prev}" ${state.busy ? 'disabled' : ''}>← Back to ${title(prev)}</button>` : ''}${next && a.stage !== 'collect' ? `<button type="button" data-stage="${next}" ${state.busy ? 'disabled' : ''}>Move to ${title(next)} →</button>` : ''}</div>` : ''; // lane 9 L9-24: one primary on this view (Save preparation); U34: Move to Understand lives on Collect
  // Lane 9 L9-24 (validator #282): ONE view heading ("Prepare this assessment"). The stage is an eyebrow + badge, not a second
  // heading; the collect consequence, stage notes, language and period sit behind the shared Learn more. A <section>, not an
  // <aside>: kit.css turns every `.rv aside` into a nav flex row at ≤760px (squashed/clipped at 390px).
  const more = `${mayEdit ? `<p class="muted">Moving into Collect opens collection; moving out of Collect closes it — for all ${n} included survey${n === 1 ? '' : 's'}.</p><p class="muted">One stage at a time, as the server allows.</p>` : ''}<p class="muted">The stage is the assessment's own state. Browsing these views never changes it.</p>${a.language_name ? `<p class="small muted">Language: ${esc(a.language_name)}</p>` : ''}${a.period ? `<p class="small muted">Period: ${esc(periodText(a.period))}</p>` : ''}`;
  const stage = `<section class="panel" data-stage-panel><p class="eyebrow">Stage <span class="badge">${stageLabel(a.stage)}</span></p>${move}${learnMore(more)}</section>`;
  return `<div class="grid"><section class="panel"><h2>Prepare this assessment</h2>${form}</section>${stage}</div>`;
}
function screen(current, view = null) {
  const a = current.assessment, project = state.projects.find(p => p.id === a.project_id);
  const tab = view || (VIEWS.includes(a.stage) ? a.stage : 'prepare');
  const role = a.granted_role || a.role, roleLine = project ? `${esc(project.name)} · your role: ${esc(role)}` : `Your role: ${esc(role)}`; // B03: never a raw project id (shared assessment, no project role)
  // lane 9 L9-24: the viewer explanation moves behind Learn more (roleMore)
  // Bincy B30 (lanes-2111): the stage header shows no line of its own — the role line joins the viewer note behind ONE shared
  // Learn more, so each stage keeps only its view's one short line. The stage badge and the stage primary stay up front.
  const roleMore = learnMore(`<p class="muted">${roleLine}</p>${a.role === 'viewer' && !a.complete && tab !== 'improve' ? /* Next steps carries its own role note (one, not two) */'<p class="muted">You can read this assessment; including surveys, printing, stage moves and permissions are owner/member actions.</p>' : ''}`);
  // Under the kit shell the eyebrow/h1 are the shell's (one heading); only the unique role line and stage badge remain here.
  // v3 (NEED 3→1): one state-driven primary in the headrow; viewers get none for setup/collect (lane 3 module decides).
  const primary = !V3_SHELL ? '' : tab === 'collect' && a.stage === 'collect' && (a.role === 'owner' || a.role === 'member') ? stageMoveButton('understand', 'Move to Understand', { primary: true, disabled: state.busy }, esc) /* U34: the one primary on Collect */ : v3StagePrimary(a.stage, a.role === 'owner' || a.role === 'member', v => `#assessment/${encodeURIComponent(a.id)}/${v}`, esc, { current: tab, secondary: tab === 'permissions' }); // U42: none on its own page; secondary on Permissions
  const head = kit ? `<div class="title assessment-head"><span class="badge">${stageLabel(a.stage)}</span>${primary}</div>${roleMore}${viewTabs(a, tab)}`
    : `<div class="title"><div><p class="eyebrow">Assessment</p><h1>${esc(a.name)}</h1></div><span class="badge">${stageLabel(a.stage)}</span>${primary}</div>${roleMore}${viewTabs(a, tab)}`; // one strip, as the reference: the stage lives in the badge + Prepare's Stage panel
  const done = a.complete && tab !== 'improve' ? `<p class="note" data-review-complete>${esc(V3_SUGGEST.done)}</p>` : ''; // B13: one line; Improve draws its own
  if (tab === 'prepare') return head + done + prepareView(current);
  if (tab !== 'collect') return head + done + `<div id="view-root" data-view="${tab}"><p class="muted">Loading…</p></div>`;
  return head + done + collectScreen(current);
}
function collectScreen(current) {
  // B30 (lane 9, less text 3): ONE heading on Collect. The survey set is secondary (surveys were chosen in setup): a closed
  // "Change surveys" disclosure under the Collect panel (open when nothing is included yet), its notes behind Learn more.
  // Save/refresh messages stay outside the disclosure so an outcome is never hidden.
  const a = current.assessment, editor = a.role === 'owner' || a.role === 'member', none = !activeSurveys(current).length;
  const setMore = learnMore(`<p class="small muted">Including a survey while the stage is Collect opens collection at once.</p><p class="small muted">Removing a survey that already has responses, codes or invitations archives it and keeps them.</p><p class="small muted">Including that survey again restores it together with what was collected.</p>`);
  const surveySet = `<details class="panel survey-set" data-survey-set${none || state.surveySetOpen === a.id ? ' open' : ''}><summary>${editor ? 'Change surveys' : 'Surveys in this assessment'}</summary><p class="muted">${editor ? 'Within each lens, choose which surveys this assessment includes.' : a.complete ? 'The surveys in this review.' : 'Changing the surveys needs a member or owner role.'}${state.templates ? '' : ' Template catalogue not loaded.'}</p>${lensRows(current)}${setMore}</details>`;
  const outcome = `${dirtyBanner(a.id)}<p class="status" role="${showMessage(current)?.alert ? 'alert' : 'status'}" aria-live="polite">${esc(showMessage(current)?.text || '')}</p>`;
  return `<div class="stack">${collectPanel(current)}${outcome}${surveySet}</div>`; // one column: the Collect panel is the screen
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
  // B30 (Bugbot 4108407845): the survey set stays open across include/remove repaints. Recorded from the rendered state (an
  // auto-open fires no reliable toggle), from user toggles on the live node only (a replaced node may fire a stale toggle),
  // and on every include/remove click.
  const set = app.querySelector('[data-survey-set]');
  if (set?.open) state.surveySetOpen = aid;
  set?.addEventListener('toggle', e => { if (e.currentTarget.isConnected) state.surveySetOpen = e.currentTarget.open ? aid : null; });
  set?.querySelectorAll('[data-include],[data-remove]').forEach(b => b.addEventListener('click', () => { state.surveySetOpen = aid; }));
  app.querySelectorAll('[data-refresh]').forEach(el => el.onclick = e => { e.preventDefault(); render(); });
  bindCounts(current);
  // U14 (J5): owner-only delete — dry run, one-sentence impact asked in the page, execute, land on the project with a notice.
  const del = app.querySelector('[data-delete-assessment]');
  if (del) del.onclick = () => { if (state.busy) return; const pid = current.assessment.project_id, refuse = text => { state.message = { aid, text, alert: true }; paint(); };
    deleteAssessmentFlow(del, { id: aid, api, ask: askStageMove, onRefused: refuse, onError: e => refuse(redact(e.message)),
      onDeleted: () => { state.lists.delete(pid); state.dirty.delete(aid); state.message = null; pendingNotice = DELETED_NOTICE; location.hash = cards.routes.project(pid); } }); };
  app.querySelectorAll('[data-include]').forEach(b => b.onclick = () => act(aid, 'Including survey…', async () => { const restoring = b.textContent.trim() === 'Include again'; const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys`, { method: 'POST', body: { template_id: b.dataset.include, version: Number(b.dataset.version) } }); return `${restoring ? 'Survey restored with what was collected' : 'Survey included'}; collection ${r.survey?.collection_status || 'status unknown'}.`; }));
  app.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => act(aid, 'Removing survey…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/surveys/${encodeURIComponent(b.dataset.remove)}`, { method: 'DELETE' }); return r.archived ? `Survey archived: ${r.preserved_responses} response(s), ${r.preserved_codes} code(s), ${r.preserved_invitations} invitation(s) kept. Collection is closed for it; including it again restores it.` : 'Survey removed from this assessment; nothing had been collected for it.'; }));
}
// Share card binding: model keyed to (aid, sid, epoch) and cleared with identity; repaint of the card only (no network in paint).
function currentShareRoute() {
  const r = route(location.hash), model = state.share;
  if (model && (r.kind !== 'survey' || r.id !== model.aid || r.sid !== model.sid || epoch !== model.epoch)) state.share = null;
  return state.share;
}
// U36: the Share card starts from the survey's active link already issued on this page load (launch, Collect or an earlier visit), if any.
function shareModel(aid, sid) {
  const m = share.shareFor(state, aid, sid, epoch), known = share.knownLink(state.collectLinks, share.linkKey(aid, sid));
  if (!m.link && known && m.stage !== 'busy') { m.link = known; m.stage = 'linked'; }
  return m;
}
function bindShare(current, s) {
  const root = app.querySelector('#share-root'); if (!root) return;
  const model = shareModel(current.assessment.id, s.id), linkKey = share.linkKey(current.assessment.id, s.id);
  const ctx = { esc, enc: encodeURIComponent, isCurrent: () => currentShareRoute() === model };
  const onChange = () => { const el = app.querySelector('#share-root'); if (!el) return; el.innerHTML = share.render(ctx, { current, survey: s, share: model }); share.bind(ctx, el, { current, survey: s, share: model, api, apiFull, onChange, links: state.collectLinks, linkKey }); };
  share.bind(ctx, root, { current, survey: s, share: model, api, apiFull, onChange, links: state.collectLinks, linkKey });
}
function bindPrepare(current) {
  const aid = current.assessment.id, n = activeSurveys(current).length;
  app.querySelectorAll('button[data-stage]').forEach(b => b.onclick = () => {
    const to = b.dataset.stage, effect = to === 'collect' ? `opens collection for ${n} included survey${n === 1 ? '' : 's'}` : current.assessment.stage === 'collect' ? `closes collection for ${n} included survey${n === 1 ? '' : 's'}` : 'does not change collection';
    // U34: asked in the page (shared Review gate confirm), never window.confirm.
    askStageMove(b, `Move this assessment from ${stageLabel(current.assessment.stage)} to ${stageLabel(to)}? This ${effect}.`, `Move to ${title(to)}`, () =>
      act(aid, 'Moving stage…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(aid)}/stage`, { method: 'POST', body: { stage: to } }); return `Stage is now ${stageLabel(r.assessment.stage)}.`; })); // refusal: act() shows the server error.message verbatim
  });
  const f = app.querySelector('#prepare-form'); if (!f) return;
  f.onsubmit = e => { e.preventDefault(); const fd = new FormData(f); act(current.assessment.id, 'Saving preparation…', async () => { const r = await api(`/v2/assessments/${encodeURIComponent(current.assessment.id)}`, { method: 'PATCH', body: { purpose: String(fd.get('purpose')).trim() } }); return `Saved: ${r.assessment.name}`; }); };
}
// B07: the assessment name is the heading (shell's or page's); owners/members rename it in place through cap.assessment.update.
let pendingRename = null; // { aid, done } while a heading rename PATCH is in flight
function bindNameHeading(current) {
  const a = current.assessment, h1 = (app.closest('[role=main]') || app).querySelector('h1');
  // One place that shows a committed name (heading, crumb, tab title, cached list); used by the rename and by its Undo (U17).
  const showName = (next, old) => {
    const listed = state.lists.get(a.project_id)?.list?.find?.(x => x.id === a.id); if (listed) listed.name = next;
    if (state.current?.assessment.id !== a.id) return false;
    state.current.assessment.name = next;
    return true;
  };
  const inPlace = (next, old) => {
    const parts = document.title.split(' · '); if (parts.length === 3 && parts[1] === old) document.title = [parts[0], next, parts[2]].join(' · '); // paint()'s `<tab> · <name> · 3D Review`, by position
    if (kit) document.querySelectorAll('header.top nav.crumbs [data-crumb="assessment"]').forEach(el => { el.textContent = next; }); // by level, never by label text
  };
  return mountEditableHeading(h1, { canEdit: a.role === 'owner' || a.role === 'member', label: 'assessment name',
    // Write guards without the shared busy flag (Bugbot on #285): never starts during an act() write or over a dirty screen; while the
    // PATCH runs, this view's other controls are disabled IN PLACE (no repaint, drafts survive) and re-enabled only if still on screen.
    // act() on this assessment waits for the rename to settle (pendingRename), so two cap.assessment.update writes never race.
    // A view rebuilt meanwhile draws normally and, if it shows this assessment, settles like act(): refresh on commit, aid-scoped
    // message on refusal. Other pages are untouched.
    save: async name => {
      if (state.busy || pendingRename) return false;
      if (state.dirty.has(a.id)) throw new Error(state.dirty.get(a.id) === 'write' ? 'Your last change is saved but this screen is not refreshed yet. Refresh before making more changes.' : 'This assessment changed on the server. Refresh before making changes.');
      const identity = identityGeneration, view = app.firstElementChild, held = [...app.querySelectorAll('button:not([disabled])')].filter(b => !b.closest('.v3-eh'));
      held.forEach(b => { b.disabled = true; });
      let settle; const mine = pendingRename = { aid: a.id, done: new Promise(res => { settle = res; }) };
      let r, failed = null;
      let token = null; // U17: the receipt's undo_token, when the write declares a true inverse
      try { const j = await apiFull(`/v2/assessments/${encodeURIComponent(a.id)}`, { method: 'PATCH', body: { name } }); r = j?.result; token = undoTokenOf(j); } catch (e) { failed = redact(e.message); }
      held.forEach(b => { if (b.isConnected) b.disabled = false; });
      if (pendingRename === mine) pendingRename = null;
      try {
        if (identity !== identityGeneration) return false;
        const intact = !!view?.isConnected && held.every(b => b.isConnected);
        const here = route(location.hash), onThis = (here.kind === 'assessment' || here.kind === 'survey') && here.id === a.id && state.current?.assessment.id === a.id;
        if (failed) { if (!intact && onThis && !state.busy) { state.message = { aid: a.id, text: failed, alert: true }; paint(); } throw new Error(failed); }
        const next = String(r?.assessment?.name ?? name), old = state.current?.assessment.name;
        if (!showName(next, old)) return;
        if (!intact) { if (onThis) { state.dirty.set(a.id, 'write'); if (!state.busy) await render(); } return; } // refreshed BEFORE settle(): a waiting act() then runs on a clean screen
        // No shell re-sync here: a kit update empties the content mount (drafts). The component sets the heading; the assessment crumb and title follow in place.
        inPlace(next, old);
        // U17: "Saved · Undo" (or "Saved") beside the heading's form; Undo calls cap.ops.undo and puts the old name back in place.
        const was = old ?? a.name;
        if (h1?.parentElement) showSavedStatus(h1.parentElement, { inside: true, undoToken: token, undo: async t => {
          if (state.busy || pendingRename || identity !== identityGeneration) throw new Error('Wait for the current change to finish, then try Undo again.');
          let u; try { u = await api(`/v2/undo/${encodeURIComponent(t)}`, { method: 'POST' }); } catch (e) { throw new Error(`Undo failed: ${redact(e.message)}`); }
          const back = String(u?.assessment?.name ?? was), now = h1.textContent.trim();
          if (showName(back, now)) { h1.textContent = back; inPlace(back, now); }
        } });
      } finally { settle(); }
    } });
}
// Transition: write → (committed ⇒ dirty) → refresh → (landed ⇒ clean). Every outcome is scoped to `aid`, never to
// whatever is on screen when the promise settles (Bugbot 4040525117 / 4040525128).
async function act(aid, label, fn) {
  if (pendingRename?.aid === aid) { // B07: never race the heading rename's PATCH; a queued write survives only the same identity on the same assessment
    const identity0 = identityGeneration; await pendingRename.done;
    const here = route(location.hash); if (identity0 !== identityGeneration || !((here.kind === 'assessment' || here.kind === 'survey') && here.id === aid)) return;
  }
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
  if (!state.workspaces.has(wid)) { try { const r = await api(`/v2/workspaces/${encodeURIComponent(wid)}`); if (identity !== identityGeneration) return null; state.workspaces.set(wid, { id: wid, name: r.workspace.name, role: r.workspace.role, projects: (r.projects || []).map(x => x.id) }); } catch { return null; } }
  return state.workspaces.get(wid);
}
async function fetchAssessment(aid) {
  const r = await api(`/v2/assessments/${encodeURIComponent(aid)}`);
  if (!state.templates) { try { state.templates = (await api('/v2/templates')).templates || []; } catch { state.templates = null; } }
  await assessmentsFor(r.assessment.project_id); await workspaceFor(r.assessment.project_id);
  return { assessment: completeLock(r.assessment), surveys: r.surveys || [] }; // B13: a completed review renders read-only everywhere
}
async function render() {
  // B02: signed in, "/" is the current work (#projects), never the public welcome with its Sign in choice.
  if (landsOnWork(route(location.hash), state.principal)) { try { history.replaceState(null, '', location.pathname + location.search + '#projects'); } catch {} }
  const gen = ++generation, r = route(location.hash);
  if (wizardHandle) { try { wizardHandle.destroy(); } catch {} wizardHandle = null; }
  currentShareRoute();
  // K3a root lifecycle (kit only): the shell reflects the new route from data already held, and the previous view is destroyed
  // BEFORE any load for the new route; a loading line stands in until the page's own render. Same-entity repaints (dirty refresh,
  // act() completion) keep their view: only a real route/entity change clears.
  if (kit && (r.kind !== 'assessment' && r.kind !== 'survey' ? true : state.current?.assessment.id !== r.id)) { syncShell(); app.className = ''; app.innerHTML = '<p class="muted">Loading…</p>'; }
  if (r.kind === 'assessment' || r.kind === 'survey') {
    const aid = r.id;
    if (state.current?.assessment.id !== aid || state.dirty.has(aid)) {
      try { const data = await fetchAssessment(aid); if (gen !== generation) return; state.current = data; epoch += 1; state.dirty.delete(aid); state.counts.clear(); state.countInflight.clear(); state.print = null; }
      catch (e) {
        if (gen !== generation) return;
        if (state.current?.assessment.id === aid) { /* dirty refresh failed: keep the last screen, keep the dirty banner (retry offered) */ }
        else { state.current = null; app.className = ''; syncShell(); const expired = UNAUTHENTICATED.has(String(e.code)); app.innerHTML = `<div class="narrow panel"><h1>${expired ? 'Your sign-in is no longer active' : 'Assessment unavailable'}</h1><p class="muted">${esc(redact(e.message))}</p><p>${expired ? `<a class="button primary" href="/v2/auth/access">Sign in again</a> ` : ''}<a class="button" href="#assessment/${encodeURIComponent(aid)}" data-refresh="${esc(aid)}">Try again</a> <a href="#">All projects</a></p></div>`; app.querySelector('[data-refresh]').onclick = ev => { ev.preventDefault(); render(); }; return; }
      }
    }
    if (gen !== generation || state.current?.assessment.id !== aid) return;
    syncShell(); // old view destroyed here; the assessment page (retained legacy module) mounts into the stable content element
    paint(r, gen);
  } else {
    state.current = null; if (gen !== generation) return;
    // Scope pages (workspace, project, permissions) carry the same context sidebar as the assessment page; entry and the
    // top-level lists stand alone (showcase SOURCE-MAP: the panel is absent from public routes).
    // K3a: workspace/project read surfaces are kit-presented (tree in the shell); the legacy context sidebar remains only for permissions.
    if (r.kind === 'new') { await mountNew(gen, r.id); return; }
    if (r.kind === 'invite') { mountInvitePage(gen); return; }
    const sidebar = state.principal && (kit ? ['permissions'] : ['workspace', 'project', 'permissions']).includes(r.kind);
    app.className = sidebar ? 'workspace-layout' : '';
    if (sidebar) { syncShell(); app.innerHTML = context(null) + '<div id="page-root"><p class="muted">Loading…</p></div></section>'; bind(null); await runPage(pageFor(r), r, gen, app.querySelector('#page-root')); }
    else await runPage(pageFor(r), r, gen);
    if (gen === generation && (r.kind === 'projects' || r.kind === 'workspaces') && state.principal && !app.querySelector('[data-v3-start]')) app.insertAdjacentHTML('afterbegin', startReview());
  }
}
// B03: the invitation page. Signed out → the sign-in step (the token stays in this tab so the sign-in return comes back here).
function mountInvitePage(gen) {
  syncShell(); app.className = ''; document.title = 'Invitation · 3D Review';
  const t = pendingInvite || storedInvite();
  if (!t) { app.innerHTML = inviteView({ status: 'missing' }); return; }
  if (!state.principal) { app.innerHTML = inviteView({ status: 'signin' }); return; }
  const ctx = ctxFor();
  mountInvite(app, { api: ctx.api, token: t, isCurrent: () => gen === generation, forget: forgetInvite,
    // Accepted (Bugbot on #298): re-read the project list the way boot does, so the granted project's name is known to Home and
    // the assessment header without a page reload; a failed re-read keeps the old list and still goes Home.
    onAccepted: async () => { await reloadProjects(); if (gen === generation) ctx.go(cards.routes.projects); } });
}
// The project list read boot uses. Returns false (state untouched) when the identity changed while it was in flight.
async function reloadProjects() {
  const identity = identityGeneration;
  try { const result = await api('/v2/projects'); if (identity !== identityGeneration) return false; state.projects = result.projects || []; return true; }
  catch { return false; }
}
async function mountNew(gen, resume = null) {
  syncShell(); app.className = '';
  // Bugbot 4094071987: same gate as every signed-in page — no session, no wizard.
  if (!state.principal) { app.innerHTML = `<div class="narrow panel"><p class="eyebrow">Sign in</p><h1>Sign in to continue</h1><p class="muted">Starting a review needs a facilitator session.</p><div class="actions"><a class="rv-btn primary" href="/v2/auth/access">Sign in with email code</a></div></div>`; return; }
  if (!document.querySelector(`link[href="${WIZARD_CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = WIZARD_CSS; document.head.appendChild(l); }
  let mod = null; try { mod = await import(WIZARD_JS); } catch { mod = null; }
  if (gen !== generation) return;
  if (!mod?.mountWizard) { app.innerHTML = `<div class="narrow panel"><h1>Start a review</h1><p class="muted">The guided setup is not available on this build yet.</p><div class="actions"><a class="rv-btn primary" href="${cards.routes.projects}">Go to your projects</a></div></div>`; return; }
  const ctx = ctxFor();
  const idg = identityGeneration;
  wizardHandle = mod.mountWizard(app, { api: ctx.api, go: ctx.go, origin: location.origin, assessmentHref: id => `#assessment/${encodeURIComponent(id)}`, resume,
    onLink: (aid, row) => { if (idg === identityGeneration) share.rememberLaunchLink(state.collectLinks, aid, row, location.origin); }, // U36: Collect and the survey page reuse the launch links
    mark: id => { if (gen !== generation) return; try { history.replaceState(null, '', `${location.pathname}${location.search}#new/${encodeURIComponent(id)}`); } catch {} } }); // U22: a reload reopens this draft
  document.title = `${resume ? 'Continue setup' : 'Start a review'} · 3D Review`;
}
// Account identity remains transient and belongs to this exact app identity.
let accountBusy = false;
function accountStatus(message = '') { const el = document.getElementById('account-status'); if (el) el.textContent = message; }
function accountControls(visible, busy = false) {
  const actions = document.getElementById('account-actions'); if (actions) actions.hidden = !visible;
  for (const id of ['account-signout', 'account-switch', 'account-switch-confirm']) { const el = document.getElementById(id); if (el) el.disabled = busy; }
}
async function loadAccountEmail() {
  if (demo) { who.textContent = 'Sample account'; accountControls(false); return; }
  const identity = identityGeneration, credential = token;
  who.textContent = 'Checking account…'; accountControls(true, accountBusy);
  try {
    const headers = { accept: 'application/json' }; if (credential) headers.authorization = `Bearer ${credential}`;
    const response = await fetch('/v2/auth/access?view=account', { headers, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
    const value = response.ok ? await response.json() : null;
    if (identity !== identityGeneration || credential !== token) return;
    // U03 (lanes-1321): sandbox and cookie sessions have no account view; say "Signed in", never a failure sentence.
    who.textContent = typeof value?.email === 'string' && value.email.trim() && [...value.email].length <= 254 ? `Account: ${value.email}` : 'Signed in';
  } catch { if (identity === identityGeneration && credential === token) who.textContent = 'Signed in'; }
}
// B44 (captain report 20:39): ONE sign-out for Sign out, Use another account and every caller (ctx.signOut). It never sends the
// person to the Access team-domain page: that logout shows only "Failed to log out." when there is no Access session
// (already signed out, or signed in by an email link), and the app-domain one shows "No Access cookie found" — so the Access
// logout is a background same-origin request on THIS app's domain (Cloudflare: it revokes the Access session across apps and clears
// the app cookie), never a page. DELETE /v2/auth/session revokes the app session and expires the HttpOnly `session` cookie server
// side (B38 email-link sessions included). Then the app's own sign-in screen, email field empty. Already signed out → straight there.
const SIGN_OUT_ACCESS = '/cdn-cgi/access/logout';
function landOnSignIn() {
  who.textContent = 'Not signed in';
  try { history.replaceState(null, '', location.pathname + '#signin'); } catch {}
  listen(); return render();
}
async function signOut(switchAccount = false) {
  if (demo || accountBusy) return;
  if (!state.principal && !token) return landOnSignIn();
  const identity = identityGeneration, credential = token;
  const current = () => identity === identityGeneration && credential === token;
  accountBusy = true; accountControls(true, true); accountStatus('Signing out…');
  try {
    let result;
    try { result = await api('/v2/auth/session', { method: 'DELETE' }); }
    catch (e) { if (e?.code !== 'NOT_AUTHENTICATED') throw e; result = { signed_out: true }; } // session already gone: the person is signed out
    if (!current()) return;
    if (result?.signed_out !== true) throw new Error('Logout not confirmed');
    token = null; try { sessionStorage.removeItem('facilitatorToken'); } catch {}
    resetIdentity();
    who.textContent = 'Not signed in';
    const signedOutIdentity = identityGeneration, signedOutCredential = token;
    // The provider request may already have taken effect; only its continuation can be suppressed.
    try { await fetch(SIGN_OUT_ACCESS, { credentials: 'same-origin', redirect: 'manual', cache: 'no-store' }); } catch {}
    if (signedOutIdentity !== identityGeneration || signedOutCredential !== token) return;
    await landOnSignIn();
  } catch {
    if (current()) accountStatus('Sign-out could not be confirmed. Your session may still be active.');
  } finally {
    if (current()) { accountBusy = false; accountControls(!!state.principal); }
  }
}
function bindAccountControls() {
  document.getElementById('account-signout')?.addEventListener('click', () => signOut());
  const dialog = document.getElementById('account-switch-dialog');
  document.getElementById('account-switch')?.addEventListener('click', () => { if (!accountBusy && state.principal) dialog?.showModal(); });
  document.getElementById('account-switch-cancel')?.addEventListener('click', () => dialog?.close());
  document.getElementById('account-switch-confirm')?.addEventListener('click', () => { dialog?.close(); signOut(true); });
}
bindAccountControls();
// ---- scope pages + views (product overhaul): one runner for every { load, render, bind } module ----
const setToken = t => { if (demo) return; token = t || null; landAfterSignIn = !!t; /* B04 */ try { t ? sessionStorage.setItem('facilitatorToken', t) : sessionStorage.removeItem('facilitatorToken'); } catch {} resetIdentity(); boot(); };
function ctxFor(extra = {}) {
  // Every page context is bound to the render generation and identity that created it: a retained control from a destroyed
  // view (route change, identity reset) can neither issue a request nor write a status line into the current view.
  const gen = generation, identity = identityGeneration, live = () => gen === generation && identity === identityGeneration;
  const stale = () => Promise.reject(Object.assign(new Error('This view is no longer current.'), { code: 'STALE_VIEW' }));
  // shellOwnsTitle (Bugbot 4073693743): explicit host contract — only a mounted kit root shows the page title in its header, so only
  // then do scope pages omit their own heading. The non-kit /assess/index.html host keeps page-owned headings.
  return { api: (url, opts) => live() ? api(url, opts) : stale(), apiFull: (url, opts) => live() ? apiFull(url, opts) : stale(), demo, esc, enc: cards.enc, routes: cards.routes, cards, state, setToken, signOut, shellOwnsTitle: !!kit, note: (text, alert = false) => { if (!live()) return; note.textContent = text || ''; note.classList.toggle('alert', !!alert); },
    // Review F2: a completion arriving after the view was replaced must not navigate the newer route (it cannot undo a dispatched write).
    go: (hash, { reload = false } = {}) => { if (!live()) return; if (location.hash === hash || reload) render(); else location.hash = hash; }, ...extra };
}
function pageFor(r) { if (r.kind === 'feedback') return feedback; return r.kind === 'permissions' ? views.permissions : pages[r.kind] || pages.projects; }
async function runPage(page, r, gen, root = app, extra = {}) {
  // pageModel: a page that re-loaded itself in place (retry/reload) hands the controller its new model so the shell stays consistent.
  const ctx = ctxFor({ ...extra, isCurrent: () => gen === generation, pageModel: model => { if (gen === generation && root === app) syncShell({ kind: r.kind, model }); } }), params = { ...r, aid: r.id };
  let model;
  try { model = await page.load(ctx, params); }
  catch (e) { if (gen !== generation) return; if (root === app) syncShell({ kind: r.kind, model: { status: UNAUTHENTICATED.has(String(e.code)) ? 'unauthenticated' : REFUSED.has(String(e.code)) ? 'refused' : 'failed' } }); root.innerHTML = `<div class="narrow panel"><h1>${UNAUTHENTICATED.has(String(e.code)) ? 'Your sign-in is no longer active' : REFUSED.has(String(e.code)) ? 'Not visible to you' : 'Could not load this page'}</h1><p class="muted">${esc(redact(e.message))}</p><p>${UNAUTHENTICATED.has(String(e.code)) ? `<a class="button primary" href="#">Sign in</a>` : `<a class="button" href="#" data-retry-page>Retry</a>`}</p></div>`; root.querySelector('[data-retry-page]')?.addEventListener('click', ev => { ev.preventDefault(); render(); }); return; }
  if (gen !== generation) return;
  if (root === app) syncShell({ kind: r.kind, model }); // kit read model from THIS page's loaded data; clears the previous view first
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
  renderBlankPrint(document, app.querySelector('#print-root'), model);
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
  // Compact chrome: under the kit shell the tree, crumbs and title are the shell's; the legacy context panel and the duplicate
  // assessment heading are not rendered. Stage badge, role line, view tabs and every action/state/error remain.
  app.className = kit ? '' : 'workspace-layout';
  const ctxPanel = kit ? '<section class="assessment-body">' : context(state.current);
  if (r.kind === 'survey') {
    const s = activeSurveys(state.current).find(x => x.id === r.sid);
    app.innerHTML = ctxPanel + (s ? surveyScreen(state.current, s) : surveyUnavailable(r.id, r.sid)) + '</section>';
    // `only` FILTERS the child paint to its own survey; it never forces (settled/in-flight guard intact; only Retry re-reads).
    bind(state.current); if (s) { bindShare(state.current, s); bindPrint(state.current, s); loadCounts(state.current, { only: s.id }); if (state.print && s.id === state.print.sid) replayPrint(state.print.model); }
    document.title = `${s ? s.template_name + ' · ' : ''}${state.current.assessment.name} · 3D Review`;
  } else {
    // A1 precedence: route hash > recalled tab (`stage-tab:<aid>`, stage ids only) > server stage. Permissions is a peer tab but is never
    // written to the recall key (rememberTab rejects non-stage ids) and never carries data-stage, so compositionState never sees it.
    const a0 = state.current.assessment;
    const tab = r.view || recalledTab(tabStorage, a0.id, VIEWS.includes(a0.stage) ? a0.stage : 'prepare');
    if (r.view) rememberTab(tabStorage, a0.id, r.view);
    app.innerHTML = ctxPanel + screen(state.current, tab) + '</section>'; bind(state.current); if (tab === 'collect') { bindCollectLinks(state.current); loadCounts(state.current); }
    bindPrepare(state.current); bindNameHeading(state.current); mountView(state.current, tab, gen);
    document.title = `${title(tab)} · ${state.current.assessment.name} · 3D Review`;
  }
}
// Root entry switch (A7): `/` is the product shell. Hashes the legacy surface owns are forwarded to `/legacy/` unrendered —
// `#survey=` uses the dedicated participant page; `#invite=` (acceptance; Auth A13), `#participant`, `#facilitator`, `#workspace`, `#reports-card`,
// `#evidence`. `#session=` is the Access return leg (src/index.ts:138, callback unchanged): consumed here exactly as legacy does —
// same `facilitatorToken` key, stripped from history before any render, never echoed. Nothing else stores a credential.
const LEGACY_HASHES = new Set(['#facilitator', '#workspace', '#evidence']);
// B03: a pending invitation token — memory + this tab's sessionStorage only (survives the sign-in round trip), cleared once used.
let pendingInvite = null;
function storedInvite() { try { return sessionStorage.getItem(INVITE_KEY); } catch { return null; } }
function forgetInvite() { pendingInvite = null; try { sessionStorage.removeItem(INVITE_KEY); } catch {} }
// B04: set when a sign-in just happened (Access return #session=, or the entry form's setToken); boot() applies signInLanding once.
let landAfterSignIn = false;
// Returns 'forwarded' (this page is leaving), 'session' (a session was consumed — identity must be re-observed), or null.
// Runs on load AND on every hashchange (Auditor S1): fragment-only navigation after load takes the same path as a fresh load.
function scrubCredentialHash() {
  const h = location.hash || '';
  if (demo) { if (/^#(?:session|invite|survey)=/.test(h) || route(h).kind === 'entry') history.replaceState(null, '', location.pathname + '?demo=1#assessment/demo-assessment/collect'); return null; }
  if (h === '#how' || h === '#example') { location.replace('/?demo=1#assessment/demo-assessment/collect'); return 'forwarded'; }
  if (h === '#participant') { location.replace('/legacy/#participant'); return 'forwarded'; }
  if (h === '#reports-card') { location.replace('/#projects'); return 'forwarded'; }
  if (/^#survey=/.test(h)) { try { history.replaceState(null, '', location.pathname); } catch {} location.replace('/participate/' + h); return 'forwarded'; }
  if (/^#invite=/.test(h)) { const t = parseInvitationFragment(h); if (t) { pendingInvite = t; try { sessionStorage.setItem(INVITE_KEY, t); } catch {} } try { history.replaceState(null, '', location.pathname + '#invite'); } catch {} return null; } // B03: stays in v3; token leaves the address bar
  if (LEGACY_HASHES.has(h)) { try { history.replaceState(null, '', location.pathname); } catch {} location.replace('/legacy/' + h); return 'forwarded'; }
  const m = /^#session=([A-Za-z0-9_]+)$/.exec(h);
  if (m) { /* B-F02a: land on the work list; B03: a pending invitation comes first */ try { history.replaceState(null, '', location.pathname + (pendingInvite || storedInvite() ? '#invite' : '#projects')); } catch {} landAfterSignIn = true; token = m[1]; try { sessionStorage.setItem('facilitatorToken', m[1]); } catch {} resetIdentity(); return 'session'; }
  if (/^#session=/.test(h)) { try { history.replaceState(null, '', location.pathname); } catch {} } // malformed: drop, never render
  return null;
}
function resetIdentity() {
  identityGeneration += 1; generation += 1; epoch += 1;
  pendingRename = null; // B07: an in-flight rename belongs to the old principal; its settle() still runs, its outcome is dropped by the identity check
  accountBusy = false; accountControls(false); accountStatus();
  document.getElementById('account-switch-dialog')?.close();
  state.share = null; state.collectLinks.clear(); state.principal = null; state.projects = []; state.current = null; state.templates = null;
  state.openProjects.clear(); state.lists.clear(); state.workspaces.clear(); state.inflight.clear(); state.seq.clear();
  state.counts.clear(); state.countInflight.clear(); state.dirty.clear(); state.message = null; state.print = null; state.busy = false;
  if (kit) syncShell(); else if (app) app.innerHTML = ''; if (note) note.textContent = ''; if (who) who.textContent = 'Checking session…';
  for (const id of ['legacy-link', 'whats-here-wrap']) { const el = document.getElementById(id); if (el) el.hidden = true; }
}
function syncContextDisclosure(event) {
  if (!event.matches) { const disclosure = app?.querySelector('.context-disclosure'); if (disclosure) disclosure.open = true; }
}
if (typeof matchMedia === 'function') matchMedia('(max-width:650px)').addEventListener('change', syncContextDisclosure);
// U30 (Bincy B07/B31): a status line belongs to the page and action that set it. A route change clears it so "Renamed." from one
// page never reads as feedback on the next. An in-flight action keeps its busy label; its own finally clears it.
let pendingNotice = null; // U14: the one-line notice carried across the navigation that follows a delete
function clearPageNote() { if (!note || state.busy) return; note.textContent = pendingNotice || ''; pendingNotice = null; note.classList.remove('alert'); }
let listening = false;
function listen() { if (listening) return; listening = true; window.addEventListener('hashchange', () => { const r = scrubCredentialHash(); if (r === 'forwarded') return; if (r === 'session') { boot(); return; } clearPageNote(); render(); window.scrollTo(0, 0); }); } // S1: listener path == load path
// B38: does this environment use email sign-in links (DEV) or Cloudflare Access (production)? Asked once; remembered only on
// an answer (2 s timeout; a timeout or failure leaves it unknown). Unknown or off → the Access sign-in button and the team-domain logout stay exactly as before.
async function loadEmailLinks() {
  if (demo || typeof state.emailLinks === 'boolean') return state.emailLinks === true;
  try { const r = await fetch('/v2/auth/email?probe', { headers: { accept: 'application/json' }, credentials: 'same-origin', redirect: 'error', cache: 'no-store', ...(typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? { signal: AbortSignal.timeout(2000) } : {}) }); if (r.ok) { const v = await r.json(); state.emailLinks = v?.email_links === true; if (state.emailLinks) emailLinksCopy(); } } catch {}
  return state.emailLinks === true;
}
// B38, email links ON only: the markup and every Sign-in href stay byte-identical to production (/v2/auth/access, Access
// copy); this environment re-points them at run time. Plain left clicks on an Access sign-in link go to the email sign-in
// page instead, and the account-switch dialog gets the email-link copy. Off → nothing here runs.
function emailLinksCopy() {
  const dialog = document.getElementById('account-switch-dialog');
  const paras = dialog?.querySelectorAll?.('p');
  if (paras?.length) { paras[0].textContent = 'You will be signed out here, then asked for the email address of the other account. We email it a sign-in link.'; for (const p of [...paras].slice(1)) p.remove(); }
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('click', ev => {
  if (state.emailLinks !== true || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  const a = ev.target?.closest?.('a[href="/v2/auth/access"]'); if (!a) return;
  ev.preventDefault(); location.assign('/v2/auth/email');
});
async function boot() {
  if (scrubCredentialHash() === 'forwarded') return; // 'session' falls through: identity is observed fresh below
  placeDemoNotice();
  const identity = identityGeneration;
  const linksKnown = loadEmailLinks();
  try { const me = await api('/v2/me'); if (identity !== identityGeneration) return; state.principal = me.principal; }
  catch {
    if (identity !== identityGeneration) return;
    landAfterSignIn = false; // B04: no session observed, nothing to land
    // Public entry: the welcome/tour/example/survey-code/sign-in page needs no session; every other route asks to sign in.
    accountControls(false); accountStatus();
    listen();
    if (route(location.hash).kind === 'invite') { who.textContent = 'Not signed in'; app.className = ''; syncShell(); mountInvitePage(generation); return; }
    if (route(location.hash).kind === 'entry') { await linksKnown; if (identity !== identityGeneration) return; who.textContent = 'Not signed in'; app.className = ''; syncShell(); await render(); return; }
    // Real sign-in only (captain: synthetic-only sign-in rejected). /v2/auth/access is the existing Cloudflare email-code
    // route; it sets the session cookie and returns to the workspace home (/#session=…), not here — stated, not hidden.
    who.textContent = 'Not signed in'; app.className = ''; syncShell();
    const here = /(invite|session)=/.test(location.hash) ? location.pathname : location.pathname + location.hash;
    app.innerHTML = `<div class="narrow panel"><h1>Sign in to open this page</h1><p class="muted">Sign in first, then open this address again:</p><p><code>${esc(here)}</code></p><p><a class="button primary" href="#">Go to sign in</a> <a class="button" href="/v2/auth/access">Sign in with an email code</a></p></div>`;
    return; }
  void loadAccountEmail();
  // E1: signed-in staff get the real-app way back (same-origin session, no token) and the generated functionality statement.
  const back = document.getElementById('legacy-link'); if (back) back.hidden = true;
  const wh = document.getElementById('whats-here'); if (wh) { wh.textContent = whatsHere(); const wrap = document.getElementById('whats-here-wrap'); if (wrap) wrap.hidden = false; else wh.hidden = false; }
  // A12 (R1/I1): a transient failure here renders a retryable message, never a blank page.
  try { const result = await api('/v2/projects'); if (identity !== identityGeneration) return; state.projects = result.projects || []; }
  catch (e) { if (identity !== identityGeneration) return; // Auth A14: a direct #assessment/<id> still renders under "Granted to you"; the project list failure is a retryable notice, not a dead end.
    state.projects = []; note.innerHTML = `Could not load your project list (${esc(redact(e.message))}). <a href="#" data-retry-boot>Retry</a>`; note.querySelector('[data-retry-boot]').onclick = ev => { ev.preventDefault(); note.textContent = ''; boot(); };
    if (!['assessment', 'survey', 'feedback', 'invite'].includes(route(location.hash).kind)) /* B03: acceptance does not need the list */ { syncShell(); app.innerHTML = `<div class="narrow panel"><h1>Could not load projects</h1><p class="muted">${esc(redact(e.message))}</p><p><a class="button" href="#" data-retry-boot2>Retry</a></p></div>`; app.querySelector('[data-retry-boot2]').onclick = ev => { ev.preventDefault(); boot(); }; listen(); return; } }
  // B04: once, right after a sign-in, the landing follows Bincy's rule (invitation → accept screen; one project → it; several → Home).
  if (landAfterSignIn) { landAfterSignIn = false; if (['projects', 'invite', 'entry'].includes(route(location.hash).kind)) { try { history.replaceState(null, '', location.pathname + location.search + signInLanding({ invite: !!(pendingInvite || storedInvite()), projects: state.projects })); } catch {} } }
  listen();
  await render();
}
// Boot on the kit root (normal root) or the legacy #app root; never in a headless harness without either.
if (typeof window !== 'undefined' && (kit || document.getElementById('app'))) boot();
