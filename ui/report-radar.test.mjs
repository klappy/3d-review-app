import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { radarModel, renderLensRadar, radarCopy } from './report-radar.js';
import { renderReport } from './report-view.js';

// Synthetic payload: three perspectives, one area not asked of Community (the skipped spoke), one single-lens area.
const SYNTH = {
  id: 'rep_synth_radar', created_at: '2026-10-16T12:00:00Z',
  payload: {
    source_commit: 'f042cdeabcdef123456', versions: { scorer: 's', narrative: 'n', policy: 'p' },
    lenses: [{ lens: 'team', score: 66, sub_dimensions: [{ sub_dimension: 'process', score: 70, n_items_included: 3 }] }],
    cross_lens_multi: [
      { construct_name: 'Clarity / Naturalness', agreement_range: 4, lens_scores: [{ lens: 'Church', score: 72 }, { lens: 'Community', score: 70 }, { lens: 'Translation Team', score: 68 }] },
      { construct_name: 'Appeal / Beauty', agreement_range: 52, lens_scores: [{ lens: 'Church', score: 84 }, { lens: 'Translation Team', score: 32 }] },
      { construct_name: 'Trust / Readiness', agreement_range: 41, lens_scores: [{ lens: 'Church', score: 30 }, { lens: 'Community', score: 45.5 }, { lens: 'Translation Team', score: 71 }] },
    ],
    cross_lens_single: [{ construct_name: 'Consistency', agreement_range: null, lens_scores: [{ lens: 'Translation Team', score: 61 }] }],
    standalone_indicators: [{ question_text: 'Is the meaning clear?', lens: 'community', sub_dimension: 'clarity', score: 82.5, n_responses: 9 }],
    evidence: [{ form_type: 'CW', label: 'Community — Written', n: 7 }],
  },
};
const doc = () => new JSDOM('<!doctype html><body></body>').window.document;

test('R1 spokes are the areas two or more perspectives scored; single-lens areas are not spokes', () => {
  const m = radarModel(SYNTH);
  assert.deepEqual(m.spokes, ['Clarity / Naturalness', 'Appeal / Beauty', 'Trust / Readiness']);
  assert.deepEqual(m.lenses.map(l => l.lens), ['Church', 'Community', 'Translation Team']);
});

test('R2 a perspective not asked about an area skips that spoke (null), never zero', () => {
  const community = radarModel(SYNTH).lenses.find(l => l.lens === 'Community');
  assert.deepEqual(community.scores, [70, null, 45.5]);
});

test('R3 fewer than three shared areas: no radar (a radar needs three spokes)', () => {
  const two = { payload: { ...SYNTH.payload, cross_lens_multi: SYNTH.payload.cross_lens_multi.slice(0, 2) } };
  assert.equal(radarModel(two), null);
  assert.equal(renderLensRadar({ doc: doc(), report: two }), null);
  assert.equal(radarModel({ payload: null }), null);
});

test('R4 full report renders one inline SVG radar with a polygon per perspective, legend, and "out of 100" scale', () => {
  const d = doc(); const root = d.createElement('div');
  assert.equal(renderReport({ doc: d, root, report: SYNTH }), true);
  const radar = root.querySelector('[data-lens-radar]');
  assert.ok(radar, 'radar section present');
  assert.equal(radar.querySelectorAll('svg').length, 1);
  assert.equal(radar.querySelectorAll('[data-radar-lens]').length, 3);
  assert.match(radar.textContent, /out of 100/);
  assert.deepEqual([...radar.querySelectorAll('.lens-radar-legend li')].map(li => li.textContent), ['Church', 'Community', 'Translation team']);
  assert.ok(radar.querySelector('svg title'), 'svg has an accessible title');
  assert.equal(radar.querySelector('h4').textContent, radarCopy.heading);
  // Radar follows the agree / disagree block (the block still leads, DEC-0012).
  const sections = [...root.children];
  assert.ok(sections.indexOf(radar) === sections.findIndex(s => s.dataset && 'lensesAgree' in s.dataset) + 1);
});

test('R5 skipped spoke: the Community polygon has a marker only on the spokes it scored', () => {
  const d = doc(); const root = d.createElement('div');
  renderReport({ doc: d, root, report: SYNTH });
  const community = root.querySelector('[data-radar-lens="Community"]');
  assert.equal(community.querySelectorAll('circle').length, 2);
  const church = root.querySelector('[data-radar-lens="Church"]');
  assert.equal(church.querySelectorAll('circle').length, 3);
});

test('R6 every numeric score in the full report is labelled "out of 100"', () => {
  const d = doc(); const root = d.createElement('div');
  renderReport({ doc: d, root, report: SYNTH });
  const labels = [...root.querySelectorAll('dt')].map(n => n.textContent).filter(t => /score/i.test(t));
  assert.ok(labels.length >= 2);
  for (const t of labels) assert.match(t, /out of 100/);
  const overall = [...root.querySelectorAll('.report-metric-label')].map(n => n.textContent);
  for (const t of overall) assert.match(t, /out of 100/);
  for (const li of root.querySelectorAll('[data-lens-score]')) assert.match(li.textContent, /out of 100/);
});
