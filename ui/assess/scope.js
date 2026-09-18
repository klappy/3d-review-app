// Scope pages — entry · workspaces · workspace · projects · project (UI overhaul contract, 2026-09-17).
// Each page = { load(ctx, params) → model, render(ctx, model) → html, bind(ctx, root, model) }.
// ctx = { api, esc, enc, go, note(msg, alert), state, routes, cards, setToken? }.
// Layout comes from the showcase (projectsView / workspaceView / createView, welcome root). Legacy app.js is behaviour reference only.
// Pure render: HTML strings, every text value through ctx.esc. No DOM access outside bind().

const UNAUTHENTICATED = new Set(['NOT_AUTHENTICATED', '401']);
const REFUSED = new Set(['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_AUTHORIZED', '403', '404']);
const NOT_BUILT = new Set(['RESERVED_NOT_BUILT', '501']);
const CAN_EDIT = new Set(['owner', 'member']);

// ---------- shared: error classification and panels ----------
export function classify(e) {
  const code = String(e?.code ?? '');
  if (UNAUTHENTICATED.has(code)) return 'unauthenticated';
  if (REFUSED.has(code)) return 'refused';
  if (NOT_BUILT.has(code)) return 'not_built';
  return 'failed';
}
const fail = (e, message) => ({ status: classify(e), error: message(e) });
const safeMessage = e => String(e?.message || 'Request could not be completed.');

function signInPanel(ctx) {
  return `<div class="narrow"><section class="panel"><p class="eyebrow">Sign in</p><h1>Sign in to continue</h1><p class="muted">This page needs a facilitator session.</p><div class="actions"><a class="button primary" href="${ctx.routes.entry}">Go to sign in</a><a class="quiet button" href="/v2/auth/access">Sign in with email code</a></div></section></div>`;
}
function refusedPanel(ctx, back) {
  return `<div class="narrow">${back ? `<a class="back" href="${ctx.esc(back.href)}">← ${ctx.esc(back.label)}</a>` : ''}<section class="panel"><p class="eyebrow">Not visible to you</p><h1>Nothing to show here</h1><p class="muted">Either this does not exist or your account has no role on it. Ask an owner to invite you.</p></section></div>`;
}
function notBuiltPanel(ctx, back) {
  return `<div class="narrow">${back ? `<a class="back" href="${ctx.esc(back.href)}">← ${ctx.esc(back.label)}</a>` : ''}<section class="panel"><p class="eyebrow">Not built</p><h1>This part is not built yet</h1><p class="muted">The server reserves this capability but has not implemented it.</p></section></div>`;
}
function failedPanel(ctx, model, back) {
  return `<div class="narrow">${back ? `<a class="back" href="${ctx.esc(back.href)}">← ${ctx.esc(back.label)}</a>` : ''}<section class="panel"><p class="eyebrow">Could not load</p><h1>Something went wrong</h1><p class="muted">${ctx.esc(model.error)}</p><div class="actions"><button type="button" class="primary" data-act="retry">Retry</button></div></section></div>`;
}
// Renders the failure state for a loaded model, or null when the model is 'loaded'.
function gate(ctx, model, back) {
  switch (model.status) {
    case 'unauthenticated': return signInPanel(ctx);
    case 'refused': return refusedPanel(ctx, back);
    case 'not_built': return notBuiltPanel(ctx, back);
    case 'failed': return failedPanel(ctx, model, back);
    default: return null;
  }
}
// Retry re-runs load() then re-renders and re-binds in place. Every page's bind() starts here.
function bindRetry(ctx, root, page, model) {
  const b = root.querySelector('[data-act="retry"]');
  if (!b) return;
  b.addEventListener('click', async () => {
    b.disabled = true;
    const next = await page.load(ctx, model.params || {});
    root.innerHTML = page.render(ctx, next);
    page.bind(ctx, root, next);
  });
}
// A write: disables the trigger while in flight, reports the server outcome, never claims success without it.
async function write(ctx, control, label, fn) {
  const controls = control ? [control, ...(control.form ? Array.from(control.form.querySelectorAll('button')) : [])] : [];
  for (const c of controls) c.disabled = true;
  try { const r = await fn(); return r; }
  catch (e) {
    const kind = classify(e);
    ctx.note(kind === 'unauthenticated' ? 'Your session has ended. Sign in again.' : kind === 'refused' ? 'Not allowed here.' : `${label} failed: ${safeMessage(e)}`, true);
    return undefined;
  }
  finally { for (const c of controls) c.disabled = false; }
}
const val = (form, name) => String(form.elements[name]?.value ?? '').trim();
const storeSession = (key, v) => { try { sessionStorage.setItem(key, v); } catch {} };
const dropSession = key => { try { sessionStorage.removeItem(key); } catch {} };

