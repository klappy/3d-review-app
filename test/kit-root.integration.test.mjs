// node --test test/kit-root.integration.test.mjs — normal root, REAL index.html + REAL assess controller + REAL kit modules,
// driven in jsdom over the synthetic fail-closed transport (test/fixtures/kit-root-transport.js). No fixture-only shell,
// no prototype router/state, no cookies, no real session. Phone/desktop layout itself is a browser-screenshot step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { dataset, createTransport } from './fixtures/kit-root-transport.js';
import * as demo from '../ui/demo.js';
import { redactDiagnosticPath } from '../ui/diagnostic-path.js';
import * as stage from '../ui/stage-screens.js';
import { whatsHere } from '../ui/assess/whats-here.js';
import * as cards from '../ui/assess/cards.js';
import { pages, css as scopeCss } from '../ui/assess/scope.js';
import { views, css as viewsCss } from '../ui/assess/views.js';
import * as share from '../ui/assess/share.js';
import { feedback } from '../ui/assess/feedback.js';
import { mountKitRoot, shellModel, bindAccountMenu } from '../ui/kit/app-adapter.js';
import { createFeedbackModal } from '../ui/assess/feedback-modal.js';
// Generated loaded-client identity is a build artifact (scripts/stamp-version.mjs → ui/client-release.js); the harness supplies a synthetic one.
const clientRelease = Object.freeze({ version: '0.0.0-synthetic', commit: 'synthetic', release_source: 'synthetic', build_uuid: null });

const ORIGIN = 'http://127.0.0.1:4173';
const HTML = readFileSync(new URL('../ui/index.html', import.meta.url), 'utf8');
const strip = src => src.replace(/^import .*;\n/gm, '').replace(/^export (async )?function /gm, '$1function ').replace(/^export const /gm, 'const ');
const ASSESS = strip(readFileSync(new URL('../ui/assess/assess.js', import.meta.url), 'utf8'));
const CHANGELOG = strip(readFileSync(new URL('../ui/changelog.js', import.meta.url), 'utf8'));
const tick = (n = 6) => new Promise(r => { let i = 0; (function step() { if (++i > n) return r(); setTimeout(step, 0); })(); });

// Boot the real page at `hash` as `identity`. Everything the controller imports is the real module; only fetch is synthetic.
async function bootPage(identity = 'owner', hash = '#workspaces', { install } = {}) {
  const data = dataset(identity), transport = createTransport({ routes: data.routes, origin: ORIGIN });
  if (install) install(transport, data);
  const dom = new JSDOM(HTML, { url: ORIGIN + '/' + hash, pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  w.CSS = { escape: s => String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c) };
  w.fetch = transport.fetch; // installed BEFORE any script runs
  w.confirm = () => false;
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  Object.assign(w, { isDemo: demo.isDemo, demoApi: demo.demoApi, memoryStorage: demo.memoryStorage, sampleResponses: demo.sampleResponses, redactDiagnosticPath, loadBlankPrint: stage.loadBlankPrint, renderBlankPrint: stage.renderBlankPrint, printAllowed: stage.printAllowed, rememberTab: stage.rememberTab, recalledTab: stage.recalledTab, STAGES: stage.STAGES, whatsHere, cards, pages, scopeCss, views, viewsCss, share, feedback, mountKitRoot, shellModel, bindAccountMenu, createFeedbackModal, clientRelease });
  const ctx = dom.getInternalVMContext();
  vm.runInContext(CHANGELOG, ctx, { filename: 'changelog.js' });
  const api = vm.runInContext(ASSESS + '\n({ state, resetIdentity, render, boot, route, setHash: h => { location.hash = h; }, kit, app })', ctx, { filename: 'assess.js' });
  await tick(12); // the controller's own boot guard fires on the kit root; nothing is started by the test
  const d = w.document;
  const q = s => d.querySelector(s), qa = s => [...d.querySelectorAll(s)];
  const go = async h => { w.location.hash = h; await tick(16); };
  const text = s => (q(s)?.textContent || '').trim();
  const served = () => transport.log.filter(l => l.outcome === 'served').map(l => l.key);
  return { dom, w, d, q, qa, go, text, api, transport, data, served };
}
const treeLabels = p => p.qa('nav[aria-label="Scopes"] .tree-label').map(e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim());
const crumbs = p => p.qa('header.top nav.crumbs a').map(a => a.textContent.trim());

test('normal root: single kit header hosts the REAL account/version/link controls (moved, not cloned); no legacy header', async () => {
  const p = await bootPage('owner', '#workspaces');
  assert.equal(p.qa('header').length, 1); assert.ok(p.q('header.top'));
  assert.equal(p.qa('#who').length, 1); assert.equal(p.qa('#version').length, 1); assert.equal(p.qa('#account').length, 1);
  assert.ok(p.q('[data-header-host] #account-menu-toggle #who'), 'verified email node is the visible account control');
  assert.ok(p.q('[data-header-host] #account-menu #version')); assert.ok(p.q('[data-header-host] #account-menu #shell-links a[href="#feedback"]')); assert.ok(p.q('[data-header-host] #account-menu #account-signout'));
  assert.equal(p.q('#account-menu').hidden, true, 'secondary controls disclosed on demand'); assert.equal(p.q('header.top .me'), null, 'no identity pill: email is the identity');
  assert.equal(p.q('#shell-controls'), null, 'adoption wrapper removed');
  assert.equal(p.text('#who'), 'Account: synthetic-owner@example.invalid');
  assert.deepEqual(p.qa('header.top *').filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.includes('@'))).map(e => e.id), ['who'], 'private email appears exactly once (the #who node)');
  assert.equal(p.q('#account-actions').hidden, false);
  assert.equal(p.q('[role=main].content [data-content]'), p.api.app, 'controller app root IS the stable shell content element');
});

