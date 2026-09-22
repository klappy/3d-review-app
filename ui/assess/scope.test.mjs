// node --test ui/assess/scope.test.mjs — scope pages: render() strings, load() with a fake api, entry sign-in transitions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pages, css, classify } from './scope.js';
import * as cards from './cards.js';

const err = (code, message = 'nope') => Object.assign(new Error(message), { code, status: Number(code) || 400 });
function ctxWith(routesMap = {}, over = {}) {
  const calls = [], notes = [], gone = [];
  const api = async (url, opts = {}) => {
    const key = `${opts.method || 'GET'} ${url}`; calls.push({ key, body: opts.body });
    const r = routesMap[key]; if (r === undefined) throw err('500', `unmapped ${key}`);
    if (r instanceof Error) throw r; return typeof r === 'function' ? r(opts) : r;
  };
  return { api, esc: cards.esc, enc: cards.enc, go: h => gone.push(h), note: (m, a) => notes.push({ m, a }), state: { principal: null }, routes: cards.routes, cards, calls, notes, gone, ...over };
}

// ---- minimal fake DOM: enough for querySelector('[data-act]'), '#id', forms with elements, click/submit ----
class El {
  constructor(tag, attrs = {}, parent = null) { this.tag = tag; this.attrs = attrs; this.dataset = {}; this.listeners = {}; this.disabled = false; this.parent = parent; this.children = []; this.elements = {}; for (const [k, v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  async fire(t, ev = {}) { for (const f of this.listeners[t] || []) await f({ preventDefault() {}, target: this, ...ev }); }
  get form() { let p = this.parent; while (p && p.tag !== 'form') p = p.parent; return p; }
  querySelectorAll(sel) { return all(this).filter(e => matches(e, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
const all = e => e.children.flatMap(c => [c, ...all(c)]);
function matches(e, sel) {
  if (sel.startsWith('#')) return e.attrs.id === sel.slice(1);
  const m = sel.match(/^(\w+)?\[([\w-]+)(?:=(.+))?\]$/); if (!m) return false;
  const [, tag, attr, v] = m; if (tag && e.tag !== tag) return false;
  return attr in e.attrs && (v === undefined || e.attrs[attr] === v.replace(/^"|"$/g, ''));
}
function parse(html) {
  const root = new El('root'); let cur = root; const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g; let m;
  while ((m = re.exec(html))) {
    const [, close, tag, rest] = m;
    if (close) { if (cur.tag === tag && cur.parent) cur = cur.parent; continue; }
    const attrs = {}; for (const a of rest.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? '';
    const el = new El(tag, attrs, cur); cur.children.push(el);
    if (tag === 'input' || tag === 'select') { const f = el.form; if (f && attrs.name) f.elements[attrs.name] = el; el.value = attrs.value || ''; }
    if (!['input', 'br', 'option'].includes(tag) && !rest.endsWith('/')) cur = el;
  }
  return root;
}
function mount(page, ctx, model) { const root = parse(page.render(ctx, model)); root.innerHTML = ''; Object.defineProperty(root, 'innerHTML', { set(h) { const p = parse(h); root.children = p.children; root.children.forEach(c => c.parent = root); }, get() { return ''; } }); page.bind(ctx, root, model); return root; }

// ---------- classify / css ----------
test('classify maps contract codes', () => {
  assert.equal(classify(err('NOT_AUTHENTICATED')), 'unauthenticated'); assert.equal(classify(err('401')), 'unauthenticated');
  for (const c of ['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', 'NOT_AUTHORIZED', '403', '404']) assert.equal(classify(err(c)), 'refused');
  assert.equal(classify(err('RESERVED_NOT_BUILT')), 'not_built'); assert.equal(classify(err('500')), 'failed');
});
test('css exports the three blocks', () => { for (const k of ['.entity-card', '.hero', '.stepper']) assert.ok(css.includes(k)); });

// ---------- empty states ----------
test('workspaces: empty state and create form', async () => {
  const ctx = ctxWith({ 'GET /v2/workspaces': { workspaces: [] } });
  const m = await pages.workspaces.load(ctx, {}); const h = pages.workspaces.render(ctx, m);
  assert.ok(h.includes('You have no workspaces yet.')); assert.ok(h.includes('id="create-workspace"'));
});
test('projects: empty state and create form', async () => {
  const ctx = ctxWith({ 'GET /v2/projects': { projects: [] } });
  const h = pages.projects.render(ctx, await pages.projects.load(ctx, {}));
  assert.ok(h.includes('You have no projects yet.')); assert.ok(h.includes('id="create-project"')); assert.ok(h.includes('href="#workspaces"'));
});
test('workspace: no projects grouped, viewer sees no add/rename/remove', async () => {
  const ctx = ctxWith({ 'GET /v2/workspaces/ws1': { workspace: { id: 'ws1', name: 'W <1>', role: 'viewer', archived_at: null }, projects: [] } });
  const m = await pages.workspace.load(ctx, { id: 'ws1' }); const h = pages.workspace.render(ctx, m);
  assert.ok(h.includes('No projects grouped yet')); assert.ok(h.includes('W &lt;1&gt;')); assert.ok(!h.includes('id="add-project"')); assert.ok(!h.includes('id="rename-form"')); assert.ok(!h.includes('data-remove'));
  assert.equal(ctx.calls.length, 1, 'viewer does not fetch candidate projects');
  assert.ok(h.includes('href="#permissions/workspaces/ws1"'));
});
test('project: no assessments, no languages → create blocked until a language exists', async () => {
  const ctx = ctxWith({ 'GET /v2/projects/p1': { project: { id: 'p1', name: 'P', role: 'member' }, languages: [] }, 'GET /v2/projects/p1/assessments': { assessments: [] }, 'GET /v2/projects/p1/languages': { languages: [] } });
  const h = pages.project.render(ctx, await pages.project.load(ctx, { id: 'p1' }));
  assert.ok(h.includes('No assessments yet.')); assert.ok(h.includes('No languages yet')); assert.ok(h.includes('id="add-language"')); assert.ok(!h.includes('id="create-assessment"')); assert.ok(!h.includes('id="rename-form"'), 'member cannot rename');
});

// ---------- card links per scope ----------
test('workspaces: cards link to #workspace/<id>', async () => {
  const ctx = ctxWith({ 'GET /v2/workspaces': { workspaces: [{ id: 'ws 1', name: 'A', role: 'owner' }, { id: 'ws2', name: 'B', role: 'member', archived_at: '2026-01-01' }] } });
  const h = pages.workspaces.render(ctx, await pages.workspaces.load(ctx, {}));
  assert.ok(h.includes('href="#workspace/ws%201"')); assert.ok(h.includes('href="#workspace/ws2"')); assert.ok(h.includes('Archived'));
});
test('workspace (owner): project cards, add select excludes grouped, remove + rename + permissions', async () => {
  const ctx = ctxWith({ 'GET /v2/workspaces/ws1': { workspace: { id: 'ws1', name: 'W', role: 'owner', archived_at: '2026-02-02' }, projects: [{ id: 'p1', name: 'In', archived_at: null }] }, 'GET /v2/projects': { projects: [{ id: 'p1', name: 'In', role: 'owner' }, { id: 'p2', name: 'Out', role: 'owner' }] } });
  const h = pages.workspace.render(ctx, await pages.workspace.load(ctx, { id: 'ws1' }));
  assert.ok(h.includes('href="#project/p1"')); assert.ok(h.includes('<option value="p2">Out</option>')); assert.ok(!h.includes('<option value="p1"'));
  assert.ok(h.includes('data-remove="p1"')); assert.ok(h.includes('id="rename-form"')); assert.ok(h.includes('>Archived<'));
  assert.ok(!h.includes('Your role: owner</p><p'), 'no people list'); assert.ok(!/principal|invitation/i.test(h), 'no people listed at workspace level on this page');
});
test('projects: cards link to #project/<id>', async () => {
  const ctx = ctxWith({ 'GET /v2/projects': { projects: [{ id: 'p1', name: 'One', role: 'owner' }] } });
  assert.ok(pages.projects.render(ctx, await pages.projects.load(ctx, {})).includes('href="#project/p1"'));
});
test('project (owner): assessment cards link to #assessment/<id> with language name, create form, permissions link', async () => {
  const ctx = ctxWith({ 'GET /v2/projects/p1': { project: { id: 'p1', name: 'P', role: 'owner', organization: 'Org' }, languages: [] }, 'GET /v2/projects/p1/assessments': { assessments: [{ id: 'a1', name: 'Sept', stage: 'collect', language_id: 'l1' }] }, 'GET /v2/projects/p1/languages': { languages: [{ id: 'l1', name: 'Lake', code: 'qaa', archived_at: null }, { id: 'l2', name: 'Old', code: null, archived_at: '2026-01-01' }] } });
  const h = pages.project.render(ctx, await pages.project.load(ctx, { id: 'p1' }));
  assert.ok(h.includes('href="#assessment/a1"')); assert.ok(h.includes('Language: Lake')); assert.ok(h.includes('Collecting'));
  assert.ok(h.includes('id="create-assessment"')); assert.ok(h.includes('<option value="l1">Lake (qaa)</option>')); assert.ok(!h.includes('<option value="l2"'), 'archived language not offered');
  assert.ok(h.includes('id="rename-form"')); assert.ok(h.includes('href="#permissions/projects/p1"')); assert.ok(h.includes('Org'));
});

// ---------- refusal / auth / transient ----------
test('refusal codes render "Not visible to you" without leaking existence', async () => {
  for (const code of ['NOT_FOUND_OR_NOT_VISIBLE', 'NOT_AUTHORIZED_AT_SCOPE', '403', '404']) {
    const ctx = ctxWith({ 'GET /v2/workspaces/x': err(code, 'secret detail'), 'GET /v2/projects/x': err(code, 'secret detail') });
    for (const page of [pages.workspace, pages.project]) {
      const m = await page.load(ctx, { id: 'x' }); assert.equal(m.status, 'refused');
      const h = page.render(ctx, m); assert.ok(h.includes('Not visible to you')); assert.ok(!h.includes('secret detail')); assert.ok(!h.includes('Retry'));
    }
  }
});
test('NOT_AUTHENTICATED renders a sign-in prompt linking #', async () => {
  const ctx = ctxWith({ 'GET /v2/workspaces': err('NOT_AUTHENTICATED'), 'GET /v2/projects': err('401') });
  for (const page of [pages.workspaces, pages.projects]) { const h = page.render(ctx, await page.load(ctx, {})); assert.ok(h.includes('Sign in to continue')); assert.ok(h.includes('href="#"')); assert.ok(h.includes('/v2/auth/access')); }
});
test('transient failure renders message + Retry, and Retry re-runs load', async () => {
  const map = { 'GET /v2/workspaces': err('500', 'boom') }; const ctx = ctxWith(map);
  const m = await pages.workspaces.load(ctx, {}); const h = pages.workspaces.render(ctx, m);
  assert.ok(h.includes('boom')); assert.ok(h.includes('data-act="retry"'));
  map['GET /v2/workspaces'] = { workspaces: [{ id: 'w', name: 'Back', role: 'owner' }] };
  const root = mount(pages.workspaces, ctx, m); await root.querySelector('[data-act="retry"]').fire('click');
  assert.equal(ctx.calls.length, 2); assert.ok(root.querySelector('#create-workspace'), 'page re-rendered after retry');
});
test('RESERVED_NOT_BUILT renders honest not-built, not retry', async () => {
  const ctx = ctxWith({ 'GET /v2/projects': err('RESERVED_NOT_BUILT') });
  const h = pages.projects.render(ctx, await pages.projects.load(ctx, {})); assert.ok(h.includes('not built')); assert.ok(!h.includes('Retry'));
});
test('project: refused assessments list is shown as not visible, page still renders', async () => {
  const ctx = ctxWith({ 'GET /v2/projects/p1': { project: { id: 'p1', name: 'P', role: 'viewer' }, languages: [] }, 'GET /v2/projects/p1/assessments': err('NOT_AUTHORIZED_AT_SCOPE'), 'GET /v2/projects/p1/languages': { languages: [] } });
  const m = await pages.project.load(ctx, { id: 'p1' }); assert.equal(m.status, 'loaded'); assert.equal(m.assessmentsStatus, 'refused');
  const h = pages.project.render(ctx, m); assert.ok(h.includes('not visible to you')); assert.ok(h.includes('<h2>P</h2>')); assert.ok(h.includes('data-read-region')); assert.ok(!h.includes('data-action-region'), 'viewer: no retained action forms');
});

// ---------- entry ----------
test('entry: public welcome with hero, tour stepper and survey/example/sign-in buttons', async () => {
  const ctx = ctxWith(); const m = await pages.entry.load(ctx, {}); const h = pages.entry.render(ctx, m);
  assert.ok(h.includes('What is 3D Review?')); assert.ok(h.includes('Translation team')); assert.ok(h.includes('href="#survey">Take a survey')); assert.ok(h.includes('href="/?demo=1#assessment/demo-assessment/prepare">Browse a sample assessment (synthetic data) →')); assert.ok(h.includes('href="/v2/auth/access">Sign in</a>')); assert.ok(!h.includes('Continue'));
  // captain-named public home (ui/public-choices.test.mjs contract, now asserted on the ROOT entry): four choices, in order, above the headline
  const nav = h.slice(h.indexOf('<nav class="public-choices'), h.indexOf('</nav>')); const links = [...nav.matchAll(/<a class="rv-btn[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map(m => [m[2], m[1]]);
  assert.deepEqual(links, [['Read about it', '#public-about'], ['Take the tour', '/?demo=1#assessment/demo-assessment/prepare'], ['Take a survey', '#survey'], ['Sign in', '/v2/auth/access']]);
  assert.ok(nav.includes('aria-label="Choose where to start"')); assert.ok(h.indexOf('<nav class="public-choices') < h.indexOf('<h1>')); assert.ok(h.includes('<p class="eyebrow" id="public-about">What is 3D Review?</p>'));
  assert.ok(h.includes('Explore the real assessment screens · Go at your own pace · Nothing is sent')); assert.ok(h.includes('href="#projects">Open your projects and reports'));
  for (const retired of ['Here to take the survey?', 'Show me how', 'Manage assessments']) assert.ok(!h.includes(retired), retired);
});
test('entry: signed in shows Continue cards + sign-out, hides sign-in', async () => {
  const ctx = ctxWith({}, { state: { principal: { id: 'pr_1' } } }); const h = pages.entry.render(ctx, await pages.entry.load(ctx, {}));
  assert.ok(h.includes('href="#workspaces"')); assert.ok(h.includes('href="#projects"')); assert.ok(h.includes('data-act="signout"')); assert.ok(!h.includes('data-act="signin"'));
});
test('entry: sign-in email → code step (dev code shown) → session stored, token set, go #workspaces', async () => {
  const stored = {}; globalThis.sessionStorage = { setItem: (k, v) => { stored[k] = v; }, removeItem: k => { delete stored[k]; } };
  const tokens = [];
  const ctx = ctxWith({ 'POST /v2/auth/link': { sent: true, dev_only_code: '123456' }, 'POST /v2/auth/session': { session: 'sess_abc', principal_id: 'pr_1' } }, { setToken: t => tokens.push(t) });
  const m = await pages.entry.load(ctx, {}); m.mode = 'signin';
  const root = mount(pages.entry, ctx, m);
  let form = root.querySelector('#signin-form'); assert.equal(form.dataset.stage, 'email'); assert.equal(form.querySelector('[name=code]'), null);
  form.elements.email.value = 'a@x.example.invalid'; await form.fire('submit');
  assert.deepEqual(ctx.calls[0].body, { email: 'a@x.example.invalid' });
  form = root.querySelector('#signin-form'); assert.equal(form.dataset.stage, 'code'); assert.ok(form.querySelector('[name=code]'));
  assert.ok(pages.entry.render(ctx, m).includes('123456'));
  form.elements.code.value = ' 123456 '; await form.fire('submit');
  assert.deepEqual(ctx.calls[1].body, { email: 'a@x.example.invalid', code: '123456' });
  assert.equal(stored.facilitatorToken, 'sess_abc'); assert.deepEqual(tokens, ['sess_abc']); assert.deepEqual(ctx.gone, ['#workspaces']);
});
test('entry: sign-in failure stays on the form and never claims success', async () => {
  const ctx = ctxWith({ 'POST /v2/auth/link': err('INVALID_PARAMS', 'synthetic only') });
  const m = await pages.entry.load(ctx, {}); m.mode = 'signin'; const root = mount(pages.entry, ctx, m);
  const form = root.querySelector('#signin-form'); form.elements.email.value = 'real@example.com'; await form.fire('submit');
  assert.equal(m.signin.stage, 'email'); assert.ok(ctx.notes.some(n => n.a && n.m.includes('synthetic only'))); assert.deepEqual(ctx.gone, []);
});
test('entry: survey guidance treats the code as optional and never implies a resend', async () => {
  const ctx = ctxWith(); const h = pages.entry.render(ctx, await pages.entry.load(ctx, { intent: 'survey' }));
  const guidance = 'If you were given an access code, enter it below.';
  assert.ok(h.includes(guidance));
  assert.ok(h.includes('Missing your survey link? Ask the person who invited you or shared the survey to send you the link.'));
  assert.ok(!h.includes('released above'));
  assert.ok(!h.includes('send it again'));
});
test('entry: survey code stores participant token and hands off to legacy /#participant', async () => {
  const stored = {}; globalThis.sessionStorage = { setItem: (k, v) => { stored[k] = v; }, removeItem: k => { delete stored[k]; } };
  const assigned = []; globalThis.window = { location: { assign: u => assigned.push(u) } };
  const ctx = ctxWith({ 'POST /v2/participate/code': { participant_token: 'ptok', survey_id: 's1' } });
  const m = await pages.entry.load(ctx, {}); m.mode = 'survey'; const root = mount(pages.entry, ctx, m);
  const form = root.querySelector('#code-form'); form.elements.code.value = 'ABC'; await form.fire('submit');
  assert.equal(stored.participantToken, 'ptok'); assert.deepEqual(assigned, ['/legacy/#participant']);
});

// ---------- writes ----------
test('workspaces: create goes to the new workspace; NOT_AUTHORIZED shows the server message', async () => {
  const ctx = ctxWith({ 'GET /v2/workspaces': { workspaces: [] }, 'POST /v2/workspaces': { workspace: { id: 'ws9', name: 'N' } } });
  const m = await pages.workspaces.load(ctx, {}); const root = mount(pages.workspaces, ctx, m);
  const form = root.querySelector('#create-workspace'); form.elements.name.value = 'N'; await form.fire('submit');
  assert.deepEqual(ctx.gone, ['#workspace/ws9']);
  const ctx2 = ctxWith({ 'GET /v2/workspaces': { workspaces: [] }, 'POST /v2/workspaces': err('NOT_AUTHORIZED_AT_SCOPE', 'workspace creation is provisioned') });
  const m2 = await pages.workspaces.load(ctx2, {}); const root2 = mount(pages.workspaces, ctx2, m2);
  const f2 = root2.querySelector('#create-workspace'); f2.elements.name.value = 'N'; await f2.fire('submit');
  assert.deepEqual(ctx2.gone, []); assert.ok(ctx2.notes.some(n => n.a));
});
test('project: create assessment posts {name, language_id} and goes to #assessment/<id>', async () => {
  const ctx = ctxWith({ 'GET /v2/projects/p1': { project: { id: 'p1', name: 'P', role: 'member' }, languages: [] }, 'GET /v2/projects/p1/assessments': { assessments: [] }, 'GET /v2/projects/p1/languages': { languages: [{ id: 'l1', name: 'Lake', code: null, archived_at: null }] }, 'POST /v2/projects/p1/assessments': { assessment: { id: 'a7' } } });
  const m = await pages.project.load(ctx, { id: 'p1' }); const root = mount(pages.project, ctx, m);
  const form = root.querySelector('#create-assessment'); form.elements.name.value = 'Sept'; form.elements.language_id.value = 'l1'; await form.fire('submit');
  assert.deepEqual(ctx.calls.at(-1).body, { name: 'Sept', language_id: 'l1' }); assert.deepEqual(ctx.gone, ['#assessment/a7']);
});

test('signed-in welcome never displays internal identity or invented email and delegates logout', async()=>{
  let calls=0;const ctx=ctxWith({}, {state:{principal:{id:'private-opaque',email:'not-verified@example.invalid'}},signOut:async()=>{calls++;}});
  const model=await pages.entry.load(ctx);const html=pages.entry.render(ctx,model);assert.ok(!html.includes('private-opaque'));assert.ok(!html.includes('not-verified@example.invalid'));
  const root={querySelector:()=>null,querySelectorAll:()=>[{dataset:{act:'signout'},addEventListener:(_type,fn)=>root.click=fn}]};pages.entry.bind(ctx,root,model);await root.click();assert.equal(calls,1);assert.equal(ctx.calls.length,0);
});
