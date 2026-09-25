// node --test ui/assess/v3-assessment.test.mjs — lane 3: rulings a/b/c and the state-driven primary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { v3StagePrimary, v3StageWord, v3CountLine, v3BandsMarkup, V3_SET_STAGE, V3_FLAGS, v3ExpectedFor, V3_EXPECTED_KEY } from './v3-assessment.js';

const L = ['Translation Team', 'Church', 'Community'];

test('primary follows stage: Collecting → Reviewing → Improving', () => {
  assert.match(v3StagePrimary('collect', true), /Share the survey/);
  assert.match(v3StagePrimary('understand', true), /Look at the results/);
  assert.match(v3StagePrimary('improve', true), /Open the next step/);
  assert.equal(v3StagePrimary('collect', false), '');
  assert.match(v3StagePrimary('understand', false), /Look at the results/);
  assert.equal(v3StageWord('collect'), 'Collecting responses');
});
test('set_stage mapping keeps app stage ids (ADOPTION.md)', () => {
  assert.deepEqual({ ...V3_SET_STAGE }, { launch: 'collect', recordReview: 'understand', saveAndFinish: 'improve' });
});
test('(a) denominator only when entered', () => {
  assert.match(v3CountLine({ responses: 4 }), />4 responded</);
  assert.match(v3CountLine({ responses: 4, expected: 10 }), />4 of 10 responded</);
  assert.match(v3CountLine({ responses: 4, expected: '' }), />4 responded</);
});
test('(b) settled and not-yet-confirmed side by side; never guessed', () => {
  const s = v3CountLine({ responses: 7, unconfirmed: 2 });
  assert.match(s, /data-v3-settled="7"/); assert.match(s, /2 not yet confirmed/);
  assert.doesNotMatch(v3CountLine({ responses: 7 }), /confirmed/);
  assert.match(v3CountLine({ responses: 7, unconfirmed: 0 }), /0 not yet confirmed/);
  assert.doesNotMatch(v3CountLine({ responses: 7 }, undefined, { ...V3_FLAGS, showUnconfirmed: false }), /confirmed/);
});
test('(c) held results render band cards as evidence gaps, no invented band', () => {
  const h = v3BandsMarkup({ status: 'held', reason: 'policy <unresolved>' }, L);
  assert.match(h, /data-v3-bands="held"/); assert.equal((h.match(/data-v3-band=/g) || []).length, 3);
  assert.doesNotMatch(h, /policy &lt;unresolved&gt;/); // U05: never the server's policy code
  assert.equal((h.match(/Results appear after/g) || []).length, 1); assert.match(h, /data-v3-band-held>Results appear after/); // U05: one plain line under the cards, none per card
  assert.doesNotMatch(h.slice(0, h.indexOf('data-v3-legend')), />Strong</); // cards only; the legend names every band (L3-5)
  const s = v3BandsMarkup({ status: 'ready', bands: [{ perspective: 'Church', band: 'Growing', text: 'ok' }, { perspective: 'Community', band: '87%' }] }, L);
  assert.match(s, /data-v3-bands="shown"/); assert.match(s, />Growing</); assert.doesNotMatch(s, /87%/);
});

import { v3GateAction, v3ReviewGateMarkup, v3SetStage, V3_REVIEW_CHECK } from './v3-assessment.js';
test('U4 gate: Collecting → Record my review (checkbox first) → Choose a next step → Reviewed', () => {
  assert.deepEqual(v3GateAction('collect', 'owner'), { action: 'recordReview', label: 'Record my review', check: true });
  assert.equal(v3GateAction('understand', 'member').action, 'saveAndFinish');
  assert.equal(v3GateAction('improve', 'owner'), null);
  assert.equal(v3GateAction('collect', 'viewer'), null);
  const c = v3ReviewGateMarkup('collect', 'owner');
  assert.match(c, /data-v3-review-check/); assert.match(c, /data-v3-gate-go="recordReview" disabled>Record my review/);
  assert.ok(c.includes(V3_REVIEW_CHECK)); assert.match(c, /Draft · a person checks this before sharing/);
  assert.doesNotMatch(v3ReviewGateMarkup('understand', 'owner'), /data-v3-review-check|disabled/);
  assert.match(v3ReviewGateMarkup('improve', 'owner'), /data-v3-reviewed="true">Reviewed/);
  const v = v3ReviewGateMarkup('collect', 'viewer'); assert.doesNotMatch(v, /button/); assert.match(v, /data-v3-gate="none"/);
});
test('U4 gate write is one set_stage move with the mapped stage id', async () => {
  const calls = []; const api = async (url, init) => { calls.push([url, init]); return {}; };
  await v3SetStage(api, encodeURIComponent, 'a 1', 'recordReview');
  await v3SetStage(api, encodeURIComponent, 'a1', 'saveAndFinish');
  assert.deepEqual(calls, [['/v2/assessments/a%201/stage', { method: 'POST', body: { stage: 'understand' } }], ['/v2/assessments/a1/stage', { method: 'POST', body: { stage: 'improve' } }]]);
  await assert.rejects(v3SetStage(api, encodeURIComponent, 'a1', 'nope'));
});