test('journey: Workspaces → workspace → project (two distinct assessments, language state) → assessment → back; route/title/crumb agree', async () => {
  const p = await bootPage('owner', '#workspaces');
  assert.equal(p.text('[role=main].content h1'), 'Workspaces'); assert.deepEqual(crumbs(p), ['Workspaces']);
  assert.ok(p.q('[data-read-region] a[href="#workspace/w1"]')); assert.ok(p.q('[data-action-region] form#create-workspace'));
  assert.ok(treeLabels(p).includes('Field team')); assert.ok(treeLabels(p).includes('Hill project'), 'ungrouped project listed at top level');
  await p.go('#workspace/w1');
  assert.equal(p.text('[role=main].content h1'), 'Field team'); assert.deepEqual(crumbs(p), ['Workspaces', 'Field team']);
  assert.equal(p.q('nav[aria-label="Scopes"] [aria-current="page"]')?.textContent.trim(), 'Field team');
  assert.ok(p.q('[data-read-region] a[href="#project/p1"]')); assert.ok(p.q('[data-action-region] #add-project, [data-action-region] #rename-form'));
  await p.go('#project/p1');
  assert.equal(p.text('[role=main].content h1'), 'River Valley'); assert.deepEqual(crumbs(p), ['Projects', 'Field team', 'River Valley']);
  const items = p.qa('[data-read-region] .grid article');
  assert.equal(items.length, 2);
  assert.ok(items[0].textContent.includes('September assessment') && items[0].textContent.includes('Collecting') && items[0].textContent.includes('Lake language'));
  assert.ok(items[1].textContent.includes('Spring baseline') && items[1].textContent.includes('In preparation'));
  assert.ok(p.q('[data-action-region] #create-assessment')); assert.ok(p.q('[data-action-region] #add-language')); assert.ok(p.q('[data-action-region] #rename-form'));
  assert.deepEqual(treeLabels(p).filter(l => /September|Spring/.test(l)), ['September assessment', 'Spring baseline'], 'tree shows both assessments under the project from loaded data');
  const projectContent = p.api.app;
  await p.go('#assessment/a1');
  assert.equal(p.text('[role=main].content h1'), 'September assessment'); assert.deepEqual(crumbs(p), ['Field team', 'River Valley', 'September assessment']);
  assert.ok(p.q('nav[aria-label="Scopes"] [aria-current="page"]')?.textContent.startsWith('September assessment'));
  assert.ok(p.q('[data-content] .view-tabs'), 'retained legacy assessment module mounted in stable content');
  assert.equal(p.q('[data-content] .context-panel'), null, 'no duplicate context panel under the kit tree'); assert.equal(p.qa('h1').length, 1, 'one heading'); assert.ok(p.q('[data-content] .badge'), 'stage badge kept');
  assert.equal(p.api.app, projectContent, 'content element identity stable across route change');
  assert.equal(p.q('[data-content] [data-read-region]'), null, 'old project view destroyed before the assessment mounted');
  await p.go('#project/p1');
  assert.equal(p.text('[role=main].content h1'), 'River Valley'); assert.deepEqual(crumbs(p), ['Projects', 'Field team', 'River Valley']);
  assert.equal(p.q('[data-content] .view-tabs'), null);
  // exact reads: no discovery calls, no mutation, no non-local request
  assert.ok(p.transport.log.every(l => l.outcome === 'served'), JSON.stringify(p.transport.log.filter(l => l.outcome !== 'served').map(l => l.key)));
  assert.ok(!p.served().some(k => k.includes('/v2/projects/p9')));
});

