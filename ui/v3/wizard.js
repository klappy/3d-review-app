// v3 lane 2 · four-step setup wizard (design-system-v3 CHANGE-MAP "Setup (frames 3 to 6)", PARITY P2/P7/A1/C1).
// Steps (Bincy 03–06): Assessment details · Who will participate? · Participant information · Review & launch. One primary action per step.
// Contract unchanged (ADOPTION.md): launch maps onto cap.project.create (only for "New project…"), cap.language.create
// (only with a new project), cap.assessment.create, cap.survey.select, cap.assessment.set_stage (collect) and
// cap.survey.issue_link (dry_run → execute). Nothing is sent to anyone; links are opened, not mailed.
// Ruling (a), captain 2026-09-24: "How many do you expect?" is OPTIONAL. The contract stores no expected count, so N lives
// only in this browser (EXPECTED_KEY, best effort) and "n of N" shows only when N was entered; otherwise "n responded".
// Lane 1 owns routing and the shell: this module exports pure helpers plus mountWizard(root, deps); it never touches
// location or the router itself. deps.go(hash) is the shell's navigation.

import { shareUrl } from '../shared-link.js';
import { stepper as stepperComponent, ensureStepperStyle } from './components/stepper.js';

export const STEPS = ['details', 'participants', 'information', 'review'];
// Step names follow Bincy's screen inventory 03–06 (cookbook @933eb5f sources/bincy-design-sprint-2026-09-22/01_documents/04_screen_inventory.md).
// Stepper labels follow the approved design-system-v3 prototype setup view (captain correction 11:14).
export const STEP_TITLES = ['Details', 'Participants', 'Information', 'Review'];
// Perspective colour dot, as the prototype's pdot(); unknown perspectives get the neutral pip.
export const pdot = p => { const s = String(p || '').toLowerCase(); return /team/.test(s) ? 'p-team' : /community/.test(s) ? 'p-community' : /church/.test(s) ? 'p-church' : 'p-reviewer'; };
export const EXPECTED_KEY = 'v3:expected'; // { [surveyId]: N } — device-local, never sent to the API
export const NEW_PROJECT = '__new__';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = encodeURIComponent;
const LANG_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/; // mirrors src/handlers/language.ts CODE (cap.language.create `code`)

export function freshDraft() {
  return { name: '', project: '', language: '', newProject: '', newOrg: '', newLanguage: '', newLangCode: '', period: '', format: 'Written', purpose: '', followup: false, context: '', groups: {} };
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
  }
  if (step === 'participants' && !Object.keys(d.groups).length) errs.push('Choose at least one group.');
  return errs;
}