// L3-3: U2 evidence toggle + table, group counts on band cards (Bincy screen 10).
import { v3EvidenceRows, v3EvidenceMarkup, v3GroupCountText, V3_EVIDENCE_FOOTER } from './v3-assessment.js';
test('U2 evidence rows: held result → held state + server reason, counts only from server', () => {
  const held = { status: 'held', reason: 'D7 policy unresolved' };
  const rows = v3EvidenceRows(held, L, { 'Translation Team': { surveys: 1, loaded: 1, responses: 3 }, Church: { surveys: 0, loaded: 0, responses: 0 } });
  assert.deepEqual(rows[0], ['Translation Team', 'Held · no band yet · 3 responses', 'D7 policy unresolved']);
  assert.deepEqual(rows[1], ['Church', 'Not asked in this review', 'Missing data is not a low result']);
  assert.equal(rows[2][1], 'Not asked in this review');
  assert.ok(rows.every(r => !/\d+(\.\d+)?%|score/i.test(r.join(' '))));
});
test('U2 toggle: closed by default, table hidden; open shows Simple view', () => {
  const c = v3EvidenceMarkup([['A', 'b', 'c']], false), o = v3EvidenceMarkup([['A', 'b', 'c']], true);
  assert.match(c.btn, /Show evidence and details/); assert.match(c.btn, /aria-expanded="false"/); assert.match(c.table, /data-v3-evidence hidden/);
  assert.match(o.btn, /Simple view/); assert.doesNotMatch(o.table, / hidden/);
  assert.ok(o.table.includes('Missing data is not a low result') && V3_EVIDENCE_FOOTER.length > 0);
  assert.match(v3EvidenceMarkup([['<x>', '', '']], true).table, /&lt;x&gt;/);
});
test('group count on band cards: partial loads say so; no survey says so', () => {
  assert.equal(v3GroupCountText({ surveys: 2, loaded: 2, responses: 1 }), '1 response');
  assert.equal(v3GroupCountText({ surveys: 2, loaded: 1, responses: 4 }), '4 responses so far (1 of 2 survey counts loaded)');
  assert.equal(v3GroupCountText(undefined), 'Not asked in this review');
  assert.equal(v3GroupCountText({ surveys: 2, loaded: 0, responses: 0 }), 'Count not loaded yet');
  assert.deepEqual(v3EvidenceRows({ bands: [{ perspective: 'Church', band: 'Strong' }] }, ['Church'], { Church: { surveys: 1, loaded: 0, responses: 0 } })[0], ['Church', 'Strong · Count not loaded yet', 'Count not loaded yet']);
  assert.match(v3BandsMarkup({ status: 'held' }, L, undefined, { Church: { surveys: 1, loaded: 1, responses: 2 } }), /data-v3-band-count="Church">2 responses/);
  assert.doesNotMatch(v3BandsMarkup({ status: 'held' }, L), /data-v3-band-count/);
});

test('L3-4 next step: flag on; copy from frame 11; the stage move stays on the Understand gate', async () => {
  const m = await import('./v3-assessment.js');
  assert.equal(m.V3_FLAGS.nextStepPage, true); assert.equal(m.V3_NEXT.title, 'What happens next?'); assert.equal(m.V3_NEXT.save, 'Save notes');
  assert.equal(m.v3GateAction('understand', 'member').action, 'saveAndFinish'); assert.equal(m.V3_SET_STAGE.saveAndFinish, 'improve');
});

test('L3-5: results legend carries one token colour dot per band word (prototype frame 10)', async () => {
  const m = await import('./v3-assessment.js');
  const html = m.v3BandsMarkup({ status: 'held', reason: 'x' }, ['Translation Team', 'Church', 'Community']);
  const legend = html.slice(html.indexOf('data-v3-legend'));
  for (const [w, v] of m.V3_LEGEND) assert.ok(legend.includes(`<i class="dot" style="background:var(${v})" aria-hidden="true"></i>${w}`), w);
  assert.equal(m.V3_LEGEND.length, 5);
});

