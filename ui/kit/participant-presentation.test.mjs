// K4 participant presentation: the frozen kit paints around the REAL participant page, controller and shared-link client.
// Part 1 checks the builders keep the form contract byte-for-byte in meaning (names, types, required, native validation).
// Part 2 runs the actual ui/participate/index.html + page.js in jsdom against a synthetic, fail-closed transport and walks
// intro → question → Next/Back → review → Change → submit → receipt through the real controller. No real network, no storage
// beyond jsdom's own sessionStorage, and nothing private leaves the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { adoptKit, field, intro, itemChips, pager, receipt, reviewRow, STYLESHEETS } from './views-participant.js';

const doc = () => new JSDOM('<!doctype html><html><head></head><body><main id="participant"></main></body></html>').window.document;
const items = [
  { id: 'q1', type: 'scale', text: 'How clear was it?', scale: { min: 1, max: 5 } },
  { id: 'q2', type: 'single', text: 'Which fits?', options: [{ code: 'a', label: 'A' }, { code: 'b', label: 'B' }] },
  { id: 'q3', type: 'multi', text: 'Problems?', required: false, requiredness: 'unresolved', answer_semantics: 'unresolved_no_problems_vs_skipped', options: [{ code: 'x', label: 'X' }, { code: 'none', label: 'No problems', exclusive: true }] },
  { id: 'q4', type: 'text', text: 'Anything else?', required: false },
  { id: 'q5', type: 'mystery', text: 'Unsupported' },
];

test('field(): names, control types, required flags and scale bounds are the existing form contract', () => {
  const d = doc();
  const f = items.map(item => field(d, item));
  assert.deepEqual(f.map(x => x.dataset.item), ['q1', 'q2', 'q3', 'q4', 'q5']);
  const q1 = f[0].querySelector('input'); assert.equal(q1.type, 'number'); assert.equal(q1.name, 'q1'); assert.equal(q1.required, true); assert.equal(q1.min, '1'); assert.equal(q1.max, '5'); assert.equal(q1.step, '1');
  const q2 = [...f[1].querySelectorAll('input')]; assert.deepEqual(q2.map(i => [i.type, i.name, i.value, i.required]), [['radio', 'q2', 'a', true], ['radio', 'q2', 'b', true]]);
  const q3 = [...f[2].querySelectorAll('input')]; assert.deepEqual(q3.map(i => [i.type, i.name, i.value, i.required]), [['checkbox', 'q3', 'x', false], ['checkbox', 'q3', 'none', false]]);
  assert.ok(q3[1].closest('label').className.includes('flag-exclusion'));
  assert.match(f[2].textContent, /unknown answer/); assert.match(f[2].textContent, /cannot be combined/); assert.match(f[2].textContent, /policy held/);
  const q4 = f[3].querySelector('textarea'); assert.equal(q4.name, 'q4'); assert.equal(q4.required, false); assert.match(f[3].textContent, /Optional/);
  assert.equal(f[4].querySelector('input,textarea'), null); assert.match(f[4].textContent, /unsupported question/);
  for (const x of f) assert.equal(x.querySelector('legend').textContent, x === f[4] ? 'Unsupported' : items[f.indexOf(x)].text);
  assert.equal(itemChips(d, items[0]), null);
});

