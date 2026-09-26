// v3 lane 2 · four-step setup wizard (design-system-v3 CHANGE-MAP "Setup (frames 3 to 6)", PARITY P2/P7/A1/C1).
// Steps (Bincy 03–06): Assessment details · Who will participate? · Participant information · Review & launch. One primary action per step.
// Contract unchanged (ADOPTION.md): launch maps onto cap.project.create (only for "New project…"), cap.language.create
// (only with a new project), cap.assessment.create, cap.survey.select, cap.assessment.set_stage (collect) and
// cap.survey.issue_link (dry_run → execute). Nothing is sent to anyone; links are opened, not mailed.
// Ruling (a), captain 2026-09-24: "How many do you expect?" is OPTIONAL. The contract stores no expected count, so N lives
// only in this browser (EXPECTED_KEY, best effort) and "n of N" shows only when N was entered; otherwise "n responded".
// Lane 1 owns routing and the shell: this module exports pure helpers plus mountWizard(root, deps); it never touches
// location or the router itself. deps.go(hash) is the shell's navigation.
// B06 (captain ruling 16:20–16:35 ET, ASK 7 option 1): Continue on step 1 saves the review as a draft in Prepare with the same
// writes Launch used to make first (savePlan: cap.project.create / cap.language.create only for a new project, then
// cap.assessment.create); later step-1 edits ride cap.assessment.update. Home's "Continue setup" reopens #new/<id> at the next
// unfinished step (draftFromSaved). Cancel after a save asks in the page: Keep as draft, or Discard (cap.assessment.delete,
// the U14 flow). Launch picks up after the saved writes (launchResume). Contract unchanged.

import { shareUrl } from '../shared-link.js';
import { groupLinks, bindGroupLinks, printAllButton, bindPrintAll } from '../assess/share.js';
import { stepper as stepperComponent, ensureStepperStyle } from './components/stepper.js';
import { learnMore } from './components/learn-more.js';
import { PRIVACY_LINE } from './components/privacy-line.js';
import { packPeriod, parsePeriod, periodText, periodErrors, formatDate, todayIso } from './components/active-until.js';
import { deleteAssessmentFlow } from './components/delete-assessment.js';
import { whoLine } from '../assess/scope.js';

export const STEPS = ['details', 'participants', 'information', 'review'];
// Step names follow Bincy's screen inventory 03–06 (cookbook @933eb5f sources/bincy-design-sprint-2026-09-22/01_documents/04_screen_inventory.md).
// Stepper labels follow the approved design-system-v3 prototype setup view (captain correction 11:14).
export const STEP_TITLES = ['Details', 'Participants', 'Information', 'Review'];
// Perspective colour dot, as the prototype's pdot(); unknown perspectives get the neutral pip.
export const pdot = p => { const s = String(p || '').toLowerCase(); return /team/.test(s) ? 'p-team' : /community/.test(s) ? 'p-community' : /church/.test(s) ? 'p-church' : 'p-reviewer'; };
export const EXPECTED_KEY = 'v3:expected'; // { [surveyId]: N } — device-local, never sent to the API
export const NEW_PROJECT = '__new__';
// B40 (captain 19:50, Bincy): "Lead organisation" is a select plus "Other (type it)". Names only, deduplicated, from the
// Lovable harvest (v0 lead orgs + v1.0 lead_organization options; test/placeholder values dropped). Organisations already on
// the projects this account can see are merged in at render time. Stored value is unchanged: project.organization text.
export const ORGANIZATIONS = ['Beyond Translation', 'Global Partnerships', 'Local church', 'SIL', 'unfoldingWord', 'Wycliffe Associates', 'Wycliffe Global Alliance', 'Wycliffe USA'];
export const ORG_OTHER = '__other__';
export function orgChoices(projects = []) {
  const seen = new Map();
  for (const n of [...ORGANIZATIONS, ...projects.map(p => p && p.organization)]) { const v = String(n ?? '').trim(); if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v); }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = encodeURIComponent;
const LANG_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/; // mirrors src/handlers/language.ts CODE (cap.language.create `code`)

export function freshDraft() {
  return { name: '', project: '', language: '', newProject: '', newOrg: '', newLanguage: '', newLangCode: '', starts: todayIso(), until: '', format: 'Written', purpose: '', groups: {} };
}

// Ruling (a): a denominator appears only when the facilitator entered one.
export function expectedValue(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}
export function countLabel(n, N) {
  const got = Number(n) || 0;
  return Number.isInteger(N) && N > 0 ? `${got} of ${N}` : `${got} responded`;
}

// Latest published version per template id; the pinned instrument is whatever the server lists (no invented groups).
export function latestTemplates(templates = []) {
  const best = new Map();
  for (const t of templates) { const cur = best.get(t.id); if (!cur || Number(t.version) > Number(cur.version)) best.set(t.id, t); }
  return [...best.values()].sort((a, b) => String(a.perspective).localeCompare(String(b.perspective)) || String(a.name).localeCompare(String(b.name)));
}

