// ASK 24 (captain: "Both: link first, Cloudflare code as backup"). With email links ON every sign-in entry shows the emailed-link
// form FIRST and a clearly visible secondary "Sign in with a code instead" to /v2/auth/access (Cloudflare Access one-time code),
// which the B38 click interceptor never re-points. With email links OFF (production) every entry renders exactly what it did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as v3 from '../v3-shell.js';
import { isDemo, memoryStorage } from '../demo.js';
import * as cards from './cards.js';
import { mountKitRoot, shellModel } from '../kit/app-adapter.js';
import { pages, CODE_SIGNIN, CODE_SIGNIN_LABEL, emailLinkForm } from './scope.js';

const CODE = '<a class="button rv-btn" href="/v2/auth/access" data-code-signin>Sign in with a code instead</a>';
const FORM = 'action="/v2/auth/email"';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const ctx = (emailLinks, over = {}) => ({ esc: cards.esc, enc: cards.enc, routes: cards.routes, cards, state: emailLinks === undefined ? { principal: null } : { principal: null, emailLinks }, ...over });
const signinModel = () => ({ mode: 'signin', signin: { email: '', devCode: null, stage: 'email' } });
const linkFirst = (html, where) => {
  const form = html.indexOf(FORM), code = html.indexOf(CODE);
  assert.ok(form > -1, `${where}: emailed-link form present`); assert.ok(code > -1, `${where}: "Sign in with a code instead" present`);
  assert.ok(form < code, `${where}: link form first, code link second`);
  assert.equal(html.split('data-code-signin').length - 1, 1, `${where}: one code link`);
  assert.equal(html.split('/v2/auth/access').length - 1, 1, `${where}: the code link is the only Access href`);
};

// The real assess.js shell functions in a VM (same technique as identity-reset.test.mjs), with a document that records the
// click listener so the B38 interceptor itself is exercised.
function harness() {
  const nodes = new Map(['app', 'who', 'note', 'legacy-link', 'whats-here-wrap', 'account-actions', 'account-status', 'account-signout', 'account-switch', 'account-switch-confirm', 'account-switch-cancel', 'account-switch-dialog'].map(id => [id, { innerHTML: 'old', textContent: 'old', className: '', hidden: false, querySelector: () => null, addEventListener() {}, close() {}, showModal() {} }]));
  const source = read('./assess.js').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  const navigations = [], listeners = [];
  const box = { ...v3, cards, mountKitRoot, shellModel, CODE_SIGNIN, emailLinkForm, history: { replaceState() {} }, sessionStorage: { getItem() { return null; }, removeItem() {} }, isDemo, memoryStorage,
    document: { getElementById: id => nodes.get(id), addEventListener: (type, fn) => listeners.push([type, fn]) },
    location: { hash: '', pathname: '/', search: '', assign: path => navigations.push(path) }, redactDiagnosticPath: x => x, AbortSignal, fetch: () => Promise.resolve({ ok: false }) };
  const api = vm.runInNewContext(source + '\n({state,boot,emailLinksClick,emailLinksCopy,setApi:fn=>api=fn,setFetch:fn=>fetch=fn,setListen:fn=>listen=fn,setHash:h=>location.hash=h})', box);
  return { ...api, nodes, navigations, listeners };
}
const click = (h, attrs) => {
  const a = { hasAttribute: n => Object.hasOwn(attrs, n), getAttribute: n => attrs[n] ?? null };
  const ev = { button: 0, defaultPrevented: false, target: { closest: sel => (sel === 'a[href="/v2/auth/access"]' && attrs.href === '/v2/auth/access' ? a : null) }, preventDefault() { this.defaultPrevented = true; } };
  h.emailLinksClick(ev); return ev;
};

