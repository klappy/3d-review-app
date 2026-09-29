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
import { pages, css as scopeCss, landsOnWork, signInLanding } from '../ui/assess/scope.js';
import { views, css as viewsCss } from '../ui/assess/views.js';
import * as share from '../ui/assess/share.js';
import { feedback } from '../ui/assess/feedback.js';
import { mountKitRoot, shellModel, bindAccountMenu } from '../ui/kit/app-adapter.js';
import * as v3 from '../ui/v3-shell.js';
import { v3StagePrimary, v3CountLine, v3StageStepper, ensureStepperStyle, v3ExpectedFor, stageMoveButton, askStageMove, deleteAssessmentButton, deleteAssessmentFlow, DELETED_NOTICE, v3CompleteLock, V3_SUGGEST } from '../ui/assess/v3-assessment.js';
import { learnMore } from '../ui/v3/components/learn-more.js';
import { activeUntilLine, periodText, collectLine } from '../ui/v3/components/active-until.js';
import { breadcrumbs } from '../ui/v3/components/breadcrumbs.js';
import { sidebarTree } from '../ui/v3/components/sidebar-tree.js';
import { mountEditableHeading } from '../ui/v3/components/editable-heading.js';
import { showSavedStatus, undoTokenOf } from '../ui/v3/components/saved-status.js';
import { mountInvite, mountInvitations, inviteView, INVITE_KEY, parseInvitationFragment, pendingInvitations } from '../ui/v3/components/invite.js';

const ORIGIN = 'http://127.0.0.1:4173';
const HTML = readFileSync(new URL('../ui/index.html', import.meta.url), 'utf8');
const strip = src => src.replace(/^import .*;\n/gm, '').replace(/^export (async )?function /gm, '$1function ').replace(/^export const /gm, 'const ');
const ASSESS = strip(readFileSync(new URL('../ui/assess/assess.js', import.meta.url), 'utf8'));
const CHANGELOG = strip(readFileSync(new URL('../ui/changelog.js', import.meta.url), 'utf8'));
const tick = (n = 6) => new Promise(r => { let i = 0; (function step() { if (++i > n) return r(); setTimeout(step, 0); })(); });