export function validateStep(step, d) {
  const errs = [];
  if (step === 'details') {
    if (!d.name.trim()) errs.push('Give the review a name.');
    if (!d.project) errs.push('Choose a project.');
    if (d.project === NEW_PROJECT) { if (!d.newProject.trim()) errs.push('Name the new project.'); if (!d.newLanguage.trim()) errs.push('Name the language.'); if ((d.newLangCode || '').trim() && !LANG_CODE.test(d.newLangCode.trim())) errs.push('Language code: use an ISO 639 code such as "hil" or "en-US" (qaa–qtz for an unlisted language), or leave it blank.'); }
    else if (d.project && !d.language) errs.push('Choose a language.');
    errs.push(...periodErrors(d.starts, d.until)); // B41: Active until required, Starts optional
  }
  if (step === 'participants' && !Object.keys(d.groups).length) errs.push('Choose at least one group.');
  return errs;
}

// The ordered write plan for "Launch the review". Pure, so the order is testable without a network.
// pre: template ids whose survey a saved draft already holds (selected on an earlier, part-done launch); not selected again.
export function launchPlan(d, pre = []) {
  const plan = [];
  if (d.project === NEW_PROJECT) {
    plan.push({ cap: 'cap.project.create', method: 'POST', url: () => '/v2/projects', body: () => ((d.newOrg || '').trim() ? { name: d.newProject.trim(), organization: d.newOrg.trim() } : { name: d.newProject.trim() }), keep: (r, ctx) => { ctx.pid = r.project.id; } });
    plan.push({ cap: 'cap.language.create', method: 'POST', url: ctx => `/v2/projects/${enc(ctx.pid)}/languages`, body: () => ((d.newLangCode || '').trim() ? { name: d.newLanguage.trim(), code: d.newLangCode.trim() } : { name: d.newLanguage.trim() }), keep: (r, ctx) => { ctx.lid = r.language.id; } });
  }
  plan.push({ cap: 'cap.assessment.create', method: 'POST', url: ctx => `/v2/projects/${enc(ctx.pid)}/assessments`, body: ctx => {
    const b = { name: d.name.trim(), language_id: ctx.lid };
    if (d.purpose.trim()) b.purpose = d.purpose.trim();
    const period = packPeriod(d.starts, d.until); if (period) b.period = period; // B41: existing field, no migration
    if (d.format) b.format = d.format;
    return b;
  }, keep: (r, ctx) => { ctx.aid = r.assessment.id; } });
  for (const [tid, g] of Object.entries(d.groups)) {
    if (pre.includes(tid)) continue;
    plan.push({ cap: 'cap.survey.select', method: 'POST', url: ctx => `/v2/assessments/${enc(ctx.aid)}/surveys`, body: () => ({ template_id: tid, version: Number(g.version) }),
      keep: (r, ctx) => { ctx.surveys.push({ id: r.survey.id, template: tid, expected: expectedValue(g.expected) }); } });
  }
  plan.push({ cap: 'cap.assessment.set_stage', method: 'POST', url: ctx => `/v2/assessments/${enc(ctx.aid)}/stage`, body: () => ({ stage: 'collect' }) });
  plan.push({ cap: 'cap.survey.issue_link', each: 'surveys' });
  return plan;
}

// B06: Continue on step 1 makes exactly the writes Launch made first, so a saved draft is the same row Launch would create.
export const SAVE_CAPS = ['cap.project.create', 'cap.language.create', 'cap.assessment.create'];
export const savePlan = d => launchPlan(d).filter(step => SAVE_CAPS.includes(step.cap));
// What the saved row holds for step 1, as cap.assessment.create sent it (nulls where nothing was given).
export function detailsOf(d) {
  return { name: d.name.trim(), purpose: d.purpose.trim() || null, period: packPeriod(d.starts, d.until) || null, format: d.format || null, language_id: d.language || null };
}
// Step-1 edits after the save: only the changed fields, for cap.assessment.update (PATCH). null when nothing changed.
export function detailsPatch(snap, d) {
  const now = detailsOf(d), out = {};
  for (const k of Object.keys(now)) if ((now[k] ?? null) !== (snap[k] ?? null) && !(k === 'language_id' && !now[k])) out[k] = now[k];
  return Object.keys(out).length ? out : null;
}
// Resume a saved draft (#new/<id>): step-1 values from the assessment row, groups from surveys it already holds, and the next
// unfinished step (step 2 once step 1 is complete).
export function draftFromSaved(a, surveys = [], store) {
  const p = parsePeriod(a.period) || { starts: '', until: '' };
  const d = { ...freshDraft(), name: a.name || '', project: a.project_id || '', language: a.language_id || '', purpose: a.purpose || '', format: a.format || 'Written', starts: p.starts || '', until: p.until || '' };
  const pre = [];
  for (const x of surveys) {
    if (x.archived_at || (x.state && x.state !== 'selected') || d.groups[x.template_id]) continue;
    const N = expectedFor(x.id, store);
    d.groups[x.template_id] = { version: String(x.template_version), expected: N ? String(N) : '' };
    pre.push({ id: x.id, template: x.template_id, version: Number(x.template_version) });
  }
  const snap = { name: a.name || '', purpose: a.purpose ?? null, period: a.period ?? null, format: a.format ?? null, language_id: a.language_id || null };
  return { d, step: validateStep('details', d).length ? 'details' : 'participants', saved: { aid: a.id, pid: a.project_id, role: a.role || '', snap, pre } };
}
// The launch ctx for a saved draft: the assessment exists (done), surveys it already holds and are still chosen are kept.
export function launchResume(saved, d) {
  const kept = saved.pre.filter(x => d.groups[x.template] && Number(d.groups[x.template].version) === Number(x.version));
  return { pid: saved.pid, lid: d.language, aid: saved.aid, surveys: kept.map(x => ({ id: x.id, template: x.template, expected: expectedValue(d.groups[x.template].expected) })), links: [], done: ['cap.assessment.create'], pre: kept.map(x => x.template) };
}

