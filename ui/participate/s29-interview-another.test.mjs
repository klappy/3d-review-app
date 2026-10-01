// node --test ui/participate/s29-interview-another.test.mjs — S29 surveyor mode (Lovable parity; cookbook ticket
// work/queued/2026-09-29-3d-interview-another-parity): after a respondent submits on the surveyor's phone, the thank-you
// offers "Interview another person"; one tap clears the answers and opens the same link as a new respondent. The earlier
// response stays committed. Controller cases use a fake /v2; the page case runs the real page.js in jsdom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createParticipantJourney } from './controller.js';
import { copy, digestNamespace } from '../shared-link.js';
import { UI_EN, SURVEYOR_EN } from './i18n.js';

const form = { assessment: 'A', language: 'L', template: { id: 't', version: '1', perspective: 'Community' }, items: [{ id: 'q', type: 'text', text: 'Your view' }] };
const ok = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result: structuredClone(result) }) });
// A fake participant server: a link opened without resume_token is a new respondent (src/handlers/shared-link.ts).
function server({ failOpen = () => false } = {}) {
  let n = 0; const opens = [], posted = [], saved = new Map(), requests = [];
  const fetchImpl = async (url, opts = {}) => {
    const bearer = opts.headers?.authorization?.replace(/^Bearer /, '') || null; requests.push(url);
    if (url.endsWith('/link')) {
      const body = JSON.parse(opts.body); opens.push(body);
      if (failOpen(opens.length)) { const error = { ok: false, status: 503, json: async () => ({ ok: false, error: { code: 'UNAVAILABLE' } }) }; return error; }
      return ok({ participant_token: body.resume_token || `pt_${++n}` });
    }
    if (url.endsWith('/receipt')) return ok(saved.get(bearer) || { submitted: false });
    if (url.endsWith('/form')) return ok(form);
    if (url.endsWith('/responses')) { const body = JSON.parse(opts.body); posted.push({ bearer, ...body }); const r = { submitted: true, response_id: `resp_${bearer}`, submitted_at: '2026-09-30T16:00:00Z' }; saved.set(bearer, r); return ok(r); }
    throw new Error(`unmapped ${url}`);
  };
  return { fetchImpl, opens, posted, saved, requests };
}
function journeyOn({ hash = '#survey=link-secret', saved = {}, srv = server() } = {}) {
  const data = new Map(Object.entries(saved)), assigned = [];
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
  const win = { location: { hash, pathname: '/participate/', search: '', assign: u => assigned.push(u) }, history: { replaceState() { win.location.hash = ''; } } };
  return { journey: createParticipantJourney({ window: win, storage, fetchImpl: srv.fetchImpl }), data, srv, assigned };
}
async function submitted(h, answer = 'first person') {
  await h.journey.start(); h.journey.save({ q: answer }); h.journey.review({ q: answer }); await h.journey.submit();
  assert.equal(h.journey.state.phase, 'receipt');
}

test('S29: after a submit, Interview another opens the same link as a new respondent with empty answers; the first response stays', async () => {
  const h = journeyOn(), ns = await digestNamespace('link-secret');
  await submitted(h);
  assert.equal(h.data.get(ns + 'bearer'), 'pt_1');
  await h.journey.another();
  assert.deepEqual(h.srv.opens[1], { token: 'link-secret' }, 'second open sends the link token only — no resume_token, so the server starts a new respondent');
  assert.equal(h.data.get(ns + 'bearer'), 'pt_2', 'a new participant session for this link');
  assert.equal(h.journey.state.phase, 'form'); assert.equal(h.journey.state.draft, null); assert.equal(h.journey.state.fresh, true);
  assert.equal(h.journey.state.notice, SURVEYOR_EN.nextPerson);
  assert.ok(![...h.data.keys()].some(k => k.endsWith(':draft') || k.endsWith(':submitKey')), 'no answers or submit key carried over');
  assert.equal(h.srv.saved.get('pt_1').response_id, 'resp_pt_1', 'the first response is still recorded');
  assert.ok(!h.srv.requests.some(u => /undo|revoke|delete/i.test(u)), 'nothing is undone or revoked');
  h.journey.review({ q: 'second person' }); await h.journey.submit();
  assert.equal(h.journey.state.phase, 'receipt');
  assert.deepEqual(h.srv.posted.map(p => [p.bearer, p.answers.q]), [['pt_1', 'first person'], ['pt_2', 'second person']], 'two respondents, two responses');
  assert.notEqual(h.srv.posted[0].idempotency_key, h.srv.posted[1].idempotency_key);
});