test('shell search and expansion preserve the mounted view, its input and the header host; delegated navigation works', async () => {
  const p = await bootPage('owner', '#project/p1');
  const mount = p.api.app, who = p.q('#who'), host = p.q('[data-header-host]');
  const input = p.q('#create-assessment input[name=name]'); input.value = 'unsaved draft';
  const search = p.q('[data-search]'); search.focus(); search.value = 'Spring'; search.dispatchEvent(new p.w.InputEvent('input', { bubbles: true }));
  assert.deepEqual(treeLabels(p), ['Spring baseline']);
  assert.equal(p.api.app, mount); assert.equal(input.isConnected, true); assert.equal(input.value, 'unsaved draft');
  assert.equal(p.q('[data-header-host]'), host); assert.equal(who.isConnected, true); assert.equal(p.qa('#who').length, 1);
  search.value = ''; search.dispatchEvent(new p.w.InputEvent('input', { bubbles: true }));
  const caret = p.q('[data-expand="p:p1"]'); caret.click();
  assert.equal(p.q('[data-expand="p:p1"]').getAttribute('aria-expanded'), 'false'); assert.equal(p.api.app, mount); assert.equal(input.isConnected, true);
  p.q('[data-expand="p:p1"]').click();
  const link = p.qa('nav[aria-label="Scopes"] [data-navigate]').find(a => a.textContent.includes('Spring'));
  link.click(); await tick(16);
  assert.equal(p.w.location.hash, '#assessment/a2'); assert.equal(p.text('[role=main].content h1'), 'Spring baseline');
});

test('stale identity/route: held read never paints, retained old control is disconnected, private text cleared', async () => {
  let release;
  const p = await bootPage('owner', '#project/p1', { install: t => { release = t.hold('GET /v2/projects/p2'); } });
  const oldForm = p.q('#create-assessment');
  p.w.location.hash = '#project/p2'; await tick(4); // load held
  assert.equal(p.text('[role=main].content h1'), 'Hill project', 'title from the already-loaded project list while the page load is held');
  assert.equal(p.q('[data-content]').textContent.trim(), 'Loading…', 'old view destroyed before the new load resolves');
  p.api.resetIdentity(); await tick(2);
  assert.equal(oldForm.isConnected, false, 'old control detached');
  assert.equal(p.q('[data-content]').childNodes.length, 0);
  assert.equal(p.text('#who'), 'Checking session…'); assert.ok(p.q('[data-header-host] #who'), 'host and its node survive identity reset');
  assert.equal(p.q('#account-actions').hidden, true);
  release(); await tick(12);
  assert.equal(p.q('[data-content]').childNodes.length, 0, 'held reply for the old identity painted nothing');
  assert.ok(!p.q('[role=main].content').textContent.includes('Hill project'), 'old identity data gone from the shell');
  oldForm.dispatchEvent(new p.w.Event('submit', { bubbles: true })); await tick(2);
  assert.ok(!p.transport.log.some(l => l.method === 'POST'), 'retained old form cannot emit into the new identity');
});

