import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formStrings, translateForm, makeT, fetchTranslations, fetchTranslationsProgressive, initialLanguage, hashOf, isEnglish, isRtl, UI_EN, pickLanguage } from './i18n.js';

const form = {
  template: { id: 'tpl_mid_level' },
  items: [
    { id: 'ML-Q1', type: 'single', text: 'Does the team have a brief?', options: [{ code: 'documented', text: 'Yes, documented' }, { code: 'other', text: 'Other (please describe)' }] },
    { id: 'ML-Q4', type: 'multi', text: 'Which resources?', options: [{ code: 'commentaries', label: 'Commentaries' }] },
    { id: 'ML-Q9', type: 'text', text: 'Anything else?' },
  ],
  context_fields: [{ key: 'gender', label: 'Gender', options: [{ code: 'female', label: 'Female' }] }],
};

test('formStrings keys by item id and option code, never by position', () => {
  assert.deepEqual(formStrings(form), {
    'ML-Q1.text': 'Does the team have a brief?', 'ML-Q1.opt.documented': 'Yes, documented', 'ML-Q1.opt.other': 'Other (please describe)',
    'ML-Q4.text': 'Which resources?', 'ML-Q4.opt.commentaries': 'Commentaries', 'ML-Q9.text': 'Anything else?',
    'about.gender.label': 'Gender', 'about.gender.opt.female': 'Female',
  });
});

test('translateForm swaps display text only; ids, codes, types and order are unchanged', () => {
  const shown = translateForm(form, { 'ML-Q1.text': 'ທີມ…?', 'ML-Q1.opt.documented': 'ແມ່ນ', 'ML-Q4.opt.commentaries': 'ຄຳອະທິບາຍ', 'about.gender.label': 'ເພດ' });
  assert.equal(shown.items[0].text, 'ທີມ…?');
  assert.equal(shown.items[0].options[0].text, 'ແມ່ນ');
  assert.equal(shown.items[0].options[1].text, 'Other (please describe)'); // missing → English
  assert.equal(shown.items[1].options[0].label, 'ຄຳອະທິບາຍ');
  assert.equal(shown.items[2].text, 'Anything else?');
  assert.deepEqual(shown.items.map(i => i.id), form.items.map(i => i.id));
  assert.deepEqual(shown.items[0].options.map(o => o.code), ['documented', 'other']);
  assert.equal(shown.context_fields[0].label, 'ເພດ');
  assert.equal(form.items[0].text, 'Does the team have a brief?'); // source form untouched
  assert.equal(translateForm(form, {}), form);
});

test('makeT falls back to English', () => {
  const t = makeT({ next: 'ຕໍ່ໄປ' });
  assert.equal(t('next', 'Next'), 'ຕໍ່ໄປ');
  assert.equal(t('back', 'Back'), 'Back');
  assert.equal(t('start'), UI_EN.start);
});

function memoryStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; }

test('fetchTranslations posts the Lovable wire shape, caches complete answers, keeps partial ones uncached', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ translated: { a: 'ກ', b: 'ຂ' }, partial: false }) }; };
  const storage = memoryStorage();
  const first = await fetchTranslations({ lang: 'Lao', context: 'participant-ui', sourceTexts: { a: 'A', b: 'B' }, fetchImpl, storage });
  assert.deepEqual(first.map, { a: 'ກ', b: 'ຂ' });
  assert.equal(calls[0].url, '/v2/translate');
  assert.deepEqual(JSON.parse(calls[0].init.body), { targetLang: 'Lao', context: 'participant-ui', sourceTexts: { a: 'A', b: 'B' } });
  const second = await fetchTranslations({ lang: 'Lao', context: 'participant-ui', sourceTexts: { a: 'A', b: 'B' }, fetchImpl, storage });
  assert.equal(second.cached, true); assert.equal(calls.length, 1);
  const partialFetch = async () => ({ ok: true, status: 200, json: async () => ({ translated: { a: 'ກ' }, partial: true }) });
  const store2 = memoryStorage();
  const p = await fetchTranslations({ lang: 'Lao', context: 'x', sourceTexts: { a: 'A', b: 'B' }, fetchImpl: partialFetch, storage: store2 });
  assert.equal(p.partial, true); assert.equal(store2.m.size, 0);
});

