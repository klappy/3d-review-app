import test from 'node:test';
import * as v3 from '../v3-shell.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isDemo, memoryStorage } from '../demo.js';
import * as cards from './cards.js';
import { mountKitRoot, shellModel } from '../kit/app-adapter.js';

// Execute the actual shell functions with deferred API replies, without starting its browser boot.
function harness() {
  const disclosure = { open: false };
  const nodes = new Map(['app', 'who', 'note', 'legacy-link', 'whats-here-wrap', 'account-actions', 'account-status', 'account-signout', 'account-switch', 'account-switch-confirm', 'account-switch-cancel', 'account-switch-dialog'].map(id => [id, { innerHTML: 'old', textContent: 'old', hidden: false, querySelector: () => disclosure, addEventListener() {}, close() {}, showModal() {} }]));
  const source = readFileSync(new URL('./assess.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  const navigations = [], removed = [], fetches = [];
  // K3a: the real adapter is supplied; with no #rv node the kit root is absent and the controller falls back to #app unchanged.
  const box = { ...v3, cards, mountKitRoot, shellModel, history: {replaceState() {}}, sessionStorage: {getItem() {return null;},removeItem:k=>removed.push(k)}, isDemo, memoryStorage, document: { getElementById: id => nodes.get(id) }, location: { hash: '', pathname: '/', assign: path=>navigations.push(path) }, redactDiagnosticPath: x => x, AbortSignal, fetch: (url, options) => { fetches.push({ url, options }); return Promise.resolve({ ok: true }); } };
  const api = vm.runInNewContext(source + '\n({state,resetIdentity,assessmentsFor,workspaceFor,boot,act,loadCounts,syncContextDisclosure,currentShareRoute,setHash:hash=>location.hash=hash,setApi:fn=>api=fn,setRender:fn=>render=fn,loadAccountEmail,signOut,setFetch:fn=>fetch=fn,setCredential:t=>token=t,getCredential:()=>token,setListen:fn=>listen=fn,setHistory:o=>{history.replaceState=o.replaceState},clearPageNote,loadEmailLinks})', box);
  return { ...api, nodes, disclosure, navigations, removed, fetches };
}
const deferred = () => { let resolve, reject; const promise = new Promise((r,j) => {resolve=r;reject=j;}); return { promise, resolve, reject }; };

test('identity change clears prior data, UI, busy flags and pending-read registries', () => {
  const h = harness();
  for (const key of ['lists','workspaces','inflight','seq','counts','dirty']) h.state[key].set('old', 'old');
  h.state.share = { link: 'old' }; h.state.openProjects.add('old'); h.state.countInflight.add('old'); h.state.message = { text: 'old' }; h.state.busy = true;
  h.resetIdentity();
  for (const key of ['lists','workspaces','inflight','seq','counts','dirty','openProjects','countInflight']) assert.equal(h.state[key].size, 0, key);
  assert.equal(h.state.share, null); assert.equal(h.state.message, null); assert.equal(h.state.busy, false);
  assert.equal(h.nodes.get('app').innerHTML, ''); assert.equal(h.nodes.get('legacy-link').hidden, true);
});

test('old identity list completion neither populates new cache nor deletes its pending request', async () => {
  const h = harness(), old = deferred(), next = deferred(); let calls = 0;
  h.setApi(() => ++calls === 1 ? old.promise : next.promise);
  const a = h.assessmentsFor('same-project'); h.resetIdentity(); const b = h.assessmentsFor('same-project');
  old.resolve({ assessments: [{ id: 'private-old-assessment' }] }); await a;
  assert.equal(h.state.lists.has('same-project'), false); assert.equal(h.state.inflight.size, 1);
  next.resolve({ assessments: [{ id: 'new-assessment' }] }); await b;
  assert.equal(h.state.lists.get('same-project').list[0].id, 'new-assessment'); assert.equal(h.state.inflight.size, 0);
});

test('old boot identity reply cannot repopulate principal after identity reset', async () => {
  const h = harness(), reply = deferred(); h.setApi(() => reply.promise);
  const pending = h.boot(); h.resetIdentity(); reply.resolve({ principal: { id: 'old-person' } }); await pending;
  assert.equal(h.state.principal, null);
});

test('old write completion cannot attach a status or dirty flag to a new identity', async () => {
  const h = harness(), reply = deferred(); h.setRender(() => {});
  const pending = h.act('same-assessment', 'Saving', () => reply.promise); h.resetIdentity(); reply.resolve('Saved old change'); await pending;
  assert.equal(h.state.message, null); assert.equal(h.state.dirty.size, 0); assert.equal(h.state.busy, false);
});

test('workspace failure is retryable and old workspace replies are discarded', async () => {
  const h = harness(); h.state.projects = [{ id: 'p', workspace_id: 'w' }]; let calls = 0;
  h.setApi(async () => { if (++calls === 1) throw Error('transient'); return { workspace: { name: 'Workspace', role: 'member' }, projects: [] }; });
  assert.equal(await h.workspaceFor('p'), null); assert.equal(h.state.workspaces.has('w'), false);
  const loaded = await h.workspaceFor('p'); assert.equal(loaded.name, 'Workspace'); assert.equal(loaded.role, 'member', 'workspace cache keeps the role the GET returned'); assert.equal(calls, 2);
  h.state.workspaces.clear(); const reply = deferred(); h.setApi(() => reply.promise); const pending = h.workspaceFor('p');
  h.resetIdentity(); reply.resolve({ workspace: { name: 'Old private workspace' }, projects: [] }); await pending;
  assert.equal(h.state.workspaces.size, 0);
});

test('widening reveals a context disclosure collapsed on mobile', () => {
  const h = harness(); h.syncContextDisclosure({ matches: true }); assert.equal(h.disclosure.open, false);
  h.syncContextDisclosure({ matches: false }); assert.equal(h.disclosure.open, true);
});


test('old count completion does not release the new identity pending count', async () => {
  const h = harness(), old = deferred(), next = deferred(); let calls = 0;
  h.setApi(() => ++calls === 1 ? old.promise : next.promise);
  const current = { assessment: { id: 'a' }, surveys: [{ id: 's', state: 'selected' }] };
  h.state.current = current; h.loadCounts(current); h.resetIdentity(); h.state.current = current; h.loadCounts(current);
  old.resolve({}); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.state.countInflight.has('s'), true); assert.equal(h.state.counts.get('s').status, 'loading');
});


test('same-survey repaint preserves sharing but route departure permanently invalidates its model', () => {
 const h=harness(),model={aid:'a1',sid:'s1',epoch:0,link:null};
 h.state.share=model;h.setHash('#assessment/a1/survey/s1');
 assert.equal(h.currentShareRoute(),model);
 h.setHash('#workspaces');assert.equal(h.currentShareRoute(),null);
 h.setHash('#assessment/a1/survey/s1');assert.equal(h.currentShareRoute(),null);
});

for (const switchAccount of [false,true]) for (const succeeds of [false,true]) test(`late ${switchAccount?'switch':'logout'} ${succeeds?'success':'failure'} preserves replacement identity`, async()=>{
  const h=harness(), wait=deferred(); h.state.principal={id:'old'};h.setCredential('old-token');h.setApi(()=>wait.promise);
  const pending=h.signOut(switchAccount);h.resetIdentity();h.state.principal={id:'new'};h.setCredential('new-token');h.nodes.get('who').textContent='Account: new@example.invalid';h.nodes.get('app').innerHTML='new work';
  succeeds?wait.resolve({signed_out:true}):wait.reject(Error('uncertain'));await pending;
  assert.equal(h.getCredential(),'new-token');assert.equal(h.nodes.get('who').textContent,'Account: new@example.invalid');assert.equal(h.nodes.get('app').innerHTML,'new work');assert.deepEqual(h.navigations,[]);assert.deepEqual(h.removed,[]);assert.equal(h.nodes.get('account-status').textContent,'');
});
test('unconfirmed logout stays truthful and busy prevents duplicate dispatch',async()=>{
  const h=harness(),wait=deferred();let calls=0;h.state.principal={id:'one'};h.setCredential('one-token');h.setApi(()=>{calls++;return wait.promise;});
  const pending=h.signOut(true);await h.signOut(true);assert.equal(calls,1);wait.resolve({signed_out:false});await pending;
  assert.equal(h.getCredential(),'one-token');assert.equal(h.state.principal.id,'one');assert.match(h.nodes.get('account-status').textContent,/could not be confirmed/);assert.deepEqual(h.navigations,[]);
});
// B44: one sign-out. Both buttons, both environments: app session DELETE, background app-domain Access logout, then #signin.
for (const emailLinks of [false, true]) for (const switchAccount of [false, true]) test(`B44: confirmed ${switchAccount ? 'switch' : 'sign-out'} (email links ${emailLinks ? 'on' : 'off'}) ends both sessions and lands on the app sign-in screen`, async () => {
  const h = harness(); const replaced = []; let rendered = 0;
  h.setHistory({ replaceState: (_s, _t, url) => replaced.push(url) }); h.setRender(() => { rendered++; }); h.setListen(() => {});
  h.state.emailLinks = emailLinks; h.state.principal = { id: 'one' }; h.setCredential('one-token');
  const calls = []; h.setApi(async (url, o) => { calls.push([url, o?.method]); return { signed_out: true }; });
  await h.signOut(switchAccount);
  assert.deepEqual(calls, [['/v2/auth/session', 'DELETE']]);
  assert.equal(h.getCredential(), null); assert.equal(h.state.principal, null); assert.deepEqual(h.removed, ['facilitatorToken']);
  assert.equal(h.fetches.length, 1); assert.equal(h.fetches[0].url, '/cdn-cgi/access/logout');
  assert.equal(h.fetches[0].options.credentials, 'same-origin'); assert.equal(h.fetches[0].options.redirect, 'manual'); assert.equal(h.fetches[0].options.cache, 'no-store');
  assert.deepEqual(h.navigations, [], 'never a page navigation to any logout URL');
  assert.deepEqual(replaced, ['/#signin']); assert.equal(rendered, 1); assert.equal(h.nodes.get('who').textContent, 'Not signed in');
  h.resetIdentity(); assert.equal(h.state.emailLinks, emailLinks, 'an environment fact, not identity: survives sign-out');
});
test('B44: already signed out skips both logout calls and goes straight to sign-in', async () => {
  const h = harness(); const replaced = []; let rendered = 0; let apiCalls = 0;
  h.setHistory({ replaceState: (_s, _t, url) => replaced.push(url) }); h.setRender(() => { rendered++; }); h.setListen(() => {}); h.setApi(async () => { apiCalls++; });
  h.state.principal = null; h.setCredential(null);
  await h.signOut(true);
  assert.equal(apiCalls, 0); assert.equal(h.fetches.length, 0); assert.deepEqual(h.navigations, []); assert.deepEqual(replaced, ['/#signin']); assert.equal(rendered, 1);
});
test('B44: a session the server already ended counts as signed out (no error line, lands on sign-in)', async () => {
  const h = harness(); const replaced = [];
  h.setHistory({ replaceState: (_s, _t, url) => replaced.push(url) }); h.setRender(() => {}); h.setListen(() => {});
  h.state.principal = { id: 'one' }; h.setCredential('one-token');
  h.setApi(async () => { throw Object.assign(new Error('session already revoked'), { code: 'NOT_AUTHENTICATED' }); });
  await h.signOut();
  assert.equal(h.getCredential(), null); assert.equal(h.fetches.length, 1); assert.deepEqual(replaced, ['/#signin']); assert.equal(h.nodes.get('account-status').textContent, '');
});
test('B44: no sign-out path in ui/ names the Access team domain or navigates to a logout page', async () => {
  const { readdirSync, statSync } = await import('node:fs'); const root = new URL('../', import.meta.url);
  const walk = dir => readdirSync(dir).flatMap(n => { const u = new URL(n, dir); return statSync(u).isDirectory() ? (n === 'node_modules' ? [] : walk(new URL(n + '/', dir))) : [u]; });
  for (const u of walk(root)) {
    if (!/\.(js|mjs|html)$/.test(u.pathname) || /\.test\.mjs$/.test(u.pathname)) continue;
    const src = readFileSync(u, 'utf8');
    assert.ok(!src.includes('cloudflareaccess.com'), `${u.pathname} names the Access team domain`);
    assert.ok(!/location\.(assign|replace|href)\s*[(=][^;\n]*access\/logout/.test(src), `${u.pathname} navigates to a logout page`);
  }
});
test('account email read forbids redirect, does not repaint work and ignores stale response',async()=>{
  const h=harness(),wait=deferred();let options;h.setFetch((_url,o)=>{options=o;return wait.promise;});h.setCredential('old-token');h.nodes.get('app').innerHTML='unsaved work';
  const pending=h.loadAccountEmail();assert.equal(options.redirect,'error');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(h.nodes.get('app').innerHTML,'unsaved work');
  h.resetIdentity();h.setCredential('new-token');h.nodes.get('who').textContent='Account: next@example.invalid';wait.resolve({ok:true,json:async()=>({email:'prior@example.invalid'})});await pending;assert.equal(h.nodes.get('who').textContent,'Account: next@example.invalid');
});
test('account email is text only and failures remove previous email',async()=>{
  const h=harness();h.setFetch(async()=>({ok:true,json:async()=>({email:'<synthetic>@example.invalid'})}));await h.loadAccountEmail();assert.equal(h.nodes.get('who').textContent,'Account: <synthetic>@example.invalid');
  h.setFetch(async()=>{throw Error('redirect');});await h.loadAccountEmail();assert.equal(h.nodes.get('who').textContent,'Signed in');
});

for (const outcome of ['resolve', 'reject']) test(`provider logout ${outcome} cannot navigate or clear a replacement identity`, async () => {
  const h = harness();
  h.state.principal = { id: 'old' }; h.setCredential('old-token');
  h.setApi(async () => ({ signed_out: true }));
  const provider = deferred(), entered = deferred();
  h.setFetch(() => { entered.resolve(); return provider.promise; });
  const pending = h.signOut(true);
  await entered.promise;
  h.resetIdentity(); h.state.principal = { id: 'new' }; h.setCredential('new-token');
  h.nodes.get('who').textContent = 'New account'; h.nodes.get('app').innerHTML = 'New work';
  h.nodes.get('account-status').textContent = 'New status';
  if (outcome === 'resolve') provider.resolve({ ok: true }); else provider.reject(new Error('Provider uncertain'));
  await pending;
  assert.deepEqual(h.navigations, []);
  assert.equal(h.getCredential(), 'new-token'); assert.equal(h.state.principal.id, 'new');
  assert.equal(h.nodes.get('who').textContent, 'New account');
  assert.equal(h.nodes.get('app').innerHTML, 'New work');
  assert.equal(h.nodes.get('account-status').textContent, 'New status');
});

// B03 follow-up (Bugbot on #298): accepting an invitation re-reads the project list before Home renders, so the granted
// project's name is known (assessment header, Home) without a page reload. Drives the real mountInvitePage → onAccepted.
function inviteHarness() {
  const nodes = new Map(['app', 'who', 'note', 'legacy-link', 'whats-here-wrap'].map(id => [id, { innerHTML: '', textContent: '', hidden: false, className: '', querySelector: () => null, addEventListener() {} }]));
  const source = readFileSync(new URL('./assess.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  const seen = { mounted: null, navigations: [] };
  const location = { pathname: '/', _h: '#invite', get hash() { return this._h; }, set hash(v) { this._h = v; seen.navigations.push({ hash: v, projects: api.state.projects.map(p => p.name) }); } };
  const box = { ...v3, cards, mountKitRoot, shellModel, history: { replaceState() {} }, sessionStorage: { getItem: () => 'tok-1', setItem() {}, removeItem() {} }, isDemo, memoryStorage,
    document: { getElementById: id => nodes.get(id), title: '' }, location, redactDiagnosticPath: x => x, fetch: () => Promise.resolve({ ok: true }),
    INVITE_KEY: 'k', inviteView: () => '', mountInvite: (root, opts) => { seen.mounted = opts; } };
  const api = vm.runInNewContext(source + '\n({state,mountInvitePage,resetIdentity,getGen:()=>generation,setApi:fn=>api=fn,setRender:fn=>render=fn})', box);
  api.setRender(async () => {});
  return { ...api, seen };
}

test('B03: after an accepted invitation the project list is re-read before going Home (granted project named, no reload)', async () => {
  const h = inviteHarness(), calls = [];
  h.state.principal = { id: 'u1' }; h.state.projects = [{ id: 'p0', name: 'Coast' }];
  h.setApi(async url => { calls.push(url); if (url === '/v2/projects') return { projects: [{ id: 'p0', name: 'Coast' }, { id: 'p9', name: 'Granted' }] }; throw new Error('unexpected ' + url); });
  h.mountInvitePage(h.getGen());
  assert.ok(h.seen.mounted, 'invitation controller mounted');
  await h.seen.mounted.onAccepted({ kind: 'project', id: 'p9' });
  assert.deepEqual(calls, ['/v2/projects'], 'the boot project-list read, once');
  assert.deepEqual(h.state.projects.map(p => p.id), ['p0', 'p9']);
  assert.deepEqual(h.seen.navigations, [{ hash: '#projects', projects: ['Coast', 'Granted'] }], 'Home is reached with the granted project already in the list');
});

test('B03: a failed re-read after accept keeps the old list and still goes Home; a stale view does not navigate', async () => {
  const h = inviteHarness();
  h.state.principal = { id: 'u1' }; h.state.projects = [{ id: 'p0', name: 'Coast' }];
  h.setApi(async () => { throw Object.assign(new Error('down'), { code: '503' }); });
  h.mountInvitePage(h.getGen());
  await h.seen.mounted.onAccepted({});
  assert.deepEqual(h.state.projects.map(p => p.id), ['p0']);
  assert.deepEqual(h.seen.navigations.map(n => n.hash), ['#projects']);
  const s = inviteHarness(); let release; const gate = new Promise(r => { release = r; });
  s.state.principal = { id: 'u1' }; s.state.projects = [{ id: 'p0', name: 'Coast' }];
  s.setApi(async () => { await gate; return { projects: [{ id: 'old-identity', name: 'Private' }] }; });
  s.mountInvitePage(s.getGen());
  const done = s.seen.mounted.onAccepted({}); s.resetIdentity(); release(); await done;
  assert.equal(s.state.projects.some(p => p.id === 'old-identity'), false, 'an old identity\'s list never lands');
  assert.deepEqual(s.seen.navigations, [], 'no navigation from a replaced view');
});

test('U30: a route change clears the page status line; an in-flight busy label stays', () => {
  const h = harness();
  const note = h.nodes.get('note'), classes = new Set(['alert']);
  note.classList = { remove: c => classes.delete(c), toggle() {} };
  note.textContent = 'Renamed.'; h.state.busy = false;
  h.clearPageNote();
  assert.equal(note.textContent, ''); assert.equal(classes.has('alert'), false);
  note.textContent = 'Saving…'; h.state.busy = true;
  h.clearPageNote();
  assert.equal(note.textContent, 'Saving…');
});

test('B38: the email-links probe carries a 2 s timeout; a timeout leaves the setting unknown (Access copy, as before)', async () => {
  const h = harness(); let seen;
  h.setFetch((url, options) => { seen = { url, options }; return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason))); });
  const keepAlive = setTimeout(() => {}, 5000); // AbortSignal.timeout timers are unref'd in Node
  const t0 = Date.now(); const on = await h.loadEmailLinks(); clearTimeout(keepAlive);
  assert.equal(seen.url, '/v2/auth/email?probe'); assert.ok(seen.options.signal, 'signal passed');
  assert.ok(Date.now() - t0 >= 1900 && Date.now() - t0 < 5000, 'aborted by the 2 s timeout');
  assert.equal(on, false); assert.equal(h.state.emailLinks, undefined, 'unknown, not false: a later call may ask again');
  h.setFetch(async () => ({ ok: true, json: async () => ({ email_links: true }) }));
  assert.equal(await h.loadEmailLinks(), true); assert.equal(h.state.emailLinks, true);
});
