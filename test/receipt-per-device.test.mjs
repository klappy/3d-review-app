// Receipt per device (captain ruling 2026-10-21; cookbook work/active/2026-09-29-3d-gate-0230-participant-fixes/RULING.md):
// a participant who submitted sees the same receipt in any tab on that device that reopens the link, and
// "Interview another person" still starts a new respondent and forgets the remembered one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticipantJourney } from '../ui/participate/controller.js';
import { createSharedLinkClient, deviceStorage, digestNamespace, scopedStorage, DEVICE_MEMORY_MS, CURRENT_KEY } from '../ui/shared-link.js';

const form = { assessment: 'A', language: 'L', template: { id: 't', version: '1', perspective: 'Leaders' }, items: [{ id: 'q', type: 'text' }] };
const response = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
const memory = (seed = {}) => { const data = new Map(Object.entries(seed)); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };

// A tiny server: each fresh open is a new respondent with a fixed 12h session (never extended); a live resume_token
// resumes that respondent, an expired one is refused; submitted is per respondent.
function server(clock = () => 0) {
  let next = 0; const submitted = new Set(), opens = [], ends = new Map();
  const refused = { ok: false, status: 403, json: async () => ({ ok: false, error: { code: 'NOT_FOUND_OR_NOT_VISIBLE' } }) };
  const fetchImpl = async (url, options) => {
    const bearer = options.headers.authorization?.replace('Bearer ', '');
    if (url.endsWith('/link')) {
      const body = JSON.parse(options.body); opens.push(body);
      if (body.resume_token && !(ends.get(body.resume_token) > clock())) return refused;
      const token = body.resume_token || `pt-${++next}`; if (!ends.has(token)) ends.set(token, clock() + DEVICE_MEMORY_MS);
      return response({ participant_token: token, expires_in: Math.floor((ends.get(token) - clock()) / 1000) });
    }
    if (bearer && !(ends.get(bearer) > clock()) && !bearer.startsWith('pt-code')) return refused;
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

test('deviceStorage: writes stay in the tab; remember copies to the device until the given end and never slides', () => {
  let clock = 1000; const device = memory(), first = memory();
  const store = deviceStorage({ device, tab: first, ttlMs: 50, now: () => clock });
  store.setItem('k', 'v');
  assert.equal(first.getItem('k'), 'v'); assert.equal(device.getItem('k'), null, 'a plain write never reaches the device');
  store.remember('k', 1030); assert.deepEqual(JSON.parse(device.getItem('k')), { v: 'v', exp: 1030 }, 'the server end wins');
  const other = deviceStorage({ device, tab: memory(), ttlMs: 50, now: () => clock });
  assert.equal(other.getItem('k'), 'v', 'another tab on the device finds it');
  assert.equal(deviceStorage({ device, tab: memory({ k: 'mine' }), now: () => clock }).getItem('k'), 'mine', 'the tab\'s own value wins');
  clock = 1020; store.remember('k'); store.remember('k', NaN); assert.equal(JSON.parse(device.getItem('k')).exp, 1030, 'no server end: nothing copied, nothing extended');
  const bare = memory(); deviceStorage({ device: bare, tab: memory({ x: 'y' }), now: () => clock }).remember('x'); assert.equal(bare.data.size, 0, 'unknown expiry never reaches the device');
  store.remember('k', 5000); assert.equal(JSON.parse(device.getItem('k')).exp, 1070, 'capped at ttlMs');
  store.setItem('k', 'w'); assert.equal(JSON.parse(device.getItem('k')).v, 'v', 'an ordinary tab write never touches the device copy');
  store.setItem('k', 'v'); store.remember('k', 1030); clock = 1030; assert.equal(other.getItem('k'), null, 'expired'); assert.equal(device.getItem('k'), null, 'expired entry is dropped');
  clock = 1000; store.remember('k', 1030); store.removeItem('k'); assert.equal(first.getItem('k'), null); assert.equal(device.getItem('k'), null);
  device.setItem('bad', 'not json'); assert.equal(other.getItem('bad'), null);
});
test('deviceStorage: no localStorage (throws or missing) keeps per-tab behaviour', () => {
  const broken = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  for (const device of [broken, null]) {
    const t = memory(), store = deviceStorage({ device, tab: t });
    store.setItem('k', 'v'); store.remember('k', Date.now() + 1000); assert.equal(store.getItem('k'), 'v'); store.removeItem('k'); assert.equal(store.getItem('k'), null);
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
test('the device memory ends with the server session: reopening does not extend it', async t => {
  // The client stamps the server end with Date.now(), so the test clock drives Date.now too.
  const realNow = Date.now; let clock = realNow(); const start = clock; const now = () => clock; Date.now = now; t.after(() => { Date.now = realNow; });
  const device = memory(), srv = server(now);
  await submitIn(tab({ device, srv, now }));
  clock = start + 11 * 3600_000; const reopened = tab({ device, srv, now }); await reopened.journey.start();
  assert.equal(reopened.journey.state.phase, 'receipt', 'still remembered at 11h');
  clock = start + 13 * 3600_000; const later = tab({ device, srv, now }); await later.journey.start();
  assert.equal(later.journey.state.phase, 'form', 'after the server session ends a new tab starts fresh, not "cannot resume"');
  assert.deepEqual(srv.opens.at(-1), { token: 'link-secret' });
});
test('only a submitted session reaches the device: unsent answers and an unsubmitted session stay in their tab', async () => {
  const device = memory(), srv = server(), ns = await digestNamespace('link-secret');
  const a = tab({ device, srv }); await a.journey.start(); a.journey.save({ q: 'private answer' });
  assert.equal(device.data.size, 0, 'nothing on the device before a submission');
  const b = tab({ device, srv }); await b.journey.start();
  assert.equal(b.journey.state.phase, 'form'); assert.equal(b.journey.state.draft, null, 'the other tab does not restore A\'s answers');
  assert.deepEqual(srv.opens.at(-1), { token: 'link-secret' }, 'and does not resume A\'s respondent');
  a.journey.review({ q: 'private answer' }); await a.journey.submit();
  assert.deepEqual([...device.data.keys()].sort(), [CURRENT_KEY, ns + 'bearer', ns + 'expiresAt'].sort(), 'only the session, never the draft or submit key');
});
test('Interview another person stays and forgets the remembered receipt on this device', async () => {
  const device = memory(), srv = server(), ns = await digestNamespace('link-secret');
  const first = tab({ device, srv }); await submitIn(first);
  await first.journey.another();
  assert.equal(first.journey.state.phase, 'form'); assert.equal(first.journey.state.fresh, true);
  assert.equal(device.getItem(ns + 'bearer'), null, 'the device forgets the last person; the next is remembered only once they submit');
  const other = tab({ device, srv }); await other.journey.start();
  assert.equal(other.journey.state.phase, 'form', 'the next tab does not show the previous person\'s receipt');
  // After a reload the link token is gone: Interview another still drops the remembered session from the device.
  await submitIn(other); const reloaded = tab({ device, srv, hash: '', session: other.session }); await reloaded.journey.start();
  assert.equal(reloaded.journey.state.phase, 'receipt'); await reloaded.journey.another();
  assert.equal(device.getItem(ns + 'bearer'), null); assert.equal(other.session.getItem(ns + 'bearer'), null);
});
test('a submitted session with no server-derived expiry (opened before expiresAt existed) stays in its tab', async () => {
  const device = memory(), srv = server(), ns = await digestNamespace('legacy-session');
  const session = memory({ [CURRENT_KEY]: ns, [ns + 'bearer']: 'pt-code-legacy' }); // pt-code*: the mock server keeps it live
  srv.submitted.add('pt-code-legacy');
  const reloaded = tab({ device, srv, hash: '', session }); await reloaded.journey.start();
  assert.equal(reloaded.journey.state.phase, 'receipt'); assert.equal(reloaded.journey.state.thanks.code, false);
  assert.equal(device.data.size, 0, 'no 12h guess: nothing is copied to the device');
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

test('legacy fragment-less receipts stay in their tab until a server expiry is known', async t => {
  const realNow = Date.now; let clock = realNow(); const initial = clock; const now = () => clock; Date.now = now; t.after(() => { Date.now = realNow; });
  const device = memory(), srv = server(now), first = tab({ device, srv, now });
  await submitIn(first);
  const ns = await digestNamespace('link-secret');
  // Previous releases remembered the bearer in the tab without expiresAt/device entries.
  device.data.clear(); first.session.removeItem(ns + 'expiresAt');
  clock = initial + 11 * 3600_000;
  const legacy = tab({ device, srv, now, hash: '', session: first.session });
  await legacy.journey.start();
  assert.equal(legacy.journey.state.phase, 'receipt', 'do not break same-tab legacy receipts');
  assert.equal(device.data.size, 0, 'unknown server expiry cannot grant a fresh device lifetime');
  clock = initial + 13 * 3600_000;
  const later = tab({ device, srv, now }); await later.journey.start();
  assert.equal(later.journey.state.phase, 'form', 'an expired legacy token must not poison a new tab');
  assert.deepEqual(srv.opens.at(-1), { token: 'link-secret' });
});

test('reopening the original link upgrades a legacy receipt only to its remaining server lifetime', async t => {
  const realNow = Date.now; let clock = realNow(); const initial = clock; const now = () => clock; Date.now = now; t.after(() => { Date.now = realNow; });
  const device = memory(), srv = server(now), first = tab({ device, srv, now });
  await submitIn(first);
  const ns = await digestNamespace('link-secret');
  device.data.clear(); first.session.removeItem(ns + 'expiresAt');
  clock = initial + 11 * 3600_000;
  const upgraded = tab({ device, srv, now, session: first.session }); await upgraded.journey.start();
  assert.equal(upgraded.journey.state.phase, 'receipt');
  assert.equal(JSON.parse(device.getItem(ns + 'bearer')).exp, initial + DEVICE_MEMORY_MS);
  const reopened = tab({ device, srv, now }); await reopened.journey.start();
  assert.equal(reopened.journey.state.phase, 'receipt', 'valid refreshed expiry retains per-device receipt');
  clock = initial + 13 * 3600_000;
  const later = tab({ device, srv, now }); await later.journey.start();
  assert.equal(later.journey.state.phase, 'form');
});

test('receipt promotion refuses malformed or elapsed stored expiry without breaking tab receipts', async () => {
  for (const invalid of ['not-a-timestamp', 'Infinity', '0', String(Date.now() - 1000)]) {
    const device = memory(), srv = server(), first = tab({ device, srv });
    await submitIn(first);
    const ns = await digestNamespace('link-secret');
    device.data.clear(); first.session.setItem(ns + 'expiresAt', invalid);
    const reloaded = tab({ device, srv, hash: '', session: first.session }); await reloaded.journey.start();
    assert.equal(reloaded.journey.state.phase, 'receipt');
    assert.equal(device.data.size, 0, `invalid expiry ${invalid} must not reach the device`);
  }
});

test('the remembered end is the server\'s absolute expires_at, else expires_in counted from before the request (Codex 4343346811)', async t => {
  const realNow = Date.now; let clock = 1_000_000; Date.now = () => clock; t.after(() => { Date.now = realNow; });
  const slow = reply => async () => { clock += 60_000; return response(reply); }; // the reply lands a minute after the request
  const at = memory(), withAt = createSharedLinkClient({ store: scopedStorage(at, 'shared:t:'), fetchImpl: slow({ participant_token: 'p', expires_at: new Date(5_000_000).toISOString(), expires_in: 4000 }) });
  await withAt.open('link'); assert.equal(at.getItem('shared:t:expiresAt'), '5000000', 'expires_at wins');
  const inOnly = memory(), withIn = createSharedLinkClient({ store: scopedStorage(inOnly, 'shared:t:'), fetchImpl: slow({ participant_token: 'p', expires_in: 4000 }) });
  const sent = clock; await withIn.open('link'); assert.equal(inOnly.getItem('shared:t:expiresAt'), String(sent + 4_000_000), 'anchored before the request, not after the await');
  const none = memory({ 'shared:t:expiresAt': '9' }), without = createSharedLinkClient({ store: scopedStorage(none, 'shared:t:'), fetchImpl: slow({ participant_token: 'p' }) });
  await without.open('link'); assert.equal(none.getItem('shared:t:expiresAt'), null, 'no server end: nothing stored');
});
test('another tab\'s unsubmitted session does not erase a submitted device copy (Codex 4343346801)', async () => {
  const device = memory(), srv = server(), ns = await digestNamespace('link-secret');
  const b = tab({ device, srv }); await b.journey.start(); // B opens first and does not submit
  const a = tab({ device, srv }); await submitIn(a);
  const remembered = JSON.parse(device.getItem(ns + 'bearer')).v; assert.equal(remembered, 'pt-2');
  const bAgain = tab({ device, srv, session: b.session }); await bAgain.journey.start(); // B reopens the link and rewrites its own bearer
  assert.equal(bAgain.journey.state.phase, 'form'); assert.equal(JSON.parse(device.getItem(ns + 'bearer')).v, remembered, 'A\'s device copy stays');
  const c = tab({ device, srv }); await c.journey.start(); assert.equal(c.journey.state.phase, 'receipt', 'a new tab still shows A\'s receipt');
});
