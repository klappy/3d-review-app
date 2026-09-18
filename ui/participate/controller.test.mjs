import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticipantJourney } from './controller.js';
import { copy, digestNamespace } from '../shared-link.js';

const form = { assessment: 'A', language: 'L', template: { id: 't', version: '1' }, items: [{ id: 'q', type: 'text' }] };
const response = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
const refused = (code, status = 403) => ({ ok: false, status, json: async () => ({ ok: false, error: { code } }) });
function harness({ hash = '#survey=link-secret', saved = {}, handle } = {}) {
  const data = new Map(Object.entries(saved)), requests = [], states = [];
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const win = { location: { hash, pathname: '/participate/', search: '' }, history: { replaceState(_, __, path) { assert.equal(path, '/participate/'); win.location.hash = ''; } } };
  const journey = createParticipantJourney({ window: win, storage, onChange: s => states.push(s), fetchImpl: async (url, options) => {
    assert.equal(win.location.hash, '', 'raw credential stripped before transport');
    assert.equal(options.credentials, 'omit'); assert.ok(!url.includes('secret'));
    assert.notEqual(options.headers.authorization, 'Bearer staff-secret');
    requests.push({ url, options });
    if (handle) { const value = await handle(url, options, requests); if (value) return value; }
    if (url.endsWith('/link')) return response({ participant_token: 'participant-secret' });
    if (url.endsWith('/receipt')) return response({ submitted: false });
    if (url.endsWith('/form')) return response(form);
    return response({ submitted: true, response_id: 'r' });
  } });
  return { journey, data, requests, states, win };
}
test('new shared link opens standalone participant form without any staff transport; submits and clears only scoped state', async () => {
  const h = harness({ saved: { facilitatorToken: 'staff-secret', responseKey: 'staff-key' } });
  await h.journey.start(); assert.equal(h.journey.state.phase, 'form');
  assert.deepEqual(h.requests.map(r => r.url), ['/v2/participate/link', '/v2/participate/receipt', '/v2/participate/form']);
  assert.equal(h.requests[0].options.headers.authorization, undefined);
  assert.deepEqual(JSON.parse(h.requests[0].options.body), { token: 'link-secret' });
  h.journey.save({ q: 'answer' }); h.journey.review({ q: 'answer' });
  assert.equal(h.requests.length, 3, 'review sends nothing'); await h.journey.submit();
  assert.equal(h.journey.state.phase, 'receipt'); assert.equal(h.data.get('facilitatorToken'), 'staff-secret'); assert.equal(h.data.get('responseKey'), 'staff-key');
  assert.ok(![...h.data.keys()].some(k => k.endsWith(':draft') || k.endsWith(':submitKey')));
});
test('same-tab reload probes existing bearer before form and restores versioned draft', async () => {
  const ns = await digestNamespace('link-secret');
  const h = harness({ hash: '', saved: { 'shared:current': ns, [ns + 'bearer']: 'participant-secret', [ns + 'draft']: JSON.stringify({ template: form.template, answers: { q: 'draft' } }) } });
  await h.journey.start(); assert.equal(h.journey.state.phase, 'form'); assert.deepEqual(h.journey.state.draft, { q: 'draft' });
  assert.equal(h.requests.some(r => r.url.endsWith('/link')), false);
});
test('reopening submitted session shows receipt without downloading form', async () => {
  const h = harness({ handle: url => url.endsWith('/receipt') ? response({ submitted: true, response_id: 'old' }) : null });
  await h.journey.start(); assert.equal(h.journey.state.phase, 'receipt'); assert.equal(h.requests.length, 2);
});
test('uncertain submit retains draft and key; safe retry reuses key and returns receipt', async () => {
  let count = 0; const keys = [];
  const h = harness({ handle: (url, options) => { if (url.endsWith('/responses')) { keys.push(JSON.parse(options.body).idempotency_key); if (++count === 1) throw Error('network'); } } });
  await h.journey.start(); h.journey.save({ q: 'answer' }); h.journey.review({ q: 'answer' }); await h.journey.submit();
  assert.equal(h.journey.state.notice, copy.submitUncertain); assert.ok([...h.data.keys()].some(k => k.endsWith(':draft')));
  h.journey.edit(); assert.equal(h.journey.state.notice, copy.submitUncertain);
  h.journey.review({ q: 'answer' }); assert.equal(h.journey.state.notice, copy.submitUncertain);
  await h.journey.recover(); assert.equal(h.journey.state.notice, copy.submitUncertain);
  await h.journey.submit(); assert.equal(keys[0], keys[1]); assert.equal(h.journey.state.phase, 'receipt');
});
test('refused resume preserves scoped draft/bearer and never opens a fresh respondent', async () => {
  const ns = await digestNamespace('link-secret');
  const h = harness({ saved: { [ns + 'bearer']: 'old', [ns + 'draft']: 'kept' }, handle: url => url.endsWith('/link') ? refused('NOT_FOUND_OR_NOT_VISIBLE') : null });
  await h.journey.start(); assert.equal(h.journey.state.notice, copy.cannotResume); assert.equal(h.requests.length, 1); assert.equal(h.data.get(ns + 'bearer'), 'old'); assert.equal(h.data.get(ns + 'draft'), 'kept');
});
test('closed collection refuses editable form and malformed fragment does no transport', async () => {
  const h = harness({ handle: url => url.endsWith('/link') ? refused('STAGE_CONFLICT', 409) : null });
  await h.journey.start(); assert.equal(h.journey.state.notice, copy.collectionClosed); assert.equal(h.requests.length, 1);
  const malformed = harness({ hash: '#survey=%ZZ' }); await malformed.journey.start(); assert.equal(malformed.requests.length, 0); assert.equal(malformed.win.location.hash, '');
});
test('concurrent clicks submit only once', async () => {
  let finish; const h = harness({ handle: url => url.endsWith('/responses') ? new Promise(resolve => { finish = resolve; }) : null });
  await h.journey.start(); h.journey.review({ q: 'answer' }); const first = h.journey.submit(); await h.journey.submit();
  assert.equal(h.requests.filter(r => r.url.endsWith('/responses')).length, 1); finish(response({ submitted: true })); await first;
});

