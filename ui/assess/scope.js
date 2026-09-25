// Scope pages — entry · workspaces · workspace · projects · project (UI overhaul contract, 2026-09-17).
// Each page = { load(ctx, params) → model, render(ctx, model) → html, bind(ctx, root, model) }.
// ctx = { api, esc, enc, go, note(msg, alert), state, routes, cards, setToken? }.
// Layout comes from the showcase (projectsView / workspaceView / createView, welcome root). Legacy app.js is behaviour reference only.
// Pure render: HTML strings, every text value through ctx.esc. No DOM access outside bind().
// v3 lane 9 L9-1: projects page = home per Bincy screen 02 (relative import so node tests resolve it too).
import { homeView } from '../v3/home.js';
import { learnMore } from '../v3/components/learn-more.js';

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
export const CODE_REFUSED = 'This code has been used or is not valid. Check it, or ask the person who gave it to you for a new one.';

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
// Replace a page's DOM with a freshly loaded model ONLY while that page is still the current view (review F1: a late retry or
// reload completion must never overwrite a newer route's content). The controller may expose ctx.isCurrent (render generation +
// identity) and ctx.pageModel (shell re-sync from this page's new data); without them the swap is unconditional as before.
function swap(ctx, root, page, next) {
  if (typeof ctx.isCurrent === 'function' && !ctx.isCurrent()) return false;
  ctx.pageModel?.(next);
  root.innerHTML = page.render(ctx, next);
  page.bind(ctx, root, next);
  return true;
}
// Retry re-runs load() then re-renders and re-binds in place. Every page's bind() starts here.
// Bugbot 4073693771: a page may render more than one Retry (project: assessments AND languages). EVERY rendered control is bound;
// they share ONE in-flight guard so a second click (either button) while a reload is pending neither issues a second read nor
// re-enters swap(). Currentness stays with swap()/ctx.isCurrent: a reload completing after navigation never paints.
function bindRetry(ctx, root, page, model) {
  const buttons = Array.from(root.querySelectorAll('[data-act="retry"]'));
  if (!buttons.length) return;
  let pending = false;
  for (const b of buttons) b.addEventListener('click', async () => {
    if (pending) return;
    pending = true;
    for (const c of buttons) c.disabled = true;
    try { const next = await page.load(ctx, model.params || {}); swap(ctx, root, page, next); }
    finally { pending = false; }
  });
}
// A write: disables the trigger while in flight, reports the server outcome, never claims success without it.
async function write(ctx, control, label, fn, { refused = 'Not allowed here.', failed = null } = {}) {
  const controls = control ? [control, ...(control.form ? Array.from(control.form.querySelectorAll('button')) : [])] : [];
  for (const c of controls) c.disabled = true;
  try { const r = await fn(); return r; }
  catch (e) {
    const kind = classify(e);
    ctx.note(kind === 'unauthenticated' ? 'Your session has ended. Sign in again.' : kind === 'refused' ? refused : (failed || `${label} failed: ${safeMessage(e)}`), true);
    return undefined;
  }
  finally { for (const c of controls) c.disabled = false; }
}
const val = (form, name) => String(form.elements[name]?.value ?? '').trim();
const storeSession = (key, v) => { try { sessionStorage.setItem(key, v); } catch {} };
const dropSession = key => { try { sessionStorage.removeItem(key); } catch {} };

