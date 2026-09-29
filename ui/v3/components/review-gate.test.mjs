import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewGate, v3GateAction, V3_REVIEW_CHECK, stageMoveButton, askStageMove } from './review-gate.js';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as m from '../../assess/v3-assessment.js';
test('review gate: one primary per state, viewers badge only', () => {
  assert.equal(v3GateAction('collect', 'owner').action, 'recordReview');
  assert.match(reviewGate('collect', 'owner'), /data-v3-review-check[\s\S]*disabled/);
  assert.match(reviewGate('improve', 'owner'), /data-v3-gate="none"[\s\S]*Reviewed/);
  assert.doesNotMatch(reviewGate('collect', 'viewer'), /button/);
});
test('v3-assessment re-exports the same component bindings', () => {
  assert.equal(m.v3ReviewGateMarkup, reviewGate); assert.equal(m.v3GateAction, v3GateAction); assert.equal(m.V3_REVIEW_CHECK, V3_REVIEW_CHECK); assert.equal(m.stageMoveButton, stageMoveButton); assert.equal(m.askStageMove, askStageMove);
});
test('U34: stage move is confirmed in the page; Cancel writes nothing, confirm writes once', () => {
  const doc = new JSDOM(`<div class="title">${stageMoveButton('understand', 'Move to Understand', { primary: true })}</div><div id="after"></div>`).window.document;
  const b = doc.querySelector('button[data-stage="understand"]'); let calls = 0;
  assert.equal(b.className, 'primary');
  askStageMove(b, 'Move this assessment from Collecting responses to Ready to look at results? This closes collection for 2 included surveys.', 'Move to Understand', () => calls++);
  askStageMove(b, 'again', 'Move to Understand', () => calls++); // re-asking never stacks two confirms
  assert.equal(doc.querySelectorAll('[data-stage-confirm]').length, 1);
  assert.equal(doc.querySelector('.title').nextElementSibling.hasAttribute('data-stage-confirm'), true);
  doc.querySelector('[data-stage-confirm-cancel]').click(); assert.equal(calls, 0); assert.equal(doc.querySelectorAll('[data-stage-confirm]').length, 0);
  askStageMove(b, 'Move?', 'Move to Understand', () => calls++);
  doc.querySelector('[data-stage-confirm-go]').click(); assert.equal(calls, 1); assert.equal(doc.querySelectorAll('[data-stage-confirm]').length, 0);
});
test('U34: Collect carries Move to Understand as its primary; Prepare no longer moves Collect forward; no window.confirm', () => {
  const src = readFileSync(new URL('../../assess/assess.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /window\.confirm\(/);
  assert.match(src, /tab === 'collect' && a\.stage === 'collect'[^\n]*stageMoveButton\('understand', 'Move to Understand', \{ primary: true/);
  assert.match(src, /next && a\.stage !== 'collect' \?/);
  assert.match(src, /askStageMove\(b, /);
});
