// node --test ui/s21-gate-participant.test.mjs — persona release gate on DEV 0.23.0, phone 375x812 (participant fixes).
// A: a refused access code shows its error in the card next to the field, announced, with focus kept on the input.
// B: the on-screen paper preview on a survey page scrolls sideways / fits instead of being clipped; print CSS unchanged.
// D: an access-code participant's thank-you never promises "reopen your link" or "the same link" — a code works once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pages, CODE_REFUSED } from './assess/scope.js';
import * as cards from './assess/cards.js';
import { copy, receiptNotice, digestNamespace, scopedStorage } from './shared-link.js';
import { createParticipantJourney } from './participate/controller.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const err = (code, message = 'nope') => Object.assign(new Error(message), { code, status: Number(code) || 400 });

// ---------- A: access-code error placement, announcement and focus ----------
async function surveyPage(answer) {
  const dom = new JSDOM('<!doctype html><body><main id="rv"></main><p id="note" role="status" aria-live="polite"></p></body>');
  const { document } = dom.window, notes = [];
  const ctx = { api: async () => { if (answer instanceof Error) throw answer; return answer; }, esc: cards.esc, enc: cards.enc, routes: cards.routes, cards, state: { principal: null }, go: () => {}, note: (m, a) => notes.push({ m, a }) };
  const model = await pages.entry.load(ctx, { intent: 'survey' });
  const root = document.getElementById('rv');
  root.innerHTML = pages.entry.render(ctx, model); pages.entry.bind(ctx, root, model);
  const form = root.querySelector('#code-form'), input = form.querySelector('input[name=code]'), submit = form.querySelector('button[type=submit]');
  const send = async code => {
    input.value = code; input.dispatchEvent(new dom.window.Event('input'));
    submit.focus(); // the tap
    form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    for (let i = 0; i < 5; i++) await tick();
  };
  return { document, root, form, input, submit, notes, send };
}

test('A: a refused code shows its error inside the card, right under the field, as role=alert; focus stays on the input', async () => {
  const p = await surveyPage(err('NOT_FOUND_OR_NOT_VISIBLE', 'access code not found or not visible'));
  const box = p.form.querySelector('#code-error');
  assert.ok(box, 'the error element is rendered with the form');
  assert.equal(box.getAttribute('role'), 'alert', 'announced by screen readers when its text is set');
  assert.equal(box.textContent, '', 'empty before any submit');
  await p.send('ZZZZ-ZZZZ');
  assert.equal(box.textContent, CODE_REFUSED);
  assert.ok(p.form.closest('.panel').contains(box), 'inside the card, not the page note below it');
  assert.equal(box.previousElementSibling, p.input.closest('label.field'), 'directly under the access code field');
  assert.equal(p.input.getAttribute('aria-describedby'), 'code-error');
  assert.equal(p.input.getAttribute('aria-invalid'), 'true');
  assert.equal(p.document.activeElement, p.input, 'focus returns to the input, never drops to BODY');
  assert.equal(p.notes.filter(n => n.a).length, 0, 'the page note below the fold stays empty');
  assert.equal(p.submit.disabled, true, 'the same code is still held (unchanged behaviour)');
  // A changed code clears the old error before the next try.
  await p.send('ZZZZ-ZZZY');
  assert.equal(box.textContent, CODE_REFUSED, 'a second refusal shows again');
});