// ---------- entry (public) ----------
export const TOUR = Object.freeze([
  { label: 'Prepare', title: 'Give your review a clear starting point.', desc: 'Choose your project, then set up an assessment for a particular period and target language.', example: 'Project → Assessment. Each new assessment keeps its own responses and findings.', chips: ['Target language', 'Written, audio or sign'] },
  { label: 'Collect', title: 'Invite the people whose voices matter.', desc: 'Choose the relevant surveys and share participant links. Ask people to use the survey link you share.', example: 'A direct route to feedback: participants open their survey link to give feedback.', chips: ['Share a link', 'QR code', 'Facilitated or paper'] },
  { label: 'Understand', title: 'Read the perspectives together.', desc: 'See where experiences align and where they differ. Check whose feedback is missing before drawing conclusions.', example: 'Review translation team, community and church perspectives separately. Small-group results may be withheld to protect participants. A missing response is not a poor result.', chips: [] },
  { label: 'Improve', title: 'Agree on a useful next step.', desc: 'Review the findings before sharing. Choose an action, name an owner and return for a later assessment to learn what changed.', example: 'From discussion to action: what will we try? Who will lead it? When will we review it?', chips: ['Review findings', 'Agree on action', 'Reassess'] },
  { label: 'Repeat', title: 'Repeat when it is appropriate.', desc: 'Start a new assessment when your project is ready to reflect again and learn what changed.', example: 'Choose a useful moment. This could be between books or publishing iterations. There is no fixed weekly, monthly or yearly schedule.', chips: [] },
]);
const PERSPECTIVES = [['team', 'Translation team', 'Experience of the work'], ['community', 'Community', 'Experience of the translation'], ['church', 'Church', 'Experience of its use']];