test('intro/pager/receipt/reviewRow paint only what the model or controller carries', () => {
  const d = doc();
  let began = 0;
  const { section, begin } = intro(d, { items, assessment: 'Assessment A', language: 'test', template: { perspective: 'Community', source_ref: 'repo@abc1234' } }, () => began++);
  assert.equal(section.className, 'participant-intro'); assert.equal(section.querySelector('.eyebrow').textContent, 'Assessment A · test · Community');
  assert.match(section.textContent, /5 questions/); assert.match(section.textContent, /repo@abc1234/);
  assert.equal(begin.type, 'button'); begin.click(); assert.equal(began, 1);
  const p = pager(d, 3, { label: 'Community' }); p.paint(1); assert.equal(p.progress.textContent, 'Question 2 of 3 · Community'); const p0 = pager(d, 3, {}); p0.paint(1); assert.equal(p.controls.parentNode, null, 'caller places Back/Next');
  assert.equal(p0.progress.textContent, 'Question 2 of 3'); assert.deepEqual([...p.bar.children].map(s => s.className), ['done', 'done', '']);
  assert.equal(p.back.disabled, false); assert.equal(p.next.hidden, false); p.paint(2); assert.equal(p.next.hidden, true); p.paint(0); assert.equal(p.back.disabled, true);
  const r = receipt(d, { response_id: 'r-1', submitted_at: '2026-09-22T00:00:00Z' }); assert.match(r.textContent, /Thank you\./); assert.match(r.textContent, /r-1 · 2026-09-22T00:00:00Z/);
  const missing = receipt(d, {}); assert.match(missing.textContent, /ID unavailable · time unavailable/);
  const practice = receipt(d, { response_id: 'x' }, { demo: true }); assert.match(practice.textContent, /nothing sent/);
  assert.equal(reviewRow(d, items[3], '').querySelector('strong').textContent, '(left blank)');
  assert.equal(reviewRow(d, items[0], '4').querySelector('strong').textContent, '4');
  const main = d.getElementById('participant'); adoptKit(d, main); adoptKit(d, main);
  assert.deepEqual([...d.head.querySelectorAll('link')].map(l => l.getAttribute('href')), [...STYLESHEETS]);
  assert.equal(main.className, 'rv participant-kit');
});

// ── Part 2: the real page, controller and client ─────────────────────────────────────────────────────────────────────────
const html = readFileSync(new URL('../participate/index.html', import.meta.url), 'utf8');
const ok = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
const form = { assessment: 'Assessment A', language: 'test', period: '2026-09', template: { id: 'tpl', version: 1, perspective: 'Community', source_ref: 'instrument@c653482' }, items: items.slice(0, 4) };

