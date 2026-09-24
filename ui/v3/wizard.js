// v3 lane 2 · four-step setup wizard (design-system-v3 CHANGE-MAP "Setup (frames 3 to 6)", PARITY P2/P7/A1/C1).
// Steps: Details · Who will participate? · Participant information · Ready to launch. One primary action per step.
// Contract unchanged (ADOPTION.md): launch maps onto cap.project.create (only for "New project…"), cap.language.create
// (only with a new project), cap.assessment.create, cap.survey.select, cap.assessment.set_stage (collect) and
// cap.survey.issue_link (dry_run → execute). Nothing is sent to anyone; links are opened, not mailed.
// Ruling (a), captain 2026-09-24: "How many do you expect?" is OPTIONAL. The contract stores no expected count, so N lives
// only in this browser (EXPECTED_KEY, best effort) and "n of N" shows only when N was entered; otherwise "n responded".
// Lane 1 owns routing and the shell: this module exports pure helpers plus mountWizard(root, deps); it never touches
// location or the router itself. deps.go(hash) is the shell's navigation.

export const STEPS = ['details', 'participants', 'information', 'review'];
export const STEP_TITLES = ['Details', 'Participants', 'Information', 'Review'];
export const EXPECTED_KEY = 'v3:expected'; // { [surveyId]: N } — device-local, never sent to the API
export const NEW_PROJECT = '__new__';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = encodeURIComponent;

export function freshDraft() {
  return { name: '', project: '', language: '', newProject: '', newLanguage: '', period: '', format: 'Written', purpose: '', followup: false, context: '', groups: {} };
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
    if (d.project === NEW_PROJECT) { if (!d.newProject.trim()) errs.push('Name the new project.'); if (!d.newLanguage.trim()) errs.push('Name the language.'); }
    else if (d.project && !d.language) errs.push('Choose a language.');
  }
  if (step === 'participants' && !Object.keys(d.groups).length) errs.push('Choose at least one group.');
  return errs;
}