// Entry model: { status:'loaded', mode: 'welcome'|'tour'|'survey'|'example'|'signin', step, signin:{email, devCode, stage:'email'|'code'}, example, exampleStatus }
function entryModel(over = {}) {
  return { status: 'loaded', mode: 'welcome', step: 0, signin: { email: '', devCode: null, stage: 'email' }, example: null, exampleStatus: null, exampleError: '', params: {}, ...over };
}
function hero(ctx, signedIn) {
  const p = ctx.state.principal;
  const continueCards = signedIn ? `<section class="panel"><p class="eyebrow">Signed in${p?.id ? ` · ${ctx.esc(p.id)}` : ''}</p><h2>Continue</h2><div class="project-grid">${ctx.cards.card({ eyebrow: 'Continue', title: 'Workspaces', href: ctx.routes.workspaces, meta: ['Optional groupings of projects you can already open'] })}${ctx.cards.card({ eyebrow: 'Continue', title: 'Projects', href: ctx.routes.projects, meta: ['All projects your account holds a role on'] })}</div><div class="actions"><button type="button" class="quiet" data-act="signout">Sign out</button></div></section>` : '';
  // Public home contract (ui/public-choices.test.mjs, captain-named): exactly these four choices, in this order, above the headline;
  // Sign in goes straight to the real provider; sandbox sign-in only by explicit choice (#signin). Retired labels never return.
  const choices = `<nav class="public-choices actions" aria-label="Choose where to start" style="margin-top:0"><a class="rv-btn" href="#public-about">Read about it</a><a class="rv-btn" href="#how">Take the tour</a><a class="rv-btn" href="#participant">Take a survey</a><a class="rv-btn primary" href="/v2/auth/access">Sign in</a></nav>`;
  return `<section class="hero panel" id="public-home">${choices}<p class="eyebrow" id="public-about">What is 3D Review?</p><h1>Three perspectives.<br>One useful next step.</h1><p class="muted lead">3D Review brings translation team, community and church perspectives together to understand a project and choose useful next steps.</p><div class="perspectives">${PERSPECTIVES.map(([k, t, s]) => `<div class="perspective"><span class="dot-lg ${k}" aria-hidden="true"></span><strong>${ctx.esc(t)}</strong><small>${ctx.esc(s)}</small></div>`).join('')}</div><p class="small muted">The tour: 5 short steps · Go at your own pace · Nothing is sent</p><p class="small"><a href="#example">Browse a sample assessment (invented data) →</a> · <a href="#reports-card">View a shared report</a>${signedIn ? '' : ' · <a href="#signin">Sandbox test identities (dev only) — not a real sign-in</a>'}</p><details class="small"><summary>When should I use it? How often?</summary><p class="muted">Use it when your project is ready to pause, reflect and learn from feedback. Repeat when a new assessment would be useful — for example, between books or publishing iterations.</p></details></section>${continueCards}`;
}
function tourView(ctx, step) {
  const p = TOUR[step];
  const last = step === TOUR.length - 1;
  return `<section class="panel stepper" aria-label="Step ${step + 1} of ${TOUR.length}"><div class="progress">${TOUR.map((_, i) => `<span class="${i <= step ? 'done' : ''}"></span>`).join('')}</div><p class="eyebrow">Guided tour · nothing is sent · Step ${step + 1} of ${TOUR.length} · ${ctx.esc(p.label)}</p><h1>${ctx.esc(p.title)}</h1><p class="muted lead">${ctx.esc(p.desc)}</p><div class="note"><p>${ctx.esc(p.example)}</p>${p.chips.map(c => `<span class="badge">${ctx.esc(c)}</span>`).join(' ')}</div><div class="actions"><button type="button" class="primary" data-act="${last ? 'finish' : 'next'}">${last ? 'Go to project setup →' : 'Next →'}</button><button type="button" class="quiet" data-act="back">Back</button><button type="button" class="quiet" data-act="finish">Skip tour</button></div></section>`;
}
function surveyView(ctx) {
  return `<section class="panel narrow"><p class="eyebrow">For participants</p><h1>Your feedback starts with your invitation.</h1><p class="muted">Open the survey link or scan the QR code your facilitator shared, or enter the access code below.</p><form id="code-form"><label class="field">Access code<input name="code" required autocomplete="off" maxlength="64"></label><div class="actions"><button class="primary" type="submit">Open my survey</button><button type="button" class="quiet" data-act="welcome">Back to welcome</button></div></form><p class="small muted">Cannot find your invitation? Ask your facilitator to send it again. You do not need a facilitator account to follow a participant link.</p></section>`;
}
function exampleView(ctx, model) {
  const back = `<div class="actions"><button type="button" class="quiet" data-act="welcome">Back to welcome</button></div>`;
  if (model.exampleStatus === 'failed') return `<section class="panel narrow"><p class="eyebrow">Example</p><h1>Could not load the example</h1><p class="muted">${ctx.esc(model.exampleError)}</p><div class="actions"><button type="button" class="primary" data-act="example">Retry</button><button type="button" class="quiet" data-act="welcome">Back to welcome</button></div></section>`;
  const a = model.example?.assessment || {};
  const cov = a.summary?.coverage || {}, bands = a.summary?.bands || {};
  const surveys = (a.surveys || []).map(s => ctx.cards.card({ eyebrow: 'Survey (fixture)', title: s.template || s.id, meta: [s.responses !== undefined ? `${s.responses} responses` : ''] }));
  return `<section class="panel"><p class="eyebrow">Example · fixture data, not a real project</p><div class="title"><div><h1>${ctx.esc(a.name || 'Example assessment')}</h1><p class="muted">Language: ${ctx.esc(a.language || '')}</p></div><span class="badge">${ctx.cards.stageLabel(a.stage)}</span></div><p class="note small">This is a read-only illustration. Nothing here is saved and no real participant data is shown.</p><h2>Surveys</h2>${ctx.cards.cardGrid(surveys, 'No surveys in the fixture.')}<h2 style="margin-top:22px">Summary</h2><div class="grid"><div class="panel"><p class="eyebrow">Coverage</p>${Object.keys(cov).map(k => `<p class="small"><strong>${ctx.esc(k)}</strong>: ${ctx.esc(cov[k])}</p>`).join('') || '<p class="muted small">None</p>'}</div><div class="panel"><p class="eyebrow">Bands</p>${Object.keys(bands).map(k => `<p class="small"><strong>${ctx.esc(k)}</strong>: ${ctx.esc(bands[k])}</p>`).join('') || '<p class="muted small">None</p>'}</div></div>${back}</section>`;
}
function signinView(ctx, model) {
  const s = model.signin;
  const codeStep = s.stage === 'code';
  return `<section class="panel narrow"><p class="eyebrow">Facilitators</p><h1>Sign in</h1><p><a class="button primary" href="/v2/auth/access">Sign in with an email code</a></p><p class="small muted">Cloudflare sends a one-time code to your email; nothing to remember.</p><details class="sandbox-signin" id="sandbox-signin"${codeStep ? ' open' : ''}><summary>Sandbox test identities (dev only) — not a real sign-in</summary><form id="signin-form" data-stage="${codeStep ? 'code' : 'email'}"><label class="field">Email<input name="email" type="email" required autocomplete="email" value="${ctx.esc(s.email)}"${codeStep ? ' readonly' : ''}></label>${codeStep ? `${s.devCode ? `<p class="note small">Sandbox code: <strong>${ctx.esc(s.devCode)}</strong></p>` : '<p class="small muted">Code requested. Enter the code you received.</p>'}<label class="field">Code<input name="code" required autocomplete="one-time-code" inputmode="numeric"></label>` : ''}<div class="actions"><button class="primary" type="submit">${codeStep ? 'Sign in' : 'Send me a code'}</button><button type="button" class="quiet" data-act="welcome">Back to welcome</button></div></form></details></section>`;
}
async function loadExample(ctx, model) {
  try { model.example = await ctx.api('/v2/example'); model.exampleStatus = 'loaded'; }
  catch (e) { model.example = null; model.exampleStatus = 'failed'; model.exampleError = safeMessage(e); }
  model.mode = 'example';
}
const entry = {
  // Legacy public deep links kept: #how → tour, #example → example, #signin → sign-in (the four entry choices stay addressable).
  async load(ctx, params = {}) { const mode = { how: 'tour', signin: 'signin', survey: 'survey' }[params.intent] || 'welcome'; const model = entryModel({ params, mode }); if (params.intent === 'example') await loadExample(ctx, model); return model; },
  render(ctx, model) {
    const signedIn = !!ctx.state.principal;
    switch (model.mode) {
      case 'tour': return tourView(ctx, model.step);
      case 'survey': return surveyView(ctx);
      case 'example': return exampleView(ctx, model);
      case 'signin': return signinView(ctx, model);
      default: return hero(ctx, signedIn);
    }
  },
  bind(ctx, root, model) {
    const paint = () => { root.innerHTML = entry.render(ctx, model); entry.bind(ctx, root, model); };
    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async () => {
      switch (b.dataset.act) {
        case 'welcome': model.mode = 'welcome'; model.step = 0; return paint();
        case 'tour': model.mode = 'tour'; model.step = 0; return paint();
        case 'next': model.step = Math.min(model.step + 1, TOUR.length - 1); return paint();
        case 'back': if (model.step > 0) model.step--; else model.mode = 'welcome'; return paint();
        case 'finish': if (ctx.state.principal) return ctx.go(ctx.routes.projects); model.mode = 'signin'; return paint();
        case 'survey': model.mode = 'survey'; return paint();
        case 'signin': model.mode = 'signin'; return paint();
        case 'example': { b.disabled = true; await loadExample(ctx, model); return paint(); }
        case 'signout': {
          await write(ctx, b, 'Sign out', () => ctx.api('/v2/auth/session', { method: 'DELETE' }));
          dropSession('facilitatorToken'); if (ctx.setToken) ctx.setToken(null); ctx.state.principal = null;
          ctx.note('Signed out.'); return paint();
        }
      }
    }));
    root.querySelector('#code-form')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Code', () => ctx.api('/v2/participate/code', { method: 'POST', body: { code: val(form, 'code') } }));
      if (!r) return;
      const token = r.participant_token || r.participant;
      if (!token) return ctx.note('The server accepted the code but returned no participant token.', true);
      storeSession('participantToken', token);
      window.location.assign('/legacy/#participant'); // participant flow stays on the legacy surface (unchanged)
    });
    root.querySelector('#signin-form')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      const submit = form.querySelector('button[type=submit]');
      if (form.dataset.stage === 'email') {
        model.signin.email = val(form, 'email');
        const r = await write(ctx, submit, 'Code request', () => ctx.api('/v2/auth/link', { method: 'POST', body: { email: model.signin.email } }));
        if (!r) return;
        model.signin.devCode = r.dev_only_code || null; model.signin.stage = 'code';
        return paint();
      }
      const r = await write(ctx, submit, 'Sign in', () => ctx.api('/v2/auth/session', { method: 'POST', body: { email: model.signin.email, code: val(form, 'code') } }));
      if (!r) return;
      if (!r.session) return ctx.note('The server answered without a session token.', true);
      storeSession('facilitatorToken', r.session);
      if (ctx.setToken) ctx.setToken(r.session);
      ctx.note('Signed in.');
      ctx.go(ctx.routes.workspaces);
    });
  },
};

