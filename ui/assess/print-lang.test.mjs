// S25: Print survey in the participants' language (cookbook work/queued/2026-09-30-3d-print-and-passage-in-language Do 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadBlankPrint, renderBlankPrint, PRINT_WORDS } from '../stage-screens.js';
import { PRINT_IN_LANGUAGE, printLanguages, printLanguageField, translatePrint, facilitatorFetch, printReadyLine, printStrings } from './print-lang.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function node(tag) {
  const attrs = new Map();
  return { tag, textContent: '', children: [], className: '', hidden: false, value: '', type: '', selected: false,
    setAttribute(k, v) { attrs.set(k, String(v)); }, getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
    addEventListener() {}, append(...n) { this.children.push(...n); }, replaceChildren(...n) { this.children = n; } };
}
const doc = { createElement: node, createTextNode: t => ({ tag: '#text', textContent: t, children: [] }) };
const walk = n => [n, ...(n.children || []).flatMap(walk)];
const article = root => walk(root).find(n => n.tag === 'article');

const ENVELOPE = { ok: true, result: { blank: true, template_id: 'tpl_validation', template_version: 2, html: '<h1>Translators</h1>', items: [
  { id: 'q1', type: 'single', text: 'Is there a brief?', options: [{ code: 'yes', text: 'Yes' }, { code: 'other', text: 'Other (please describe)' }] },
  { id: 'q2', type: 'multi', text: 'Which resources?', options: [{ code: 'c', text: 'Commentaries' }] },
  { id: 'q3', type: 'text', text: 'Anything else?' },
] } };
const HI = { 'Is there a brief?': 'क्या कोई संक्षिप्त विवरण है?', Yes: 'हाँ', 'Other (please describe)': 'अन्य (कृपया बताएं)', 'Which resources?': 'कौन से संसाधन?', Commentaries: 'टीकाएँ', 'Anything else?': 'और कुछ?',
  [PRINT_WORDS.passageLead]: 'उत्तर देने से पहले पढ़ें या सुनें:', [PRINT_WORDS.codeLabel]: 'कोड (वैकल्पिक)', [PRINT_WORDS.leaveBlank]: 'साझा लिंक से उत्तर देते समय खाली छोड़ें',
  [PRINT_WORDS.noLink]: 'इस सर्वेक्षण का अभी कोई साझा लिंक नहीं है।', [PRINT_WORDS.footNote]: 'कोड कभी नहीं छापे जाते। QR इस सर्वेक्षण का अपना लिंक है।', [PRINT_WORDS.introChoices]: 'हर प्रश्न के लिए एक गोला ○ चिह्नित करें।', [PRINT_WORDS.chooseAll]: 'सभी लागू चुनें', [PRINT_WORDS.chooseOne]: 'एक चुनें' };

async function printModel(calls, lang) {
  const request = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ENVELOPE }; };
  const model = await loadBlankPrint({ request, token: 'st_facilitator', aid: 'a1', sid: 's1', role: 'member', lang });
  model.passageLine = 'Before you answer, read or listen to: Genesis 1'; // assess.js passageLine() for one passage
  return model;
}
// A /v2/translate stand-in: answers each posted string from `memory` (translation memory), leaves the rest out.
function translateServer(memory, sent, { failContext = null } = {}) {
  return async (url, init) => {
    const body = JSON.parse(init.body); sent.push({ url, init, body });
    if (body.context === failContext) return { ok: false, status: 502, json: async () => ({ error: 'translation_failed' }) };
    const translated = {}; for (const [k, v] of Object.entries(body.sourceTexts)) if (memory[v]) translated[k] = memory[v];
    return { ok: true, json: async () => ({ translated, partial: Object.keys(translated).length < Object.keys(body.sourceTexts).length }) };
  };
}