test('real participant entry: intro → paged questions → review → Change → submit once → genuine receipt, fail-closed transport', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost/participate/#survey=tok-123', pretendToBeVisual: true });
  const { window } = dom;
  const requests = [];
  let submitted = null;
  window.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', headers: options.headers, body: options.body, credentials: options.credentials });
    if (!String(url).startsWith('/v2/participate/')) throw new Error(`unexpected request ${url}`); // fail closed: nothing but the participant API
    if (url === '/v2/participate/link') return ok({ participant_token: 'ptoken-synthetic' });
    if (url === '/v2/participate/form') return ok(form);
    if (url === '/v2/participate/receipt') return submitted ? ok({ submitted: true, ...submitted }) : ok({ submitted: false });
    if (url === '/v2/participate/responses') { const body = JSON.parse(options.body); submitted = { response_id: 'resp-synthetic-1', submitted_at: '2026-09-22T15:40:00Z', idempotency_key: body.idempotency_key, answers: body.answers }; return ok(submitted); }
    throw new Error(`unrouted ${url}`);
  };
  for (const k of ['window', 'document', 'location', 'history', 'sessionStorage', 'FormData', 'HTMLElement', 'Node']) globalThis[k] = window[k] ?? window;
  globalThis.window = window; globalThis.fetch = window.fetch; // shared-link.js defaults fetchImpl to globalThis.fetch
  await import('../participate/page.js');
  const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 0)); };
  await settle();
  const $ = id => window.document.getElementById(id);
  const main = $('participant');
  assert.ok(main.classList.contains('rv'), 'kit scope on main');
  assert.deepEqual([...window.document.head.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href')), ['/participate/page.css', ...STYLESHEETS]);
  // Real controller opened the link (token in body only, credentials omitted) then loaded the form.
  assert.deepEqual(requests.map(r => [r.method, r.url]), [['POST', '/v2/participate/link'], ['GET', '/v2/participate/receipt'], ['GET', '/v2/participate/form']]);
  assert.equal(requests[0].credentials, 'omit'); assert.equal(JSON.parse(requests[0].body).token, 'tok-123'); assert.equal(window.location.hash, '', 'fragment stripped');
  assert.equal(requests[2].headers.authorization, 'Bearer ptoken-synthetic');
  // Intro from the kit, real fields hidden behind it, Review submit hidden by the existing page rule.
  const introEl = main.querySelector('.participant-intro'); assert.equal(introEl.hidden, false);
  assert.equal(introEl.querySelector('.eyebrow').textContent, 'Assessment A · test · 2026-09 · Community');
  const fields = [...$('questions').querySelectorAll('fieldset')]; assert.equal(fields.length, 4); assert.ok(fields.every(f => f.hidden));
  const controls = $('questions').querySelector('.participant-page-actions'); assert.equal(controls.hidden, true, 'Back/Next hidden on intro');
  introEl.querySelector('button').click();
  assert.equal(controls.hidden, false); assert.equal($('review-button').hidden, true, 'Review only on the last question');
  assert.deepEqual(fields.map(f => f.hidden), [false, true, true, true]);
  const nav = main.querySelector('.participant-pager'); assert.equal(nav.hidden, false); assert.equal(nav.querySelector('.participant-progress').textContent, 'Question 1 of 4 · Community');
  const [back, next] = $('questions').querySelectorAll('.participant-page-actions button'); assert.equal(back.disabled, true);
  // Required scale left blank: Next stays on the page and says why; no controller call.
  next.click(); assert.deepEqual(fields.map(f => f.hidden), [false, true, true, true]); assert.equal(main.querySelector('.participant-page-error').hidden, false);
  const q1 = fields[0].querySelector('input'); q1.value = '4'; q1.dispatchEvent(new window.Event('input', { bubbles: true }));
  // Draft saved by the real controller into this link's namespace only.
  const draftKeys = Object.keys(window.sessionStorage).filter(k => k.endsWith('draft')); assert.equal(draftKeys.length, 1); assert.match(draftKeys[0], /^shared:[0-9a-f]{64}:draft$/);
  assert.equal(JSON.parse(window.sessionStorage.getItem(draftKeys[0])).answers.q1, 4);
  next.click(); assert.deepEqual(fields.map(f => f.hidden), [true, false, true, true]);
  fields[1].querySelector('input[value=b]').click(); next.click(); assert.deepEqual(fields.map(f => f.hidden), [true, true, false, true]);
  // Exclusive + another choice: Next refuses with the existing message.
  const [x, none] = fields[2].querySelectorAll('input'); x.click(); none.click(); next.click();
  assert.deepEqual(fields.map(f => f.hidden), [true, true, false, true]); assert.match(main.querySelector('.participant-page-error').textContent, /cannot be combined/);
  x.click(); next.click(); assert.deepEqual(fields.map(f => f.hidden), [true, true, true, false]); assert.equal(next.hidden, true); assert.equal($('review-button').hidden, false);
  back.click(); assert.deepEqual(fields.map(f => f.hidden), [true, true, false, true]); assert.equal(fields[2].querySelector('input[value=none]').checked, true, 'Back keeps answers');
  next.click();
  // Review via the existing submit path: real page handler → journey.review(validated answers).
  $('review-button').click(); await settle();
  assert.equal($('review').hidden, false); assert.equal($('answers').hidden, true); assert.equal(controls.hidden, true);
  const rows = [...$('review-answers').children]; assert.equal(rows.length, 4); assert.ok(rows.every(r => r.classList.contains('participant-review-row')));
  assert.equal(rows[0].querySelector('strong').textContent, '4'); assert.equal(rows[3].querySelector('strong').textContent, 'Not answered (unknown)', 'existing reviewAnswer wording preserved');
  assert.equal(rows[0].querySelector('button.participant-change').textContent, 'Change');
  rows[0].querySelector('button.participant-change').click(); await settle();
  assert.equal($('answers').hidden, false); assert.deepEqual(fields.map(f => f.hidden), [false, true, true, true]); assert.equal(q1.value, '4', 'Change keeps the answer');
  q1.value = '5'; q1.dispatchEvent(new window.Event('input', { bubbles: true }));
  $('review-button').click(); await settle(); assert.equal([...$('review-answers').children][0].querySelector('strong').textContent, '5');
  assert.equal(requests.length, 3, 'no transport during paging/review');
  // Submit once: the real client sends the validated answers with its idempotency key; the receipt is the server's.
  $('submit').click(); await settle();
  const post = requests.find(r => r.url === '/v2/participate/responses'); assert.ok(post); assert.equal(requests.filter(r => r.url === '/v2/participate/responses').length, 1);
  const body = JSON.parse(post.body); assert.deepEqual(body.answers, { q1: 5, q2: 'b', q3: ['none'], q4: null }); assert.match(body.idempotency_key, /^[0-9a-f-]{36}$/);
  assert.equal($('receipt').hidden, false); assert.match($('receipt').textContent, /Thank you\./); assert.match($('receipt').textContent, /resp-synthetic-1 · 2026-09-22T15:40:00Z/);
  assert.equal($('review').hidden, true); assert.equal($('recover').hidden, true);
  assert.equal(window.sessionStorage.getItem(draftKeys[0]), null, 'draft cleared after genuine receipt');
  // Nothing private in the page chrome: the participant token never appears in the DOM.
  assert.equal(window.document.documentElement.outerHTML.includes('ptoken-synthetic'), false);
  assert.ok(requests.every(r => String(r.url).startsWith('/v2/participate/')), 'only the participant API was reached');
});

