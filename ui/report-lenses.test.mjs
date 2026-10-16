import assert from 'node:assert/strict';
import test from 'node:test';
import { SPREAD_CUTS, consultantsByLens, lensLabel, lensRespondents, lensSpreadRows, lensesAgreeMarkup, lensesCss, renderLensesAgree, spreadBand } from './report-lenses.js';

// Synthetic payload: church high / translation team low on one area, the reverse on another, near-agreement on a third.
const SYNTH = {
  id: 'rep_synth_lenses',
  payload: {
    source_commit: 'f042cdeabcdef123456', versions: { scorer: 's', narrative: 'n', policy: 'p' },
    lenses: [],
    cross_lens_multi: [
      { construct_name: 'Clarity / Naturalness', triangulated_mean: 70, agreement_range: 4, n_lenses_included: 3, lens_scores: [{ lens: 'Church', score: 72 }, { lens: 'Community', score: 70 }, { lens: 'Translation Team', score: 68 }] },
      { construct_name: 'Appeal / Beauty', triangulated_mean: 58, agreement_range: 52, n_lenses_included: 2, lens_scores: [{ lens: 'Church', score: 84 }, { lens: 'Translation Team', score: 32 }] },
      { construct_name: 'Trust / Readiness', triangulated_mean: 50.5, agreement_range: 41, n_lenses_included: 3, lens_scores: [{ lens: 'Church', score: 30 }, { lens: 'Community', score: 45.5 }, { lens: 'Translation Team', score: 71 }] },
      { construct_name: 'Impact / Use', triangulated_mean: 60, agreement_range: 20, n_lenses_included: 2, lens_scores: [{ lens: 'Community', score: 50 }, { lens: 'Translation Team', score: 70 }] },
    ],
    cross_lens_single: [{ construct_name: 'Consistency', triangulated_mean: 61, agreement_range: null, n_lenses_included: 1, lens_scores: [{ lens: 'Translation Team', score: 61 }] }],
    evidence: [
      { form_type: 'CHCC', label: 'Church — Consultant', n: 1 }, { form_type: 'CHCP', label: 'Church — Community Pastor', n: 2 }, { form_type: 'CHIP', label: 'Church — Involved Pastor', n: 2 },
      { form_type: 'CW', label: 'Community — Written', n: 7 }, { form_type: 'TR', label: 'Translation Team — Translator / Validation', n: 1 },
    ],
  },
};

test('L1 spread cut points: ≤10 agree, ≥30 disagree, between is mixed', () => {
  assert.deepEqual(SPREAD_CUTS, { agree: 10, disagree: 30 });
  assert.deepEqual([0, 10, 10.01, 29.99, 30, 80].map(x => spreadBand(x)), ['agree', 'agree', 'mixed', 'mixed', 'disagree', 'disagree']);
});

test('L1b the chip classifies the rounded difference it displays (10.25 shows 10 → agree; 29.5 shows 30 → disagree)', () => {
  const at = spread => lensSpreadRows({ payload: { cross_lens_multi: [{ construct_name: 'x', lens_scores: [{ lens: 'Church', score: 50 + spread }, { lens: 'Community', score: 50 }] }] } })[0];
  for (const [spread, band, shownText] of [[10.25, 'agree', 'Perspectives agree · Difference 10'], [10.5, 'mixed', 'Some difference · Difference 11'], [29.49, 'mixed', 'Some difference · Difference 29'], [29.5, 'disagree', 'Perspectives disagree · Difference 30']]) {
    assert.equal(at(spread).band, band, `spread ${spread}`);
    assert.match(lensesAgreeMarkup({ payload: { cross_lens_multi: [{ construct_name: 'x', lens_scores: [{ lens: 'Church', score: 50 + spread }, { lens: 'Community', score: 50 }] }] } }), new RegExp(shownText));
  }
});

test('L2 respondent counts per lens come from the report evidence labels', () => {
  assert.deepEqual([...lensRespondents(SYNTH.payload)], [['Church', 5], ['Community', 7], ['Translation Team', 1]]);
  // The Consultant form sits inside the Church lens score (pinned scorer); its share is named, never re-scored here.
  assert.deepEqual([...consultantsByLens(SYNTH.payload)], [['Church', 1]]);
});

test('L3 rows: biggest spread first, single-lens last, spread recomputed from lens scores, no mean carried', () => {
  const rows = lensSpreadRows(SYNTH);
  assert.deepEqual(rows.map(r => [r.name, r.spread, r.band]), [
    ['Appeal / Beauty', 52, 'disagree'], ['Trust / Readiness', 41, 'disagree'], ['Impact / Use', 20, 'mixed'],
    ['Clarity / Naturalness', 4, 'agree'], ['Consistency', null, null],
  ]);
  assert.deepEqual(rows[0].lenses, [{ lens: 'Church', score: 84, n: 5, consultants: 1 }, { lens: 'Translation Team', score: 32, n: 1 }]);
  for (const r of rows) assert.equal('triangulated_mean' in r || 'mean' in r, false);
});