test('the picker lists the participant drop-down languages: assessment LWCs, then the project\'s, English first', () => {
  assert.equal(PRINT_IN_LANGUAGE, true);
  assert.deepEqual(printLanguages(['hi', 'kn'], ['kn', 'ta', 'ins', 'xx']).map(l => l.code), ['hi', 'kn', 'ta'], 'sign language and unknown tags are never offered; no duplicates');
  const h = printLanguageField(printLanguages(['hi'], ['ta']), 'en', esc);
  assert.match(h, /<select id="print-lang"><option value="en" selected>English<\/option><option value="hi">हिन्दी \(Hindi\)<\/option><option value="ta">தமிழ் \(Tamil\)<\/option><\/select>/);
  assert.match(printLanguageField(printLanguages(['hi']), 'hi', esc), /<option value="hi" selected>/);
  assert.match(printLanguageField(printLanguages(['hi']), 'fr', esc), /<option value="en" selected>/, 'a choice no longer on the list falls back to English');
});

test('print page requests ?lang=hi strings through /v2/translate with the facilitator session and renders them', async () => {
  const calls = [], sent = [];
  const model = await printModel(calls, 'hi');
  assert.match(calls[0].url, /\/v2\/assessments\/a1\/surveys\/s1\/print\?lang=hi$/);
  const fetchImpl = facilitatorFetch('st_facilitator', translateServer(HI, sent));
  const hi = await translatePrint(model, { lang: 'hi', fetchImpl });
  assert.ok(sent.length >= 2);
  for (const s of sent) {
    assert.equal(s.url, '/v2/translate'); assert.equal(s.body.targetLang, 'hi');
    assert.equal(s.init.headers.authorization, 'Bearer st_facilitator'); assert.equal(s.init.credentials, 'same-origin');
  }
  assert.deepEqual([...new Set(sent.map(s => s.body.context))].sort(), ['participant-form:tpl_validation', 'participant-ui']);
  const form = sent.filter(s => s.body.context.startsWith('participant-form')).flatMap(s => Object.values(s.body.sourceTexts));
  assert.deepEqual(form.sort(), ['Anything else?', 'Commentaries', 'Is there a brief?', 'Other (please describe)', 'Which resources?', 'Yes'].sort(), 'questions and choices, English source text only');
  assert.equal(hi.english, 0);
  const root = node('div'); renderBlankPrint(doc, root, hi);
  const page = walk(root).map(n => n.textContent).join('\n');
  for (const s of ['क्या कोई संक्षिप्त विवरण है?', 'हाँ', 'अन्य (कृपया बताएं)', 'टीकाएँ', 'और कुछ?', 'एक चुनें', 'सभी लागू चुनें', 'उत्तर देने से पहले पढ़ें या सुनें: Genesis 1', 'हर प्रश्न के लिए']) assert.ok(page.includes(s), `paper shows ${s}`);
  assert.doesNotMatch(page, /Is there a brief\?|Choose one|Mark one circle/);
  assert.equal(article(root).getAttribute('lang'), 'hi');
  assert.equal(walk(root).some(n => n.getAttribute?.('data-en') !== null && n.getAttribute?.('data-en') !== undefined), false, 'nothing marked English');
  assert.equal(walk(root).filter(n => n.className === 'p-opt').length, 3, '0.23.0 layout: every choice still printed');
  assert.equal(walk(root).filter(n => n.className === 'p-lines').length, 1, '0.23.0 layout: write-in lines for the open question');
  assert.match(printReadyLine(hi), /^3 questions ready in हिन्दी \(Hindi\)\. Machine translation\. Use Print below\.$/);
});

