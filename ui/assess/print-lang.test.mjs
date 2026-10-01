// S25: Print survey in the participants' language (cookbook work/queued/2026-09-30-3d-print-and-passage-in-language Do 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadBlankPrint, renderBlankPrint, PRINT_WORDS, printAllowed } from '../stage-screens.js';
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
  assert.match(src, /\$\{printLangField\(a\)\}<p>\$\{printLoadButton\(a\.id, s\.id\)\}/);
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
  const kStart = src.indexOf('function keepPrint(r) {'), kEnd = src.indexOf('\n}\n', kStart) + 2;
  const el = (id, extra = {}) => ({ id, disabled: false, value: '', textContent: '', onclick: null, onchange: null, replaceChildren() {}, ...extra });
  const nodes = { '#print-load': el('print-load'), '#print-lang': el('print-lang', { value: 'hi' }), '#print-root': el('print-root'), '#print-status': el('print-status') };
  const loads = [], painted = [];
  const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
  const env = {
    app: { querySelector: q => nodes[q] || null }, state: { print: null, dirty: new Map(), current: { assessment: { id: 'a1', role: 'owner' } } }, printAllowed, generation: 1, epoch: 1, token: 'st_x', printLangs: new Map(), redact: x => x,
    loadBlankPrint: ({ lang }) => { const d = deferred(); loads.push({ lang, d }); return d.promise; },
    passageLineFor: async () => '', facilitatorFetch: () => null,
    translatePrint: async (model, { lang }) => ({ ...model, lang, title: `form in ${lang}` }),
    replayPrint: model => painted.push(model),
    ...overrides,
  };
  const { bindPrint, printLoadButton, keepPrint, bumpGeneration } = new Function(...Object.keys(env), `${src.slice(start, end)}\n${src.slice(kStart, kEnd)}\nreturn { bindPrint, printLoadButton, keepPrint, bumpGeneration: () => ++generation };`)(...Object.values(env));
  const current = { assessment: { id: 'a1', role: 'owner' } }, survey = { id: 's1' };
  bindPrint(current, survey);
  // repaint(): what paint() does to the print panel — fresh nodes drawn by printLoadButton, then bindPrint again (no generation bump).
  const repaint = () => {
    const btnHtml = printLoadButton('a1', 's1');
    nodes['#print-load'] = el('print-load', { disabled: / disabled/.test(btnHtml) }); nodes['#print-lang'] = el('print-lang', { value: nodes['#print-lang'].value });
    bindPrint(current, survey); return btnHtml;
  };
  return { nodes, loads, painted, env, printLoadButton, repaint, keepPrint, bumpGeneration };
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

test('#414b nit: a throwing helper sets an error status, unlocks the button and picker, and never rejects', async () => {
  const h = bindPrintHarness({ passageLineFor: async () => { throw new Error('boom'); } }), btn = h.nodes['#print-load'], sel = h.nodes['#print-lang'];
  const done = btn.onclick();
  assert.equal(btn.disabled, true);
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await done; // handled: no unhandled rejection
  assert.equal(h.env.state.print.status, 'error');
  assert.match(h.nodes['#print-status'].textContent, /could not be prepared/);
  assert.equal(btn.disabled, false, 'not locked forever'); assert.equal(sel.disabled, false);
  assert.equal(h.painted.length, 0);
});

test('#414b (worth fixing): repaint mid-load + second click never double-loads; the newer run stays locked until its own idle', async () => {
  const h = bindPrintHarness();
  const first = h.nodes['#print-load'].onclick();
  const firstRun = h.env.state.print;
  // paint() mid-load (no generation bump): the loading run survives and the redrawn button is locked
  h.repaint();
  assert.equal(h.env.state.print, firstRun, 'the loading run survives the repaint');
  assert.equal(h.nodes['#print-load'].disabled, true, 'the repainted button is drawn locked');
  // a second click still gets through (e.g. assistive tech): it becomes the newer run
  const second = h.nodes['#print-load'].onclick();
  const secondRun = h.env.state.print;
  assert.notEqual(secondRun, firstRun);
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await first;
  assert.equal(h.nodes['#print-load'].disabled, true, "the older run's idle()/finally never unlock the newer run's button");
  assert.equal(h.nodes['#print-lang'].disabled, true);
  assert.equal(h.painted.length, 0, 'the older run never replays');
  h.loads[1].d.resolve({ visible: true, blank: true, items: [] });
  await second;
  assert.equal(h.loads.length, 2); assert.equal(h.painted.length, 1, 'exactly one replay, from the newer run');
  assert.equal(h.env.state.print, secondRun); assert.equal(secondRun.status, 'ready');
  assert.equal(h.nodes['#print-load'].disabled, false, 'the newer run unlocks at its own idle');
});