test('read states are distinct: refused assessments + failed languages are not empty success; direct grant lists no invented ancestors', async () => {
  const p = await bootPage('member', '#project/p2');
  assert.equal(p.text('[role=main].content h1'), 'Hill project');
  assert.ok(p.q('[data-read-region]').textContent.includes('not visible to you'));
  assert.ok(p.q('[data-read-region]').textContent.includes('Languages could not be loaded'));
  assert.equal(p.qa('[data-read-region] .grid article').length, 0);
  assert.equal(p.q('[data-action-region]'), null, 'viewer role on p2: no write forms rendered');
  const d = await bootPage('direct', '#assessment/a9');
  assert.equal(d.text('[role=main].content h1'), 'Granted assessment'); assert.deepEqual(crumbs(d), ['Granted assessment']);
  assert.deepEqual(treeLabels(d), ['Granted assessment']);
  assert.equal(d.q('nav[aria-label="Scopes"] a[href^="#project"]'), null); assert.equal(d.q('nav[aria-label="Scopes"] a[href^="#workspace"]'), null);
  assert.ok(!d.served().includes('GET /v2/projects/p9'), 'no discovery read of the unreadable parent');
  assert.equal(d.text('#who'), 'Account: synthetic-direct@example.invalid');
});

test('retained forms invoke the exact existing commands and fail closed; version dialog opens from the hosted control', async () => {
  const p = await bootPage('owner', '#workspaces');
  const form = p.q('#create-workspace'); form.elements.name.value = 'New group';
  form.dispatchEvent(new p.w.Event('submit', { bubbles: true, cancelable: true })); await tick(8);
  const post = p.transport.log.find(l => l.method === 'POST');
  assert.equal(post?.key, 'POST /v2/workspaces'); assert.equal(post.outcome, 'mutation-refused'); assert.equal(JSON.parse(post.body).name, 'New group');
  assert.ok(p.text('#note').includes('Create workspace failed'), p.text('#note'));
  assert.equal(p.w.location.hash, '#workspaces');
  const dialog = p.q('#changelog');
  p.q('#version').click(); await tick(4);
  assert.equal(dialog.hasAttribute('open'), true, 'changelog dialog opens from the hosted version control');
  assert.equal(p.q('#version').getAttribute('aria-expanded'), 'true');
});

test('unauthenticated normal root: sign-in panel inside the shell, no data, no tree nodes', async () => {
  const p = await bootPage('owner', '#projects', { install: t => { t.log.length = 0; } });
  p.data.routes.delete('GET /v2/me');
  const q = await bootPage('owner', '#projects', { install: (t, data) => { data.routes.delete('GET /v2/me'); } });
  assert.ok(q.q('[data-content]').textContent.includes('Sign in to open this page'));
  assert.equal(treeLabels(q).length, 0); assert.equal(q.text('#who'), 'Not signed in');
  assert.ok(!q.served().some(k => k.startsWith('GET /v2/projects')));
});

// ---- Independent review b918faa disconfirmers (F1/F2/F3) ----
test('F1: a retry that completes after navigation never overwrites the newer route; a current retry re-syncs the shell', async () => {
  let release;
  const p = await bootPage('owner', '#project/p2', { install: t => { release = t.hold('GET /v2/projects/p2'); } });
  await tick(2); assert.equal(p.text('[data-content]'), 'Loading…');
  release(); await tick(12);
  assert.equal(p.text('[role=main].content h1'), 'Hill project');
  const retry = p.q('[data-read-region] [data-act="retry"]'); assert.ok(retry, 'languages failed → Retry offered');
  release = p.transport.hold('GET /v2/projects/p2'); retry.click(); await tick(2);
  await p.go('#project/p1');
  assert.equal(p.text('[role=main].content h1'), 'River Valley');
  release(); await tick(12);
  assert.equal(p.w.location.hash, '#project/p1'); assert.equal(p.text('[role=main].content h1'), 'River Valley');
  assert.ok(!p.q('[data-content]').textContent.includes('Hill project'), 'late retry completion painted nothing');
  assert.ok(p.q('[data-read-region] a[href="#assessment/a1"]'), 'p1 content intact');
  // Current retry: languages route now succeeds → content and shell both reflect the new model.
  await p.go('#project/p2'); p.data.routes.set('GET /v2/projects/p2/languages', { ok: true, result: { languages: [{ id: 'l5', name: 'Hill language', code: 'qab', archived_at: null }] } });
  p.q('[data-read-region] [data-act="retry"]').click(); await tick(12);
  assert.ok(p.q('[data-read-region]').textContent.includes('Hill language')); assert.equal(p.text('[role=main].content h1'), 'Hill project');
  assert.equal(p.qa('#who').length, 1);
});
test('F2: a create completion arriving after navigation does not redirect the newer route', async () => {
  const p = await bootPage('owner', '#workspaces');
  let release; p.transport.hold; // synthetic-only: the transport refuses mutations; simulate a deferred SUCCESS for this one POST
  const held = new Promise(r => { release = r; });
  const real = p.w.fetch; p.w.fetch = (u, i) => (i?.method === 'POST' && String(u).endsWith('/v2/workspaces')) ? held.then(() => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ ok: true, result: { workspace: { id: 'synthetic-created' } } }) })) : real(u, i);
  const form = p.q('#create-workspace'); form.elements.name.value = 'Late'; form.dispatchEvent(new p.w.Event('submit', { bubbles: true, cancelable: true })); await tick(2);
  await p.go('#project/p1'); assert.equal(p.text('[role=main].content h1'), 'River Valley');
  release(); await tick(12);
  assert.equal(p.w.location.hash, '#project/p1', 'stale completion did not navigate'); assert.equal(p.text('[role=main].content h1'), 'River Valley');
  assert.equal(p.text('#note'), '', 'stale completion wrote no status line');
});
test('F3: viewer-only identity shows no synthesized role; scope role appears only where loaded', async () => {
  const p = await bootPage('viewer', '#workspaces');
  assert.equal(p.q('header.top .me'), null); assert.equal(p.q('header.top nav.crumbs .tree-role'), null);
  assert.ok(!p.q('header.top').textContent.includes('Member'));
  await p.go('#project/p2');
  assert.equal(p.text('header.top nav.crumbs .tree-role'), 'Viewer');
  await p.go('#project/p1');
  assert.equal(p.text('header.top nav.crumbs .tree-role'), 'Viewer');
});

