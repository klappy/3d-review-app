// node --test ui/participate/s21-redraw-keeps-answers.test.mjs — gate 0.24.0 audit (train 22): a translation redraw on the
// participant page erased every answer given since load, and the About-you choices; the next keystroke then saved the
// erased form over the draft. Triggers: the language picker, a ?lang= (or remembered) translation landing while answering,
// a failed translation / Try again. The real page.js runs in jsdom against a fake /v2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { digestNamespace } from '../shared-link.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const form = {
  assessment: 'A', language: 'L', template: { id: 't', version: '1', perspective: 'Community' },
  items: [
    { id: 'q1', type: 'single', text: 'First question', options: [{ code: 'a', text: 'Alpha' }, { code: 'b', text: 'Beta' }] },
    { id: 'q2', type: 'multi', text: 'Second question', options: [{ code: 'x', text: 'Ex' }, { code: 'y', text: 'Why' }, { code: 'other', text: 'Other (please describe)' }] },
    { id: 'q3', type: 'text', text: 'Third question' },
  ],
  languages: [{ code: 'kn', name: 'Kannada', endonym: 'ಕನ್ನಡ', dir: 'ltr' }, { code: 'or', name: 'Odia', endonym: 'ଓଡ଼ିଆ', dir: 'ltr' }],
  demographics_enabled: true,
  context_fields: [
    { key: 'age', label: 'Age range', options: [{ code: '18-29', label: '18–29' }, { code: '30-49', label: '30–49' }] },
    { key: 'gender', label: 'Gender', options: [{ code: 'f', label: 'Female' }, { code: 'm', label: 'Male' }] },
  ],
};
const settle = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };
let run = 0;
async function openPage({ search = '', translate }) {
  const dom = new JSDOM(html, { url: `https://x.test/participate/${search}` });
  const { window } = dom, ns = await digestNamespace('ptok');
  window.sessionStorage.setItem('shared:current', ns); window.sessionStorage.setItem(ns + 'bearer', 'ptok');
  const posted = [];
  const ok = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
  const fetch = async (url, opts = {}) => {
    if (url === '/v2/translate') return translate(JSON.parse(opts.body));
    if (url.endsWith('/receipt')) return ok({ submitted: false });
    if (url.endsWith('/form')) return ok(form);
    if (url.endsWith('/responses')) { posted.push(JSON.parse(opts.body)); return ok({ submitted: true, response_id: 'resp_ab12cd34ef', submitted_at: '2026-09-30T02:00:00Z' }); }
    throw new Error(`unmapped ${url}`);
  };
  Object.assign(globalThis, { window, document: window.document, location: window.location, sessionStorage: window.sessionStorage, localStorage: window.localStorage, FormData: window.FormData, fetch });
  await import(`./page.js?run=${++run}`);
  await settle();
  const $ = id => window.document.getElementById(id), q = s => window.document.querySelector(s);
  return { window, $, q, posted, ns };
}
// Answer every question and both About-you fields, the way a participant would (input/change events), ending on question 3.
function answerAll({ $, q, window }) {
  const fire = (el, type) => el.dispatchEvent(new window.Event(type, { bubbles: true }));
  const pick = (name, value) => { const s = q(`select[name="about-${name}"]`); s.value = value; fire(s, 'change'); };
  pick('age', '30-49'); pick('gender', 'f');
  q('.participant-start').click();
  const r = q('input[name="q1"][value="a"]'); r.checked = true; fire(r, 'input'); fire(r, 'change');
  for (const v of ['x', 'other']) { const c = q(`input[name="q2"][value="${v}"]`); c.checked = true; fire(c, 'input'); fire(c, 'change'); }
  const other = q('[data-other-for="q2"]'); other.value = 'a text note'; fire(other, 'input');
  const t = q('textarea[name="q3"]'); t.value = 'my answer'; fire(t, 'input');
  const next = [...window.document.querySelectorAll('.participant-page-actions button')].find(b => /Next/.test(b.textContent));
  next.click(); next.click();
}
function assertKept({ q, window, ns }, label) {
  assert.equal(q('input[name="q1"][value="a"]').checked, true, `${label}: q1`);
  assert.deepEqual([...window.document.querySelectorAll('input[name="q2"]:checked')].map(i => i.value), ['x', 'other'], `${label}: q2`);
  assert.equal(q('[data-other-for="q2"]').value, 'a text note', `${label}: Other text`);
  assert.equal(q('textarea[name="q3"]').value, 'my answer', `${label}: q3`);
  assert.equal(q('select[name="about-age"]').value, '30-49', `${label}: age`);
  assert.equal(q('select[name="about-gender"]').value, 'f', `${label}: gender`);
  assert.equal(q('fieldset[data-item="q3"]').hidden, false, `${label}: still on question 3`);
  const draft = JSON.parse(window.sessionStorage.getItem(ns + 'draft'));
  assert.equal(draft.answers.q1, 'a', `${label}: saved draft keeps q1`); assert.equal(draft.answers.q3, 'my answer', `${label}: saved draft keeps q3`);
}
async function submit({ $, q, posted }) {
  $('review-button').click(); await settle();
  $('submit').click(); await settle();
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0].context, { age: '30-49', gender: 'f' }, 'the submit carries the About-you context');
  assert.equal(posted[0].answers.q1, 'a'); assert.deepEqual(posted[0].answers.q2, ['x', 'other']); assert.equal(posted[0].answers.q3, 'my answer');
}
const tagged = lang => body => ({ ok: true, status: 200, json: async () => ({ translated: Object.fromEntries(Object.entries(body.sourceTexts).map(([k, v]) => [k, `[${lang}] ${v}`])), partial: false }) });

test('switching the language mid-survey keeps every answer, the Other text and About-you; submit carries the context', async () => {
  const p = await openPage({ translate: body => tagged(body.targetLang)(body) });
  answerAll(p);
  const select = p.q('#participant-lang'); select.value = 'kn'; select.dispatchEvent(new p.window.Event('change')); await settle();
  assert.match(p.q('fieldset[data-item="q3"] legend').textContent, /^\[kn\] Third question/, 'the redraw happened (translated)');
  assertKept(p, 'after English → Kannada');
  select.value = 'or'; select.dispatchEvent(new p.window.Event('change')); await settle();
  assertKept(p, 'after Kannada → Odia');
  await submit(p);
});

test('a ?lang= translation that lands while the participant is answering keeps every answer and About-you', async () => {
  let release; const late = new Promise(r => { release = r; });
  const p = await openPage({ search: '?lang=kn', translate: async body => { await late; return tagged('kn')(body); } });
  answerAll(p);
  release(); await settle();
  assert.match(p.q('fieldset[data-item="q1"] legend').textContent, /^\[kn\] /, 'the late translation landed and redrew the form');
  assertKept(p, 'after the late ?lang landing');
  await submit(p);
});

test('a failed translation (and Try again) keeps every answer and About-you', async () => {
  let fail = true, release; const late = new Promise(r => { release = r; });
  const p = await openPage({ search: '?lang=or', translate: async body => { await late; return fail ? { ok: false, status: 502, json: async () => ({}) } : tagged('or')(body); } });
  answerAll(p);
  release(); await settle(40); // the failure lands while the participant is on question 3
  assert.equal(p.q('.participant-translating').classList.contains('failed'), true, 'the failure card shows');
  assertKept(p, 'after a failed translation');
  fail = false; p.q('.tr-retry').click(); await settle(40);
  assert.match(p.q('fieldset[data-item="q1"] legend').textContent, /^\[or\] /);
  assertKept(p, 'after Try again');
  await submit(p);
});
