import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { radarModel, renderLensRadar, radarCopy, labelExtents, wrap } from './report-radar.js';
import { lensSpreadRows } from './report-lenses.js';
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
  // One chart in two layouts (wide, narrow), one shown at a time by a container query (#546).
  assert.deepEqual([...radar.querySelectorAll('svg')].map(s => s.getAttribute('class')), ['radar-wide', 'radar-narrow']);
  assert.equal(radar.querySelectorAll('svg.radar-wide [data-radar-lens]').length, 3);
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

// Review #499 A/B: the ?demo=1 shape — 5 spokes; one perspective on all 5, one on 2 non-adjacent spokes, one on 3.
const GAPS = { payload: { ...SYNTH.payload, cross_lens_multi: [
  { construct_name: 'Brief Process', lens_scores: [{ lens: 'Church', score: 50 }, { lens: 'Translation Team', score: 75 }] },
  { construct_name: 'Trust', lens_scores: [{ lens: 'Church', score: 25 }, { lens: 'Community', score: 45 }] },
  { construct_name: 'Understanding', lens_scores: [{ lens: 'Church', score: 50 }, { lens: 'Translation Team', score: 67 }] },
  { construct_name: 'Clarity', lens_scores: [{ lens: 'Church', score: 50 }, { lens: 'Community', score: 44 }] },
  { construct_name: 'Appeal', lens_scores: [{ lens: 'Church', score: 40 }, { lens: 'Community', score: 42 }] },
] } };
const pointsOf = el => el.getAttribute('points').trim().split(/\s+/);
test('R7 a perspective with every spoke is one closed outline; a skipped spoke breaks the outline (5/2/3)', () => {
  const d = doc(); const radar = renderLensRadar({ doc: d, report: GAPS });
  const church = radar.querySelector('[data-radar-lens="Church"]');
  assert.equal(church.querySelectorAll('polygon').length, 1);
  assert.equal(pointsOf(church.querySelector('polygon')).length, 5);
  assert.equal(church.querySelectorAll('circle').length, 5);
  // Translation team: spokes 0 and 2 only, not adjacent → two markers, no line drawn across the skipped spoke 1.
  const team = radar.querySelector('[data-radar-lens="Translation Team"]');
  assert.equal(team.querySelectorAll('polygon').length, 0);
  assert.equal(team.querySelectorAll('polyline').length, 0);
  assert.equal(team.querySelectorAll('circle').length, 2);
  // Community: spokes 1, 3, 4 → one segment 3–4 only; nothing joins across spoke 2 or spoke 0.
  const community = radar.querySelector('[data-radar-lens="Community"]');
  assert.equal(community.querySelectorAll('polygon').length, 0);
  const lines = [...community.querySelectorAll('polyline')];
  assert.deepEqual(lines.map(l => pointsOf(l).length), [2]);
  assert.equal(community.querySelectorAll('circle').length, 3);
});