// Resumable: pass the ctx from a failed attempt as `resume` and completed writes are not repeated (no duplicate
// project/assessment/survey on retry). ctx.done counts completed writes in plan order.
export async function launch(d, opts) {
  const ctx0 = opts.resume || null;
  try { return await launchInner(d, opts); } catch (err) { if (!err.ctx) try { err.ctx = opts._ctx || ctx0; } catch {} throw err; }
}
async function launchInner(d, opts) {
  const { api, store = safeStore(), resume = null } = opts;
  const ctx = resume || { pid: d.project === NEW_PROJECT ? null : d.project, lid: d.project === NEW_PROJECT ? null : d.language, aid: null, surveys: [], links: [], done: [] };
  if (ctx.base == null) ctx.base = ctx.done.length; // writes already made before this launch (B06: the saved draft)
  opts._ctx = ctx;
  let i = 0;
  for (const step of opts.plan || launchPlan(d, ctx.pre || [])) {
    if (step.each === 'surveys') {
      for (const s of ctx.surveys) {
        if (i++ < ctx.done.length) continue;
        const url = `/v2/assessments/${enc(ctx.aid)}/surveys/${enc(s.id)}/links`;
        const dry = await api(url, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
        const r = await api(url, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token: dry.confirm_token } });
        ctx.links.push({ survey: s.id, template: s.template, entry_fragment: r.entry_fragment, expires_at: r.expires_at || null });
        ctx.done.push(step.cap);
      }
      continue;
    }
    if (i++ < ctx.done.length) continue;
    // #188: a write whose response was lost may have committed. Read it back by ids already known before retrying.
    // language.create is also read back on any resume: the project is this launch's own (created or reconciled), so a
    // same-name language there is ours; a "name already exists" 400 would otherwise block Continue forever (Bugbot 4094916357).
    if ((ctx.pending && ctx.pending.cap === step.cap) || (resume && step.cap === 'cap.language.create')) {
      const found = await reconcile(step, ctx, d, api);
      if (found) { if (step.keep) step.keep(found, ctx); ctx.pending = null; ctx.done.push(step.cap); continue; }
    }
    ctx.pending = { cap: step.cap, at: now() };
    let r;
    try { r = await api(step.url(ctx), { method: step.method, body: step.body(ctx) }); }
    catch (e) { if (refused(e)) ctx.pending = null; throw e; } // a clear 4xx refusal committed nothing: stay editable
    if (step.keep) step.keep(r, ctx);
    ctx.pending = null;
    ctx.done.push(step.cap);
  }
  rememberExpected(store, ctx.surveys);
  return ctx;
}

const now = () => Date.now();
const SKEW_MS = 5 * 60 * 1000; // client/server clock tolerance when matching a just-created row by name
const recent = (row, at) => { const t = Date.parse(row?.created_at || ''); return !Number.isNaN(t) && t >= at - SKEW_MS; };
// 4xx other than 409 (conflict may mean it already exists) = the server refused; no status or 5xx = outcome unknown.
export const refused = e => Number.isInteger(e?.status) && e.status >= 400 && e.status < 500 && e.status !== 409;
const newest = rows => rows.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;

// #188 reconcile: returns a response-shaped object when the uncertain write is found committed, else null (safe to retry).
// Reads only (cap.project.list · cap.language.list · cap.assessment.list · cap.assessment.get); contract unchanged.
// cap.survey.issue_link cannot be read back (the server keeps only a hash), so it is simply issued again.
export async function reconcile(step, ctx, d, api) {
  const at = ctx.pending?.at ?? 0;
  if (step.cap === 'cap.project.create') {
    const r = await api('/v2/projects'); const name = d.newProject.trim();
    const hit = newest((r.projects || []).filter(p => p.name === name && p.role === 'owner' && !p.archived_at && recent(p, at)));
    return hit ? { project: hit } : null;
  }
  if (step.cap === 'cap.language.create') {
    const r = await api(`/v2/projects/${enc(ctx.pid)}/languages`); const name = d.newLanguage.trim();
    const hit = newest((r.languages || []).filter(l => l.name === name && !l.archived_at));
    return hit ? { language: hit } : null;
  }
  if (step.cap === 'cap.assessment.create') {
    const r = await api(`/v2/projects/${enc(ctx.pid)}/assessments`); const name = d.name.trim();
    const hit = newest((r.assessments || []).filter(a => a.name === name && a.language_id === ctx.lid && a.role === 'owner' && a.stage === 'prepare' && !a.archived_at && recent(a, at)));
    return hit ? { assessment: hit } : null;
  }
  if (step.cap === 'cap.survey.select') {
    const tid = step.body(ctx).template_id, version = step.body(ctx).version, have = new Set(ctx.surveys.map(x => x.id));
    const r = await api(`/v2/assessments/${enc(ctx.aid)}`);
    const hit = (r.surveys || []).find(x => x.template_id === tid && Number(x.template_version) === version && !x.archived_at && !have.has(x.id));
    return hit ? { survey: hit } : null;
  }
  if (step.cap === 'cap.assessment.set_stage') {
    const r = await api(`/v2/assessments/${enc(ctx.aid)}`);
    return r.assessment && r.assessment.stage && r.assessment.stage !== 'prepare' ? r : null;
  }
  return null;
}

