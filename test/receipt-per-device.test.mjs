// Receipt per device (captain ruling 2026-10-21; cookbook work/active/2026-09-29-3d-gate-0230-participant-fixes/RULING.md):
// a participant who submitted sees the same receipt in any tab on that device that reopens the link, and
// "Interview another person" still starts a new respondent and forgets the remembered one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticipantJourney } from '../ui/participate/controller.js';
import { deviceStorage, digestNamespace, DEVICE_MEMORY_MS, CURRENT_KEY } from '../ui/shared-link.js';

const form = { assessment: 'A', language: 'L', template: { id: 't', version: '1', perspective: 'Leaders' }, items: [{ id: 'q', type: 'text' }] };
const response = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
const memory = (seed = {}) => { const data = new Map(Object.entries(seed)); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };

// A tiny server: each fresh open is a new respondent; a resume_token resumes that respondent; submitted is per respondent.
function server() {
  let next = 0; const submitted = new Set(), opens = [];
  const fetchImpl = async (url, options) => {
    const bearer = options.headers.authorization?.replace('Bearer ', '');
    if (url.endsWith('/link')) { const body = JSON.parse(options.body); opens.push(body); return response({ participant_token: body.resume_token || `pt-${++next}` }); }
    if (url.endsWith('/receipt')) return response(submitted.has(bearer) ? { submitted: true, response_id: `r-${bearer}` } : { submitted: false });
    if (url.endsWith('/form')) return response(form);
    submitted.add(bearer); return response({ submitted: true, response_id: `r-${bearer}` });
  };
  return { fetchImpl, opens, submitted };
}
function tab({ device, srv, hash = '#survey=link-secret', session = memory(), now }) {
  const win = { location: { hash, pathname: '/participate/', search: '', assign(path) { win.assigned = path; } }, history: { replaceState() { win.location.hash = ''; } } };
  const journey = createParticipantJourney({ window: win, storage: deviceStorage({ device, tab: session, now }), fetchImpl: srv.fetchImpl });
  return { journey, session, win };
}
async function submitIn(t) { await t.journey.start(); t.journey.review({ q: 'a' }); await t.journey.submit(); assert.equal(t.journey.state.phase, 'receipt'); }

test('deviceStorage: writes both, tab copy first, device copy for a new tab, expiry and remove clear it', () => {
  let clock = 1000; const device = memory(), first = memory();
  const store = deviceStorage({ device, tab: first, ttlMs: 50, now: () => clock });
  store.setItem('k', 'v');
  assert.equal(first.getItem('k'), 'v'); assert.deepEqual(JSON.parse(device.getItem('k')), { v: 'v', exp: 1050 });
  const other = deviceStorage({ device, tab: memory(), ttlMs: 50, now: () => clock });
  assert.equal(other.getItem('k'), 'v', 'another tab on the device finds it');
  const own = memory({ k: 'mine' });
  assert.equal(deviceStorage({ device, tab: own, now: () => clock }).getItem('k'), 'mine', 'the tab\'s own value wins');
  clock = 1050; assert.equal(other.getItem('k'), null, 'expired'); assert.equal(device.getItem('k'), null, 'expired entry is dropped');
  store.setItem('k', 'v'); store.removeItem('k'); assert.equal(first.getItem('k'), null); assert.equal(device.getItem('k'), null);
  device.setItem('bad', 'not json'); assert.equal(other.getItem('bad'), null);
});
test('deviceStorage: no localStorage (throws or missing) keeps per-tab behaviour', () => {
  const broken = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  for (const device of [broken, null]) {
    const t = memory(), store = deviceStorage({ device, tab: t });
    store.setItem('k', 'v'); assert.equal(store.getItem('k'), 'v'); store.removeItem('k'); assert.equal(store.getItem('k'), null);
  }
});
test('the 12-hour default matches the server participant session bound', () => { assert.equal(DEVICE_MEMORY_MS, 12 * 60 * 60 * 1000); });

test('a new tab on the same device that reopens the link shows the same receipt, not a fresh start', async () => {
  const device = memory(), srv = server();
  const first = tab({ device, srv }); await submitIn(first);
  assert.match(first.journey.state.notice, /Reopening your link shows this receipt again/, 'the promise stays');
  const second = tab({ device, srv }); await second.journey.start();
  assert.equal(second.journey.state.phase, 'receipt'); assert.equal(second.journey.state.receipt.response_id, 'r-pt-1');
  assert.deepEqual(srv.opens.at(-1), { token: 'link-secret', resume_token: 'pt-1' }, 'the new tab resumes the remembered respondent');
  const blank = tab({ device, srv, hash: '' }); await blank.journey.start();
  assert.equal(blank.journey.state.phase, 'receipt', 'a tab reopened without the fragment also finds it');
});
test('after the memory expires a new tab starts as before', async () => {
  let clock = 0; const now = () => clock; const device = memory(), srv = server();
  await submitIn(tab({ device, srv, now }));
  clock = DEVICE_MEMORY_MS; const later = tab({ device, srv, now }); await later.journey.start();
  assert.equal(later.journey.state.phase, 'form'); assert.deepEqual(srv.opens.at(-1), { token: 'link-secret' });
});
test('Interview another person stays and forgets the remembered receipt on this device', async () => {
  const device = memory(), srv = server(), ns = await digestNamespace('link-secret');
  const first = tab({ device, srv }); await submitIn(first);
  await first.journey.another();
  assert.equal(first.journey.state.phase, 'form'); assert.equal(first.journey.state.fresh, true);
  assert.equal(JSON.parse(device.getItem(ns + 'bearer')).v, 'pt-2', 'the device now remembers the next person, not the last');
  const other = tab({ device, srv }); await other.journey.start();
  assert.equal(other.journey.state.phase, 'form', 'the next tab does not show the previous person\'s receipt');
  // After a reload the link token is gone: Interview another still drops the remembered session from the device.
  await submitIn(other); const reloaded = tab({ device, srv, hash: '', session: other.session }); await reloaded.journey.start();
  assert.equal(reloaded.journey.state.phase, 'receipt'); await reloaded.journey.another();
  assert.equal(device.getItem(ns + 'bearer'), null); assert.equal(other.session.getItem(ns + 'bearer'), null);
});
test('an access-code session stays in its tab and is never told it can reopen; Interview another goes to code entry', async () => {
  const device = memory(), srv = server();
  await submitIn(tab({ device, srv })); // the device also remembers a link session
  const codeNs = await digestNamespace('code-session');
  const session = memory({ [CURRENT_KEY]: codeNs, [codeNs + 'bearer']: 'pt-code', [codeNs + 'via']: 'code' });
  srv.submitted.add('pt-code');
  const code = tab({ device, srv, hash: '', session }); await code.journey.start();
  assert.equal(code.journey.state.phase, 'receipt'); assert.equal(code.journey.state.receipt.response_id, 'r-pt-code', 'the tab\'s code session, not the device\'s link');
  assert.equal(code.journey.state.thanks.code, true); assert.doesNotMatch(code.journey.state.notice, /Reopening your link|same link/);
  await code.journey.another(); assert.equal(code.win.assigned, '/#survey');
});
