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
  assert.match(v3CountLine({ responses: 7 }), /none reported/);
  assert.doesNotMatch(v3CountLine({ responses: 7 }, undefined, { ...V3_FLAGS, showUnconfirmed: false }), /confirmed/);
});
test('(c) held results render band cards as evidence gaps, no invented band', () => {
  const h = v3BandsMarkup({ status: 'held', reason: 'policy <unresolved>' }, L);
  assert.match(h, /data-v3-bands="held"/); assert.equal((h.match(/data-v3-band=/g) || []).length, 3);
  assert.match(h, /policy &lt;unresolved&gt;/); assert.doesNotMatch(h, />Strong</);
  const s = v3BandsMarkup({ status: 'ready', bands: [{ perspective: 'Church', band: 'Growing', text: 'ok' }, { perspective: 'Community', band: '87%' }] }, L);
  assert.match(s, /data-v3-bands="shown"/); assert.match(s, />Growing</); assert.doesNotMatch(s, /87%/);
});