test('role contract end-to-end: Owner/Member/Viewer each display as themselves at project p1; write regions follow the real controller permission', async () => {
  for (const [identity, label, forms] of [['owner', 'Owner', ['create-assessment', 'rename-form', 'add-language']], ['member', 'Member', ['create-assessment', 'add-language']], ['viewer', 'Viewer', []]]) {
    const p = await bootPage(identity, '#project/p1');
    assert.equal(p.text('header.top nav.crumbs .tree-role'), label, identity);
    assert.equal(p.text('#who'), 'Account: synthetic-' + identity + '@example.invalid', identity + ' identity is the email, not a role');
    assert.equal(p.q('nav[aria-label="Scopes"] [aria-current="page"]').closest('.tree-row').querySelector('.tree-role').textContent, label, identity);
    assert.deepEqual(p.qa('[data-action-region] form').map(f => f.id), forms, identity + ' write forms come only from the controller role');
    assert.equal(p.qa('[data-menu-toggle]').length, 0, 'kit level menu never synthesized');
  }
});

// ---- Compact chrome amendment (COMPACT-CHROME-DISPOSITION-2026-09-22) ----
test('account menu: verified email is the visible control; disclosure opens/closes by pointer and keyboard with focus return; controls keep identity across routes and reset', async () => {
  const p = await bootPage('owner', '#workspaces');
  const toggle = p.q('#account-menu-toggle'), menu = p.q('#account-menu'), who = p.q('#who'), version = p.q('#version'), signout = p.q('#account-signout');
  assert.equal(p.text('#who'), 'Account: synthetic-owner@example.invalid'); assert.equal(menu.hidden, true);
  toggle.click(); assert.equal(menu.hidden, false); assert.equal(toggle.getAttribute('aria-expanded'), 'true'); assert.equal(p.d.activeElement, signout, 'first enabled item focused');
  signout.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); assert.equal(p.d.activeElement, p.q('#account-switch'));
  p.d.activeElement.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); assert.equal(menu.hidden, true); assert.equal(p.d.activeElement, toggle, 'Escape returns focus to the toggle');
  toggle.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); assert.equal(menu.hidden, false);
  p.q('[role=main]').click(); assert.equal(menu.hidden, true, 'outside click closes');
  await p.go('#project/p1'); await p.go('#assessment/a1');
  assert.equal(p.q('#who'), who); assert.equal(p.q('#version'), version); assert.equal(p.q('#account-signout'), signout); assert.equal(p.qa('#who').length, 1);
  p.api.resetIdentity(); await tick(2);
  assert.equal(p.q('#who'), who); assert.equal(p.text('#who'), 'Checking session…'); assert.equal(p.q('#account-actions').hidden, true); assert.equal(menu.hidden, true);
});
test('phone: context collapsed by default with the current scope visible; expands, Escape closes and returns focus; content/host untouched', async () => {
  const p = await bootPage('owner', '#project/p1', { install: () => {} });
  // emulate the narrow media query for this page instance (layout itself is a browser-screenshot step)
  p.w.matchMedia = q => ({ matches: /max-width:\s*760px/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
  await p.go('#workspace/w1'); await p.go('#project/p1');
  const toggle = p.q('[data-tree-toggle]'); assert.ok(toggle, 'context toggle rendered'); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(p.q('[data-tree-panel]').hidden, true); assert.equal(toggle.querySelector('.tree-toggle-current').textContent, 'River Valley', 'current scope visible while collapsed');
  assert.ok(p.q('[data-read-region] a[href="#assessment/a1"]'), 'work area rendered first');
  const mount = p.api.app, who = p.q('#who');
  toggle.click(); assert.equal(p.q('[data-tree-panel]').hidden, false); assert.equal(p.q('[data-tree-toggle]').getAttribute('aria-expanded'), 'true'); assert.equal(p.d.activeElement, p.q('[data-tree-toggle]'));
  assert.equal(p.api.app, mount); assert.equal(p.q('#who'), who);
  const search = p.q('[data-search]'); search.focus(); search.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(p.q('[data-tree-panel]').hidden, true); assert.equal(p.d.activeElement, p.q('[data-tree-toggle]'), 'Escape closes and returns focus');
  p.q('[data-tree-toggle]').click(); p.qa('nav[aria-label="Scopes"] [data-navigate]').find(a => a.textContent.includes('Spring')).click(); await tick(16);
  assert.equal(p.w.location.hash, '#assessment/a2'); assert.equal(p.q('[data-tree-panel]').hidden, true, 'route change collapses again'); assert.equal(p.q('.tree-toggle-current').textContent, 'Spring baseline');
  assert.equal(p.qa('h1').length, 1); assert.ok(p.q('[data-content] .view-tabs')); assert.ok(p.q('[data-content] .badge'));
});
test('workspace owner: one kit project card owns read/navigation; management rows are names-only with the existing [data-remove] control', async () => {
  const p = await bootPage('owner', '#workspace/w1');
  assert.equal(p.qa('[data-read-region] article').length, 1); assert.equal(p.qa('[data-action-region] article, [data-action-region] .entity-card-wrap').length, 0);
  const remove = p.q('[data-action-region] .manage-row [data-remove="p1"]'); assert.ok(remove); assert.equal(remove.getAttribute('aria-label'), 'Remove River Valley from workspace');
  remove.click(); await tick(8);
  const del = p.transport.log.find(l => l.method === 'DELETE'); assert.equal(del?.key, 'DELETE /v2/workspaces/w1/projects/p1'); assert.equal(del.outcome, 'mutation-refused');
  assert.ok(p.text('#note').includes('Remove project failed'));
});

// Measured overflow (Chrome, 195px layout viewport = phone at 200% zoom): the open account menu extended 57px past the left edge.
// jsdom has no layout, so this guards the clamp rules themselves; the pixel proof lives in the browser probe (frames-probe.html?openmenu=1).
test('account menu is clamped to the viewport inline-size (rule guard; measured proof in browser probe)', async () => {
  const p = await bootPage('owner', '#project/p1');
  const css = [...p.d.querySelectorAll('style')].map(s => s.textContent).join('\n');
  assert.match(css, /\.rv \.account-menu\{[^}]*max-width:calc\(100vw - 16px\)/, 'menu max-width clamped to viewport');
  assert.match(css, /\.rv \.account-menu\{[^}]*min-width:min\(240px,calc\(100vw - 16px\)\)/, 'min-width never exceeds viewport');
  assert.match(css, /@media \(max-width:420px\)\{[^}]*\.rv \.account\{position:static\}/, 'narrow viewports anchor the menu to the viewport edges');
  // Independent clamp review (185ede97): the collapsed context/aside painted over the open menu. The header must be its own stacking
  // context above the shell; pointer hit/click proof for all five items at 195/390/720/1440 lives in the browser probe (openmenu=1).
  assert.match(css, /\.rv header\.top\{position:relative;z-index:40\}/, 'header stacks above the shell'); assert.match(css, /\.rv \.shell\{position:relative;z-index:1\}/);
  const toggle = p.q('#account-menu-toggle'); toggle.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(p.q('#account-menu').hidden, false); assert.equal(p.d.activeElement.id, 'account-signout');
});

// ---- K3b1: feedback in place inside the real kit root (ticket outcomes 1, 3, 4, 5, 6; native focus containment is a browser-probe step) ----
const openFeedback = async p => { p.q('#account-menu-toggle').click(); const link = p.q('#account-menu a[href="#feedback"]'); link.click(); await tick(12); return p.d.querySelector('dialog.feedback-modal'); };
test('1: feedback opens from the account menu in a native dialog outside the root; URL, content, unsaved input and host unchanged; Escape/Close return focus to the toggle', async () => {
  const p = await bootPage('owner', '#project/p1');
  const mount = p.api.app, input = p.q('#create-assessment input[name=name]'); input.value = 'unsaved draft';
  const dialog = await openFeedback(p);
  assert.ok(dialog && dialog.hasAttribute('open'), 'native dialog opened'); assert.equal(dialog.closest('#rv'), null, 'dialog lives outside the application root');
  assert.equal(p.w.location.hash, '#project/p1'); assert.equal(p.api.app, mount); assert.equal(input.isConnected, true); assert.equal(input.value, 'unsaved draft');
  assert.equal(p.q('#account-menu').hidden, true, 'menu closed when the modal opened'); assert.ok(p.q('[data-header-host] #who'));
  assert.ok(dialog.querySelector('#app-feedback textarea, #app-feedback'), 'real feedback form rendered');
  assert.equal(p.text('[role=main].content h1'), 'River Valley', 'route content untouched');
  dialog.querySelector('[aria-label="Close feedback"]').click(); await tick(2);
  assert.equal(dialog.hasAttribute('open'), false); assert.equal(p.d.activeElement, p.q('#account-menu-toggle'), 'opener return goes to the visible menu toggle, not the hidden link');
  assert.equal(input.value, 'unsaved draft'); assert.equal(p.w.location.hash, '#project/p1');
});
test('3: route change and identity reset clear the draft and invalidate a delayed open', async () => {
  const p = await bootPage('owner', '#project/p1');
  let dialog = await openFeedback(p); const ta = dialog.querySelector('#app-feedback textarea'); ta.value = 'draft text';
  dialog.querySelector('[aria-label="Close feedback"]').click(); await tick(2);
  dialog = await openFeedback(p); assert.equal(dialog.querySelector('#app-feedback textarea').value, 'draft text', 'same-route reopen keeps the draft');
  dialog.querySelector('[aria-label="Close feedback"]').click(); await tick(2);
  await p.go('#workspaces'); dialog = await openFeedback(p);
  assert.equal(dialog.querySelector('#app-feedback textarea').value, '', 'route change resets the draft');
  dialog.querySelector('[aria-label="Close feedback"]').click(); await tick(2);
  p.api.resetIdentity(); await tick(2); assert.equal(p.d.querySelector('dialog.feedback-modal').hasAttribute('open'), false); assert.equal(p.d.querySelector('dialog.feedback-modal').childNodes.length, 0, 'identity reset empties the dialog');
});
test('4: intercepted payload carries only form fields, require_authenticated and the allowlisted experience; no email/ids/tokens', async () => {
  const p = await bootPage('owner', '#assessment/a1');
  const dialog = await openFeedback(p); dialog.querySelector('#app-feedback textarea').value = 'It works';
  dialog.querySelector('#app-feedback').dispatchEvent(new p.w.Event('submit', { bubbles: true, cancelable: true })); await tick(8);
  const post = p.transport.log.find(l => l.key === 'POST /v2/feedback'); assert.ok(post, 'exact command'); assert.equal(post.outcome, 'mutation-refused');
  const body = JSON.parse(post.body); assert.deepEqual(Object.keys(body).sort(), ['experience', 'note', 'require_authenticated']);
  assert.equal(body.require_authenticated, true); assert.deepEqual(Object.keys(body.experience).sort(), ['client_release', 'context', 'host', 'occurred_at', 'surface']);
  assert.deepEqual(body.experience.context, { page: 'assessment', component: 'app_feedback' }); assert.equal(body.experience.client_release.version, '0.0.0-synthetic');
  const raw = post.body; for (const secret of ['@example.invalid', 'a1', 'p1', 'synthetic-owner', 'Bearer']) assert.ok(!raw.includes(secret), 'payload must not carry ' + secret);
  assert.equal(post.headers.authorization, undefined, 'no bearer token in the synthetic session');
});
test('5: success, rejection and uncertain responses produce truthful receipt/draft/error; no automatic retry', async () => {
  const p = await bootPage('owner', '#project/p1');
  const real = p.w.fetch; let mode = 'ok';
  p.w.fetch = (u, i) => (i?.method === 'POST' && String(u).endsWith('/v2/feedback')) ? Promise.resolve(mode === 'ok' ? { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ ok: true, result: { recorded: true, feedback_id: 'fb_synthetic_1', stripped: false } }) } : mode === 'reject' ? { ok: false, status: 403, headers: { get: () => 'application/json' }, json: async () => ({ ok: false, error: { code: 'NOT_AUTHORIZED', message: 'no' } }) } : { ok: false, status: 503, headers: { get: () => 'application/json' }, json: async () => ({ ok: false, error: { code: '503', message: 'upstream' } }) }) : real(u, i);
  const submit = async (text) => { const d = await openFeedback(p); d.querySelector('#app-feedback textarea').value = text; d.querySelector('#app-feedback').dispatchEvent(new p.w.Event('submit', { bubbles: true, cancelable: true })); await tick(8); return d; };
  mode = 'uncertain'; let d = await submit('first');
  assert.match(d.querySelector('#feedback-status').textContent, /could not confirm/); assert.match(d.querySelector('button[type=submit]').textContent, /Send again \(may duplicate\)/); assert.equal(d.querySelector('#app-feedback textarea').value, 'first', 'draft kept');
  d.querySelector('[aria-label="Close feedback"]').click(); await tick(2); await p.go('#workspaces');
  mode = 'reject'; d = await submit('second'); assert.match(d.querySelector('#feedback-status').textContent, /refused for this account/); assert.equal(d.querySelector('#app-feedback textarea').value, 'second');
  d.querySelector('[aria-label="Close feedback"]').click(); await tick(2); await p.go('#project/p1');
  mode = 'ok'; d = await submit('third'); assert.match(d.querySelector('#feedback-status').textContent, /recorded/); assert.equal(d.querySelector('#feedback-receipt').textContent, 'Feedback reference: fb_synthetic_1');
  assert.equal(p.transport.log.filter(l => l.key === 'POST /v2/feedback').length, 0, 'the synthetic transport saw no feedback POST: all three were intercepted, none retried');
});
test('5b: a completion arriving after the route changed is suppressed without claiming cancellation', async () => {
  const p = await bootPage('owner', '#project/p1');
  const real = p.w.fetch; let release; const held = new Promise(r => { release = r; });
  p.w.fetch = (u, i) => (i?.method === 'POST' && String(u).endsWith('/v2/feedback')) ? held.then(() => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ ok: true, result: { recorded: true, feedback_id: 'fb_late', stripped: false } }) })) : real(u, i);
  const d = await openFeedback(p); d.querySelector('#app-feedback textarea').value = 'late'; d.querySelector('#app-feedback').dispatchEvent(new p.w.Event('submit', { bubbles: true, cancelable: true })); await tick(2);
  await p.go('#workspaces'); release(); await tick(8);
  assert.ok(!d.textContent.includes('fb_late'), 'late receipt never painted'); assert.equal(d.hasAttribute('open'), false);
  const again = await openFeedback(p); assert.equal(again.querySelector('#app-feedback textarea').value, '', 'no stale draft or receipt after route change');
});
test('6: signed-out root shows the sign-in feedback panel in the dialog fallback route; demo/anonymous never sends', async () => {
  const q = await bootPage('owner', '#feedback', { install: (t, data) => { data.routes.delete('GET /v2/me'); } });
  assert.ok(q.q('[data-content]').textContent.includes('Sign in to open this page'));
  assert.equal(q.transport.log.filter(l => l.method === 'POST').length, 0);
});
