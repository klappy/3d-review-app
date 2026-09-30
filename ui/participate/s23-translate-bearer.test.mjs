// S23 (audit of train 22, client half of the translate rate-limit fix): the participant page's translate requests carry
// the participant's own bearer when the tab holds one, and nothing otherwise. Never a staff token; the token goes to
// POST /v2/translate only, in the header only — never the body, the cache key or the device cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTranslations, fetchTranslationsProgressive, translateInit, PARTICIPANT_TOKEN } from './i18n.js';
import { createParticipantJourney } from './controller.js';

const PT = 'pt_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6'; // randomToken("pt") shape: pt_ + 32 base64url
const PT_HEX = 'pt_' + '0123456789abcdef0123456789abcdef'; // mintSession participant shape: pt_ + 32 hex
const ST = 'st_' + '0123456789abcdef0123456789abcdef'; // a staff session: never sent
const texts = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`k${i}`, `Text ${i}`]));
function memoryStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; }
function recorder() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const b = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => ({ translated: Object.fromEntries(Object.entries(b.sourceTexts).map(([k, v]) => [k, `ລາວ ${v}`])) }) };
  };
  return { calls, fetchImpl };
}
const leaks = (value, token) => JSON.stringify(value).includes(token.slice(3));

test('participant token shape: pt_ + 32 only', () => {
  assert.ok(PARTICIPANT_TOKEN.test(PT) && PARTICIPANT_TOKEN.test(PT_HEX));
  for (const bad of [ST, 'practice-only', 'participant-secret', `${PT}x`, `Bearer ${PT}`, ` ${PT}`, '', null, undefined, 42, {}]) assert.ok(!(typeof bad === 'string' && PARTICIPANT_TOKEN.test(bad)), String(bad));
});

test('translateInit: Authorization only for a participant token; always credentials omit; body never carries it', () => {
  const body = { targetLang: 'lo', context: 'participant-ui', sourceTexts: { a: 'Next' } };
  const withToken = translateInit(body, PT);
  assert.equal(withToken.method, 'POST');
  assert.equal(withToken.headers.authorization, `Bearer ${PT}`);
  assert.equal(withToken.headers['content-type'], 'application/json');
  assert.equal(withToken.credentials, 'omit');
  assert.deepEqual(JSON.parse(withToken.body), body);
  for (const bearer of [null, undefined, '', ST, 'practice-only', 'participant-secret', 7]) {
    const init = translateInit(body, bearer);
    assert.deepEqual(Object.keys(init.headers), ['content-type'], `no header for ${String(bearer)}`);
    assert.equal(init.credentials, 'omit');
  }
});

test('progressive translate: every chunk carries the participant bearer; the token never reaches body, cache key or cache', async () => {
  const { calls, fetchImpl } = recorder(), storage = memoryStorage();
  const r = await fetchTranslationsProgressive({ lang: 'lo', context: 'participant-ui', sourceTexts: texts, fetchImpl, storage, bearer: PT });
  assert.equal(Object.keys(r.map).length, 45);
  assert.equal(calls.length, 3, 'chunk size unchanged (20, 20, 5)');
  for (const { url, init } of calls) {
    assert.equal(url, '/v2/translate', 'the token goes to the translate route only');
    assert.equal(init.headers.authorization, `Bearer ${PT}`);
    assert.equal(init.credentials, 'omit');
    assert.ok(!leaks(JSON.parse(init.body), PT), 'not in the body');
  }
  assert.equal(storage.m.size, 1);
  for (const [k, v] of storage.m) assert.ok(!leaks(k, PT) && !leaks(v, PT), 'not in the device cache');
  // A cache hit makes no request at all, token or not.
  const again = recorder();
  const hit = await fetchTranslationsProgressive({ lang: 'lo', context: 'participant-ui', sourceTexts: texts, fetchImpl: again.fetchImpl, storage, bearer: PT });
  assert.equal(hit.cached, true); assert.equal(again.calls.length, 0);
});