// ---------- workspaces ----------
const workspaces = {
  async load(ctx, params = {}) {
    try { const r = await ctx.api('/v2/workspaces'); return { status: 'loaded', params, workspaces: r.workspaces || [] }; }
    catch (e) { return { ...fail(e, safeMessage), params }; }
  },
  render(ctx, model) {
    const g = gate(ctx, model); if (g) return g;
    return `<div class="title"><div><p class="eyebrow">Optional grouping</p><h1>Your workspaces</h1><p class="muted">Group projects you can already open. A workspace does not add access to other projects.</p></div><a class="button" href="${ctx.routes.projects}">All projects</a></div>${ctx.cards.cardGrid(model.workspaces.map(ctx.cards.workspaceCard), 'You have no workspaces yet.')}<section class="panel" style="margin-top:22px"><h2>Create a workspace</h2><form id="create-workspace"><label class="field">Workspace name<input name="name" maxlength="100" required placeholder="For example, Lake region"></label><div class="actions"><button class="primary" type="submit">Create workspace</button></div></form></section>`;
  },
  bind(ctx, root, model) {
    bindRetry(ctx, root, workspaces, model);
    root.querySelector('#create-workspace')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Create workspace', () => ctx.api('/v2/workspaces', { method: 'POST', body: { name: val(form, 'name') } }));
      if (r?.workspace?.id) ctx.go(ctx.routes.workspace(r.workspace.id));
      else if (r) ctx.note('Created, but the server returned no workspace id.', true);
    });
  },
};