test('root route forwards shared credentials to dedicated page, invitations remain legacy, both scrub first', async () => {
  const { readFileSync } = await import('node:fs'); const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../assess/assess.js', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('function scrubCredentialHash()'), source.indexOf('function resetIdentity()'));
  for (const [hash, destination] of [['#survey=link-secret', '/participate/#survey=link-secret'], ['#invite=invite-secret', '/legacy/#invite=invite-secret']]) {
    const events = [];
    runInNewContext(fn + '\nscrubCredentialHash();', { location: { hash, pathname: '/', replace: value => events.push(value) }, history: { replaceState: () => events.push('scrub') }, LEGACY_HASHES: new Set() });
    assert.deepEqual(events, ['scrub', destination]);
  }
});
test('429 and transport failure keep honest retry states without creating another participant', async () => {
  for (const [failure, notice] of [[() => refused('RATE_LIMITED', 429), copy.rateLimited], [() => { throw Error('offline'); }, copy.transient]]) {
    const h = harness({ handle: failure }); await h.journey.start(); assert.equal(h.journey.state.notice, notice); assert.equal(h.requests.length, 1);
  }
});
test('dedicated static page dependencies are in the local server and tests are excluded from deployed assets', async () => {
  const { readFileSync } = await import('node:fs'); const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
  const server = read('../server.mjs');
  for (const path of ['/participate/', '/participate/page.js', '/participate/controller.js', '/participate/page.css']) assert.ok(server.includes(`'${path}':`));
  assert.ok(read('../.assetsignore').split('\n').includes('participate/controller.test.mjs'));
  const html = read('./index.html');
  assert.ok(!html.includes('/app.js'), 'legacy staff app is not mounted');
  assert.equal((html.match(/src="\/changelog.js"/g) || []).length, 1);
  for (const id of ['version', 'changelog', 'changelog-title', 'changelog-build', 'changelog-body', 'changelog-close']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  }
  assert.ok(html.indexOf('id="version"') < html.indexOf('<main'));
  assert.ok(html.indexOf('id="changelog"') > html.indexOf('</main>'));
  assert.ok(html.indexOf('src="/changelog.js"') < html.indexOf('src="/participate/page.js"'));
  assert.ok(read('./page.css').includes('#participant:has(.participant-intro:not([hidden])) #review-button{display:none}'));
});
