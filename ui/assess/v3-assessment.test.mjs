// node --test ui/assess/v3-assessment.test.mjs — lane 3: rulings a/b/c and the state-driven primary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { v3StagePrimary, v3StageWord, v3CountLine, v3BandsMarkup, V3_SET_STAGE, V3_FLAGS } from './v3-assessment.js';

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
  assert.match(h, /policy &lt;unresolved&gt;/); assert.doesNotMatch(h.slice(0, h.indexOf('data-v3-legend')), />Strong</); // cards only; the legend names every band (L3-5)
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