// ---------- workspace ----------
const workspace = {
  async load(ctx, params = {}) {
    const id = params.id;
    let core;
    try { core = await ctx.api(`/v2/workspaces/${ctx.enc(id)}`); }
    catch (e) { return { ...fail(e, safeMessage), params }; }
    const model = { status: 'loaded', params, workspace: core.workspace || {}, projects: core.projects || [], candidates: [], candidatesStatus: 'skipped' };
    if (CAN_EDIT.has(model.workspace.role)) {
      // Projects the identity can open that are not already grouped here; the server decides share authority on add.
      try { const r = await ctx.api('/v2/projects'); const here = new Set(model.projects.map(p => p.id)); model.candidates = (r.projects || []).filter(p => !here.has(p.id) && !p.archived_at); model.candidatesStatus = 'loaded'; }
      catch (e) { model.candidatesStatus = classify(e); }
    }
    return model;
  },
  render(ctx, model) {
    const g = gate(ctx, model, { href: ctx.routes.workspaces, label: 'All workspaces' }); if (g) return g;
    const w = model.workspace, edit = CAN_EDIT.has(w.role), owner = w.role === 'owner';
    // Management lives on the card itself (root visual delta, loc-27): one card per project, its own Remove control beneath it.
    const cards = model.projects.map(p => `<div class="entity-card-wrap">${ctx.cards.projectCard(p)}${edit ? `<div class="card-actions"><button type="button" class="quiet small" data-remove="${ctx.esc(p.id)}">Remove from workspace</button></div>` : ''}</div>`);
    const rows = '';
    const add = edit ? `<section class="panel" style="margin-top:22px"><h2>Add a project</h2>${model.candidatesStatus === 'loaded' ? (model.candidates.length ? `<form id="add-project"><label class="field">Project<select name="pid" required><option value="">Choose a project…</option>${model.candidates.map(p => `<option value="${ctx.esc(p.id)}">${ctx.esc(p.name)}</option>`).join('')}</select></label><div class="actions"><button class="primary" type="submit">Add to workspace</button></div></form>` : '<p class="muted">Every project you can open is already grouped here, or you have no projects yet.</p>') : '<p class="muted">The project list could not be loaded right now.</p>'}<p class="small muted">Only projects you already hold a role on can be grouped. Grouping never grants access.</p></section>` : '';
    const rename = owner ? `<section class="panel" style="margin-top:22px"><h2>Rename</h2><form id="rename-form"><label class="field">Workspace name<input name="name" maxlength="100" required value="${ctx.esc(w.name)}"></label><div class="actions"><button class="primary" type="submit">Save name</button></div></form></section>` : '';
    return `<a class="back" href="${ctx.routes.workspaces}">← All workspaces</a><div class="title"><div><p class="eyebrow">Workspace</p><h1>${ctx.esc(w.name)}</h1><p class="muted small">${w.role ? `Your role: ${ctx.esc(w.role)}` : ''}</p></div><div>${w.role ? `<span class="badge">${ctx.esc(w.role)}</span> ` : ''}${w.archived_at ? '<span class="badge">Archived</span> ' : ''}<a class="button" href="#permissions/workspaces/${ctx.enc(w.id)}">Permissions</a></div></div><h2>Projects</h2>${ctx.cards.cardGrid(cards, 'No projects grouped yet. You can still open them from All projects.')}${rows}${add}${rename}`;
  },
  bind(ctx, root, model) {
    bindRetry(ctx, root, workspace, model);
    const id = model.workspace?.id;
    const reload = async () => { const next = await workspace.load(ctx, model.params); root.innerHTML = workspace.render(ctx, next); workspace.bind(ctx, root, next); };
    root.querySelector('#add-project')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target, pid = val(form, 'pid');
      if (!pid) return;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Add project', () => ctx.api(`/v2/workspaces/${ctx.enc(id)}/projects/${ctx.enc(pid)}`, { method: 'POST' }));
      if (r) { ctx.note('Project added.'); await reload(); }
    });
    root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
      const r = await write(ctx, b, 'Remove project', () => ctx.api(`/v2/workspaces/${ctx.enc(id)}/projects/${ctx.enc(b.dataset.remove)}`, { method: 'DELETE' }));
      if (r) { ctx.note('Project removed from the workspace. It keeps its own grants.'); await reload(); }
    }));
    root.querySelector('#rename-form')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Rename', () => ctx.api(`/v2/workspaces/${ctx.enc(id)}`, { method: 'PATCH', body: { name: val(form, 'name') } }));
      if (r) { ctx.note('Renamed.'); await reload(); }
    });
  },
};