// Boot the real page at `hash` as `identity`. Everything the controller imports is the real module; only fetch is synthetic.
// host: 'kit' boots the REAL ui/index.html (kit root); 'legacy' boots the REAL non-kit ui/assess/index.html (plain #app, no #rv).
// search: query string for the entry (e.g. '?demo=1' — the controller's own demo path; demoApi answers, fetch stays fail-closed).
const LEGACY_HTML = readFileSync(new URL('../ui/assess/index.html', import.meta.url), 'utf8');
async function bootPage(identity = 'owner', hash = '#workspaces', { install, host = 'kit', search = '' } = {}) {
  const data = dataset(identity), transport = createTransport({ routes: data.routes, origin: ORIGIN });
  if (install) install(transport, data);
  const dom = new JSDOM(host === 'legacy' ? LEGACY_HTML : HTML, { url: ORIGIN + (host === 'legacy' ? '/assess/' : '/') + search + hash, pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  w.CSS = { escape: s => String(s).replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c) };
  w.fetch = transport.fetch; // installed BEFORE any script runs
  w.confirm = () => false;
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  Object.assign(w, { isDemo: demo.isDemo, demoApi: demo.demoApi, memoryStorage: demo.memoryStorage, sampleResponses: demo.sampleResponses, redactDiagnosticPath, loadBlankPrint: stage.loadBlankPrint, renderBlankPrint: stage.renderBlankPrint, printAllowed: stage.printAllowed, rememberTab: stage.rememberTab, recalledTab: stage.recalledTab, STAGES: stage.STAGES, whatsHere, cards, pages, scopeCss, landsOnWork, signInLanding, views, viewsCss, share, feedback, mountKitRoot, shellModel, bindAccountMenu, ...v3, v3StagePrimary, v3CountLine, v3StageStepper, ensureStepperStyle, v3ExpectedFor, stageMoveButton, askStageMove, deleteAssessmentButton, deleteAssessmentFlow, DELETED_NOTICE, completeLock: v3CompleteLock, V3_SUGGEST, activeUntilLine, periodText, collectLine, learnMore, breadcrumbs, sidebarTree, mountEditableHeading, showSavedStatus, undoTokenOf, mountInvite, mountInvitations, inviteView, INVITE_KEY, parseInvitationFragment, pendingInvitations }); // v3 shell imports (assess.js lines 15–16); #190
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
// S6a probe (B04 b): a consumed #session= with exactly one open project lands on that project, not #projects.
test('B04 (b): #session= + one project → #project/<id>', async () => {
  const p = await bootPage('owner', '#session=tok123', { install: (t, data) => { data.routes.set('GET /v2/projects', { ok: true, result: { projects: [{ id: 'p1', name: 'River Valley', role: 'owner', workspace_id: 'w1', archived_at: null }] } }); } });
  await tick(30);
  console.log('hash after boot:', p.w.location.hash, '| served:', p.served().join(', '));
  assert.equal(p.w.location.hash, '#project/p1', 'served: ' + p.served().join(', '));
});
test('B04 (b) control: #session= + two projects → #projects', async () => {
  const p = await bootPage('owner', '#session=tok123');
  await tick(30);
  console.log('hash after boot (two):', p.w.location.hash);
  assert.equal(p.w.location.hash, '#projects');
});

// S9 (B04 step c, captain ruling 2026-09-28 15:27 ET k0015; captain 16:03 ET "ships tonight"): a person invited by an owner who just
// signs in on the site (never opened the link) lands on the "Accept invitation" screen first; with none pending, the rule above stands.
const ONE = { ok: true, result: { projects: [{ id: 'p1', name: 'River Valley', role: 'owner', workspace_id: 'w1', archived_at: null }] } };
const MINE = { ok: true, result: { invitations: [{ id: 'inv_1', scope: { type: 'project', id: 'p9', name: 'River Valley', path: ['North', 'River Valley'] }, role: 'viewer', inviter_display_name: null, invited_at: '2026-09-28T20:00:00.000Z', expires_at: '2026-10-05T20:00:00.000Z' }] } };
// The synthetic transport refuses every mutation; answer ONLY the by-id accepts (dry run → execute) of the listed ids, and once an
// id has executed, drop it from GET /v2/me/invitations (server truth) so the page reads what is left.
const answerAccepts = (t, data) => { const inner = t.fetch; t.fetch = async (input, init = {}) => {
  const url = String(input instanceof URL ? input.href : input), m = /\/v2\/me\/invitations\/([^/]+)\/accept$/.exec(url);
  if ((init.method || 'GET').toUpperCase() === 'POST' && m) {
    const id = decodeURIComponent(m[1]), body = JSON.parse(init.body || '{}'), live = data.routes.get('GET /v2/me/invitations');
    t.log.push({ key: `POST /v2/me/invitations/${id}/accept`, body: init.body, outcome: 'served' });
    const json = body.mode === 'dry_run' ? { ok: true, result: { impact: { affected: [{ scope: { type: 'project', id: 'p9' }, role: 'viewer', currently: 'none' }] }, confirm_token: 'ct_' + id } } : { ok: true, result: { granted: true, scope: { type: 'project', id: 'p9' }, role: 'viewer' } };
    if (body.mode === 'execute') data.routes.set('GET /v2/me/invitations', { ok: true, result: { invitations: live.result.invitations.filter(i => i.id !== id) } });
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => json };
  }
  return inner(input, init); }; };
test('S19 B04 (c): #session= + one pending invitation (no link opened) → #invite, "Accept invitation" naming it — even with exactly one project', async () => {
  const p = await bootPage('owner', '#session=tok123', { install: (t, data) => { data.routes.set('GET /v2/projects', ONE); data.routes.set('GET /v2/me/invitations', structuredClone(MINE)); answerAccepts(t, data); } });
  await tick(40);
  assert.equal(p.w.location.hash, '#invite', 'served: ' + p.served().join(', '));
  assert.ok(p.served().includes('GET /v2/me/invitations'), 'the landing asked the server for this person\'s invitations');
  const panel = p.q('[data-invite]'); assert.ok(panel, 'accept screen mounted');
  assert.equal(panel.querySelectorAll('h1').length, 1); assert.equal(panel.querySelector('h1').textContent, 'Accept invitation');
  assert.equal(panel.querySelectorAll('p').length, 1); assert.equal(panel.querySelector('p').textContent, 'You were invited to the project "River Valley" (North) as a viewer.');
  const buttons = panel.querySelectorAll('button'); assert.equal(buttons.length, 1); assert.equal(buttons[0].textContent, 'Accept'); assert.ok(buttons[0].classList.contains('primary'));
  assert.ok(!p.transport.log.some(l => l.key.startsWith('POST ')), 'nothing is accepted before the click');
  buttons[0].click(); await tick(40);
  const posts = p.transport.log.filter(l => l.key === 'POST /v2/me/invitations/inv_1/accept').map(l => JSON.parse(l.body));
  assert.deepEqual(posts, [{ mode: 'dry_run' }, { mode: 'execute', confirm_token: 'ct_inv_1' }], 'dry run → execute by id; no token');
  assert.equal(p.w.location.hash, '#project/p1', 'none left → the existing landing (one project → it)');
});
test('S19 B04 (c): several pending invitations → ONE page listing every one named (escaped), "Accept all" accepts them all, then the landing', async () => {
  const evil = '<img src=x onerror="alert(1)">';
  const rows = [{ id: 'inv_a', scope: { type: 'workspace', id: 'w9', name: 'North', path: ['North'] }, role: 'owner' }, { id: 'inv_b', scope: { type: 'project', id: 'p9', name: evil, path: ['North', evil] }, role: 'member' }, { id: 'inv_c', scope: { type: 'assessment', id: 'a9', name: 'Spring review', path: ['North', evil, 'Spring review'] }, role: 'viewer' }];
  const p = await bootPage('owner', '#session=tok123', { install: (t, data) => { data.routes.set('GET /v2/projects', ONE); data.routes.set('GET /v2/me/invitations', { ok: true, result: { invitations: rows } }); answerAccepts(t, data); } });
  await tick(40);
  assert.equal(p.w.location.hash, '#invite');
  const panel = p.q('[data-invite]'); assert.ok(panel);
  assert.equal(panel.querySelector('h1').textContent, 'Accept invitations'); assert.equal(panel.querySelector('[data-invite-line]').textContent, 'You have 3 invitations waiting.');
  const listed = [...panel.querySelectorAll('[data-invite-row]')]; assert.equal(listed.length, 3, 'one row per invitation — all on one page');
  assert.deepEqual(listed.map(r => r.querySelector('[data-invite-name]').textContent), ['North', evil, 'Spring review']);
  assert.equal(panel.querySelectorAll('img').length, 0, 'member-authored names are text, never markup');
  const primary = panel.querySelectorAll('.primary'); assert.equal(primary.length, 1); assert.equal(primary[0].textContent, 'Accept all');
  primary[0].click(); await tick(60);
  const posts = p.transport.log.filter(l => l.key.startsWith('POST /v2/me/invitations/')).map(l => [l.key.split('/')[4], JSON.parse(l.body).mode]);
  assert.deepEqual(posts, ['inv_a', 'inv_b', 'inv_c'].flatMap(id => [[id, 'dry_run'], [id, 'execute']]));
  assert.equal(p.w.location.hash, '#project/p1', 'none left → the existing landing');
});
test('S9 B04 (c) control: #session= + no pending invitations + one project → #project/<id> (rule above unchanged)', async () => {
  const p = await bootPage('owner', '#session=tok123', { install: (t, data) => { data.routes.set('GET /v2/projects', ONE); data.routes.set('GET /v2/me/invitations', { ok: true, result: { invitations: [] } }); } });
  await tick(30);
  assert.equal(p.w.location.hash, '#project/p1');
});
test('S9 B04 (c) control: #session= + no pending invitations + several projects → #projects', async () => {
  const p = await bootPage('owner', '#session=tok123', { install: (t, data) => { data.routes.set('GET /v2/me/invitations', { ok: true, result: { invitations: [] } }); } });
  await tick(30);
  assert.equal(p.w.location.hash, '#projects');
});
test('S9 B04 (c) control: the invitations read failing never blocks sign-in — the existing landing stands', async () => {
  const p = await bootPage('owner', '#session=tok123', { install: (t, data) => { data.routes.set('GET /v2/projects', ONE); data.routes.set('GET /v2/me/invitations', { ok: false, error: { code: 'INTERNAL', message: 'down' } }); } });
  await tick(30);
  assert.equal(p.w.location.hash, '#project/p1');
});
test('S9: a plain visit (no sign-in just happened) never asks for invitations and never redirects', async () => {
  const p = await bootPage('owner', '#projects', { install: (t, data) => { data.routes.set('GET /v2/me/invitations', MINE); } });
  await tick(30);
  assert.equal(p.w.location.hash, '#projects'); assert.ok(!p.served().includes('GET /v2/me/invitations'));
});
