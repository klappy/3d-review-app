import { test } from 'node:test';
import assert from 'node:assert/strict';
import { responseCount } from './response-count.js';
test('n of N only when N given', () => {
  assert.match(responseCount({ responses: 4, expected: 10 }), />4 of 10 responded</);
  assert.match(responseCount({ responses: 4 }), />4 responded</);
});
test('unconfirmed shown only when sent', () => {
  assert.doesNotMatch(responseCount({ responses: 2 }), /not yet confirmed/);
  assert.match(responseCount({ responses: 2, unconfirmed: 3 }), /class="badge" data-v3-unconfirmed="3">3 not yet confirmed/);
  assert.match(responseCount({ responses: 2, unconfirmed: 0 }), /class="muted"/);
});
test('flags off hide N and unconfirmed', () => {
  const out = responseCount({ responses: 1, expected: 5, unconfirmed: 2 }, undefined, { expectedOptional: false, showUnconfirmed: false });
  assert.equal(out, '<span class="v3-count" data-v3-settled="1">1 responded</span>');
});
