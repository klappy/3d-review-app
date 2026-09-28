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
  Object.assign(w, { isDemo: demo.isDemo, demoApi: demo.demoApi, memoryStorage: demo.memoryStorage, sampleResponses: demo.sampleResponses, redactDiagnosticPath, loadBlankPrint: stage.loadBlankPrint, renderBlankPrint: stage.renderBlankPrint, printAllowed: stage.printAllowed, rememberTab: stage.rememberTab, recalledTab: stage.recalledTab, STAGES: stage.STAGES, whatsHere, cards, pages, scopeCss, landsOnWork, signInLanding, views, viewsCss, share, feedback, mountKitRoot, shellModel, bindAccountMenu, ...v3, v3StagePrimary, v3CountLine, v3StageStepper, ensureStepperStyle, v3ExpectedFor, stageMoveButton, askStageMove, deleteAssessmentButton, deleteAssessmentFlow, DELETED_NOTICE, completeLock: v3CompleteLock, V3_SUGGEST, activeUntilLine, periodText, collectLine, learnMore, breadcrumbs, sidebarTree, mountEditableHeading, showSavedStatus, undoTokenOf }); // v3 shell imports (assess.js lines 15–16); #190
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