test('S29: Interview another does nothing before a submit', async () => {
  const h = journeyOn(); await h.journey.start();
  await h.journey.another(); assert.equal(h.journey.state.phase, 'form'); assert.equal(h.srv.opens.length, 1);
});

test('S29: an access-code session goes back to code entry (a code works once) and keeps its receipt slot', async () => {
  const ns = await digestNamespace('ptok');
  const h = journeyOn({ hash: '', saved: { 'shared:current': ns, [ns + 'bearer']: 'ptok', [ns + 'via']: 'code' } });
  await submitted(h);
  const before = h.srv.requests.length;
  await h.journey.another();
  assert.deepEqual(h.assigned, ['/#survey']); assert.equal(h.srv.requests.length, before, 'no network');
  assert.equal(h.data.get(ns + 'bearer'), 'ptok'); assert.equal(h.data.get(ns + 'via'), 'code');
});

test('S29: after a reload the link token is gone — the tab lets go of the old session and asks for the link again', async () => {
  const ns = await digestNamespace('link-secret');
  const h = journeyOn({ hash: '', saved: { 'shared:current': ns, [ns + 'bearer']: 'pt_9' } });
  h.srv.saved.set('pt_9', { submitted: true, response_id: 'resp_pt_9', submitted_at: '2026-09-30T15:00:00Z' });
  await h.journey.start(); assert.equal(h.journey.state.phase, 'receipt');
  await h.journey.another();
  assert.equal(h.journey.state.phase, 'unavailable'); assert.equal(h.journey.state.notice, SURVEYOR_EN.openLinkForNext);
  assert.equal(h.data.get(ns + 'bearer'), undefined, 'reopening the link now starts a new respondent');
  assert.equal(h.srv.opens.length, 0); assert.equal(h.srv.saved.get('pt_9').response_id, 'resp_pt_9', 'the response is kept');
});

test('S29: a failed re-open keeps the old session in this tab and says so', async () => {
  const h = journeyOn({ srv: server({ failOpen: n => n === 2 }) }), ns = await digestNamespace('link-secret');
  await submitted(h);
  await h.journey.another();
  assert.equal(h.journey.state.phase, 'unavailable'); assert.equal(h.journey.state.notice, copy.transient);
  assert.equal(h.data.get(ns + 'bearer'), 'pt_1');
});

// ---------- the real page in jsdom ----------
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };
test('S29 page: the button appears only on the thank-you; one tap shows an empty survey for the next person under a new session', async () => {
  const dom = new JSDOM(html, { url: 'https://x.test/participate/#survey=link-tok' });
  const { window } = dom, srv = server(), ns = await digestNamespace('link-tok');
  Object.assign(globalThis, { window, document: window.document, location: window.location, sessionStorage: window.sessionStorage, localStorage: window.localStorage, FormData: window.FormData, fetch: srv.fetchImpl });
  await import('./page.js?run=s29');
  await settle();
  const $ = id => window.document.getElementById(id), q = s => window.document.querySelector(s);
  assert.equal(window.location.hash, '', 'the link token left the address bar');
  assert.equal($('interview-another'), null, 'no button before a submit');
  q('.participant-start').click();
  const t = q('textarea[name="q"]'); t.value = 'first person'; t.dispatchEvent(new window.Event('input', { bubbles: true }));
  $('review-button').click(); await settle(); $('submit').click(); await settle();
  const button = $('interview-another');
  assert.ok(button && !$('receipt').hidden, 'the thank-you shows the button');
  assert.equal(button.textContent, 'Interview another person');
  button.click(); await settle();
  assert.equal(window.sessionStorage.getItem(ns + 'bearer'), 'pt_2', 'new participant session');
  assert.equal($('receipt').hidden, true); assert.equal($('answers').hidden, false);
  assert.equal(q('textarea[name="q"]').value, '', 'answers cleared');
  assert.equal(q('.participant-intro').hidden, false, 'back at the start of the survey');
  assert.equal($('notice').textContent, SURVEYOR_EN.nextPerson);
  q('.participant-start').click();
  const t2 = q('textarea[name="q"]'); t2.value = 'second person'; t2.dispatchEvent(new window.Event('input', { bubbles: true }));
  $('review-button').click(); await settle(); $('submit').click(); await settle();
  assert.deepEqual(srv.posted.map(p => [p.bearer, p.answers.q]), [['pt_1', 'first person'], ['pt_2', 'second person']], 'the previous submission is not lost');
  window.close();
});

test('S29: the new words stay out of UI_EN until the server translate mirror lists them (test/translate-allowlist.test.ts)', () => {
  for (const v of Object.values(SURVEYOR_EN)) assert.ok(!Object.values(UI_EN).includes(v));
});