// ---------- entry (public) ----------
// B20: also composed by the v3 setup wizard (step 2 "Who will participate?"), one description per perspective.
export const PERSPECTIVES = [['team', 'Translation team', 'Experience of the work'], ['community', 'Community', 'Experience of the translation'], ['church', 'Church', 'Experience of its use']];
// B08+B20 (Bincy SI 04 "Translation Team, Community, and Church descriptions"): one plain who-line per group, shared by setup step 2,
// the launched rows and the Collect heading. Headings and data unchanged. Keyed as the wizard's pdot(): team / community / church.
export const PERSPECTIVE_WHO = Object.freeze({ team: 'The people doing the translation work.', community: 'People who speak the language.', church: 'Pastors and church leaders in the language area.' });
export const whoLine = p => { const s = String(p || '').toLowerCase(); return PERSPECTIVE_WHO[/team/.test(s) ? 'team' : /community/.test(s) ? 'community' : /church/.test(s) ? 'church' : ''] || ''; };
function entryModel(over = {}) {
  return { status: 'loaded', mode: 'welcome', step: 0, signin: { email: '', devCode: null, stage: 'email' }, example: null, exampleStatus: null, exampleError: '', params: {}, ...over };
}
// One perspectives row, shared by the public home and About (ruling 12:34: pages compose, never copy).
const perspectivesRow = ctx => `<div class="perspectives">${PERSPECTIVES.map(([k, t, s]) => `<div class="perspective"><span class="dot-lg ${k}" aria-hidden="true"></span><strong>${ctx.esc(t)}</strong><small>${ctx.esc(s)}</small></div>`).join('')}</div>`;
// B02 (lanes-1510): a signed-in visitor at "/" (the welcome, not #signin/#survey/#about) lands on the current work (#projects).
export const landsOnWork = (r, signedIn) => !!signedIn && r?.kind === 'entry' && !['signin', 'survey', 'about'].includes(r.intent);
function hero(ctx, signedIn) {
  const continueCards = signedIn ? `<section class="panel"><p class="eyebrow">Signed in</p><h2>Continue</h2><div class="project-grid">${ctx.cards.card({ eyebrow: 'Continue', title: 'Workspaces', href: ctx.routes.workspaces, meta: ['Optional groupings of projects you can already open'] })}${ctx.cards.card({ eyebrow: 'Continue', title: 'Projects', href: ctx.routes.projects, meta: ['All projects your account holds a role on'] })}</div><div class="actions"><button type="button" class="quiet" data-act="signout">Sign out</button></div></section>` : '';
  // Public home contract (ui/public-choices.test.mjs, captain-named): exactly these four choices, in this order, above the headline;
  // Sign in goes straight to the real provider; sandbox sign-in only by explicit choice (#signin). Retired labels never return.
  const choices = `<nav class="public-choices actions" aria-label="Choose where to start" style="margin-top:0"><a class="rv-btn" href="#about">Read about it</a><a class="rv-btn" href="/?demo=1#assessment/demo-assessment/prepare">Take the tour</a><a class="rv-btn" href="#survey">Take a survey</a>${signedIn ? '' : '<a class="rv-btn primary" href="/v2/auth/access">Sign in</a>'}</nav>`; // B02: a signed-in home never offers Sign in
  // Captain order 17:05 (lane 9, L9-22) "less text": public home = the four choices, one heading, one short line; everything else behind Learn more.
  return `<section class="hero panel" id="public-home">${choices}<p class="eyebrow" id="public-about">What is 3D Review?</p><h1>Three perspectives.<br>One useful next step.</h1><p class="muted lead">Hear from the translation team, the community and the church, then choose what to do next.</p>${learnMore(`<p class="muted">3D Review brings translation team, community and church perspectives together to understand a project and choose useful next steps.</p>${perspectivesRow(ctx)}<p class="small muted">Explore the real assessment screens · Go at your own pace · Nothing is sent</p><p class="small"><a href="/?demo=1#assessment/demo-assessment/prepare">Browse a sample assessment (synthetic data) →</a> · <a href="#projects">Open your projects and reports</a>${signedIn ? '' : ' · <a href="#signin">Sandbox test identities (dev only) — not a real sign-in</a>'}</p><p class="muted">Use it when your project is ready to pause, reflect and learn from feedback. Repeat when a new assessment would be useful — for example, between books or publishing iterations.</p>`)}</section>${continueCards}`;
}
function surveyView(ctx) {
  return `<section class="panel narrow"><p class="eyebrow">For participants</p><h1>Your feedback starts with your invitation.</h1><p class="muted">Open the survey link or scan the QR code someone shared with you. If you were given an access code, enter it below.</p><p><a class="button" href="/participate/?demo=1">Try a sample survey — nothing is sent</a></p><form id="code-form"><label class="field">Access code<input name="code" required autocomplete="off" maxlength="64"></label><div class="actions"><button class="primary" type="submit">Open my survey</button><button type="button" class="quiet" data-act="welcome">Back to welcome</button></div></form><p class="small muted">Missing your survey link? Ask the person who invited you or shared the survey to send you the link. You do not need an account to follow a participant link.</p></section>`;
}
// Captain ruling 12:53 (lane 1, L1-16): a real public About page at #about — never a sign-in panel. Cards via ctx.cards.card (shared card component).
const WHO = [['Who it is for', 'Translation teams, the communities they serve and the churches using the translation — with a facilitator who runs the review.'], ['When to use it', 'When your project is ready to pause, reflect and learn from feedback.'], ['How often', 'Repeat when a new assessment would be useful — for example, between books or publishing iterations.']];
export function aboutView(ctx) {
  const facts = WHO.map(([t, s]) => ctx.cards.card({ eyebrow: 'About', title: t, meta: [s] })).join('');
  return `<section class="glass panel narrow" id="about-page"><a class="back" href="#">← Back to home</a><p class="eyebrow">About 3D Review</p><h1>Three perspectives. One useful next step.</h1><p class="muted lead">3D Review brings translation team, community and church perspectives together to understand a project and choose useful next steps. A facilitator sets up a review, each group answers a short survey, and the results show where the project is strong and where it needs support.</p><h2>The three perspectives</h2>${perspectivesRow(ctx)}<div class="project-grid">${facts}</div><div class="actions"><a class="rv-btn primary" href="#">Back to home</a><a class="rv-btn" href="/?demo=1#assessment/demo-assessment/prepare">Take the tour</a><a class="rv-btn" href="#survey">Take a survey</a></div></section>`;
}
function signinView(ctx, model) {
  const s = model.signin;
  const codeStep = s.stage === 'code';
  // v3 prototype frame 1 (design-system-v3 V.signin): centred 420px card, eyebrow, one full-width primary, survey footer (lane 1, L1-7).
  return `<section class="glass panel narrow v3-signin" style="max-width:420px;margin:48px auto 0"><p class="eyebrow">Sign in</p><h1 style="font-size:27px">Sign in with your email</h1><p class="muted">We email you a one-time code; there is no password.</p><div class="actions"><a class="button rv-btn primary" href="/v2/auth/access" style="width:100%;justify-content:center;text-align:center;box-sizing:border-box">Sign in with an email code</a></div>${learnMore('<p class="small muted">Here to take a survey? Open the link you were given; no sign-in is needed. <a href="#survey">Have an access code?</a></p>')}<details class="sandbox-signin" id="sandbox-signin"${codeStep ? ' open' : ''}><summary>Sandbox test identities (dev only) — not a real sign-in</summary><form id="signin-form" data-stage="${codeStep ? 'code' : 'email'}"><label class="field">Email<input name="email" type="email" required autocomplete="email" value="${ctx.esc(s.email)}"${codeStep ? ' readonly' : ''}></label>${codeStep ? `${s.devCode ? `<p class="note small">Sandbox code: <strong>${ctx.esc(s.devCode)}</strong></p>` : '<p class="small muted">Code requested. Enter the code you received.</p>'}<label class="field">Code<input name="code" required autocomplete="one-time-code" inputmode="numeric"></label>` : ''}<div class="actions"><button class="primary" type="submit">${codeStep ? 'Sign in' : 'Send me a code'}</button><button type="button" class="quiet" data-act="welcome">Back to welcome</button></div></form></details></section>`;
}
const entry = {
  // Tour/example deep links redirect into the shared fixture-backed assessment shell.
  async load(ctx, params = {}) { const mode = { signin: 'signin', survey: 'survey', about: 'about' }[params.intent] || 'welcome'; const model = entryModel({ params, mode }); return model; },
  render(ctx, model) {
    const signedIn = !!ctx.state.principal;
    switch (model.mode) {
      case 'survey': return surveyView(ctx);
      case 'about': return aboutView(ctx);
      case 'signin': return signinView(ctx, model);
      default: return hero(ctx, signedIn);
    }
  },
  bind(ctx, root, model) {
    const paint = () => { root.innerHTML = entry.render(ctx, model); entry.bind(ctx, root, model); };
    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async () => {
      switch (b.dataset.act) {
        case 'welcome': model.mode = 'welcome'; model.step = 0; return paint();
        case 'survey': model.mode = 'survey'; return paint();
        case 'signin': model.mode = 'signin'; return paint();
        case 'signout': return ctx.signOut?.();
      }
    }));
    root.querySelector('#code-form')?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const form = ev.target;
      // U08 (lanes-1321): a used, unknown or mistyped code gets one plain next step, not "Not allowed here." / a server message.
      const r = await write(ctx, form.querySelector('button[type=submit]'), 'Code', () => ctx.api('/v2/participate/code', { method: 'POST', body: { code: val(form, 'code') } }), { refused: CODE_REFUSED });
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
      // Bincy F02 / B-F02a (lanes-1321): land on the work, not back on this form. Navigate BEFORE setToken: setToken
      // re-boots the app (new generation), after which ctx.go is a no-op and the page stayed on #signin.
      ctx.go(ctx.routes.projects);
      if (ctx.setToken) ctx.setToken(r.session);
    });
  },
};