test('English fallback per string when memory has none, marked EN on the paper; a failed call never blocks the print', async () => {
  const sent = [];
  const partial = { 'Is there a brief?': HI['Is there a brief?'] }; // memory holds one question only; page words call fails
  const hi = await translatePrint(await printModel([], 'hi'), { lang: 'hi', fetchImpl: facilitatorFetch('st_x', translateServer(partial, sent, { failContext: 'participant-ui' })) });
  const root = node('div'); renderBlankPrint(doc, root, hi);
  const marked = walk(root).filter(n => n.getAttribute?.('data-en') === '').map(n => n.textContent);
  assert.ok(marked.includes('Yes') && marked.includes('Which resources?') && marked.includes('Choose one') && marked.includes(PRINT_WORDS.codeLabel), 'English strings carry the EN mark');
  assert.ok(!marked.includes(HI['Is there a brief?']));
  assert.equal(walk(root).find(n => n.textContent === 'Yes').getAttribute('lang'), 'en');
  assert.ok(hi.english > 0 && hi.english < hi.phrases);
  assert.match(printReadyLine(hi), /phrases have no translation yet and stay in English, marked EN on the paper/);
  const none = await translatePrint(await printModel([], 'hi'), { lang: 'hi', fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(none.english, none.phrases, 'offline: the whole form stays English (and prints)');
  assert.equal(none.items[0].text, 'Is there a brief?');
});

test('no request when English, when the assessment has no language, or for a sign language', async () => {
  let n = 0; const fetchImpl = async () => { n++; return { ok: true, json: async () => ({}) }; };
  const calls = [], model = await printModel(calls, undefined);
  assert.doesNotMatch(calls[0].url, /lang=/, 'default print route unchanged');
  for (const lang of [undefined, null, '', 'en', 'English', 'ins', 'xx']) assert.equal(await translatePrint(model, { lang, fetchImpl }), model);
  assert.equal(n, 0);
  assert.deepEqual(printLanguages([], []), []); assert.deepEqual(printLanguages(undefined, undefined), []);
  assert.equal(printLanguageField(printLanguages([], []), 'en', esc), '', 'no languages → no picker');
  const root = node('div'); renderBlankPrint(doc, root, model);
  assert.equal(article(root).getAttribute('lang'), null); assert.ok(walk(root).some(n => n.textContent === 'Choose one'));
});

test('only the words this paper shows are sent; assess.js wires the language into Print survey', () => {
  const { ui } = printStrings({ title: 'T', items: [{ type: 'text', text: 'Q?' }] });
  // S31: the QR slot is on paper now — "no shared link" when the survey has none, the helper line when it has one; the
  // identity labels only when the paper carries its identity block.
  assert.deepEqual(Object.values(ui).sort(), [PRINT_WORDS.codeLabel, PRINT_WORDS.introChoices, PRINT_WORDS.leaveBlank, PRINT_WORDS.noLink, PRINT_WORDS.footNote].sort());
  const linked = printStrings({ title: 'T', items: [{ type: 'text', text: 'Q?' }], link: { url: 'https://x.test/#survey=link_a' }, identity: { assessment: { language: 'Hindi' } } }).ui;
  assert.ok(Object.values(linked).includes(PRINT_WORDS.helperScan)); assert.ok(!Object.values(linked).includes(PRINT_WORDS.noLink));
  for (const k of ['projectLabel', 'assessmentLabel', 'languageLabel', 'printedIn', 'surveyLabel']) assert.ok(Object.values(linked).includes(PRINT_WORDS[k]), k);
  const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  assert.match(src, /loadBlankPrint\(\{[^}]*role: current\.assessment\.role, lang \}\)/);
  assert.match(src, /translatePrint\(model, \{ lang, fetchImpl: facilitatorFetch\(token\) \}\)/);
  assert.match(src, /\$\{printLangField\(a\)\}<p><button id="print-load"/);
  const line = src.split('\n').find(l => l.startsWith('const passageLine = '));
  assert.ok(new Function(`${line}; return passageLine;`)()([{ reference: 'Genesis 1' }]).startsWith(`${PRINT_WORDS.passageLead} `), 'passage line lead is the translatable one');
});

test('review #405 nits: nothing translated → no "Machine translation" claim; the default title is marked; legacy string items are not counted', async () => {
  const none = await translatePrint(await printModel([], 'hi'), { lang: 'hi', fetchImpl: async () => { throw new Error('offline'); } });
  assert.doesNotMatch(printReadyLine(none), /Machine translation/);
  assert.match(printReadyLine(none), /stay in English, marked EN on the paper/);
  const legacy = await translatePrint({ visible: true, blank: true, items: ['Q one?', 'Q two?'] }, { lang: 'hi', fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepEqual(legacy.items, ['Q one?', 'Q two?']);
  const root = node('div'); renderBlankPrint(doc, root, legacy);
  const h1 = walk(root).find(n => n.tag === 'h1');
  assert.equal(h1.textContent, PRINT_WORDS.blankSurvey); assert.equal(h1.getAttribute('data-en'), '', 'the default title stayed English and says so');
  assert.equal(legacy.phrases, walk(root).filter(n => n.getAttribute?.('data-en') === '').length, 'every counted English phrase is marked on the paper');
});

// Review of #405 finding 1: bindPrint from assess.js, run with stub loads — a language change during the load never leaves
// the paper in the old language.
function bindPrintHarness(overrides = {}) {
  const src = readFileSync(new URL('./assess.js', import.meta.url), 'utf8');
  const start = src.indexOf('function bindPrint(current, s) {'), end = src.indexOf('\nfunction context(current) {');
  const el = (id, extra = {}) => ({ id, disabled: false, value: '', textContent: '', onclick: null, onchange: null, replaceChildren() {}, ...extra });
  const nodes = { '#print-load': el('print-load'), '#print-lang': el('print-lang', { value: 'hi' }), '#print-root': el('print-root'), '#print-status': el('print-status') };
  const loads = [], painted = [];
  const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
  const env = {
    app: { querySelector: q => nodes[q] || null }, state: { print: null, dirty: new Map() }, generation: 1, epoch: 1, token: 'st_x', printLangs: new Map(), redact: x => x,
    loadBlankPrint: ({ lang }) => { const d = deferred(); loads.push({ lang, d }); return d.promise; },
    passageLineFor: async () => '', facilitatorFetch: () => null,
    translatePrint: async (model, { lang }) => ({ ...model, lang, title: `form in ${lang}` }),
    replayPrint: model => painted.push(model),
    ...overrides,
  };
  const bindPrint = new Function(...Object.keys(env), `${src.slice(start, end)}\nreturn bindPrint;`)(...Object.values(env));
  bindPrint({ assessment: { id: 'a1', role: 'owner' } }, { id: 's1' });
  return { nodes, loads, painted, env };
}

test('language changed mid-load prints the new language (picker locked during the load; a changed pick reloads)', async () => {
  const h = bindPrintHarness(), btn = h.nodes['#print-load'], sel = h.nodes['#print-lang'];
  const done = btn.onclick();
  assert.equal(sel.disabled, true, 'the picker is locked from the click'); assert.equal(btn.disabled, true);
  assert.equal(h.loads[0].lang, 'hi');
  sel.value = 'ta'; sel.onchange(); // a change that still gets through (e.g. assistive tech) while the form is loading
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await new Promise(r => setImmediate(r));
  assert.equal(h.loads.length, 2, 'loaded again in the picked language'); assert.equal(h.loads[1].lang, 'ta');
  h.loads[1].d.resolve({ visible: true, blank: true, items: [] });
  await done;
  assert.deepEqual(h.painted.map(m => m.lang), ['ta'], 'only the Tamil form is painted');
  assert.equal(h.env.state.print.model.lang, 'ta', 'and cached');
  assert.equal(sel.disabled, false); assert.equal(btn.disabled, false);
});

test('an unchanged pick loads once, and a failed load unlocks the picker', async () => {
  const h = bindPrintHarness(), btn = h.nodes['#print-load'], sel = h.nodes['#print-lang'];
  const ok = btn.onclick(); h.loads[0].d.resolve({ visible: true, blank: true, items: [] }); await ok;
  assert.equal(h.loads.length, 1); assert.deepEqual(h.painted.map(m => m.lang), ['hi']); assert.equal(sel.disabled, false);
  const bad = btn.onclick(); assert.equal(sel.disabled, true); h.loads[1].d.resolve({ visible: false, reason: 'not-visible' }); await bad;
  assert.equal(sel.disabled, false); assert.equal(btn.disabled, false); assert.equal(h.env.state.print.status, 'error');
});

test('S34 (#405 nit b): the button stays locked while the passage line is read; unlocked only when the form is ready', async () => {
  let release; const gate = new Promise(r => { release = r; });
  const h = bindPrintHarness({ passageLineFor: () => gate }), btn = h.nodes['#print-load'];
  const done = btn.onclick();
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await new Promise(r => setImmediate(r));
  assert.equal(btn.disabled, true, 'still locked during the passages GET (a second click would print twice)');
  release('Before you answer, read or listen to: Mark 4');
  await done;
  assert.equal(btn.disabled, false, 'idle() unlocks once the form is ready'); assert.equal(h.painted.length, 1);
});

test('S34 (#405 nit a): a repaint mid-load swaps the picker; idle() unlocks and picked() reads the live nodes', async () => {
  const h = bindPrintHarness(), oldBtn = h.nodes['#print-load'], oldSel = h.nodes['#print-lang'];
  const done = oldBtn.onclick();
  assert.equal(oldSel.disabled, true);
  // an error repaint replaces the nodes; the new picker shows Tamil and is disabled as painted mid-load
  h.nodes['#print-load'] = { ...oldBtn, disabled: true }; h.nodes['#print-lang'] = { ...oldSel, value: 'ta', disabled: true };
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await new Promise(r => setImmediate(r));
  assert.equal(h.loads.length, 2, 'the live picker (Tamil) differs from the load (Hindi): loaded again'); assert.equal(h.loads[1].lang, 'ta');
  h.loads[1].d.resolve({ visible: true, blank: true, items: [] });
  await done;
  assert.equal(h.nodes['#print-lang'].disabled, false, 'the live picker is unlocked'); assert.equal(h.nodes['#print-load'].disabled, false);
  assert.deepEqual(h.painted.map(m => m.lang), ['ta']);
});

test('#414 review (worth fixing): idle() never unlocks a button the dirty guard locked', async () => {
  const h = bindPrintHarness(), oldBtn = h.nodes['#print-load'];
  const done = oldBtn.onclick();
  // the assessment turns dirty mid-load; the repaint renders the live button disabled on purpose (assess.js dirty guard)
  h.env.state.dirty.set('a1', 'write');
  h.nodes['#print-load'] = { ...oldBtn, disabled: true };
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await done;
  assert.equal(h.nodes['#print-load'].disabled, true, 'a dirty assessment stays locked after idle()');
  assert.equal(h.nodes['#print-lang'].disabled, false, 'the picker is still released');
  h.env.state.dirty.clear();
  const again = oldBtn.onclick(); h.loads[1].d.resolve({ visible: false, reason: 'not-visible' }); await again;
  assert.equal(h.nodes['#print-load'].disabled, false, 'clean again: idle() unlocks');
});

test('#414 review nit: a repaint mid-load keeps the live button and picker locked through the passages read and translation', async () => {
  let release; const gate = new Promise(r => { release = r; });
  let finishTranslate; const tgate = new Promise(r => { finishTranslate = r; });
  const h = bindPrintHarness({ passageLineFor: () => gate, translatePrint: async (model, { lang }) => { await tgate; return { ...model, lang }; } });
  const oldBtn = h.nodes['#print-load'], oldSel = h.nodes['#print-lang'];
  const done = oldBtn.onclick();
  // a repaint swaps in fresh, enabled nodes (e.g. painted before state.print was consulted)
  h.nodes['#print-load'] = { ...oldBtn, disabled: false }; h.nodes['#print-lang'] = { ...oldSel, disabled: false };
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await new Promise(r => setImmediate(r));
  release('');
  await new Promise(r => setImmediate(r));
  assert.equal(h.nodes['#print-load'].disabled, true, 'the live button is locked during the translation');
  assert.equal(h.nodes['#print-lang'].disabled, true, 'the live picker is locked during the translation');
  finishTranslate();
  await done;
  assert.equal(h.nodes['#print-load'].disabled, false); assert.equal(h.nodes['#print-lang'].disabled, false);
  assert.deepEqual(h.painted.map(m => m.lang), ['hi']);
});

test('#414 review nit: a throwing helper still unlocks the button and picker', async () => {
  const h = bindPrintHarness({ passageLineFor: async () => { throw new Error('boom'); } }), btn = h.nodes['#print-load'], sel = h.nodes['#print-lang'];
  const done = btn.onclick();
  assert.equal(btn.disabled, true);
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await assert.rejects(done, /boom/);
  assert.equal(btn.disabled, false, 'not locked forever'); assert.equal(sel.disabled, false);
  assert.equal(h.painted.length, 0);
});