test('fetchTranslations: English needs no request; failures reject so the page keeps English', async () => {
  let n = 0;
  const r = await fetchTranslations({ lang: 'English', context: 'x', sourceTexts: { a: 'A' }, fetchImpl: async () => { n++; } });
  assert.deepEqual(r.map, {}); assert.equal(n, 0);
  await assert.rejects(fetchTranslations({ lang: 'Lao', context: 'x', sourceTexts: { a: 'A' }, fetchImpl: async () => ({ ok: false, status: 503 }) }));
  await assert.rejects(fetchTranslations({ lang: 'Lao', context: 'x', sourceTexts: { a: 'A' }, fetchImpl: async () => ({ ok: true, json: async () => ({ translated: {} }) }) }));
});

test('initialLanguage: ?lang= wins, then the device choice, else en; junk is ignored', () => {
  const storage = memoryStorage();
  assert.equal(initialLanguage({ search: '?lang=lo', storage }), 'lo');
  assert.equal(initialLanguage({ search: '', storage }), 'en');
  storage.setItem('3dr.lang', 'th');
  assert.equal(initialLanguage({ search: '', storage }), 'th');
  assert.equal(initialLanguage({ search: '?lang=%3Cscript%3E', storage }), 'th');
});

test('pickLanguage: only the survey\'s languages (by tag or English name); English needs no entry', () => {
  const offered = [{ code: 'lo', name: 'Lao', endonym: 'ລາວ' }, { code: 'th', name: 'Thai', endonym: 'ไทย' }];
  assert.equal(pickLanguage('lo', offered).code, 'lo');
  assert.equal(pickLanguage('Thai', offered).code, 'th');
  assert.equal(pickLanguage('km', offered), null);
  assert.equal(pickLanguage('en', offered), null);
  assert.equal(pickLanguage('lo', []), null);
});

test('helpers', () => {
  assert.equal(hashOf({ b: '2', a: '1' }), hashOf({ a: '1', b: '2' }));
  assert.ok(isEnglish('en') && isEnglish('English') && !isEnglish('Lao'));
  assert.ok(isRtl('Urdu') && !isRtl('Lao'));
});

test('fetchTranslationsProgressive: small parallel chunks, real progress to 100%, cached only when complete', async () => {
  const texts = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`k${i}`, `Text ${i}`]));
  let inFlight = 0, peak = 0; const calls = [];
  const fetchImpl = async (url, init) => { inFlight++; peak = Math.max(peak, inFlight); const b = JSON.parse(init.body); calls.push(Object.keys(b.sourceTexts).length); await new Promise(r => setTimeout(r, 5)); inFlight--; return { ok: true, status: 200, json: async () => ({ translated: Object.fromEntries(Object.entries(b.sourceTexts).map(([k, v]) => [k, `ລາວ ${v}`])) }) }; };
  const seen = []; const storage = memoryStorage();
  const r = await fetchTranslationsProgressive({ lang: 'lo', context: 'c', sourceTexts: texts, fetchImpl, storage, onProgress: p => seen.push(p.done) });
  assert.deepEqual(calls.sort((a, b) => b - a), [20, 20, 5]);
  assert.ok(peak <= 3 && peak >= 2, 'bounded parallel requests');
  assert.equal(seen[0], 0); assert.equal(seen.at(-1), 45);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], 'progress never goes backwards');
  assert.equal(Object.keys(r.map).length, 45); assert.equal(r.partial, false); assert.equal(storage.m.size, 1);
  const again = await fetchTranslationsProgressive({ lang: 'lo', context: 'c', sourceTexts: texts, fetchImpl: async () => { throw new Error('no network needed'); }, storage });
  assert.equal(again.cached, true);
});

test('fetchTranslationsProgressive: one failed chunk → partial, not cached; all failed → rejects', async () => {
  const texts = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, `Text ${i}`]));
  let n = 0;
  const flaky = async (url, init) => { const b = JSON.parse(init.body); if (n++ === 0) return { ok: false, status: 502 }; return { ok: true, json: async () => ({ translated: Object.fromEntries(Object.keys(b.sourceTexts).map(k => [k, 'ກ'])) }) }; };
  const storage = memoryStorage();
  const r = await fetchTranslationsProgressive({ lang: 'lo', context: 'c', sourceTexts: texts, fetchImpl: flaky, storage, concurrency: 1 });
  assert.equal(r.partial, true); assert.equal(storage.m.size, 0);
  await assert.rejects(fetchTranslationsProgressive({ lang: 'lo', context: 'c', sourceTexts: texts, fetchImpl: async () => ({ ok: false, status: 503 }) }));
});