// ---------- projects ----------
const projects = {
  async load(ctx, params = {}) {
    try { const r = await ctx.api('/v2/projects'); return { status: 'loaded', params, projects: r.projects || [] }; }
    catch (e) { return { ...fail(e, safeMessage), params }; }
  },
  render(ctx, model) {
    const g = gate(ctx, model); if (g) return g;
    return `<div class="title"><div><p class="eyebrow">Your projects</p><h1>Choose a project</h1></div></div>${ctx.cards.cardGrid(model.projects.map(ctx.cards.projectCard), 'You have no projects yet.')}<div class="actions"><a href="${ctx.routes.workspaces}">Organize projects in a workspace</a><span class="small muted">Optional</span></div><section class="panel" style="margin-top:22px"><h2>Create a project</h2><form id="create-project"><label class="field">Project name<input name="name" maxlength="100" required placeholder="For example, Lake project"></label><div class="actions"><button class="primary" type="submit">Create project</button></div></form></section>`;
  },
  bind(ctx, root, model) {
    bindRetry(ctx, root, projects, model);
    root.querySelector('#create-project')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Create project', () => ctx.api('/v2/projects', { method: 'POST', body: { name: val(form, 'name') } }));
      if (r?.project?.id) ctx.go(ctx.routes.project(r.project.id));
      else if (r) ctx.note('Created, but the server returned no project id.', true);
    });
  },
};