// The ordered write plan for "Launch the review". Pure, so the order is testable without a network.
export function launchPlan(d) {
  const plan = [];
  if (d.project === NEW_PROJECT) {
    plan.push({ cap: 'cap.project.create', method: 'POST', url: () => '/v2/projects', body: () => ({ name: d.newProject.trim() }), keep: (r, ctx) => { ctx.pid = r.project.id; } });
    plan.push({ cap: 'cap.language.create', method: 'POST', url: ctx => `/v2/projects/${enc(ctx.pid)}/languages`, body: () => ({ name: d.newLanguage.trim() }), keep: (r, ctx) => { ctx.lid = r.language.id; } });
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

export async function launch(d, { api, store = safeStore() }) {
  const ctx = { pid: d.project === NEW_PROJECT ? null : d.project, lid: d.project === NEW_PROJECT ? null : d.language, aid: null, surveys: [], links: [], done: [] };
  for (const step of launchPlan(d)) {
    if (step.each === 'surveys') {
      for (const s of ctx.surveys) {
        const url = `/v2/assessments/${enc(ctx.aid)}/surveys/${enc(s.id)}/links`;
        const dry = await api(url, { method: 'POST', body: { params: {}, mode: 'dry_run' } });
        const r = await api(url, { method: 'POST', body: { params: {}, mode: 'execute', confirm_token: dry.confirm_token } });
        ctx.links.push({ survey: s.id, entry_fragment: r.entry_fragment, expires_at: r.expires_at || null });
        ctx.done.push(step.cap);
      }
      continue;
    }
    const r = await api(step.url(ctx), { method: step.method, body: step.body(ctx) });
    if (step.keep) step.keep(r, ctx);
    ctx.done.push(step.cap);
  }
  rememberExpected(store, ctx.surveys);
  return ctx;
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
export function stepper(n) {
  return `<ol class="stepper" aria-label="Setup steps">${STEP_TITLES.map((t, i) => `<li class="${i + 1 < n ? 'done' : i + 1 === n ? 'on' : ''}"${i + 1 === n ? ' aria-current="step"' : ''}><i>${i + 1 < n ? '✓' : i + 1}</i><span>${t}</span></li>`).join('')}</ol>`;
}
const head = (n, h, sub) => `<div class="eyebrow">Start a 3D Review · step ${n} of 4</div>${stepper(n)}<h1 class="wz-h">${h}</h1>${sub ? `<p class="muted wz-sub">${sub}</p>` : ''}`;
const errBox = errs => errs?.length ? `<div class="note alert" role="alert">${errs.map(esc).join('<br>')}</div>` : '';
const actions = (back, primary) => `<div class="actions">${back ? `<button type="button" class="rv-btn quiet" data-wz="back">Back</button>` : `<button type="button" class="rv-btn quiet" data-wz="cancel">Cancel</button>`}<span class="spacer"></span>${primary}</div>`;

export function renderStep(step, d, data, errs = []) {
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
      ${isNew ? `<label>Language<input name="newLanguage" value="${esc(d.newLanguage)}" required placeholder="The language this translation is in"></label>` : ''}
      <div class="grid">
        <label>When<input name="period" value="${esc(d.period)}" placeholder="e.g. October 2026"></label>
        <label>Translation format<select name="format">${['Written', 'Audio', 'Sign'].map(f => `<option${f === d.format ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      </div>
      <label>What will participants consider?<input name="purpose" value="${esc(d.purpose)}" placeholder="e.g. The Genesis 1 to 3 draft"></label>
      <label class="choice"><input type="checkbox" name="followup"${d.followup ? ' checked' : ''}>This is a follow-up to an earlier review of the same project</label>
      ${actions(false, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  if (step === 'participants') return `${head(n, 'Who will participate?', 'Three perspectives, kept separate. Choose the groups you can reach.')}${errBox(errs)}
    <form data-wz-form="participants">
      ${templates.length ? templates.map(t => { const g = d.groups[t.id]; return `<div class="group${g ? ' on' : ''}">
        <label class="choice"><input type="checkbox" name="g" value="${esc(t.id)}" data-version="${esc(t.version)}"${g ? ' checked' : ''}><span><b>${esc(t.perspective)}</b><span class="sub">${esc(t.name)}</span></span></label>
        <div class="gin"><label for="n-${esc(t.id)}">How many do you expect?</label><input type="number" id="n-${esc(t.id)}" name="n-${esc(t.id)}" min="1" step="1" inputmode="numeric" value="${g && g.expected ? esc(g.expected) : ''}" placeholder="optional"></div></div>`; }).join('')
        : '<p class="muted">No published surveys are available to this account.</p>'}
      <p class="footer muted">The number is optional. Leave it empty if you don't know for sure; counts then show as "n responded". Groups you leave out can be added later.</p>
      ${actions(true, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  if (step === 'information') return `${head(n, 'Participant information', 'What participants see before they answer.')}${errBox(errs)}
    <form data-wz-form="information">
      <h3>Shown to every participant</h3>
      <dl class="kv"><dt>Project</dt><dd>${esc(proj.name || '')}</dd><dt>Language</dt><dd>${esc(lang.name || '')}</dd><dt>Material</dt><dd>${esc(d.purpose || 'Not set')}</dd><dt>Format</dt><dd>${esc(d.format)}</dd></dl>
      <label>A note for participants (optional)<textarea name="context" rows="2" placeholder="Not stored yet: the product has no field for this note.">${esc(d.context)}</textarea></label>
      <h3>Asked of each participant</h3>
      ${chosen.map(t => `<div class="group"><b>${esc(t.perspective)}</b><span class="sub">The questions in the ${esc(t.name)} survey, as published. Answers are grouped, never shown alone.</span></div>`).join('')}
      ${actions(true, '<button class="primary" type="submit">Continue</button>')}
    </form>`;
  // review
  return `${head(n, 'Ready to launch', 'Check the details. Launching opens the survey links; nothing is sent to anyone.')}${errBox(errs)}
    <div class="wz-sec"><h3>Details</h3><button type="button" class="rv-btn quiet" data-wz="edit" data-step="details">Edit</button></div>
    <dl class="kv"><dt>Name</dt><dd>${esc(d.name)}</dd><dt>Project</dt><dd>${esc(proj.name || '')}${isNew ? ' (new)' : ''}</dd><dt>Language</dt><dd>${esc(lang.name || '')}</dd><dt>When</dt><dd>${esc(d.period || 'Not set')}</dd><dt>Material</dt><dd>${esc(d.purpose || 'Not set')}</dd>${d.followup ? '<dt>Kind</dt><dd>Follow-up</dd>' : ''}</dl>
    <div class="wz-sec"><h3>Who will participate</h3><button type="button" class="rv-btn quiet" data-wz="edit" data-step="participants">Edit</button></div>
    <dl class="kv">${chosen.map(t => { const N = expectedValue(d.groups[t.id].expected); return `<dt>${esc(t.perspective)}</dt><dd>${N ? `${N} expected` : 'no number given'}</dd>`; }).join('')}</dl>
    ${actions(true, '<button type="button" class="primary" data-wz="launch">Launch the review</button>')}`;
}

export function renderDone(ctx, origin = '') {
  return `<div class="eyebrow">Launched</div><h1 class="wz-h">The review is collecting responses</h1>
    <p class="muted">Share each link with its group. Nothing was sent to anyone.</p>
    <ul class="wz-links">${ctx.links.map(l => `<li><input readonly value="${esc(origin + '/' + (l.entry_fragment || ''))}" aria-label="Participant link"></li>`).join('')}</ul>
    <div class="actions"><span class="spacer"></span><button type="button" class="primary" data-wz="open" data-aid="${esc(ctx.aid)}">Open the review</button></div>`;
}

// ---------- mount ----------
// deps: { api(url, {method, body}) → result, go(hash), assessmentHref(aid), origin, store }
export function mountWizard(root, deps) {
  const s = { step: 'details', d: freshDraft(), data: { projects: [], languages: [], templates: [] }, errs: [], busy: false, done: null };
  const paint = () => { root.innerHTML = `<div class="v3-wizard glass panel">${s.done ? renderDone(s.done, deps.origin || '') : renderStep(s.step, s.d, s.data, s.errs)}</div>`; };
  const note = e => { s.errs = [e?.message || String(e)]; paint(); };
  const loadLanguages = async () => { s.data.languages = []; if (s.d.project && s.d.project !== NEW_PROJECT) { const r = await deps.api(`/v2/projects/${enc(s.d.project)}/languages`); s.data.languages = (r.languages || []).filter(l => !l.archived_at); } };
  const read = (form) => {
    const fd = new FormData(form), d = s.d;
    if (form.dataset.wzForm === 'details') for (const k of ['name', 'newProject', 'newLanguage', 'period', 'format', 'purpose']) { if (fd.has(k)) d[k] = String(fd.get(k)); }
    if (form.dataset.wzForm === 'details') { d.followup = fd.has('followup'); if (fd.has('language')) d.language = String(fd.get('language')); }
    if (form.dataset.wzForm === 'participants') { const g = {}; for (const box of form.querySelectorAll('input[name=g]')) if (box.checked) g[box.value] = { version: box.dataset.version, expected: String(fd.get('n-' + box.value) || '') }; d.groups = g; }
    if (form.dataset.wzForm === 'information') d.context = String(fd.get('context') || '');
  };
  root.addEventListener('change', async e => {
    if (e.target.name === 'project') { const f = e.target.form; read(f); s.d.project = e.target.value; s.d.language = ''; s.errs = []; try { await loadLanguages(); } catch (err) { return note(err); } paint(); }
  });
  root.addEventListener('submit', e => {
    e.preventDefault(); read(e.target);
    s.errs = validateStep(s.step, s.d); if (!s.errs.length) s.step = STEPS[STEPS.indexOf(s.step) + 1] || s.step; paint();
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-wz]'); if (!b) return;
    const act = b.dataset.wz; s.errs = [];
    if (act === 'cancel') return deps.go?.('#/');
    if (act === 'back') { const f = root.querySelector('form'); if (f) read(f); s.step = STEPS[Math.max(0, STEPS.indexOf(s.step) - 1)]; return paint(); }
    if (act === 'edit') { s.step = b.dataset.step; return paint(); }
    if (act === 'open') return deps.go?.(deps.assessmentHref ? deps.assessmentHref(b.dataset.aid) : `#/a/${enc(b.dataset.aid)}`);
    if (act === 'launch' && !s.busy) {
      s.busy = true; b.disabled = true; b.textContent = 'Launching…';
      try { s.done = await launch(s.d, { api: deps.api, store: deps.store }); paint(); }
      catch (err) { note(new Error(`${err.message || err} Nothing after this point was done; check the review list before trying again.`)); }
      finally { s.busy = false; }
    }
  });
  (async () => {
    paint();
    try { const [p, t] = await Promise.all([deps.api('/v2/projects'), deps.api('/v2/templates')]); s.data.projects = (p.projects || []).filter(x => !x.archived_at && (x.role === 'owner' || x.role === 'member')); s.data.templates = t.templates || []; paint(); }
    catch (err) { note(err); }
  })();
  return { state: s, destroy() { root.innerHTML = ''; } };
}