// ── Part 3: controller states around the kit — busy, uncertain, closed, resume, demo ────────────────────────────────────
// Each scenario boots a fresh page instance (`?s=` busts the ESM cache) against its own jsdom + fail-closed transport.
let scenario = 0;
async function boot({ hash = '#survey=tok-123', search = '', seed = {}, route }) {
  const dom = new JSDOM(html, { url: `http://localhost/participate/${search}${hash}`, pretendToBeVisual: true });
  const { window } = dom;
  const requests = [];
  window.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', body: options.body });
    if (!String(url).startsWith('/v2/participate/')) throw new Error(`unexpected request ${url}`);
    return route(url, options, requests);
  };
  for (const k of ['window', 'document', 'location', 'history', 'sessionStorage', 'FormData', 'HTMLElement', 'Node']) globalThis[k] = window[k] ?? window;
  globalThis.window = window; globalThis.fetch = window.fetch;
  for (const [k, v] of Object.entries(seed)) window.sessionStorage.setItem(k, v);
  await import(`../participate/page.js?s=${++scenario}`);
  const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 0)); };
  await settle();
  const $ = id => window.document.getElementById(id);
  return { window, requests, settle, $, main: $('participant') };
}
const namespaceOf = async token => `shared:${[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(b => b.toString(16).padStart(2, '0')).join('')}:`;
const answerAll = async (h) => {
  const { $, settle } = h; const fields = [...$('questions').querySelectorAll('fieldset')];
  h.main.querySelector('.participant-intro button').click();
  const next = $('questions').querySelector('.participant-page-actions button.primary');
  const q1 = fields[0].querySelector('input'); q1.value = '3'; q1.dispatchEvent(new h.window.Event('input', { bubbles: true })); next.click();
  fields[1].querySelector('input[value=a]').click(); next.click(); next.click();
  $('review-button').click(); await settle();
  return fields;
};

