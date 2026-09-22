import test from 'node:test';
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
  const box = { cards, mountKitRoot, shellModel, history: {replaceState() {}}, sessionStorage: {getItem() {return null;},removeItem:k=>removed.push(k)}, isDemo, memoryStorage, document: { getElementById: id => nodes.get(id) }, location: { hash: '', pathname: '/', assign: path=>navigations.push(path) }, redactDiagnosticPath: x => x, fetch: (url, options) => { fetches.push({ url, options }); return Promise.resolve({ ok: true }); } };
  const api = vm.runInNewContext(source + '\n({state,resetIdentity,assessmentsFor,workspaceFor,boot,act,loadCounts,syncContextDisclosure,currentShareRoute,setHash:hash=>location.hash=hash,setApi:fn=>api=fn,setRender:fn=>render=fn,loadAccountEmail,signOut,setFetch:fn=>fetch=fn,setCredential:t=>token=t,getCredential:()=>token,setListen:fn=>listen=fn})', box);
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
  h.setApi(async () => { if (++calls === 1) throw Error('transient'); return { workspace: { name: 'Workspace' }, projects: [] }; });
  assert.equal(await h.workspaceFor('p'), null); assert.equal(h.state.workspaces.has('w'), false);
  assert.equal((await h.workspaceFor('p')).name, 'Workspace'); assert.equal(calls, 2);
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
test('confirmed switch clears current app identity then navigates to documented provider logout',async()=>{
  const h=harness();h.state.principal={id:'one'};h.setCredential('one-token');h.setApi(async()=>({signed_out:true}));await h.signOut(true);
  assert.equal(h.getCredential(),null);assert.equal(h.state.principal,null);assert.deepEqual(h.removed,['facilitatorToken']);
  assert.equal(h.fetches.length,1);assert.equal(h.fetches[0].url,'/cdn-cgi/access/logout');assert.equal(h.fetches[0].options.credentials,'same-origin');assert.equal(h.fetches[0].options.redirect,'manual');assert.equal(h.fetches[0].options.cache,'no-store');
  assert.deepEqual(h.navigations,['https://klappy.cloudflareaccess.com/cdn-cgi/access/logout']);
});
test('confirmed ordinary logout does not navigate to provider',async()=>{
  const h=harness();h.state.principal={id:'one'};h.setCredential('one-token');h.setApi(async()=>({signed_out:true}));h.setRender(()=>{});h.setListen(()=>{});await h.signOut();
  assert.equal(h.getCredential(),null);assert.equal(h.state.principal,null);assert.equal(h.nodes.get('who').textContent,'Not signed in');assert.deepEqual(h.navigations,[]);
});
test('account email read forbids redirect, does not repaint work and ignores stale response',async()=>{
  const h=harness(),wait=deferred();let options;h.setFetch((_url,o)=>{options=o;return wait.promise;});h.setCredential('old-token');h.nodes.get('app').innerHTML='unsaved work';
  const pending=h.loadAccountEmail();assert.equal(options.redirect,'error');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(h.nodes.get('app').innerHTML,'unsaved work');
  h.resetIdentity();h.setCredential('new-token');h.nodes.get('who').textContent='Account: next@example.invalid';wait.resolve({ok:true,json:async()=>({email:'prior@example.invalid'})});await pending;assert.equal(h.nodes.get('who').textContent,'Account: next@example.invalid');
});
test('account email is text only and failures remove previous email',async()=>{
  const h=harness();h.setFetch(async()=>({ok:true,json:async()=>({email:'<synthetic>@example.invalid'})}));await h.loadAccountEmail();assert.equal(h.nodes.get('who').textContent,'Account: <synthetic>@example.invalid');
  h.setFetch(async()=>{throw Error('redirect');});await h.loadAccountEmail();assert.equal(h.nodes.get('who').textContent,'Account email unavailable.');
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