// ---------- K3a read model + kit presentation (presentation only; load()/bind() and every form selector are unchanged) ----------
// A scope page renders as: <div data-read-region> (kit-presented read model) + <section data-action-region> (the existing
// create/rename/add/remove forms, exact selectors and handlers). The action region is an intermediate integration checkpoint
// until K3b replaces those presentations; it is never hidden to appear finished.
// v3 plain state words (lane 1; must equal ui/v3-shell.js STATE_WORDS — parity test in ui/v3-shell.test.mjs).
// v2 words, for a one-line revert: { prepare: 'In preparation', collect: 'Collecting', understand: 'Understanding', improve: 'Improving' }
export const CTX_STAGE_WORDS = Object.freeze({ prepare: 'Setup not finished', collect: 'Collecting responses', understand: 'Ready to look at results', improve: 'Reviewed' });
const ctxStage = s => CTX_STAGE_WORDS[s] || String(s || '');
const READ_STATUS = Object.freeze({ loaded: 'ready', unauthenticated: 'unauthenticated', refused: 'refused', not_built: 'not_built', failed: 'failed' });
export function readModel(kind, model) {
  const status = READ_STATUS[model?.status] || 'failed';
  const item = (x, href, eyebrow, facts = []) => ({ id: x.id, title: String(x.name ?? x.id ?? ''), href, eyebrow, role: x.role || '', archived: !!x.archived_at, facts });
  if (status !== 'ready') return { kind, status, items: [], error: model?.error || '' };
  if (kind === 'workspaces') return { kind, status, title: 'Your workspaces', eyebrow: 'Optional grouping', items: (model.workspaces || []).map(w => item(w, `#workspace/${encodeURIComponent(w.id)}`, 'Workspace')) , empty: 'You have no workspaces yet.' };
  if (kind === 'projects') return { kind, status, title: 'Choose a project', eyebrow: 'Your projects', items: (model.projects || []).map(p => item(p, `#project/${encodeURIComponent(p.id)}`, 'Project')), empty: 'You have no projects yet.' };
  if (kind === 'workspace') { const w = model.workspace || {}; return { kind, status, title: String(w.name ?? ''), eyebrow: 'Workspace', role: w.role || '', archived: !!w.archived_at, id: w.id, items: (model.projects || []).map(p => item(p, `#project/${encodeURIComponent(p.id)}`, 'Project')), empty: 'No projects grouped yet. You can still open them from All projects.' }; }
  if (kind === 'project') { const p = model.project || {}; const langName = new Map((model.languages || []).map(l => [l.id, l.name]));
    return { kind, status, title: String(p.name ?? ''), eyebrow: 'Project', role: p.role || '', archived: !!p.archived_at, organization: p.organization || '', id: p.id,
      assessments: { status: READ_STATUS[model.assessmentsStatus] || 'failed', error: model.assessmentsError || '', items: (model.assessments || []).map(a => item(a, `#assessment/${encodeURIComponent(a.id)}`, 'Assessment', [{ label: 'Stage:', value: a.archived_at ? 'Archived' : ctxStage(a.stage) }, ...(langName.get(a.language_id) || a.language_name ? [{ label: 'Language:', value: langName.get(a.language_id) || a.language_name }] : [])])) },
      languages: { status: READ_STATUS[model.languagesStatus] || 'failed', items: (model.languages || []).map(l => ({ id: l.id, name: l.name, code: l.code || '', archived: !!l.archived_at })) } }; }
  return { kind, status, items: [] };
}
function kitCard(ctx, x) {
  return `<article class="glass panel${x.archived ? ' archived' : ''}" style="min-width:0;overflow-wrap:anywhere"><p class="eyebrow">${ctx.esc(x.eyebrow)}</p><div class="row"><h3><a href="${ctx.esc(x.href)}">${ctx.esc(x.title)}</a></h3>${x.role ? `<span class="badge">${ctx.esc(x.role)}</span>` : ''}${x.archived ? '<span class="badge">Archived</span>' : ''}</div>${(x.facts || []).filter(f => f.value).map(f => `<p class="small muted">${ctx.esc(f.label)} ${ctx.esc(f.value)}</p>`).join('')}</article>`;
}
function kitGrid(ctx, items, empty) { return items.length ? `<div class="grid">${items.map(x => kitCard(ctx, x)).join('')}</div>` : `<p class="muted">${ctx.esc(empty)}</p>`; }
// Bugbot 4073693743: title ownership is an explicit host contract, never inferred from the DOM. Only the kit-root controller sets
// ctx.shellOwnsTitle = true (the shell header shows title + eyebrow, so the page renders none). In any other host — the real
// non-kit /assess/index.html, tests, an absent context — the page owns its heading and renders exactly one eyebrow + h1.
function pageHead(ctx, r) { return ctx.shellOwnsTitle === true ? '' : `<p class="eyebrow">${ctx.esc(r.eyebrow)}</p><h1>${ctx.esc(r.title)}</h1>`; }
// Parent link follows the same host contract as the heading. Kit crumbs are that link when the shell is mounted; the non-kit
// /assess/ host has no crumb chrome, so the page keeps the way up (← All workspaces / ← All projects).
function pageBack(ctx, href, label) { return ctx.shellOwnsTitle === true ? '' : `<a class="back" href="${ctx.esc(href)}">← ${ctx.esc(label)}</a>`; }
// The read head carries role/archived state and the permissions link; the heading itself follows the host contract above.
function kitHead(ctx, r, extra = '') { return `${pageHead(ctx, r)}<div class="row" style="justify-content:space-between;align-items:center" data-read-head="${ctx.esc(r.title)}"><p class="muted small" style="margin:0">${r.role ? `Your role: ${ctx.esc(r.role)}` : ''}</p><div>${r.role ? `<span class="badge">${ctx.esc(r.role)}</span> ` : ''}${r.archived ? '<span class="badge">Archived</span> ' : ''}${extra}</div></div>`; }
const readRegion = html => `<div data-read-region class="kit-read">${html}</div>`;
const actionRegion = html => html ? `<section data-action-region class="legacy-actions" aria-label="Existing controls (kit conversion pending)">${html}</section>` : '';

