import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnMore } from './learn-more.js';
test('learnMore: collapsed disclosure, same markup as the public home (#264)', () => {
  const h = learnMore('<p class="muted">Why.</p>');
  assert.equal(h, '<details class="small learn-more"><summary>Learn more</summary><p class="muted">Why.</p></details>');
  assert.ok(!/<details[^>]*\bopen\b/.test(h), 'collapsed by default');
});
test('learnMore: nothing to explain renders nothing; summary is escaped', () => {
  assert.equal(learnMore(''), '');
  assert.match(learnMore('<p>x</p>', { summary: '<b>' }), /<summary>&lt;b&gt;<\/summary>/);
});