test('busy submit with unknown outcome: inputs and independently disabled controls survive; uncertain notice is a warning; no automatic retry', async () => {
  let release; const pending = new Promise(r => { release = r; });
  const h = await boot({ route: async url => {
    if (url === '/v2/participate/link') return ok({ participant_token: 'p1' });
    if (url === '/v2/participate/form') return ok(form);
    if (url === '/v2/participate/receipt') return ok({ submitted: false });
    if (url === '/v2/participate/responses') { await pending; const e = new Error('network'); throw e; } // fetch rejection → status 0 → uncertain
  } });
  const { $, settle, main } = h;
  const fields = await answerAll(h);
  assert.equal($('review').hidden, false);
  $('submit').click(); await settle();
  const buttons = [...main.querySelectorAll('button')].filter(b => b.id !== 'version');
  assert.ok(buttons.every(b => b.disabled), 'every participant control disabled while busy');
  assert.equal(fields[0].querySelector('input').value, '3', 'field value kept while busy');
  release(); await settle(); await settle();
  assert.equal($('review').hidden, false, 'still on review after an uncertain outcome');
  assert.equal($('notice').className, 'note warning'); assert.match($('notice').getAttribute('style'), /warning-fill/); assert.match($('notice').textContent, /could not confirm whether your answers arrived/);
  assert.equal($('submit').disabled, false); assert.equal($('edit').disabled, false);
  const back = $('questions').querySelector('.participant-page-actions button.quiet');
  assert.equal(back.disabled, false, 'Back re-enabled for its own reason (not index 0) — restored to its pre-busy state');
  assert.equal(h.requests.filter(r => r.url === '/v2/participate/responses').length, 1, 'no automatic retry');
  // Edit keeps the answers; Back at question 1 is disabled on its own, and stays so after another busy cycle.
  $('edit').click(); await settle(); assert.equal(fields[0].querySelector('input').value, '3');
  assert.deepEqual(fields.map(f => f.hidden), [true, true, true, false], 'Edit returns to where paging left off');
  back.click(); back.click(); back.click(); assert.deepEqual(fields.map(f => f.hidden), [false, true, true, true]); assert.equal(back.disabled, true);
  $('recover').click(); await settle(); await settle();
  assert.equal(back.disabled, true, 'independently disabled control not re-enabled by busy restore');
  assert.equal($('notice').className, 'note warning', 'uncertain state persists through recover with no receipt');
});

test('closed collection on entry: distinct unavailable state, warning notice, no form, no submission', async () => {
  const h = await boot({ route: async url => {
    if (url === '/v2/participate/link') return { ok: false, status: 409, json: async () => ({ ok: false, error: { code: 'STAGE_CONFLICT', message: 'closed' } }) }; // conflict before any session → closed
    throw new Error(`nothing else may be requested when closed: ${url}`);
  } });
  const { $, main } = h;
  assert.equal($('answers').hidden, true); assert.equal($('review').hidden, true); assert.equal($('receipt').hidden, true);
  assert.equal(main.querySelector('.participant-intro'), null, 'no form was loaded, so nothing was mounted');
  assert.equal($('notice').className, 'note warning'); assert.match($('notice').textContent, /Collection has closed/);
  assert.equal(h.requests.some(r => r.url === '/v2/participate/responses'), false);
});

test('rate limit on entry keeps its own wording; a later successful reopen is not attempted automatically', async () => {
  const h = await boot({ route: async url => {
    if (url === '/v2/participate/link') return { ok: false, status: 429, json: async () => ({ ok: false, error: { code: 'RATE_LIMITED', message: 'slow down' } }) };
  } });
  assert.match(h.$('notice').textContent, /Too many requests/); assert.equal(h.$('notice').className, 'note warning');
  assert.equal(h.requests.length, 1);
});

test('same-tab reload resumes this link only: draft restored into the real fields, kit jumps to the first question', async () => {
  const ns = await namespaceOf('tok-resume');
  const h = await boot({ hash: '', seed: { 'shared:current': ns, [`${ns}bearer`]: 'p3', [`${ns}draft`]: JSON.stringify({ template: { id: 'tpl', version: 1 }, answers: { q1: 2, q2: 'b', q3: ['x'], q4: 'hello' } }) },
    route: async url => {
      if (url === '/v2/participate/receipt') return ok({ submitted: false });
      if (url === '/v2/participate/form') return ok(form);
      throw new Error(`no link open expected: ${url}`);
    } });
  const { $, main } = h;
  assert.equal(h.requests.some(r => r.url === '/v2/participate/link'), false, 'no re-open without a fragment');
  assert.match($('notice').textContent, /unsent answers were restored/); assert.equal($('notice').className, 'note'); assert.equal($('notice').getAttribute('style'), null);
  const fields = [...$('questions').querySelectorAll('fieldset')];
  assert.equal(fields[0].querySelector('input').value, '2'); assert.equal(fields[1].querySelector('input[value=b]').checked, true);
  assert.equal(fields[2].querySelector('input[value=x]').checked, true); assert.equal(fields[3].querySelector('textarea').value, 'hello');
  assert.equal(main.querySelector('.participant-intro').hidden, true, 'a restored draft skips the intro');
  assert.deepEqual(fields.map(f => f.hidden), [false, true, true, true]);
  assert.equal(main.querySelector('.participant-progress').textContent, 'Question 1 of 4 · Community');
});