test('A: the card error collapses when empty and has its own visible style', () => {
  const css = readFileSync(new URL('./assess/scope.js', import.meta.url), 'utf8');
  assert.match(css, /\.code-error\{[^}]*color:#8a2a1c[^}]*\}\.code-error:empty\{margin:0;padding:0\}/);
});

test('A: a server answer without a participant token is reported in the card too', async () => {
  const p = await surveyPage({});
  await p.send('ABCD-EFGH');
  assert.equal(p.form.querySelector('#code-error').textContent, 'The server accepted the code but returned no participant token.');
  assert.equal(p.document.activeElement, p.input);
});

test('A + D: an accepted code opens /participate/ with the bearer and marks the session as a code session', async () => {
  const stored = {}, assigned = [], prev = { window: globalThis.window, sessionStorage: globalThis.sessionStorage };
  globalThis.sessionStorage = { setItem: (k, v) => { stored[k] = v; }, getItem: k => stored[k] ?? null, removeItem: k => { delete stored[k]; } };
  globalThis.window = { location: { assign: u => assigned.push(u) } };
  try {
    const p = await surveyPage({ participant_token: 'ptok' });
    await p.send('ABCD-EFGH');
    for (let i = 0; i < 5; i++) await tick();
    assert.deepEqual(assigned, ['/participate/']);
    const slot = scopedStorage(globalThis.sessionStorage, await digestNamespace('ptok'));
    assert.equal(slot.get('bearer'), 'ptok');
    assert.equal(slot.get('via'), 'code');
    assert.equal(p.form.querySelector('#code-error').textContent, '');
  } finally { globalThis.window = prev.window; globalThis.sessionStorage = prev.sessionStorage; }
});

// ---------- B: paper preview on a 375 px screen; print CSS unchanged ----------
const sheet = new JSDOM(`<style>${readFileSync(new URL('./stage-screens.css', import.meta.url), 'utf8')}</style>`).window.document.styleSheets[0];
function flat(rules, media = '') { return [...rules].flatMap(r => r.media ? flat(r.cssRules, r.media.mediaText) : [{ media, sel: r.selectorText || '', css: r.cssText, style: r.style }]); }
const rules = flat(sheet.cssRules);
const phone = media => media === 'screen' || /^screen and \(max-width: ?(\d+)px\)$/.test(media) && Number(media.match(/(\d+)px/)[1]) >= 375;

test('B: at 375 px the preview panel can shrink to its column and the preview scrolls sideways; the paper margins shrink to fit', () => {
  const panel = rules.find(r => r.sel === '#print-panel');
  assert.ok(panel && phone(panel.media), 'screen rule for the Paper panel');
  assert.equal(panel.style.getPropertyValue('min-width'), '0px', 'a grid item that may shrink below its content (the preview no longer widens the column)');
  const root = rules.find(r => r.sel === '#print-root');
  assert.ok(root && phone(root.media), 'screen rule for the preview box');
  assert.equal(root.style.getPropertyValue('overflow-x'), 'auto', 'anything still wider scrolls inside the preview instead of being clipped by .rv');
  assert.equal(root.style.getPropertyValue('max-width'), '100%');
  const paper = rules.find(r => r.sel === '#print-root .paper' && r.media.includes('max-width'));
  assert.ok(paper && phone(paper.media), 'phone-width screen rule for the preview paper');
  assert.equal(paper.style.getPropertyValue('padding'), '16px 12px');
});

test('B: print output is unchanged — the new rules are screen-only and the print rules are exactly as before', () => {
  for (const r of rules.filter(r => /#print-(root|panel)/.test(r.sel))) assert.match(r.media, /^screen\b/, `${r.sel} applies on screen only`);
  assert.deepEqual(rules.filter(r => r.media === 'print').map(r => r.css), [
    'html,body { background: rgb(255, 255, 255); }',
    '.no-print,#toasts,#layer { display: none !important; }',
    '.paper { margin: 0px; padding: 6mm 4mm; box-shadow: none; width: auto; min-height: 0px; }',
    '.p-page::after { content: "Page " counter(page); }',
    'body:has(> .stage-print-only) > :not(.stage-print-only) { display: none !important; }',
    'body > .stage-print-only { display: block !important; }',
    'body:has(> .stage-print-only) { display: block !important; overflow: visible !important; min-height: 0px !important; }',
  ]);
});

// ---------- D: thank-you copy for access-code participants ----------
test('D: the code thank-you names the group, says a code works once, and never promises reopening a link', () => {
  for (const notice of [receiptNotice('Community', { code: true }), receiptNotice('', { code: true })]) {
    assert.doesNotMatch(notice, /Reopening your link|same link/);
    assert.match(notice, /An access code works only once/);
  }
  assert.equal(receiptNotice('Community', { code: true }), `Thank you. Your answers stay with the team, grouped with others from the Community perspective. ${copy.codeOnce}`);
  assert.equal(receiptNotice(undefined, { code: true }), `${copy.receiptThanksCodeNoGroup} ${copy.codeOnce}`);
  assert.equal(receiptNotice('Community'), `${copy.receiptThanks.replace('{perspective}', 'Community')} ${copy.sameLinkOthers}`, 'the shared-link thank-you is unchanged');
});

const form = { assessment: 'A', language: 'L', template: { id: 't', version: '1', perspective: 'Community' }, items: [{ id: 'q', type: 'text' }] };
async function journeyAfterSubmit(extra) {
  const ns = await digestNamespace('ptok'), data = new Map(Object.entries({ 'shared:current': ns, [ns + 'bearer']: 'ptok', ...extra(ns) }));
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const ok = result => ({ ok: true, status: 200, json: async () => ({ ok: true, result }) });
  const win = { location: { hash: '', pathname: '/participate/', search: '' }, history: { replaceState() {} } };
  const journey = createParticipantJourney({ window: win, storage, fetchImpl: async url => url.endsWith('/receipt') ? ok({ submitted: false }) : url.endsWith('/form') ? ok(form) : ok({ submitted: true, response_id: 'r' }) });
  await journey.start(); journey.review({ q: 'a' }); await journey.submit();
  return journey.state;
}

test('D: a code session (via=code) gets the code thank-you; a link session keeps the link thank-you', async () => {
  const code = await journeyAfterSubmit(ns => ({ [ns + 'via']: 'code' }));
  assert.equal(code.phase, 'receipt');
  assert.equal(code.notice, receiptNotice('Community', { code: true }));
  assert.doesNotMatch(code.notice, /Reopening your link|same link/);
  const link = await journeyAfterSubmit(() => ({}));
  assert.equal(link.notice, receiptNotice('Community'));
});

// ---------- Folded in (persona D on DEV 0.24.0, phone): translation of the thank-you, counter word order, switch copy ----------
const { UI_EN, makeT, translatingSub } = await import('./participate/i18n.js');
const { fillTranslated } = await import('./shared-link.js');
const { receiptLine } = await import('./present.js');
const { mountParticipantView } = await import('./participant-view.js');

test('B1: every thank-you sentence (link and code) and the Reference word are in the translated page strings', () => {
  for (const key of ['receiptThanks', 'receiptThanksNoGroup', 'sameLinkOthers', 'receiptThanksCode', 'receiptThanksCodeNoGroup', 'codeOnce']) assert.equal(UI_EN[key], copy[key], key);
  assert.equal(UI_EN.reference, 'Reference');
});

test('B1: the thank-you is said in the chosen language, with the group filled after translation; English stays the fallback', () => {
  const T = makeT({ receiptThanks: 'ଧନ୍ୟବାଦ। {perspective} ଦୃଷ୍ଟିକୋଣ।', sameLinkOthers: 'ସେହି ଲିଙ୍କ।', receiptThanksCode: 'ଧନ୍ୟବାଦ। {perspective}।', codeOnce: 'କୋଡ୍ ଥରେ।' });
  assert.equal(receiptNotice('Community', { t: T }), 'ଧନ୍ୟବାଦ। Community ଦୃଷ୍ଟିକୋଣ। ସେହି ଲିଙ୍କ।');
  assert.equal(receiptNotice('Community', { t: T, code: true }), 'ଧନ୍ୟବାଦ। Community। କୋଡ୍ ଥରେ।');
  assert.equal(receiptNotice('', { t: T }), `${copy.receiptThanksNoGroup} ସେହି ଲିଙ୍କ।`, 'a sentence with no translation stays English');
  const lost = makeT({ receiptThanks: 'ଧନ୍ୟବାଦ। ଦୃଷ୍ଟିକୋଣ।' }); // the translation dropped {perspective}
  assert.equal(receiptNotice('Community', { t: lost }), receiptNotice('Community'), 'a translation that lost the placeholder falls back to English, never drops the group');
  assert.equal(receiptNotice('Community', { t: makeT({}) }), receiptNotice('Community'), 'English page: unchanged');
});

test('B1: the reference line uses the translated word and the chosen locale; defaults unchanged', () => {
  const r = { response_id: 'resp_ab12cd34ef', submitted_at: '2026-09-25T17:27:05.171Z' };
  const line = receiptLine(r, { t: makeT({ reference: 'ସନ୍ଦର୍ଭ' }), locale: 'or' });
  assert.match(line, /^ସନ୍ଦର୍ଭ AB12CD34 · /);
  assert.equal(line.split(' · ')[1], new Date(r.submitted_at).toLocaleString('or', { dateStyle: 'medium', timeStyle: 'short' }));
  assert.equal(receiptLine({ response_id: 'resp_ab12cd34ef' }), 'Reference AB12CD34');
  assert.doesNotThrow(() => receiptLine(r, { locale: 'not a tag!!' }), 'a bad locale falls back');
});

test('B3: the question counter is ONE template with {n} and {total}, filled after translation (word order follows the language)', () => {
  assert.equal(UI_EN.questionOf, 'Question {n} of {total}');
  assert.equal(UI_EN.question, undefined); assert.equal(UI_EN.of, undefined);
  const mount = t => {
    const { document } = new JSDOM('<div id="root"></div><form id="answers"><div id="questions"><fieldset data-item="a"><legend>A</legend><input name="a"></fieldset><fieldset data-item="b"><legend>B</legend><input name="b"></fieldset><fieldset data-item="c"><legend>C</legend><input name="c"></fieldset></div><button id="review-button" type="submit">Review</button></form><div id="review"></div><div id="review-answers"></div><div id="receipt"></div>').window;
    const $ = id => document.getElementById(id);
    const view = mountParticipantView({ doc: document, root: $('root'), form: $('answers'), questions: $('questions'), review: $('review'), reviewAnswers: $('review-answers'), receipt: $('receipt'), reviewButton: $('review-button'), model: { items: [{ id: 'a', type: 'text' }, { id: 'b', type: 'text' }, { id: 'c', type: 'text' }] }, ...(t ? { t } : {}) });
    view.showForm(0);
    return document.querySelector('.participant-progress').textContent;
  };
  assert.equal(mount(), 'Question 1 of 3');
  assert.equal(mount(makeT({ questionOf: '{total} ರಲ್ಲಿ ಪ್ರಶ್ನೆ {n}' })), '3 ರಲ್ಲಿ ಪ್ರಶ್ನೆ 1', 'Kannada order: total first, then the question number');
  assert.equal(mount(makeT({ questionOf: '{total} में से प्रश्न {n}' })), '3 में से प्रश्न 1');
  assert.equal(mount(makeT({ questionOf: 'ಪ್ರಶ್ನೆ' })), 'Question 1 of 3', 'a translation that lost a placeholder falls back to English');
  assert.equal(fillTranslated('{n}/{n}', 'Question {n} of {total}', { n: 1, total: 3 }), 'Question 1 of 3');
});

test('B4: while one translation replaces another, the card names the language still on screen, never "English"', () => {
  assert.equal(translatingSub(null), UI_EN.translatingFirst, 'English on screen: unchanged copy');
  const kn = translatingSub({ code: 'kn', endonym: 'ಕನ್ನಡ', name: 'Kannada' });
  assert.equal(kn, 'The first time can take up to a minute. After that it opens straight away. You can keep reading in ಕನ್ನಡ (Kannada) meanwhile.');
  assert.doesNotMatch(kn, /in English/);
  assert.match(translatingSub({ endonym: 'Tavo', name: 'Tavo' }), /reading in Tavo meanwhile\.$/);
  assert.match(translatingSub('kn'), /reading in kn meanwhile\.$/);
});

test('B4: the participant page passes the on-screen language (captured before the switch) to the card', () => {
  const page = readFileSync(new URL('./participate/page.js', import.meta.url), 'utf8');
  assert.match(page, /const was = shownLang\(\), onScreen = was \? \(pickLanguage\(was, form\?\.languages \|\| \[\]\) \|\| was\) : null;/);
  assert.ok(page.indexOf('const was = shownLang()') < page.indexOf('tr = { lang, form, ui: u.map'), 'captured before the new translation replaces tr');
  assert.match(page, /showTranslating\(entry, \{ done: seen\.ui \+ seen\.items, total \}, onScreen\)/);
  assert.match(page, /trSub\.textContent = translatingSub\(onScreen\);/);
  assert.match(page, /receiptNotice\(state\.thanks\.perspective, \{ code: state\.thanks\.code, t: T \}\)/);
  assert.match(page, /receiptLine\(state\.receipt, \{ t: T, locale: shownLocale\(\) \}\)/);
});
