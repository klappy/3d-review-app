import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isDemo, memoryStorage } from '../demo.js';

// Execute the actual shell functions with deferred API replies, without starting its browser boot.
function harness() {
  const disclosure = { open: false };
  const nodes = new Map(['app', 'who', 'note', 'legacy-link', 'whats-here-wrap'].map(id => [id, { innerHTML: 'old', textContent: 'old', hidden: false, querySelector: () => disclosure }]));
  const source = readFileSync(new URL('./assess.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  const box = { isDemo, memoryStorage, document: { getElementById: id => nodes.get(id) }, location: { hash: '', pathname: '/' }, redactDiagnosticPath: x => x };
  const api = vm.runInNewContext(source + '\n({state,resetIdentity,assessmentsFor,workspaceFor,boot,act,loadCounts,syncContextDisclosure,setApi:fn=>api=fn,setRender:fn=>render=fn})', box);
  return { ...api, nodes, disclosure };
}
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

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