test('L4 overview markup: disagreement first, counts as text, no "average", values escaped', () => {
  const html = lensesAgreeMarkup(SYNTH);
  assert.ok(html.indexOf('Appeal / Beauty') < html.indexOf('Trust / Readiness'));
  assert.ok(html.indexOf('Trust / Readiness') < html.indexOf('Clarity / Naturalness'));
  assert.match(html, /data-spread-band="disagree"/);
  assert.match(html, /Perspectives disagree · Difference 52/);
  assert.match(html, />Translation team </); const visible = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(visible, /Translation Team/); assert.doesNotMatch(visible, /\blens(es)?\b/i); // the user's word is "perspective" (design-lens rule 5)
  assert.match(html, /<b title="84">84<\/b><span class="lens-agree-n"> 5 responses, 1 of them consultant<\/span>/);
  assert.match(html, / 1 response<\/span>/);
  assert.doesNotMatch(html, /average|mean/i);
  const hostile = { payload: { cross_lens_multi: [{ construct_name: '<img src=x onerror=1>', lens_scores: [{ lens: 'a"b', score: 1 }, { lens: 'c', score: 2 }] }] } };
  const out = lensesAgreeMarkup(hostile);
  assert.doesNotMatch(out, /<img/); assert.match(out, /&lt;img/); assert.match(out, /data-lens="a&quot;b"/);
});

test('L5 nothing to compare renders nothing; malformed entries are skipped, never guessed', () => {
  assert.equal(lensesAgreeMarkup(null), '');
  assert.equal(lensesAgreeMarkup({ payload: { cross_lens_multi: [] } }), '');
  assert.deepEqual(lensSpreadRows({ payload: { cross_lens_multi: [null, { construct_name: 'x', lens_scores: [{ lens: 'a', score: 'n/a' }] }] } }), []);
});

test('L6 full report DOM: createElement/textContent only, heading first, positions in style', () => {
  const made = [];
  const node = tag => { const n = { tag, textContent: '', children: [], dataset: {}, style: {}, append(...k) { this.children.push(...k); } }; made.push(n); return n; };
  const section = renderLensesAgree({ doc: { createElement: node }, report: SYNTH });
  assert.equal(section.tag, 'section'); assert.equal(section.children[0].textContent, 'Do the perspectives agree?');
  assert.match(section.className, /report-detail-section/);
  for (const n of made) assert.equal('innerHTML' in n, false);
  const first = section.children[2].children[0];
  assert.equal(first.dataset.spreadBand, 'disagree');
  const bar = first.children[1].children[0];
  assert.deepEqual([bar.className, bar.style.left, bar.style.width], ['lens-agree-bar', '32%', '52%']);
  assert.equal(renderLensesAgree({ doc: { createElement: node }, report: { payload: {} } }), null);
});

test('L7 full report prints exact values and classifies the band on the exact spread it shows; overview rounds', () => {
  const report = { payload: { cross_lens_multi: [{ construct_name: 'x', agreement_range: 10.25, lens_scores: [{ lens: 'Church', score: 60.25 }, { lens: 'Community', score: 50 }] }] } };
  assert.equal(lensSpreadRows(report)[0].band, 'agree'); // overview shows 10 → agree
  assert.equal(lensSpreadRows(report, { exact: true })[0].band, 'mixed'); // full report shows 10.25 → some difference
  const text = [];
  const node = tag => ({ tag, textContent: '', children: [], dataset: {}, style: {}, append(...k) { this.children.push(...k); }, set title(v) { this._t = v; } });
  const walk = n => { if (n.textContent) text.push(n.textContent); n.children.forEach(walk); };
  walk(renderLensesAgree({ doc: { createElement: node }, report }));
  assert.ok(text.includes('Some difference · Difference 10.25'), text.join('|'));
  assert.ok(text.includes('60.25') && text.includes('50'));
  assert.match(lensesAgreeMarkup(report), /Perspectives agree · Difference 10<\/span>/);
  assert.match(lensesAgreeMarkup(report), /<b title="60.25">60<\/b>/);
});

test('L8 spread prefers the payload agreement_range (exact as returned) over recomputing', () => {
  const report = { payload: { cross_lens_multi: [{ construct_name: 'x', agreement_range: 0.2, lens_scores: [{ lens: 'Church', score: 0.3 }, { lens: 'Community', score: 0.1 }] }] } };
  assert.equal(lensSpreadRows(report, { exact: true })[0].spread, 0.2);
});

test('L9 styles use design tokens only: no raw hex, no undefined --muted', () => {
  assert.doesNotMatch(lensesCss, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(lensesCss, /--muted/);
  assert.equal(lensLabel('Translation Team'), 'Translation team'); assert.equal(lensLabel('team'), 'Translation team'); assert.equal(lensLabel('Other'), 'Other');
});