// ---------- project ----------
const project = {
  async load(ctx, params = {}) {
    const id = params.id;
    let core;
    try { core = await ctx.api(`/v2/projects/${ctx.enc(id)}`); }
    catch (e) { return { ...fail(e, safeMessage), params }; }
    const model = { status: 'loaded', params, project: core.project || {}, assessments: [], assessmentsStatus: 'loaded', assessmentsError: '', languages: core.languages || [], languagesStatus: 'loaded' };
    const [a, l] = await Promise.allSettled([ctx.api(`/v2/projects/${ctx.enc(id)}/assessments`), ctx.api(`/v2/projects/${ctx.enc(id)}/languages`)]);
    if (a.status === 'fulfilled') model.assessments = a.value.assessments || [];
    else { model.assessmentsStatus = classify(a.reason); model.assessmentsError = safeMessage(a.reason); }
    if (l.status === 'fulfilled') model.languages = l.value.languages || model.languages;
    else model.languagesStatus = classify(l.reason);
    return model;
  },
  render(ctx, model) {
    const g = gate(ctx, model, { href: ctx.routes.projects, label: 'All projects' }); if (g) return g;
    const p = model.project, edit = CAN_EDIT.has(p.role), owner = p.role === 'owner';
    const active = model.languages.filter(l => !l.archived_at);
    const langName = new Map(model.languages.map(l => [l.id, l.name]));
    const cards = model.assessments.map(a => ctx.cards.assessmentCard({ ...a, language_name: langName.get(a.language_id) || a.language_name }));
    const assessmentsBlock = model.assessmentsStatus === 'loaded' ? ctx.cards.cardGrid(cards, 'No assessments yet.')
      : model.assessmentsStatus === 'refused' ? '<p class="muted">Assessments are not visible to you here.</p>'
      : model.assessmentsStatus === 'unauthenticated' ? `<p class="muted">Your session has ended. <a href="${ctx.routes.entry}">Sign in</a></p>`
      : `<p class="muted">${ctx.esc(model.assessmentsError)}</p><div class="actions"><button type="button" class="primary" data-act="retry">Retry</button></div>`;
    const langList = model.languages.length ? `<div class="links">${model.languages.map(l => `<p class="small">${ctx.esc(l.name)}${l.code ? ` <span class="muted">(${ctx.esc(l.code)})</span>` : ''}${l.archived_at ? ' <span class="badge">Archived</span>' : ''}</p>`).join('')}</div>` : '<p class="muted">No languages yet. Add one before creating an assessment.</p>';
    const addLang = edit ? `<form id="add-language" class="line"><label class="field">Language name<input name="name" maxlength="100" required placeholder="For example, Lake language"></label><label class="field">Code (optional, BCP-47 shaped; qaa–qtz for an invented language)<input name="code" maxlength="20" pattern="[a-z]{2,3}(-[A-Za-z0-9]{1,8})*"></label><div class="actions"><button class="primary" type="submit">Add language</button></div></form>` : '';
    const create = edit ? `<section class="panel"><p class="eyebrow">Prepare</p><h2>Create an assessment</h2>${active.length ? `<form id="create-assessment"><label class="field">Assessment name<input name="name" maxlength="100" required placeholder="For example, September review"></label><label class="field">Language<select name="language_id" required>${active.map(l => `<option value="${ctx.esc(l.id)}">${ctx.esc(l.name)}${l.code ? ` (${ctx.esc(l.code)})` : ''}</option>`).join('')}</select></label><div class="actions"><button class="primary" type="submit">Create & prepare</button></div></form>` : '<p class="muted">Add a language first; every assessment names its target language.</p>'}</section>` : '';
    const rename = owner ? `<section class="panel"><h2>Rename</h2><form id="rename-form"><label class="field">Project name<input name="name" maxlength="100" required value="${ctx.esc(p.name)}"></label><div class="actions"><button class="primary" type="submit">Save name</button></div></form></section>` : '';
    return `<a class="back" href="${ctx.routes.projects}">← All projects</a><div class="title"><div><p class="eyebrow">Project</p><h1>${ctx.esc(p.name)}</h1><p class="muted small">${p.organization ? `${ctx.esc(p.organization)} · ` : ''}${p.role ? `Your role: ${ctx.esc(p.role)}` : ''}</p></div><div>${p.role ? `<span class="badge">${ctx.esc(p.role)}</span> ` : ''}${p.archived_at ? '<span class="badge">Archived</span> ' : ''}<a class="button" href="#permissions/projects/${ctx.enc(p.id)}">Permissions</a></div></div><h2>Assessments</h2>${assessmentsBlock}<div class="grid" style="margin-top:22px"><div class="stack">${create}${rename}</div><aside class="panel"><h2>Languages</h2>${langList}${addLang}</aside></div>`;
  },
  bind(ctx, root, model) {
    bindRetry(ctx, root, project, model);
    const id = model.project?.id;
    const reload = async () => { const next = await project.load(ctx, model.params); root.innerHTML = project.render(ctx, next); project.bind(ctx, root, next); };
    root.querySelector('#add-language')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target, code = val(form, 'code');
      const body = { name: val(form, 'name') }; if (code) body.code = code;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Add language', () => ctx.api(`/v2/projects/${ctx.enc(id)}/languages`, { method: 'POST', body }));
      if (r) { ctx.note('Language added.'); await reload(); }
    });
    root.querySelector('#create-assessment')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Create assessment', () => ctx.api(`/v2/projects/${ctx.enc(id)}/assessments`, { method: 'POST', body: { name: val(form, 'name'), language_id: val(form, 'language_id') } }));
      if (r?.assessment?.id) ctx.go(ctx.routes.assessment(r.assessment.id));
      else if (r) ctx.note('Created, but the server returned no assessment id.', true);
    });
    root.querySelector('#rename-form')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Rename', () => ctx.api(`/v2/projects/${ctx.enc(id)}`, { method: 'PATCH', body: { name: val(form, 'name') } }));
      if (r) { ctx.note('Renamed.'); await reload(); }
    });
  },
};