// L3-12 — CAPTAIN RULING 12:22: provisional cut-offs from the report's per-perspective score, min 3 responses.
test('v3ScoreBand: provisional cut-offs and the minimum response count', async () => {
  const { v3ScoreBand, V3_BAND_CUTOFFS } = await import('./v3-assessment.js');
  assert.deepEqual({ ...V3_BAND_CUTOFFS }, { provisional: true, strong: 75, growing: 60, needsSupport: 40, minResponses: 3 });
  assert.equal(v3ScoreBand(75, 3), 'Strong'); assert.equal(v3ScoreBand(74.9, 3), 'Growing'); assert.equal(v3ScoreBand(60, 10), 'Growing');
  assert.equal(v3ScoreBand(59.9, 3), 'Needs support'); assert.equal(v3ScoreBand(40, 3), 'Needs support'); assert.equal(v3ScoreBand(39.9, 3), 'Needs urgent attention');
  assert.equal(v3ScoreBand(90, 2), 'More input needed'); assert.equal(v3ScoreBand(90, null), 'More input needed'); assert.equal(v3ScoreBand(null, 9), 'More input needed');
});
test('v3BandsMarkup: report scores band each perspective and sub-dimension, labelled provisional; held without scores', async () => {
  const { v3BandsMarkup, v3ReportScores, v3EvidenceRows } = await import('./v3-assessment.js');
  const report = { payload: { lenses: [{ lens: 'Church', score: 45.8, sub_dimensions: [{ sub_dimension: 'Affirmation', score: 41.7 }, { sub_dimension: 'Translation Brief', score: 80 }] }, { lens: 'Community', score: 47.1, sub_dimensions: [] }] } };
  const scores = v3ReportScores(report), lenses = ['Translation Team', 'Church', 'Community'];
  const groups = { 'Translation Team': { surveys: 1, loaded: 1, responses: 5 }, Church: { surveys: 1, loaded: 1, responses: 4 }, Community: { surveys: 1, loaded: 1, responses: 2 } };
  const html = v3BandsMarkup({ status: 'held', reason: 'D7' }, lenses, undefined, groups, scores);
  assert.match(html, /data-v3-bands="provisional"/); assert.match(html, /data-v3-provisional/);
  assert.match(html, /data-v3-band="Church" data-v3-band-word="Needs support"/);
  assert.match(html, /Affirmation · <strong>Needs support/); assert.match(html, /Translation Brief · <strong>Strong/);
  assert.match(html, /data-v3-band="Community" data-v3-band-word="More input needed"/); // 2 responses < 3
  assert.match(html, /data-v3-band="Translation Team" data-v3-band-word="More input needed"/); // not in the report
  assert.doesNotMatch(html, /45\.8/); // bands first; numbers only behind the evidence toggle
  assert.match(v3EvidenceRows({ status: 'held' }, lenses, groups, scores)[1][1], /Needs support \(provisional\) · score 45\.8/);
  const heldHtml = v3BandsMarkup({ status: 'held', reason: 'D7' }, lenses, undefined, groups, null);
  assert.match(heldHtml, /data-v3-bands="held"/); assert.doesNotMatch(heldHtml, /data-v3-provisional/);
});
test('v3ReportScores: a null, empty or boolean score is no score (never banded as 0)', async () => {
  const { v3ReportScores, v3ScoreBand } = await import('./v3-assessment.js');
  const sc = v3ReportScores({ payload: { lenses: [{ lens: 'Church', score: null }, { lens: 'Community', score: '' }, { lens: 'Translation Team', score: true, sub_dimensions: [] }, { lens: 'X', score: 50, sub_dimensions: [{ sub_dimension: 'A', score: null }, { sub_dimension: 'B', score: '61' }] }] } });
  assert.deepEqual(Object.keys(sc), ['X']); assert.deepEqual(sc.X.subs, [{ name: 'B', score: 61 }]);
  assert.equal(v3ScoreBand(false, 9), 'More input needed'); assert.equal(v3ScoreBand('', 9), 'More input needed');
});

import { v3StageStepper } from './v3-assessment.js';
test('L3-13 assessment stages render the shared Stepper: active stage, earlier ticked, steps navigate', () => {
  const h = v3StageStepper('understand', v => `#assessment/a1/${v}`);
  assert.match(h, /class="v3-stepper stepper"/);
  assert.equal((h.match(/<li class="done"/g) || []).length, 2);
  assert.match(h, /<li class="on" aria-current="step"><a href="#assessment\/a1\/understand">/);
  assert.match(h, /href="#assessment\/a1\/improve"/);
  assert.doesNotMatch(v3StageStepper('prepare'), /<a /);
  assert.match(v3StageStepper('weird'), /<li class="on" aria-current="step">/);
});

test('B-07: collect reads the expected number the wizard stored on this device', () => {
  const mem = v => ({ getItem: k => (k === V3_EXPECTED_KEY ? v : null) });
  assert.equal(v3ExpectedFor('s1', mem(JSON.stringify({ s1: 5 }))), 5);
  assert.equal(v3ExpectedFor('s1', mem(JSON.stringify({ s1: '5' }))), 5);
  assert.equal(v3ExpectedFor('s2', mem(JSON.stringify({ s1: 5 }))), null);
  assert.equal(v3ExpectedFor('s1', mem(JSON.stringify({ s1: 0 }))), null);
  assert.equal(v3ExpectedFor('s1', mem('not json')), null);
  assert.equal(v3ExpectedFor('s1', null), null);
  assert.match(v3CountLine({ responses: 3, expected: v3ExpectedFor('s1', mem(JSON.stringify({ s1: 5 }))) }), />3 of 5 responded</);
  assert.match(v3CountLine({ responses: 3, expected: v3ExpectedFor('s9', mem('{}')) }), />3 responded</);
});