// ---------- workspaces ----------
const workspaces = {
  async load(ctx, params = {}) {
    try { const r = await ctx.api('/v2/workspaces'); return { status: 'loaded', params, workspaces: r.workspaces || [] }; }
    catch (e) { return { ...fail(e, safeMessage), params }; }
  },
  render(ctx, model) {
    const g = gate(ctx, model); if (g) return g;
    const r = readModel('workspaces', model);
    return readRegion(`${pageHead(ctx, r)}<p class="muted">Group projects you can already open. A workspace does not add access to other projects. <a href="${ctx.routes.projects}">All projects</a></p>${kitGrid(ctx, r.items, r.empty)}`)
      + actionRegion(`<section class="panel" style="margin-top:22px"><h2>Create a workspace</h2><form id="create-workspace"><label class="field">Workspace name<input name="name" maxlength="100" required placeholder="For example, Lake region"></label><div class="actions"><button class="primary" type="submit">Create workspace</button></div></form></section>`);
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
    const rows = '';
    const add = edit ? `<section class="panel" style="margin-top:22px"><h2>Add a project</h2>${model.candidatesStatus === 'loaded' ? (model.candidates.length ? `<form id="add-project"><label class="field">Project<select name="pid" required><option value="">Choose a project…</option>${model.candidates.map(p => `<option value="${ctx.esc(p.id)}">${ctx.esc(p.name)}</option>`).join('')}</select></label><div class="actions"><button class="primary" type="submit">Add to workspace</button></div></form>` : '<p class="muted">Every project you can open is already grouped here, or you have no projects yet.</p>') : '<p class="muted">The project list could not be loaded right now.</p>'}<p class="small muted">Only projects you already hold a role on can be grouped. Grouping never grants access.</p></section>` : '';
    const rename = owner ? `<section class="panel" style="margin-top:22px"><h2>Rename</h2><form id="rename-form"><label class="field">Workspace name<input name="name" maxlength="100" required value="${ctx.esc(w.name)}"></label><div class="actions"><button class="primary" type="submit">Save name</button></div></form></section>` : '';
    const r = readModel('workspace', model);
    // Read region: kit cards for grouped projects. Action region: the existing per-card Remove controls, Add and Rename forms (same selectors).
    return pageBack(ctx, ctx.routes.workspaces, 'All workspaces') + readRegion(`${kitHead(ctx, r, `<a class="button" href="#permissions/workspaces/${ctx.enc(w.id)}">Permissions</a>`)}<h3>Projects</h3>${kitGrid(ctx, r.items, r.empty)}`)
      // Ruling: one kit card owns read/navigation; management is a names-only row per project carrying the EXISTING [data-remove] control
      // (same selector/handler/permission). Accessible action name includes the project.
      + actionRegion(`${edit && model.projects.length ? `<ul class="manage-rows" aria-label="Grouped projects">${model.projects.map(p => `<li class="manage-row"><span>${ctx.esc(p.name)}</span><button type="button" class="quiet small" data-remove="${ctx.esc(p.id)}" aria-label="Remove ${ctx.esc(p.name)} from workspace">Remove from workspace</button></li>`).join('')}</ul>` : ''}${rows}${add}${rename}`);
  },
  bind(ctx, root, model) {
    bindRetry(ctx, root, workspace, model);
    const id = model.workspace?.id;
    const reload = async () => { const next = await workspace.load(ctx, model.params); swap(ctx, root, workspace, next); };
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
// B34 (Bincy F03): one way to create. Projects and a project page offer only this Start entry (the guided setup at #new creates
// the project, language and assessment); the project page keeps add-language / bare-assessment forms behind a closed "More".
const START_REVIEW = '<div class="v3-shell-actions actions"><a class="rv-btn primary" data-v3-start href="#new">+ Start a new 3D Review</a></div>';
const projects = {
  async load(ctx, params = {}) {
    let list;
    try { const r = await ctx.api('/v2/projects'); list = r.projects || []; }
    catch (e) { return { ...fail(e, safeMessage), params }; }
    // v3 lane 9: each project's assessments, read-only, same endpoint the project page uses; first 20 projects, the rest link out.
    const lists = {};
    await Promise.allSettled(list.filter(p => !p.archived_at).slice(0, 20).map(async p => {
      try { const a = await ctx.api(`/v2/projects/${encodeURIComponent(p.id)}/assessments`); lists[p.id] = { status: 'loaded', list: (a.assessments || []).filter(x => !x.archived_at) }; }
      catch (e) { lists[p.id] = { status: classify(e) }; }
    }));
    // B03 (Bincy F01/F02): an assessment shared directly (assessment grant, no project role) is not in /v2/projects. Home lists it
    // from the caller's own grants (/v2/me) + the assessment read the grant already allows — no new server surface.
    let shared = [];
    try {
      const me = await ctx.api('/v2/me'), here = new Set(list.map(p => p.id));
      const ids = [...new Set((me?.grants || []).filter(g => g.scope_type === 'assessment').map(g => g.scope_id))].slice(0, 20);
      const reads = await Promise.allSettled(ids.map(id => ctx.api(`/v2/assessments/${encodeURIComponent(id)}`)));
      shared = reads.filter(r => r.status === 'fulfilled').map(r => r.value?.assessment).filter(a => a && !a.archived_at && !here.has(a.project_id));
    } catch { shared = []; }
    return { status: 'loaded', params, projects: list, lists, shared };
  },
  render(ctx, model) {
    const g = gate(ctx, model); if (g) return g;
    const r = readModel('projects', model);
    const home = homeView({ projects: model.projects || [], shared: model.shared || [], listFor: id => (model.lists || {})[id], stageLabel: s => ctx.esc(ctxStage(s)), start: START_REVIEW });
    return readRegion(`${pageHead(ctx, r)}${home}<p class="small muted"><a href="${ctx.routes.workspaces}">Organize projects in a workspace</a> · Optional</p>`);
  },
  bind(ctx, root, model) {
    bindRetry(ctx, root, projects, model);
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
    const langList = model.languages.length ? `<div class="links">${model.languages.map(l => `<p class="small">${ctx.esc(l.name)}${l.code ? ` <span class="muted">(${ctx.esc(l.code)})</span>` : ''}${l.archived_at ? ' <span class="badge">Archived</span>' : ''}</p>`).join('')}</div>` : '<p class="muted">No languages yet.</p>';
    const addLang = edit ? `<form id="add-language" class="line"><label class="field">Language name<input name="name" maxlength="100" required placeholder="For example, Lake language"></label><label class="field">Code (optional, BCP-47 shaped; qaa–qtz for an invented language)<input name="code" maxlength="20" pattern="[a-z]{2,3}(-[A-Za-z0-9]{1,8})*"></label><div class="actions"><button class="primary" type="submit">Add language</button></div></form>` : '';
    const create = edit ? `<section class="panel"><p class="eyebrow">Prepare</p><h2>Create an assessment</h2>${active.length ? `<form id="create-assessment"><label class="field">Assessment name<input name="name" maxlength="100" required placeholder="For example, September review"></label><label class="field">Language<select name="language_id" required>${active.map(l => `<option value="${ctx.esc(l.id)}">${ctx.esc(l.name)}${l.code ? ` (${ctx.esc(l.code)})` : ''}</option>`).join('')}</select></label><div class="actions"><button class="primary" type="submit">Create & prepare</button></div></form>` : '<p class="muted">Add a language first; every assessment names its target language.</p>'}</section>` : '';
    const rename = owner ? `<section class="panel"><h2>Rename</h2><form id="rename-form"><label class="field">Project name<input name="name" maxlength="100" required value="${ctx.esc(p.name)}"></label><div class="actions"><button class="primary" type="submit">Save name</button></div></form></section>` : '';
    // Lane 11 (LANES.md claim 11:19): retained surfaces (cookbook design-system-v3 PARITY.md, ADOPTION item 7) reachable from project
    // settings. Links only, to the existing screens; no new capability, contract unchanged. Access codes (C3) live on the legacy facilitator page.
    const kept = [{ key: 'access-codes', name: 'Access codes', what: 'Issue paper codes for one survey and release them once to print (choose the assessment and survey there)', href: '/legacy/#facilitator', label: 'Open access codes' },
      // Workspaces (W1): the existing #workspaces screen — create a workspace, add or remove projects, rename.
      { key: 'workspaces', name: 'Workspaces', what: 'Group projects in a workspace: create one, add or remove projects, rename it', href: ctx.routes.workspaces, label: 'Open workspaces' }];
    const settings = edit ? `<section class="panel" id="project-settings" aria-labelledby="project-settings-title"><h2 id="project-settings-title">Project settings</h2><ul class="manage-rows kept-surfaces" aria-label="Kept tools">${kept.map(k => `<li class="manage-row"><span><strong>${ctx.esc(k.name)}</strong> <span class="small muted">${ctx.esc(k.what)}</span></span><a class="button quiet small" href="${ctx.esc(k.href)}" data-kept="${ctx.esc(k.key)}">${ctx.esc(k.label)}</a></li>`).join('')}</ul></section>` : '';
    const r = readModel('project', model);
    // Assessments and languages keep their independent settled outcomes; only a 'ready' list renders as cards (never an empty success).
    const assessmentsRead = r.assessments.status === 'ready' ? kitGrid(ctx, r.assessments.items, 'No assessments yet.') : assessmentsBlock;
    const languagesRead = r.languages.status === 'ready' ? langList : r.languages.status === 'refused' ? '<p class="muted">Languages are not visible to you here.</p>' : r.languages.status === 'unauthenticated' ? `<p class="muted">Your session has ended. <a href="${ctx.routes.entry}">Sign in</a></p>` : '<p class="muted" role="alert">Languages could not be loaded. <button type="button" class="quiet" data-act="retry">Retry</button></p>';
    return pageBack(ctx, ctx.routes.projects, 'All projects') + readRegion(`${kitHead(ctx, r, `<a class="button" href="#permissions/projects/${ctx.enc(p.id)}">Permissions</a>`)}${p.organization ? `<p class="muted small">${ctx.esc(p.organization)}</p>` : ''}<h3>Assessments</h3>${assessmentsRead}<aside class="glass panel" style="margin-top:22px"><h3>Languages</h3>${languagesRead}</aside>`)
      + actionRegion(`${edit ? START_REVIEW : ''}${rename}${settings}${edit ? `<details class="panel more-tools" id="project-more"><summary>More</summary>${create}<section class="panel"><h2>Languages</h2>${addLang}</section></details>` : ''}`);
  },
  bind(ctx, root, model) {
    bindRetry(ctx, root, project, model);
    const id = model.project?.id;
    const reload = async () => { const next = await project.load(ctx, model.params); swap(ctx, root, project, next); };
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