test('ASK 24 (a): #signin with email links on — the link form first, then "Sign in with a code instead" to /v2/auth/access', () => {
  const html = pages.entry.render(ctx(true), signinModel());
  linkFirst(html, '#signin'); assert.equal(CODE_SIGNIN_LABEL, 'Sign in with a code instead');
  assert.ok(html.indexOf(CODE) < html.indexOf('<details class="sandbox-signin"'), 'code link above the sandbox');
});
test('ASK 24 (a): public Home "Sign in" with email links on opens #signin (the link-first screen), never the Access route directly', () => {
  const home = pages.entry.render(ctx(true), { mode: 'welcome', signin: { email: '', devCode: null, stage: 'email' } });
  assert.ok(home.includes('<a class="rv-btn primary" href="#signin">Sign in</a>')); assert.ok(!home.includes('href="/v2/auth/access"'));
  linkFirst(pages.entry.render(ctx(true), signinModel()), 'Home → #signin');
});
test('ASK 24 (a): the signed-out "Sign in to continue" panel with email links on — link form first, code link second', async () => {
  const c = ctx(true, { api: async () => { const e = new Error('no'); e.code = 'NOT_AUTHENTICATED'; throw e; } });
  for (const page of [pages.workspaces, pages.projects]) { const h = page.render(c, await page.load(c, {})); assert.ok(h.includes('Sign in to continue')); linkFirst(h, 'Sign in to continue'); }
});
test('ASK 24 (a): "Sign in to open this page" (assess.js boot) with email links on — link form first, code link second', async () => {
  const h = harness(); h.setListen(() => {}); h.setHash('#assessment/a1');
  h.setApi(async () => { throw Object.assign(new Error('no session'), { code: 'NOT_AUTHENTICATED' }); });
  h.setFetch(async () => ({ ok: true, json: async () => ({ email_links: true }) }));
  await h.boot();
  const html = h.nodes.get('app').innerHTML;
  assert.ok(html.includes('Sign in to open this page')); assert.ok(html.includes('<code>/#assessment/a1</code>')); linkFirst(html, 'Sign in to open this page');
});
test('ASK 24 (a): "Use another account" / "Sign out and use another account" — the dialog names both ways, and sign-out lands on the link-first #signin', () => {
  const h = harness(); const paras = [{ textContent: 'a', remove() {} }, { textContent: 'b', remove() { this.removed = true; } }];
  h.nodes.set('account-switch-dialog', { querySelectorAll: () => paras });
  h.emailLinksCopy();
  assert.match(paras[0].textContent, /sign-in link; you can also sign in with a code instead\.$/); assert.equal(paras[1].removed, true);
  const src = read('./assess.js');
  assert.ok(src.includes("history.replaceState(null, '', location.pathname + '#signin');"), 'B44 sign-out (both buttons) lands on #signin');
  linkFirst(pages.entry.render(ctx(true), signinModel()), 'after switch: #signin');
});
test('ASK 24 (b): the B38 interceptor re-points plain Access sign-in links but never the code link', () => {
  const h = harness();
  assert.ok(h.listeners.some(([t, fn]) => t === 'click' && fn === h.emailLinksClick), 'the interceptor is the registered click listener');
  h.state.emailLinks = true;
  const plain = click(h, { href: '/v2/auth/access' });
  assert.equal(plain.defaultPrevented, true); assert.deepEqual(h.navigations, ['/v2/auth/email']);
  const code = click(h, { href: '/v2/auth/access', 'data-code-signin': '' });
  assert.equal(code.defaultPrevented, false, 'the browser follows the code link to /v2/auth/access'); assert.deepEqual(h.navigations, ['/v2/auth/email'], 'no re-point');
  h.state.emailLinks = false; const off = click(h, { href: '/v2/auth/access' });
  assert.equal(off.defaultPrevented, false); assert.equal(h.navigations.length, 1);
});
test('ASK 24 (d): email links off — every entry renders the production markup, with no code link and no email form', async () => {
  for (const state of [false, undefined]) {
    const si = pages.entry.render(ctx(state), signinModel());
    assert.ok(si.includes('<div class="actions"><a class="button rv-btn primary" href="/v2/auth/access" style="width:100%;justify-content:center;text-align:center;box-sizing:border-box">Sign in with an email code</a></div>'));
    const home = pages.entry.render(ctx(state), { mode: 'welcome', signin: { email: '', devCode: null, stage: 'email' } });
    assert.ok(home.includes('<a class="rv-btn primary" href="/v2/auth/access">Sign in</a></nav>'));
    const c = ctx(state, { api: async () => { throw Object.assign(new Error('no'), { code: 'NOT_AUTHENTICATED' }); } });
    const panel = pages.projects.render(c, await pages.projects.load(c, {}));
    assert.ok(panel.includes('<div class="actions"><a class="button primary" href="#">Go to sign in</a><a class="quiet button" href="/v2/auth/access">Sign in with email code</a></div></section></div>'));
    for (const h of [si, home, panel]) { assert.ok(!h.includes('data-code-signin') && !h.includes(CODE_SIGNIN_LABEL)); assert.ok(!h.includes(FORM)); }
  }
  const h = harness(); h.setListen(() => {}); h.setHash('#assessment/a1');
  h.setApi(async () => { throw Object.assign(new Error('no session'), { code: 'NOT_AUTHENTICATED' }); });
  h.setFetch(async () => ({ ok: true, json: async () => ({ email_links: false }) }));
  await h.boot();
  assert.equal(h.nodes.get('app').innerHTML, '<div class="narrow panel"><h1>Sign in to open this page</h1><p class="muted">Sign in first, then open this address again:</p><p><code>/#assessment/a1</code></p><p><a class="button primary" href="#">Go to sign in</a> <a class="button" href="/v2/auth/access">Sign in with an email code</a></p></div>');
  assert.ok(read('../index.html').includes('<p>This also signs you out of other apps protected by this Cloudflare Access account.</p>'), 'switch dialog copy unchanged');
  assert.ok(!emailLinkForm().includes('/v2/auth/access') && CODE_SIGNIN.includes(CODE));
});