function safeStore() { try { return globalThis.localStorage || null; } catch { return null; } }
export function rememberExpected(store, surveys) {
  if (!store) return;
  try {
    const cur = JSON.parse(store.getItem(EXPECTED_KEY) || '{}');
    for (const s of surveys) if (s.expected) cur[s.id] = s.expected;
    store.setItem(EXPECTED_KEY, JSON.stringify(cur));
  } catch {}
}
export function expectedFor(surveyId, store = safeStore()) {
  try { return expectedValue(JSON.parse(store?.getItem(EXPECTED_KEY) || '{}')[surveyId]); } catch { return null; }
}

// ---------- views (pure string renderers) ----------
// component: Stepper (ruling 12:34) — the wizard composes the shared component; it keeps no copy of its own.
export const stepper = n => stepperComponent(STEP_TITLES, n, { label: 'Setup steps' });
// B08+B20 (Bincy SI 04): step 2 groups surveys under one heading per perspective, each with one plain who-line (scope.js whoLine, shared).
export const perspectiveNote = p => whoLine(p);
export function byPerspective(templates = []) {
  const groups = new Map();
  for (const t of templates) { const k = String(t.perspective ?? ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  return [...groups.entries()];
}
// Captain order 17:05 (lane 9 less text): one heading, at most one short line, one primary action; the rest goes in `more` (shared Learn more).
const head = (n, h, sub, more = '') => `<div class="eyebrow">Start a 3D Review · step ${n} of ${STEP_TITLES.length}</div>${stepper(n)}<h1 class="wz-h">${h}</h1>${sub ? `<p class="muted wz-sub">${sub}</p>` : ''}${learnMore(more)}`;
const errBox = errs => errs?.length ? `<div class="note alert" role="alert">${errs.map(esc).join('<br>')}</div>` : '';
// B06: once step 1 is saved, every step offers Cancel (it asks Keep as draft / Discard).
const actions = (back, primary, cancel = false) => `<div class="actions">${back ? `<button type="button" class="rv-btn quiet" data-wz="back">Back</button>` : ''}${!back || cancel ? `<button type="button" class="rv-btn quiet" data-wz="cancel">Cancel</button>` : ''}<span class="spacer"></span>${primary}</div>`;
// B06: Cancel after step 1 was saved asks in the page (same note/actions markup as the shared in-page confirm), never window.confirm.
export const KEEP_LABEL = 'Keep as draft', DISCARD_LABEL = 'Discard';
export function cancelAsk() {
  return `<div class="note" data-wz-ask role="group" aria-label="Leave setup"><p>This review is saved as a draft. Keep it for Continue setup on Home, or discard it?</p><div class="actions"><button type="button" class="primary" data-wz="keep">${KEEP_LABEL}</button><button type="button" class="quiet" data-wz="discard">${DISCARD_LABEL}</button></div></div>`;
}

function orgField(d, projects) {
  const names = orgChoices(projects), cur = String(d.newOrg || '').trim();
  const listed = names.find(n => n.toLowerCase() === cur.toLowerCase());
  const other = d.newOrgOther || (cur && !listed);
  return `<label>Lead organisation<select name="newOrgPick"><option value=""${!other && !listed ? ' selected' : ''}>Choose… (optional)</option>${names.map(n => `<option value="${esc(n)}"${!other && n === listed ? ' selected' : ''}>${esc(n)}</option>`).join('')}<option value="${ORG_OTHER}"${other ? ' selected' : ''}>Other (type it)</option></select></label>`
    + (other ? `<label>Organisation name<input name="newOrg" value="${esc(d.newOrg || '')}" placeholder="The organisation leading this translation"></label>` : '');
}

// locked: the partial launch ctx (or true). Links already issued are shown so they are never lost (the server keeps only a hash).
// B41: the two setup dates as review rows (Starts only when given).
const dates = d => `${(d.starts || '').trim() ? `<dt>Starts</dt><dd>${esc(formatDate(d.starts.trim()) || d.starts)}</dd>` : ''}<dt>Active until</dt><dd>${esc(formatDate((d.until || '').trim()) || 'Not set')}</dd>`;
export function renderStep(step, d, data, errs = [], locked = false, origin = '') {
  const n = STEPS.indexOf(step) + 1;
  const projects = data.projects || [], languages = data.languages || [], templates = latestTemplates(data.templates);
  const isNew = d.project === NEW_PROJECT;
  const proj = isNew ? { name: d.newProject } : projects.find(p => p.id === d.project) || {};
  const lang = isNew ? { name: d.newLanguage } : languages.find(l => l.id === d.language) || {};
  const chosen = templates.filter(t => d.groups[t.id]);
  const saved = !!data.saved, act = (back, primary) => actions(back, primary, saved); // B06: saved draft — project is fixed
  if (step === 'details') return `${head(n, 'Assessment details', 'You can change these later.', '<p class="muted">Only what the review needs.</p>')}${errBox(errs)}
    <form data-wz-form="details">
      <label>Name<input name="name" value="${esc(d.name)}" required placeholder="e.g. October assessment"></label>
      <div class="grid">
        <label>Project<select name="project"${saved ? ' disabled' : ''}><option value=""${d.project ? '' : ' selected'} disabled>Choose…</option>${projects.map(p => `<option value="${esc(p.id)}"${p.id === d.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}${saved ? '' : `<option value="${NEW_PROJECT}"${isNew ? ' selected' : ''}>New project…</option>`}</select></label>
        ${isNew ? `<label>New project name<input name="newProject" value="${esc(d.newProject)}" required></label>`
          : `<label>Language<select name="language"${d.project ? '' : ' disabled'}><option value=""${d.language ? '' : ' selected'} disabled>${d.project ? (languages.length ? 'Choose…' : 'No languages in this project') : 'Choose a project first'}</option>${languages.map(l => `<option value="${esc(l.id)}"${l.id === d.language ? ' selected' : ''}>${esc(l.name)}${l.code ? ' · ' + esc(l.code) : ''}</option>`).join('')}</select></label>`}
      </div>
      ${isNew ? orgField(d, projects) : ''}
      ${isNew ? `<label>Language<input name="newLanguage" value="${esc(d.newLanguage)}" required placeholder="The language this translation is in"></label><label>Language code (ISO 639, optional)<input name="newLangCode" value="${esc(d.newLangCode || '')}" placeholder="e.g. hil — qaa–qtz if unlisted" autocapitalize="off" spellcheck="false"></label>` : ''}
      <div class="grid">
        <label>Starts (optional)<input type="date" name="starts" value="${esc(d.starts)}"></label>
        <label>Active until<input type="date" name="until" value="${esc(d.until)}" required></label>
      </div>
      <div class="grid">
        <label>Translation format<select name="format">${['Written', 'Audio', 'Sign'].map(f => `<option${f === d.format ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      </div>
      <label>What will participants consider?<input name="purpose" value="${esc(d.purpose)}" placeholder="e.g. The Genesis 1 to 3 draft"></label>
      ${act(false, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  if (step === 'participants') return `${head(n, 'Who will participate?', 'Choose the groups you can reach.', '<p class="muted">Three perspectives, kept separate.</p><p class="muted">The number is optional. Leave it empty if you don\'t know for sure; counts then show as "n responded". Groups you leave out can be added later.</p>')}${errBox(errs)}
    <form data-wz-form="participants">
      ${templates.length ? byPerspective(templates).map(([p, ts]) => `<div class="wz-pgroup"><div class="wz-persp"><span class="pdot ${pdot(p)}" aria-hidden="true"></span><div><h3>${esc(p)}</h3>${perspectiveNote(p) ? `<p class="small muted wz-pnote">${esc(perspectiveNote(p))}</p>` : ''}</div></div>
        ${ts.map(t => { const g = d.groups[t.id]; return `<div class="group${g ? ' on' : ''}">
        <label class="choice"><input type="checkbox" name="g" value="${esc(t.id)}" data-version="${esc(t.version)}"${g ? ' checked' : ''}><span class="wz-sname">${esc(t.name)}</span></label>
        <div class="gin"><label for="n-${esc(t.id)}">How many do you expect?</label><input type="number" id="n-${esc(t.id)}" name="n-${esc(t.id)}" min="1" step="1" inputmode="numeric" value="${g && g.expected ? esc(g.expected) : ''}" placeholder="optional"></div></div>`; }).join('')}</div>`).join('')
        : '<p class="muted">No published surveys are available to this account.</p>'}
      ${act(true, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  if (step === 'information') return `${head(n, 'Participant information', 'What participants see before they answer.')}${errBox(errs)}
    <form data-wz-form="information">
      <h3>Shown to every participant</h3>
      <dl class="kv"><dt>Project</dt><dd>${esc(proj.name || '')}</dd><dt>Language</dt><dd>${esc(lang.name || '')}</dd><dt>Material</dt><dd>${esc(d.purpose || 'Not set')}</dd><dt>Format</dt><dd>${esc(d.format)}</dd>${dates(d)}</dl>
      <h3>Asked of each participant</h3>
      ${chosen.map(t => `<div class="group"><span class="pdot ${pdot(t.perspective)}" aria-hidden="true"></span><div><h3>${esc(t.perspective)}</h3><span class="sub">The ${esc(t.name)} survey, as published.</span></div></div>`).join('')}${chosen.length ? `<p class="small muted">${PRIVACY_LINE}</p>` : ''}
      ${act(true, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  // review
  return `${head(n, 'Ready to launch', 'Check the details, then launch.', '<p class="muted">Launching opens the survey links; nothing is sent to anyone.</p>')}${errBox(errs)}
    <div class="wz-sec"><h3>Details</h3>${locked ? '' : '<button type="button" class="rv-btn quiet" data-wz="edit" data-step="details">Edit</button>'}</div>
    <dl class="kv"><dt>Name</dt><dd>${esc(d.name)}</dd><dt>Project</dt><dd>${esc(proj.name || '')}${isNew ? ' (new)' : ''}</dd>${isNew && (d.newOrg || '').trim() ? `<dt>Lead organisation</dt><dd>${esc(d.newOrg.trim())}</dd>` : ''}<dt>Language</dt><dd>${esc(lang.name || '')}${isNew && (d.newLangCode || '').trim() ? ' · ' + esc(d.newLangCode.trim()) : ''}</dd>${dates(d)}<dt>Material</dt><dd>${esc(d.purpose || 'Not set')}</dd></dl>
    <div class="wz-sec"><h3>Who will participate</h3>${locked ? '' : '<button type="button" class="rv-btn quiet" data-wz="edit" data-step="participants">Edit</button>'}</div>
    <dl class="kv">${chosen.map(t => { const N = expectedValue(d.groups[t.id].expected); return `<dt><span class="pdot wz-kvdot ${pdot(t.perspective)}" aria-hidden="true"></span>${esc(t.perspective)}</dt><dd>${N ? `${N} expected` : 'no number given'}</dd>`; }).join('')}</dl>
    <div class="wz-sec"><h3>Participant information</h3>${locked ? '' : '<button type="button" class="rv-btn quiet" data-wz="edit" data-step="information">Edit</button>'}</div>
    <dl class="kv"><dt>Shown to everyone</dt><dd>${esc([proj.name, lang.name, d.purpose.trim(), d.format, periodText(packPeriod(d.starts, d.until))].filter(Boolean).join(' · '))}</dd><dt>Asked of each</dt><dd>The published survey questions for each group</dd></dl>
    ${locked && locked.links?.length ? `<h3>Links already opened — copy them now</h3>${linkList(locked.links, origin, templates)}` : ''}
    ${locked ? `<div class="actions"><button type="button" class="rv-btn quiet" data-wz="cancel">Leave setup (what was created stays; nothing was sent)</button><span class="spacer"></span><button type="button" class="primary" data-wz="launch">Continue the launch</button></div>` : act(true, '<button type="button" class="primary" data-wz="launch">Launch the review</button>')}`;
}

// B36: one row per group (group · survey) with Copy link and Show QR code — the Share card's shared rows (assess/share.js).
export function linkRows(links, origin, templates) {
  const tpl = id => templates.find(t => t.id === id) || {};
  const url = l => { try { return shareUrl(origin, l.entry_fragment); } catch { return ''; } };
  return links.map(l => { const group = tpl(l.template).perspective || l.template; return { key: l.survey || l.template, group, survey: tpl(l.template).name || 'Survey', line: whoLine(group) || group, url: url(l) }; });
}
// B08+B20: the launched rows sit under their group's who-line (same shared line as step 2 and Collect); rows themselves unchanged.
function linkList(links, origin, templates) {
  const rows = linkRows(links, origin, templates), groups = new Map();
  for (const r of rows) { const w = whoLine(r.group); if (!groups.has(w)) groups.set(w, []); groups.get(w).push(r); }
  return `<div class="wz-links">${[...groups].map(([w, rs]) => `${w ? `<p class="small muted wz-pnote" data-who>${esc(w)}</p>` : ''}${groupLinks({ esc }, rs)}`).join('')}</div>`;
}
export function renderDone(ctx, origin = '', templates = []) {
  return `<div class="eyebrow">Launched</div><h1 class="wz-h">The review is collecting responses</h1>
    <p class="muted">Share each link with its group.</p>${learnMore('<p class="muted">Nothing was sent to anyone.</p>')}
    ${linkList(ctx.links, origin, templates)}${(ctx.links || []).length ? printAllButton({ esc }) : ''}
    <div class="actions"><span class="spacer"></span><button type="button" class="primary" data-wz="open" data-aid="${esc(ctx.aid)}">Open the review</button></div>`;
}

// ---------- mount ----------
// deps: { api(url, {method, body}) → result, go(hash), assessmentHref(aid), origin, store, resume? (B06: saved draft's assessment id) }
export function mountWizard(root, deps) {
  ensureStepperStyle(root?.ownerDocument);
  const s = { step: 'details', d: freshDraft(), data: { projects: [], languages: [], templates: [] }, errs: [], busy: false, done: null, partial: null, langGen: 0, saved: null, saveCtx: null, asking: false };
  let alive = true; const ac = new AbortController(); const on = { signal: ac.signal };
  // B06: only the current step's live form is read on paint; a form left behind by a step change was already read (never undo a save's adoption).
  const paint = () => { if (!alive) return; const live = root.querySelector('form[data-wz-form]'); if (live && !s.done && live.dataset.wzForm === s.step) read(live); root.innerHTML = `<div class="v3-wizard glass panel">${s.done ? renderDone(s.done, deps.origin || '', latestTemplates(s.data.templates)) : renderStep(s.step, s.d, { ...s.data, saved: !!s.saved }, s.errs, s.partial || false, deps.origin || '')}${s.asking && !s.done ? cancelAsk() : ''}</div>`; };
  const note = e => { s.errs = [e?.message || String(e)]; paint(); };
  const loadLanguages = async () => { const g = ++s.langGen, pid = s.d.project; s.data.languages = []; if (pid && pid !== NEW_PROJECT) { const r = await deps.api(`/v2/projects/${enc(pid)}/languages`); if (g !== s.langGen || !alive) return false; s.data.languages = (r.languages || []).filter(l => !l.archived_at); } return true; };
  const read = (form) => {
    const fd = new FormData(form), d = s.d;
    if (form.dataset.wzForm === 'details') for (const k of ['name', 'newProject', 'newOrg', 'newLanguage', 'newLangCode', 'starts', 'until', 'format', 'purpose']) { if (fd.has(k)) d[k] = String(fd.get(k)); }
    if (form.dataset.wzForm === 'details' && fd.has('newOrgPick')) { const v = String(fd.get('newOrgPick')); d.newOrgOther = v === ORG_OTHER; if (!d.newOrgOther) d.newOrg = v; else if (!fd.has('newOrg')) d.newOrg = ''; }
    if (form.dataset.wzForm === 'details') { if (fd.get('project')) d.project = String(fd.get('project')); if (fd.has('language')) { const v = String(fd.get('language')); d.language = s.data.languages.some(l => l.id === v) ? v : ''; } }
    if (form.dataset.wzForm === 'participants') { const g = {}; for (const box of form.querySelectorAll('input[name=g]')) if (box.checked) g[box.value] = { version: box.dataset.version, expected: String(fd.get('n-' + box.value) || '') }; d.groups = g; }
  };
  root.addEventListener('change', async e => {
    if (e.target.name === 'newOrgPick' && !s.partial && !s.busy) { read(e.target.form); paint(); if (s.d.newOrgOther) root.querySelector('input[name=newOrg]')?.focus(); return; }
    if (e.target.name === 'project' && !s.partial && !s.busy) { const f = e.target.form; read(f); s.d.project = e.target.value; s.d.language = ''; s.data.languages = []; s.errs = []; paint(); try { if (!(await loadLanguages())) return; } catch (err) { return note(err); } paint(); }
  }, on);
  // B06: step 1 is saved (first time: savePlan; after: cap.assessment.update with the changed fields only).
  const saveDetails = async () => {
    if (s.saved) {
      const body = detailsPatch(s.saved.snap, s.d); if (!body) return;
      await deps.api(`/v2/assessments/${enc(s.saved.aid)}`, { method: 'PATCH', body });
      s.saved.snap = { ...s.saved.snap, ...body }; return;
    }
    if (s.saveCtx && s.saveCtx.choice !== s.d.project) s.saveCtx = null; // a part-done save is resumed only for the same project choice
    let ctx;
    try { ctx = await launch(s.d, { api: deps.api, store: deps.store, resume: s.saveCtx, plan: savePlan(s.d) }); }
    catch (err) { if (err.ctx && (err.ctx.done.length || err.ctx.pending)) { err.ctx.choice = s.d.project; s.saveCtx = err.ctx; } throw err; }
    const d = s.d;
    if (d.project === NEW_PROJECT) { // the new project is now an existing one: the draft points at it, and it stays fixed
      s.data.projects = [...s.data.projects, { id: ctx.pid, name: d.newProject.trim(), organization: (d.newOrg || '').trim() || null, role: 'owner' }];
      s.data.languages = [{ id: ctx.lid, name: d.newLanguage.trim(), code: (d.newLangCode || '').trim() || null }];
      d.project = ctx.pid; d.language = ctx.lid;
    }
    s.saveCtx = null;
    s.saved = { aid: ctx.aid, pid: ctx.pid, role: 'owner', snap: detailsOf(d), pre: [] }; // cap.assessment.create grants the creator owner
  };
  root.addEventListener('submit', async e => {
    e.preventDefault(); if (s.partial || s.busy) return; read(e.target); s.asking = false;
    s.errs = validateStep(s.step, s.d); if (s.errs.length) return paint();
    if (s.step === 'details') {
      s.busy = true; const btn = e.target.querySelector('button[type=submit]'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
      try { await saveDetails(); }
      catch (err) { if (!alive) return; s.busy = false; return note(new Error(`${err.message || err} ${s.saved ? 'Your changes were not saved; the draft keeps what was saved before.' : 'The review was not saved yet. Continue tries again.'}`)); }
      s.busy = false; if (!alive) return;
    }
    s.step = STEPS[STEPS.indexOf(s.step) + 1] || s.step; paint();
  }, on);
  bindGroupLinks(root, { signal: ac.signal, resolve: async key => (linkRows((s.done || s.partial || {}).links || [], deps.origin || '', latestTemplates(s.data.templates)).find(r => r.key === key) || {}).url });
  // B43: "Print all" — every launched survey on one page (title, one line, QR); the links are the ones already shown.
  bindPrintAll(root, { signal: ac.signal, heading: () => s.d.name, items: async () => linkRows((s.done || {}).links || [], deps.origin || '', latestTemplates(s.data.templates)).map(r => ({ title: r.survey, line: r.line, url: r.url })) });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-wz]'); if (!b) return;
    const act = b.dataset.wz; s.errs = [];
    if (s.busy) return; // nothing moves while a launch is in flight
    if (s.partial && act !== 'launch' && act !== 'cancel') return; // a launch is part-done: the draft is locked so a retry matches the writes already made
    s.asking = false;
    // B06: after step 1 was saved, Cancel asks in the page; Keep leaves the draft for Continue setup, Discard deletes it (U14 flow).
    if (act === 'cancel') { if (s.saved && !s.partial && s.saved.role === 'owner') { s.asking = true; return paint(); } return deps.go?.('#/'); }
    if (act === 'keep') return deps.go?.('#/');
    if (act === 'discard' && s.saved) {
      s.busy = true; let confirmed = null;
      await deleteAssessmentFlow(b, { id: s.saved.aid, api: deps.api, ask: (_b, _sentence, _label, go) => { confirmed = go(); }, // already asked in the page
        onDeleted: () => { s.saved = null; deps.go?.('#/'); }, onRefused: t => note(new Error(t)), onError: err => note(err) });
      await confirmed; s.busy = false; return;
    }
    if (act === 'back') { const f = root.querySelector('form'); if (f) read(f); s.step = STEPS[Math.max(0, STEPS.indexOf(s.step) - 1)]; return paint(); }
    if (act === 'edit') { s.step = b.dataset.step; return paint(); }
    if (act === 'open') return deps.go?.(deps.assessmentHref ? deps.assessmentHref(b.dataset.aid) : `#/a/${enc(b.dataset.aid)}`);
    if (act === 'launch' && !s.busy) {
      s.busy = true; b.disabled = true; b.textContent = 'Launching…';
      try { const done = await launch(s.d, { api: deps.api, store: deps.store, resume: s.partial || (s.saved ? launchResume(s.saved, s.d) : null) }); if (!alive) return; s.done = done; s.partial = null; paint(); }
      catch (err) { if (!alive) return; const c = err.ctx, made = c ? c.done.length - (c.base || 0) : 0; s.partial = (made > 0 || c?.pending) ? c : s.partial; s.step = 'review'; note(new Error(s.partial ? `${err.message || err} ${s.partial.done.length - (s.partial.base || 0)} of the launch writes were done${s.partial.pending ? ' and the last one may have gone through' : ''}. "Continue the launch" checks what was saved and picks up from there; edits stay locked until then.` : `${err.message || err} ${s.saved ? 'Nothing more was saved; the draft is kept.' : 'Nothing was created.'} You can edit and launch again.`)); }
      finally { s.busy = false; }
    }
  }, on);
  (async () => {
    if (deps.resume) root.innerHTML = '<div class="v3-wizard glass panel"><p class="muted">Loading the saved setup…</p></div>'; else paint(); // B06: no empty step 1 while the draft loads
    try {
      const [p, t, r] = await Promise.all([deps.api('/v2/projects'), deps.api('/v2/templates'), deps.resume ? deps.api(`/v2/assessments/${enc(deps.resume)}`) : null]); if (!alive) return;
      s.data.projects = (p.projects || []).filter(x => !x.archived_at && (x.role === 'owner' || x.role === 'member')); s.data.templates = t.templates || [];
      if (r) { // B06: Continue setup — a launched review has no setup left; a draft reopens at its next unfinished step
        const a = r.assessment || {};
        if (a.stage !== 'prepare') return deps.go?.(deps.assessmentHref ? deps.assessmentHref(a.id || deps.resume) : `#/a/${enc(a.id || deps.resume)}`);
        const back = draftFromSaved(a, r.surveys || [], deps.store); s.d = back.d; s.step = back.step; s.saved = back.saved;
        if (!s.data.projects.some(x => x.id === a.project_id)) { const any = (p.projects || []).find(x => x.id === a.project_id); s.data.projects.push({ id: a.project_id, name: any?.name || 'This project' }); }
        await loadLanguages(); if (!alive) return;
      }
      paint();
    }
    catch (err) { // B06: a draft that cannot be read is never replaced by a fresh setup (Continue would make a second review)
      if (!alive) return;
      if (deps.resume && !s.saved) { root.innerHTML = `<div class="v3-wizard glass panel"><h1 class="wz-h">Setup could not be opened</h1><div class="note alert" role="alert">${esc(err?.message || String(err))}</div><div class="actions"><button type="button" class="rv-btn quiet" data-wz="keep">Back to Home</button></div></div>`; return; }
      note(err);
    }
  })();
  return { state: s, destroy() { alive = false; ac.abort(); root.innerHTML = ''; } };
}