test('#414b nit: the rendered Print survey button is disabled while a run for this survey is loading', async () => {
  const h = bindPrintHarness();
  assert.doesNotMatch(h.printLoadButton('a1', 's1'), / disabled/, 'idle: enabled');
  const done = h.nodes['#print-load'].onclick();
  assert.match(h.printLoadButton('a1', 's1'), /<button id="print-load" disabled>/, 'loading: drawn disabled');
  assert.doesNotMatch(h.printLoadButton('a1', 's2'), / disabled/, 'another survey is not locked by this run');
  h.repaint(); assert.equal(h.nodes['#print-lang'].disabled, true, 'bindPrint re-locks the repainted picker mid-load');
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] }); await done;
  assert.doesNotMatch(h.printLoadButton('a1', 's1'), / disabled/, 'ready: enabled again');
  h.env.state.dirty.set('a1', 'write'); assert.match(h.printLoadButton('a1', 's1'), / disabled/, 'dirty guard kept');
});

test('#414c (worth fixing): render() bumps the generation mid-load and repaints the same survey — Print survey and the picker end up enabled', async () => {
  const h = bindPrintHarness();
  const done = h.nodes['#print-load'].onclick();
  assert.equal(h.env.state.print.status, 'loading');
  // render(): ++generation, then paint() of the same survey route — keepPrint decides whether the in-flight run survives
  h.bumpGeneration();
  assert.equal(h.keepPrint({ kind: 'survey', id: 'a1', sid: 's1' }), false, 'a run from an older render is not kept');
  h.env.state.print = null; // paint(): if (!keepPrint(r)) state.print = null
  const html = h.repaint();
  assert.doesNotMatch(html, / disabled/, 'the repainted button is drawn enabled');
  assert.equal(h.nodes['#print-lang'].disabled, false, 'the repainted picker is not re-locked');
  // the stale run finishes: it quits on its generation check and its cleanup never runs — nothing is left locked
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  await done;
  assert.equal(h.nodes['#print-load'].disabled, false, 'Print survey is enabled'); assert.equal(h.nodes['#print-lang'].disabled, false, 'the language picker is enabled');
  assert.equal(h.painted.length, 0, 'the stale run never replays');
});

test('#414c nits: a loading run applies the role check, and the run carries the epoch it started from', async () => {
  const h = bindPrintHarness();
  const done = h.nodes['#print-load'].onclick();
  const run = h.env.state.print, r = { kind: 'survey', id: 'a1', sid: 's1' };
  assert.equal(run.epoch, 1, 'stamped at the start');
  assert.equal(h.keepPrint(r), true, 'same render, same survey, printing allowed: kept');
  h.env.state.current.assessment.role = 'viewer';
  assert.equal(printAllowed('viewer'), false);
  assert.equal(h.keepPrint(r), false, 'a role that no longer allows printing drops the loading run');
  h.env.state.current.assessment.role = 'owner';
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] }); await done;
  assert.equal(run.status, 'ready'); assert.equal(run.epoch, 1);
});

test('S35 (rev414d nit): a repaint mid-load keeps the print status line and the locked button; the run then completes', async () => {
  let finishTranslate; const tgate = new Promise(r => { finishTranslate = r; });
  const h = bindPrintHarness({ translatePrint: async (model, { lang }) => { await tgate; return { ...model, lang }; } });
  const done = h.nodes['#print-load'].onclick();
  assert.equal(h.nodes['#print-status'].textContent, 'Preparing the form…', 'the click shows the status at once');
  h.repaint(); // before any status text: the redrawn line says why the button is locked
  assert.equal(h.nodes['#print-status'].textContent, 'Preparing the form…');
  h.loads[0].d.resolve({ visible: true, blank: true, items: [] });
  for (let i = 0; i < 3; i++) await new Promise(r => setImmediate(r));
  const line = 'Translating the form… The first time can take up to a minute.';
  assert.equal(h.nodes['#print-status'].textContent, line);
  // paint() mid-load: fresh status node (empty, as printBlock draws it), fresh button and picker, then bindPrint again
  h.nodes['#print-status'] = { ...h.nodes['#print-status'], textContent: '' };
  h.repaint();
  assert.equal(h.nodes['#print-status'].textContent, line, 'the status line survives the repaint');
  assert.equal(h.nodes['#print-load'].disabled, true, 'the button stays locked'); assert.equal(h.nodes['#print-lang'].disabled, true);
  finishTranslate();
  await done;
  assert.equal(h.nodes['#print-load'].disabled, false); assert.equal(h.nodes['#print-lang'].disabled, false);
  assert.deepEqual(h.painted.map(m => m.lang), ['hi']); assert.equal(h.env.state.print.status, 'ready');
});