test('R9 phone legibility: spoke labels fit both viewBoxes; wide keeps main sizes; narrow sizes are CSS px per band', () => {
  // Six spokes as on DEV (RESULTS-qaradar-2141): "Understanding of the Source" sat past the right edge of the old fixed box.
  const names = ['Brief Process & Perceived Fidelity', 'Trust / Readiness', 'Understanding of the Source', 'Clarity / Naturalness', 'Appeal / Beauty', 'Consistency'];
  const six = { payload: { cross_lens_multi: names.map((n, k) => ({ construct_name: n, lens_scores: [{ lens: 'Church', score: 50 + k }, { lens: 'Community', score: 60 }, { lens: 'Translation Team', score: 70 }] })) } };
  const section = renderLensRadar({ doc: doc(), report: six });
  const css = section.querySelector('style').textContent;
  for (const variant of ['wide', 'narrow']) {
    const svg = section.querySelector(`svg.radar-${variant}`);
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    assert.equal(svg.getAttribute('style'), `--vbw:${vw}`);
    assert.ok(Math.abs(vx + vw / 2 - 180) < 0.1, `${variant} box is centred on the chart`);
    const narrowFs = 11 * vw / 240; // largest narrow unit size (the 240px band)
    for (const t of svg.querySelectorAll('.spoke-label')) {
      const tspans = [...t.querySelectorAll('tspan')];
      const label = { lx: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')), anchor: t.getAttribute('text-anchor'), parts: tspans.map(s => s.textContent) };
      if (variant === 'wide') continue; // wide keeps main's fixed box exactly (asserted below); labels may overhang it as on main
      const e = labelExtents(label, narrowFs);
      // #546 HOLD k0005: whole words on the phone (no hyphen breaks for these names) and "/" stays with the word before it.
      assert.ok(label.parts.every(p => !p.endsWith('-') && p !== '/' && !p.startsWith('/')), `narrow "${label.parts.join('|')}" keeps words whole`);
      assert.ok(e.left >= vx - 0.1 && e.right <= vx + vw + 0.1 && e.top >= vy - 0.1 && e.bottom <= vy + vh + 0.1, `${variant} "${label.parts.join(' ')}" fits`);
    }
    if (variant === 'wide') assert.equal(svg.getAttribute('viewBox'), '-70 -40 500 440', 'wide box is main 8646a5b exactly');
    if (variant === 'wide') for (const c of svg.querySelectorAll('circle')) assert.equal(c.getAttribute('r'), '5', 'wide markers as on main');
    // #546 re-review: the narrow plot is never smaller than main's (box width = main's 500) and shows only rings 50 and 100.
    if (variant === 'narrow') assert.equal(vw, 500, 'narrow box keeps main width');
    assert.deepEqual([...svg.querySelectorAll('.ring-label')].map(t => t.textContent), variant === 'wide' ? ['25', '50', '75', '100'] : ['50', '100']);
    for (const r of svg.querySelectorAll('.ring-label')) assert.equal(r.getAttribute('font-size'), null, 'ring size is set in CSS only');
  }
  const appeal = [...section.querySelectorAll('svg.radar-narrow .spoke-label')].find(t => t.textContent.startsWith('Appeal'));
  assert.deepEqual([...appeal.querySelectorAll('tspan')].map(s => s.textContent), ['Appeal /', 'Beauty']);
  assert.match(css, /\.ring-label\{font-size:13px/, 'wide ring labels as on main');
  assert.match(css, /\.spoke-label\{font-size:20px/, 'wide spoke labels as on main');
  assert.match(css, /@container \(max-width:459\.98px\)/);
  assert.match(css, /\.radar-narrow \.ring-label\{font-size:calc\(11px \* var\(--vbw\) \/ var\(--wmin\)\)\}/);
  assert.match(css, /\.radar-narrow \.spoke-label\{font-size:calc\(11px \* var\(--vbw\) \/ var\(--wmin\)\)\}/);
  assert.match(css, /\.radar-narrow circle\{r:calc\(4px \* var\(--vbw\) \/ var\(--wmin\)\)\}/);
  assert.match(css, /\.radar-narrow :is\(\.ring,\.spoke,polygon,polyline,circle\)\{vector-effect:non-scaling-stroke\}/);
});

test('R10 a blank construct name (empty or whitespace-only) gives a finite viewBox, no NaN, and an em dash label', () => {
  for (const blank of ['', '   ', '\t\n']) {
    const names = ['Trust / Readiness', blank, 'Clarity / Naturalness'];
    const rep = { payload: { cross_lens_multi: names.map((n, k) => ({ construct_name: n, lens_scores: [{ lens: 'Church', score: 50 + k }, { lens: 'Community', score: 60 }] })) } };
    const section = renderLensRadar({ doc: doc(), report: rep });
    assert.ok(!section.outerHTML.includes('NaN'), `no NaN for ${JSON.stringify(blank)}`);
    for (const variant of ['wide', 'narrow']) {
      const svg = section.querySelector(`svg.radar-${variant}`);
      const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      assert.ok(vb.every(Number.isFinite), `${variant} viewBox is finite`);
      const label = [...svg.querySelectorAll('.spoke-label')][1];
      assert.deepEqual([...label.querySelectorAll('tspan')].map(s => s.textContent), ['—']);
      // Every spoke label (the dash included) is laid out at finite coordinates and sits inside its viewBox.
      for (const el of svg.querySelectorAll('.spoke-label')) {
        const parts = [...el.querySelectorAll('tspan')].map(s => s.textContent);
        const fs = variant === 'wide' ? 20 : 11 * 500 / 240;
        const e = labelExtents({ lx: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')), anchor: el.getAttribute('text-anchor'), parts }, fs);
        assert.ok([e.left, e.right, e.top, e.bottom].every(Number.isFinite), `${variant} label extents finite`);
        // Narrow grows its box to hold every label; wide keeps main's fixed box (labels may overhang it, as on main).
        if (variant === 'narrow') assert.ok(e.left >= vb[0] && e.right <= vb[0] + vb[2] && e.top >= vb[1] && e.bottom <= vb[1] + vb[3], `narrow label ${JSON.stringify(parts)} inside the box`);
      }
    }
    // Wide keeps main's fixed box exactly, and the named spokes are laid out as they are with all three named.
    const wide = section.querySelector('svg.radar-wide');
    assert.equal(wide.getAttribute('viewBox'), '-70 -40 500 440');
    const named = renderLensRadar({ doc: doc(), report: { payload: { cross_lens_multi: rep.payload.cross_lens_multi.map((e, k) => (k === 1 ? { ...e, construct_name: 'Middle' } : e)) } } }).querySelector('svg.radar-wide');
    for (const k of [0, 2]) assert.equal([...wide.querySelectorAll('.spoke-label')][k].outerHTML, [...named.querySelectorAll('.spoke-label')][k].outerHTML);
  }
});

test('R11 a missing or null construct name shows the em dash in the spoke label, the marker tooltip and the agreement row', () => {
  for (const missing of [undefined, null, '', '  ']) {
    const entries = ['Trust / Readiness', missing, 'Clarity / Naturalness'].map((n, k) => ({ ...(n === undefined ? {} : { construct_name: n }), lens_scores: [{ lens: 'Church', score: 50 + k }, { lens: 'Community', score: 60 }] }));
    const rep = { payload: { cross_lens_multi: entries } };
    assert.deepEqual(radarModel(rep).spokes, ['Trust / Readiness', '—', 'Clarity / Naturalness']);
    const section = renderLensRadar({ doc: doc(), report: rep });
    const html = section.outerHTML;
    assert.ok(!/undefined|null|NaN/.test(html), `no raw ${JSON.stringify(missing)} in the radar`);
    for (const variant of ['wide', 'narrow']) {
      const svg = section.querySelector(`svg.radar-${variant}`);
      assert.deepEqual([...[...svg.querySelectorAll('.spoke-label')][1].querySelectorAll('tspan')].map(s => s.textContent), ['—']);
      const tips = [...svg.querySelectorAll('[data-radar-lens] circle title')].map(t => t.textContent);
      assert.ok(tips.includes('Church · —: 51 out of 100'), `${variant} tooltip ${JSON.stringify(tips)}`);
      assert.ok(tips.includes('Community · —: 60 out of 100'));
    }
    const row = lensSpreadRows(rep).find(r => r.lenses.some(l => l.score === 51));
    assert.equal(row.name, '—');
  }
  // Named areas pass through exactly as returned (not trimmed, not rewritten).
  assert.deepEqual(radarModel({ payload: { cross_lens_multi: [' A ', 'B', 0].map(n => ({ construct_name: n, lens_scores: [{ lens: 'Church', score: 1 }, { lens: 'Community', score: 2 }] })) } }).spokes, [' A ', 'B', '0']);
});

test('R12 wrap() terminates and hyphenates when hardMax is 1 or 2', () => {
  for (const hardMax of [1, 2]) {
    const lines = wrap('abcdef', 1, hardMax);
    assert.ok(lines.length > 1 && lines.join('').replace(/-/g, '') === 'abcdef', `hardMax ${hardMax}: ${JSON.stringify(lines)}`);
  }
  assert.deepEqual(wrap('   '), ['—']);
});