test('a mismatched draft is not restored and says so; nothing from another version is shown', async () => {
  const ns = await namespaceOf('tok-mismatch');
  const h = await boot({ hash: '', seed: { 'shared:current': ns, [`${ns}bearer`]: 'p4', [`${ns}draft`]: JSON.stringify({ template: { id: 'tpl', version: 99 }, answers: { q1: 5 } }) },
    route: async url => url === '/v2/participate/receipt' ? ok({ submitted: false }) : url === '/v2/participate/form' ? ok(form) : (() => { throw new Error(url); })() });
  assert.match(h.$('notice').textContent, /different version/); assert.equal(h.$('notice').className, 'note warning');
  assert.equal(h.$('questions').querySelector('fieldset input').value, '');
  assert.equal(h.main.querySelector('.participant-intro').hidden, false);
  assert.equal(h.window.sessionStorage.getItem(`${ns}draft`), null);
});

test('demo entry never touches transport or sessionStorage and ends in the practice receipt', async () => {
  const h = await boot({ search: '?demo=1', hash: '#survey=practice', route: async url => { throw new Error(`real transport used in demo: ${url}`); } });
  const { $, main, settle } = h;
  assert.equal(h.requests.length, 0);
  assert.match(main.querySelector('h1').textContent, /Practice survey/);
  assert.equal(main.querySelector('.participant-intro').hidden, false);
  main.querySelector('.participant-intro button').click();
  const fields = [...$('questions').querySelectorAll('fieldset')]; assert.ok(fields.length > 0);
  const next = $('questions').querySelector('.participant-page-actions button.primary');
  for (const f of fields) { for (const input of f.querySelectorAll('input,textarea')) { if (input.type === 'radio' || input.type === 'checkbox') { if (!f.querySelector('input:checked')) input.click(); } else { input.value = input.type === 'number' ? input.min || '1' : 'practice'; input.dispatchEvent(new h.window.Event('input', { bubbles: true })); } } if (!next.hidden) next.click(); }
  $('review-button').click(); await settle();
  assert.equal($('review').hidden, false);
  $('submit').click(); await settle(); await settle();
  assert.equal($('receipt').hidden, false); assert.match($('receipt').textContent, /Practice complete — nothing sent/);
  assert.match($('notice').textContent, /Practice only/);
  assert.equal(h.requests.length, 0, 'no real request at any point');
  assert.equal(h.window.sessionStorage.length, 0, 'demo writes nothing to sessionStorage');
});

test('destroy on form replacement removes stale pager callbacks and restores hidden state', async () => {
  const d = doc();
  const { mountParticipantView } = await import('../participant-view.js');
  const formEl = d.createElement('form'); const questions = d.createElement('div'); const reviewBtn = d.createElement('button'); reviewBtn.type = 'submit';
  const model = { items: items.slice(0, 2) }; for (const item of model.items) questions.append(field(d, item)); formEl.append(questions, reviewBtn); d.body.append(formEl);
  const root = d.getElementById('participant');
  let edits = 0;
  const view = mountParticipantView({ doc: d, root, form: formEl, questions, review: d.createElement('section'), reviewAnswers: d.createElement('div'), receipt: d.createElement('section'), model, onEdit: () => edits++, reviewButton: reviewBtn });
  view.showForm(1); assert.equal(reviewBtn.hidden, false); view.showForm(0); assert.equal(reviewBtn.hidden, true);
  const next = questions.querySelector('.participant-page-actions button.primary');
  view.destroy();
  assert.equal(root.children.length, 0); assert.equal(questions.querySelector('.participant-page-actions'), null);
  assert.equal(reviewBtn.hidden, false, 'review button restored'); assert.ok([...questions.children].every(f => !f.hidden), 'fields restored');
  next.click(); assert.ok([...questions.children].every(f => !f.hidden), 'stale Next does nothing after destroy');
  reviewBtn.click(); assert.ok([...questions.children].every(f => !f.hidden));
  view.destroy(); // idempotent
});