// The ordered write plan for "Launch the review". Pure, so the order is testable without a network.
export function launchPlan(d) {
  const plan = [];
  if (d.project === NEW_PROJECT) {
    plan.push({ cap: 'cap.project.create', method: 'POST', url: () => '/v2/projects', body: () => ((d.newOrg || '').trim() ? { name: d.newProject.trim(), organization: d.newOrg.trim() } : { name: d.newProject.trim() }), keep: (r, ctx) => { ctx.pid = r.project.id; } });
    plan.push({ cap: 'cap.language.create', method: 'POST', url: ctx => `/v2/projects/${enc(ctx.pid)}/languages`, body: () => ((d.newLangCode || '').trim() ? { name: d.newLanguage.trim(), code: d.newLangCode.trim() } : { name: d.newLanguage.trim() }), keep: (r, ctx) => { ctx.lid = r.language.id; } });
  }
  plan.push({ cap: 'cap.assessment.create', method: 'POST', url: ctx => `/v2/projects/${enc(ctx.pid)}/assessments`, body: ctx => {
    const b = { name: d.name.trim(), language_id: ctx.lid };
    if (d.purpose.trim()) b.purpose = d.purpose.trim();
    if (d.period.trim()) b.period = d.period.trim();
    if (d.format) b.format = d.format;
    return b;
  }, keep: (r, ctx) => { ctx.aid = r.assessment.id; } });
  for (const [tid, g] of Object.entries(d.groups)) {
    plan.push({ cap: 'cap.survey.select', method: 'POST', url: ctx => `/v2/assessments/${enc(ctx.aid)}/surveys`, body: () => ({ template_id: tid, version: Number(g.version) }),
      keep: (r, ctx) => { ctx.surveys.push({ id: r.survey.id, template: tid, expected: expectedValue(g.expected) }); } });
  }
  plan.push({ cap: 'cap.assessment.set_stage', method: 'POST', url: ctx => `/v2/assessments/${enc(ctx.aid)}/stage`, body: () => ({ stage: 'collect' }) });
  plan.push({ cap: 'cap.survey.issue_link', each: 'surveys' });
  return plan;
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
  opts._ctx = ctx;
  let i = 0;
  for (const step of launchPlan(d)) {
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
const head = (n, h, sub) => `<div class="eyebrow">Start a 3D Review · step ${n} of ${STEP_TITLES.length}</div>${stepper(n)}<h1 class="wz-h">${h}</h1>${sub ? `<p class="muted wz-sub">${sub}</p>` : ''}`;
const errBox = errs => errs?.length ? `<div class="note alert" role="alert">${errs.map(esc).join('<br>')}</div>` : '';
const actions = (back, primary) => `<div class="actions">${back ? `<button type="button" class="rv-btn quiet" data-wz="back">Back</button>` : `<button type="button" class="rv-btn quiet" data-wz="cancel">Cancel</button>`}<span class="spacer"></span>${primary}</div>`;

// locked: the partial launch ctx (or true). Links already issued are shown so they are never lost (the server keeps only a hash).
export function renderStep(step, d, data, errs = [], locked = false, origin = '') {
  const n = STEPS.indexOf(step) + 1;
  const projects = data.projects || [], languages = data.languages || [], templates = latestTemplates(data.templates);
  const isNew = d.project === NEW_PROJECT;
  const proj = isNew ? { name: d.newProject } : projects.find(p => p.id === d.project) || {};
  const lang = isNew ? { name: d.newLanguage } : languages.find(l => l.id === d.language) || {};
  const chosen = templates.filter(t => d.groups[t.id]);
  if (step === 'details') return `${head(n, 'Assessment details', 'Only what the review needs. You can change these later.')}${errBox(errs)}
    <form data-wz-form="details">
      <label>Name<input name="name" value="${esc(d.name)}" required placeholder="e.g. October assessment"></label>
      <div class="grid">
        <label>Project<select name="project"><option value=""${d.project ? '' : ' selected'} disabled>Choose…</option>${projects.map(p => `<option value="${esc(p.id)}"${p.id === d.project ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="${NEW_PROJECT}"${isNew ? ' selected' : ''}>New project…</option></select></label>
        ${isNew ? `<label>New project name<input name="newProject" value="${esc(d.newProject)}" required></label>`
          : `<label>Language<select name="language"${d.project ? '' : ' disabled'}><option value=""${d.language ? '' : ' selected'} disabled>${d.project ? (languages.length ? 'Choose…' : 'No languages in this project') : 'Choose a project first'}</option>${languages.map(l => `<option value="${esc(l.id)}"${l.id === d.language ? ' selected' : ''}>${esc(l.name)}${l.code ? ' · ' + esc(l.code) : ''}</option>`).join('')}</select></label>`}
      </div>
      ${isNew ? `<label>Lead organisation<input name="newOrg" value="${esc(d.newOrg || '')}" placeholder="e.g. the organisation leading this translation"></label>` : ''}
      ${isNew ? `<label>Language<input name="newLanguage" value="${esc(d.newLanguage)}" required placeholder="The language this translation is in"></label><label>Language code (ISO 639, optional)<input name="newLangCode" value="${esc(d.newLangCode || '')}" placeholder="e.g. hil — qaa–qtz if unlisted" autocapitalize="off" spellcheck="false"></label>` : ''}
      <div class="grid">
        <label>When<input name="period" value="${esc(d.period)}" placeholder="e.g. October 2026"></label>
        <label>Translation format<select name="format">${['Written', 'Audio', 'Sign'].map(f => `<option${f === d.format ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      </div>
      <label>What will participants consider?<input name="purpose" value="${esc(d.purpose)}" placeholder="e.g. The Genesis 1 to 3 draft"></label>
      <label class="choice"><input type="checkbox" name="followup"${d.followup ? ' checked' : ''}>This is a follow-up to an earlier review of the same project <span class="sub">(not stored yet: the product has no field for it)</span></label>
      ${actions(false, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  if (step === 'participants') return `${head(n, 'Who will participate?', 'Three perspectives, kept separate. Choose the groups you can reach.')}${errBox(errs)}
    <form data-wz-form="participants">
      ${templates.length ? templates.map(t => { const g = d.groups[t.id]; return `<div class="group${g ? ' on' : ''}"><span class="pdot ${pdot(t.perspective)}" aria-hidden="true"></span>
        <label class="choice"><input type="checkbox" name="g" value="${esc(t.id)}" data-version="${esc(t.version)}"${g ? ' checked' : ''}><span><h3>${esc(t.perspective)}</h3><span class="sub">${esc(t.name)}</span></span></label>
        <div class="gin"><label for="n-${esc(t.id)}">How many do you expect?</label><input type="number" id="n-${esc(t.id)}" name="n-${esc(t.id)}" min="1" step="1" inputmode="numeric" value="${g && g.expected ? esc(g.expected) : ''}" placeholder="optional"></div></div>`; }).join('')
        : '<p class="muted">No published surveys are available to this account.</p>'}
      <p class="footer muted">The number is optional. Leave it empty if you don't know for sure; counts then show as "n responded". Groups you leave out can be added later.</p>
      ${actions(true, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  if (step === 'information') return `${head(n, 'Participant information', 'What participants see before they answer.')}${errBox(errs)}
    <form data-wz-form="information">
      <h3>Shown to every participant</h3>
      <dl class="kv"><dt>Project</dt><dd>${esc(proj.name || '')}</dd><dt>Language</dt><dd>${esc(lang.name || '')}</dd><dt>Material</dt><dd>${esc(d.purpose || 'Not set')}</dd><dt>Format</dt><dd>${esc(d.format)}</dd></dl>
      <label>A note for participants (optional)<textarea name="context" rows="2" placeholder="Not sent to participants yet: this note is not saved.">${esc(d.context)}</textarea></label>
      <h3>Asked of each participant</h3>
      ${chosen.map(t => `<div class="group"><span class="pdot ${pdot(t.perspective)}" aria-hidden="true"></span><div><h3>${esc(t.perspective)}</h3><span class="sub">The questions in the ${esc(t.name)} survey, as published. Answers are grouped, never shown alone.</span></div></div>`).join('')}
      ${actions(true, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  // review
  return `${head(n, 'Ready to launch', 'Check the details. Launching opens the survey links; nothing is sent to anyone.')}${errBox(errs)}
    <div class="wz-sec"><h3>Details</h3>${locked ? '' : '<button type="button" class="rv-btn quiet" data-wz="edit" data-step="details">Edit</button>'}</div>
    <dl class="kv"><dt>Name</dt><dd>${esc(d.name)}</dd><dt>Project</dt><dd>${esc(proj.name || '')}${isNew ? ' (new)' : ''}</dd>${isNew && (d.newOrg || '').trim() ? `<dt>Lead organisation</dt><dd>${esc(d.newOrg.trim())}</dd>` : ''}<dt>Language</dt><dd>${esc(lang.name || '')}${isNew && (d.newLangCode || '').trim() ? ' · ' + esc(d.newLangCode.trim()) : ''}</dd><dt>When</dt><dd>${esc(d.period || 'Not set')}</dd><dt>Material</dt><dd>${esc(d.purpose || 'Not set')}</dd></dl>
    <div class="wz-sec"><h3>Who will participate</h3>${locked ? '' : '<button type="button" class="rv-btn quiet" data-wz="edit" data-step="participants">Edit</button>'}</div>
    <dl class="kv">${chosen.map(t => { const N = expectedValue(d.groups[t.id].expected); return `<dt><span class="pdot wz-kvdot ${pdot(t.perspective)}" aria-hidden="true"></span>${esc(t.perspective)}</dt><dd>${N ? `${N} expected` : 'no number given'}</dd>`; }).join('')}</dl>
    <div class="wz-sec"><h3>Participant information</h3>${locked ? '' : '<button type="button" class="rv-btn quiet" data-wz="edit" data-step="information">Edit</button>'}</div>
    <dl class="kv"><dt>Shown to everyone</dt><dd>${esc([proj.name, lang.name, d.purpose.trim(), d.format].filter(Boolean).join(' · '))}</dd><dt>Note for participants</dt><dd>${d.context.trim() ? `${esc(d.context.trim())} <span class="sub">(not sent yet: this note is not saved with the review)</span>` : 'None'}</dd><dt>Asked of each</dt><dd>The published survey questions for each group</dd></dl>
    ${locked && locked.links?.length ? `<h3>Links already opened — copy them now</h3>${linkList(locked.links, origin, templates)}` : ''}
    ${locked ? `<div class="actions"><button type="button" class="rv-btn quiet" data-wz="cancel">Leave setup (what was created stays; nothing was sent)</button><span class="spacer"></span><button type="button" class="primary" data-wz="launch">Continue the launch</button></div>` : actions(true, '<button type="button" class="primary" data-wz="launch">Launch the review</button>')}`;
}

function linkList(links, origin, templates) {
  const name = id => (templates.find(t => t.id === id) || {}).perspective || id;
  const url = l => { try { return shareUrl(origin, l.entry_fragment); } catch { return ''; } };
  return `<ul class="wz-links">${links.map(l => `<li><label>${esc(name(l.template))}<input readonly value="${esc(url(l))}"></label></li>`).join('')}</ul>`;
}
export function renderDone(ctx, origin = '', templates = []) {
  return `<div class="eyebrow">Launched</div><h1 class="wz-h">The review is collecting responses</h1>
    <p class="muted">Share each link with its group. Nothing was sent to anyone.</p>
    ${linkList(ctx.links, origin, templates)}
    <div class="actions"><span class="spacer"></span><button type="button" class="primary" data-wz="open" data-aid="${esc(ctx.aid)}">Open the review</button></div>`;
}

// ---------- mount ----------
// deps: { api(url, {method, body}) → result, go(hash), assessmentHref(aid), origin, store }
export function mountWizard(root, deps) {
  ensureStepperStyle(root?.ownerDocument);
  const s = { step: 'details', d: freshDraft(), data: { projects: [], languages: [], templates: [] }, errs: [], busy: false, done: null, partial: null, langGen: 0 };
  let alive = true; const ac = new AbortController(); const on = { signal: ac.signal };
  const paint = () => { if (!alive) return; const live = root.querySelector('form[data-wz-form]'); if (live && !s.done) read(live); root.innerHTML = `<div class="v3-wizard glass panel">${s.done ? renderDone(s.done, deps.origin || '', latestTemplates(s.data.templates)) : renderStep(s.step, s.d, s.data, s.errs, s.partial || false, deps.origin || '')}</div>`; };
  const note = e => { s.errs = [e?.message || String(e)]; paint(); };
  const loadLanguages = async () => { const g = ++s.langGen, pid = s.d.project; s.data.languages = []; if (pid && pid !== NEW_PROJECT) { const r = await deps.api(`/v2/projects/${enc(pid)}/languages`); if (g !== s.langGen || !alive) return false; s.data.languages = (r.languages || []).filter(l => !l.archived_at); } return true; };
  const read = (form) => {
    const fd = new FormData(form), d = s.d;
    if (form.dataset.wzForm === 'details') for (const k of ['name', 'newProject', 'newOrg', 'newLanguage', 'newLangCode', 'period', 'format', 'purpose']) { if (fd.has(k)) d[k] = String(fd.get(k)); }
    if (form.dataset.wzForm === 'details') { d.followup = fd.has('followup'); if (fd.get('project')) d.project = String(fd.get('project')); if (fd.has('language')) { const v = String(fd.get('language')); d.language = s.data.languages.some(l => l.id === v) ? v : ''; } }
    if (form.dataset.wzForm === 'participants') { const g = {}; for (const box of form.querySelectorAll('input[name=g]')) if (box.checked) g[box.value] = { version: box.dataset.version, expected: String(fd.get('n-' + box.value) || '') }; d.groups = g; }
    if (form.dataset.wzForm === 'information') d.context = String(fd.get('context') || '');
  };
  root.addEventListener('change', async e => {
    if (e.target.name === 'project' && !s.partial && !s.busy) { const f = e.target.form; read(f); s.d.project = e.target.value; s.d.language = ''; s.data.languages = []; s.errs = []; paint(); try { if (!(await loadLanguages())) return; } catch (err) { return note(err); } paint(); }
  }, on);
  root.addEventListener('submit', e => {
    e.preventDefault(); if (s.partial || s.busy) return; read(e.target);
    s.errs = validateStep(s.step, s.d); if (!s.errs.length) s.step = STEPS[STEPS.indexOf(s.step) + 1] || s.step; paint();
  }, on);
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-wz]'); if (!b) return;
    const act = b.dataset.wz; s.errs = [];
    if (s.busy) return; // nothing moves while a launch is in flight
    if (s.partial && act !== 'launch' && act !== 'cancel') return; // a launch is part-done: the draft is locked so a retry matches the writes already made
    if (act === 'cancel') return deps.go?.('#/');
    if (act === 'back') { const f = root.querySelector('form'); if (f) read(f); s.step = STEPS[Math.max(0, STEPS.indexOf(s.step) - 1)]; return paint(); }
    if (act === 'edit') { s.step = b.dataset.step; return paint(); }
    if (act === 'open') return deps.go?.(deps.assessmentHref ? deps.assessmentHref(b.dataset.aid) : `#/a/${enc(b.dataset.aid)}`);
    if (act === 'launch' && !s.busy) {
      s.busy = true; b.disabled = true; b.textContent = 'Launching…';
      try { const done = await launch(s.d, { api: deps.api, store: deps.store, resume: s.partial }); if (!alive) return; s.done = done; s.partial = null; paint(); }
      catch (err) { if (!alive) return; s.partial = (err.ctx?.done.length || err.ctx?.pending) ? err.ctx : s.partial; s.step = 'review'; note(new Error(s.partial ? `${err.message || err} ${s.partial.done.length} of the launch writes were done${s.partial.pending ? ' and the last one may have gone through' : ''}. "Continue the launch" checks what was saved and picks up from there; edits stay locked until then.` : `${err.message || err} Nothing was created. You can edit and launch again.`)); }
      finally { s.busy = false; }
    }
  }, on);
  (async () => {
    paint();
    try { const [p, t] = await Promise.all([deps.api('/v2/projects'), deps.api('/v2/templates')]); if (!alive) return; s.data.projects = (p.projects || []).filter(x => !x.archived_at && (x.role === 'owner' || x.role === 'member')); s.data.templates = t.templates || []; paint(); }
    catch (err) { note(err); }
  })();
  return { state: s, destroy() { alive = false; ac.abort(); root.innerHTML = ''; } };
}
