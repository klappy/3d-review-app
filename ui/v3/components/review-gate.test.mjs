import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewGate, v3GateAction, V3_REVIEW_CHECK } from './review-gate.js';
import * as m from '../../assess/v3-assessment.js';
test('review gate: one primary per state, viewers badge only', () => {
  assert.equal(v3GateAction('collect', 'owner').action, 'recordReview');
  assert.match(reviewGate('collect', 'owner'), /data-v3-review-check[\s\S]*disabled/);
  assert.match(reviewGate('improve', 'owner'), /data-v3-gate="none"[\s\S]*Reviewed/);
  assert.doesNotMatch(reviewGate('collect', 'viewer'), /button/);
});
test('v3-assessment re-exports the same component bindings', () => {
  assert.equal(m.v3ReviewGateMarkup, reviewGate); assert.equal(m.v3GateAction, v3GateAction); assert.equal(m.V3_REVIEW_CHECK, V3_REVIEW_CHECK);
});
