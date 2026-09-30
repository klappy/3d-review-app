// S24 (DEV 0.24.0 persona pass): with email sign-in links ON, the tour's header "Sign in" and in-app navigation to #new lead with
// the emailed-link form like every other way in. Runs the actual assess.js functions in a vm (imports stripped, as identity-reset does).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import * as v3 from '../v3-shell.js';
import * as cards from './cards.js';
import { isDemo, memoryStorage } from '../demo.js';
import { mountKitRoot, shellModel } from '../kit/app-adapter.js';
import { emailLinkForm, CODE_SIGNIN } from './scope.js';
import { placeDemoExit } from '../v3/components/demo-exit.js';

function harness({ search = '', hash = '' } = {}) {
  const nodes = new Map(['app', 'who', 'note', 'legacy-link', 'whats-here-wrap', 'account-actions', 'account-status', 'account-signout', 'account-switch', 'account-switch-confirm', 'account-switch-cancel', 'account-switch-dialog'].map(id => [id, { innerHTML: '', textContent: '', hidden: false, className: '', querySelector: () => null, addEventListener() {}, close() {}, showModal() {} }]));
  const source = readFileSync(new URL('./assess.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  const navigations = [], fetches = [];
  const box = { ...v3, cards, mountKitRoot, shellModel, isDemo, memoryStorage, emailLinkForm, CODE_SIGNIN, history: { replaceState() {} }, sessionStorage: { getItem() { return null; }, removeItem() {} }, document: { getElementById: id => nodes.get(id), title: '' }, location: { search, hash, pathname: '/', assign: path => navigations.push(path) }, redactDiagnosticPath: x => x, AbortSignal,
    fetch: async (url, options) => { fetches.push({ url, options }); return { ok: true, json: async () => ({ email_links: true }) }; } };
  const api = vm.runInNewContext(source + '\n({state,boot,mountNew,loadEmailLinks,emailLinksClick,generation:()=>generation,setApi:fn=>api=fn,setListen:fn=>listen=fn})', box);
  api.setListen(() => {});
  return { ...api, app: nodes.get('app'), navigations, fetches };
}
const gateOrder = html => { const form = html.indexOf('action="/v2/auth/email"'), code = html.indexOf('data-code-signin'); return form >= 0 && code > form; };

test('S24 B1: the tour asks the email-links question too (no credentials sent), and its header Sign in then leads with the emailed link', async () => {
  const h = harness({ search: '?demo=1', hash: '#assessment/demo-assessment/collect' });
  assert.equal(await h.loadEmailLinks(), true, 'the probe runs in the tour');
  assert.equal(h.fetches.length, 1); assert.equal(h.fetches[0].url, '/v2/auth/email?probe');
  assert.equal(h.fetches[0].options.credentials, 'omit', 'the tour sends nothing of the viewer\'s (no cookies)');
  // the real tour header (demo-exit component), its "Sign in" clicked
  const { document } = new JSDOM('<header class="top"><a class="brand" href="#">3D Review</a><div class="right"></div></header>').window;
  assert.ok(placeDemoExit(document));
  const signin = document.querySelector('[data-v3-demo-signin]');
  assert.equal(signin.getAttribute('href'), '/v2/auth/access', 'markup unchanged (production copy)');
  const ev = { button: 0, target: signin, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  h.emailLinksClick(ev);
  assert.ok(ev.defaultPrevented); assert.deepEqual(h.navigations, ['/v2/auth/email'], 'the emailed-link page, not Cloudflare Access');
});

test('S24 B1: outside the tour the probe still sends same-origin credentials (unchanged)', async () => {
  const h = harness();
  assert.equal(await h.loadEmailLinks(), true);
  assert.equal(h.fetches[0].options.credentials, 'same-origin');
});

test('S24 B2: signed out, in-app navigation to #new renders the same gate a fresh load of /#new renders (form first, code link second)', async () => {
  // fresh load of /#new: boot, no session
  const fresh = harness({ hash: '#new' }); fresh.state.emailLinks = true; fresh.setApi(() => Promise.reject(Object.assign(new Error('no session'), { code: 'UNAUTHENTICATED' })));
  await fresh.boot();
  assert.ok(gateOrder(fresh.app.innerHTML), 'fresh load: form first, code link under it');
  // in-app: /#projects → #new (hashchange → render → mountNew), email links known ON
  const nav = harness({ hash: '#new' }); nav.state.emailLinks = true;
  await nav.mountNew(nav.generation());
  assert.equal(nav.app.innerHTML, fresh.app.innerHTML, 'the same gate');
  assert.ok(gateOrder(nav.app.innerHTML)); assert.match(nav.app.innerHTML, /<code>\/#new<\/code>/);
  assert.doesNotMatch(nav.app.innerHTML, /Sign in with email code/);
  // the answer still in flight when the hash changes: it is awaited, then the same gate
  const early = harness({ hash: '#new' });
  await early.mountNew(early.generation());
  assert.equal(early.fetches[0]?.url, '/v2/auth/email?probe'); assert.equal(early.app.innerHTML, fresh.app.innerHTML);
});

test('S24 B2: email links OFF, #new keeps the base production panel byte for byte', async () => {
  const h = harness({ hash: '#new' }); h.state.emailLinks = false;
  await h.mountNew(h.generation());
  assert.equal(h.app.innerHTML, '<div class="narrow panel"><p class="eyebrow">Sign in</p><h1>Sign in to continue</h1><p class="muted">Starting a review needs a facilitator session.</p><div class="actions"><a class="rv-btn primary" href="/v2/auth/access">Sign in with email code</a></div></div>');
  assert.equal(h.fetches.length, 0, 'a known answer is not asked again');
});