export const pages = Object.freeze({ entry, workspaces, workspace, projects, project });

// Integrator inlines this next to the existing <style>. Reuses tokens from ui/assess/index.html; only adds entity-card / hero / stepper.
export const css = `
.entity-card{display:block;color:var(--ink);text-decoration:none}.entity-card:hover{border-color:#9dbeb7}.entity-card.archived{opacity:.7}.entity-card h2{margin-bottom:6px}.entity-card .badge{margin-top:8px}
.hero{max-width:840px;margin:0 auto 22px;padding:40px}.hero h1{font-size:clamp(30px,4.5vw,47px);letter-spacing:-1.7px;max-width:610px}.hero .lead{font-size:17px;max-width:590px}
.perspectives{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:30px 0}.perspective{padding:18px 14px;border-radius:18px;background:#ffffff8c;border:1px solid var(--edge)}.perspective strong{display:block;font-size:15px}.perspective small{display:block;color:var(--muted);font-size:13px;margin-top:3px}
.dot-lg{display:block;width:24px;height:24px;border-radius:50%;margin-bottom:13px;box-shadow:inset 0 2px 3px #ffffff66}.dot-lg.team{background:#5bbd98}.dot-lg.community{background:#78aee0}.dot-lg.church{background:#e8c568}
.stepper{max-width:840px;margin:0 auto 22px}.stepper .progress{display:flex;gap:7px;margin:0 0 25px}.stepper .progress span{height:5px;flex:1;border-radius:6px;background:#cfdee5}.stepper .progress span.done{background:#367e73}.stepper .note .badge{margin:4px 5px 4px 0}
@media(max-width:720px){.hero{padding:24px 20px}.perspectives{grid-template-columns:1fr;gap:8px}.perspective{display:grid;grid-template-columns:24px 1fr;column-gap:12px;padding:12px}.dot-lg{grid-row:1/3;align-self:center;margin:0}.perspective small{grid-column:2}}
`;