test('progressive translate without a participant token sends no Authorization header, exactly as before', async () => {
  for (const bearer of [undefined, null, ST, 'practice-only']) {
    const { calls, fetchImpl } = recorder();
    await fetchTranslationsProgressive({ lang: 'lo', context: 'participant-ui', sourceTexts: texts, fetchImpl, ...(bearer === undefined ? {} : { bearer }) });
    assert.equal(calls.length, 3);
    for (const { init } of calls) {
      assert.deepEqual(init.headers, { 'content-type': 'application/json' }, `headers for ${String(bearer)}`);
      assert.equal(init.method, 'POST');
    }
  }
});

test('single-request translate follows the same header rule', async () => {
  const a = recorder();
  await fetchTranslations({ lang: 'lo', context: 'c', sourceTexts: { a: 'Next' }, fetchImpl: a.fetchImpl, bearer: PT_HEX });
  assert.equal(a.calls[0].init.headers.authorization, `Bearer ${PT_HEX}`);
  const b = recorder();
  await fetchTranslations({ lang: 'lo', context: 'c', sourceTexts: { a: 'Next' }, fetchImpl: b.fetchImpl });
  assert.equal(b.calls[0].init.headers.authorization, undefined);
  const c = recorder();
  await fetchTranslations({ lang: 'en', context: 'c', sourceTexts: { a: 'Next' }, fetchImpl: c.fetchImpl, bearer: PT });
  assert.equal(c.calls.length, 0, 'English asks nothing');
});

test('journey.bearer is the participant token from the link, never the staff token; the journey requests are unchanged', async () => {
  const data = new Map([['facilitatorToken', ST]]), requests = [];
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const win = { location: { hash: '#survey=link-secret', pathname: '/participate/', search: '' }, history: { replaceState() { win.location.hash = ''; } } };
  const ok = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
  const journey = createParticipantJourney({ window: win, storage, fetchImpl: async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/link')) return ok({ participant_token: PT });
    if (url.endsWith('/receipt')) return ok({ submitted: false });
    return ok({ assessment: 'A', language: 'L', template: { id: 't', version: '1' }, items: [{ id: 'q', type: 'text' }] });
  } });
  assert.equal(journey.bearer, null, 'no token before the link opens');
  await journey.start();
  assert.equal(journey.state.phase, 'form');
  assert.equal(journey.bearer, PT);
  assert.notEqual(journey.bearer, ST);
  // The participant client's own requests are exactly as before (link without, receipt/form with its bearer).
  assert.deepEqual(requests.map(r => [r.url, r.options.headers.authorization]), [['/v2/participate/link', undefined], ['/v2/participate/receipt', `Bearer ${PT}`], ['/v2/participate/form', `Bearer ${PT}`]]);
  // And the page's translate requests carry that same participant token.
  const { calls, fetchImpl } = recorder();
  await fetchTranslationsProgressive({ lang: 'lo', context: 'participant-ui', sourceTexts: { a: 'Next' }, fetchImpl, bearer: journey.bearer });
  assert.equal(calls[0].init.headers.authorization, `Bearer ${PT}`);
});

test('a tab with no participant session (practice stand-in or none) sends no header', async () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const win = { location: { hash: '', pathname: '/participate/', search: '' }, history: { replaceState() {} } };
  const journey = createParticipantJourney({ window: win, storage, fetchImpl: async () => { throw new Error('no request expected'); } });
  await journey.start();
  assert.equal(journey.state.phase, 'unavailable');
  assert.equal(journey.bearer, null);
  const { calls, fetchImpl } = recorder();
  await fetchTranslationsProgressive({ lang: 'lo', context: 'participant-ui', sourceTexts: { a: 'Next' }, fetchImpl, bearer: journey.bearer });
  assert.equal(calls[0].init.headers.authorization, undefined);
});
