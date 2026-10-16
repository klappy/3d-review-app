import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE_LIMIT_MESSAGE, holdRetry, isRateLimited, rateLimitMessage, retryAfterFromResponse, retryAfterOf, retryAfterSeconds } from './rate-limit.js';

test('DoD 6: the message says plainly it is a rate limit and to try again in one minute', () => {
  assert.equal(RATE_LIMIT_MESSAGE, 'Too many requests right now — this is a rate limit. Try again in one minute.');
  assert.equal(rateLimitMessage(), RATE_LIMIT_MESSAGE);
  assert.equal(rateLimitMessage(60), RATE_LIMIT_MESSAGE);
  assert.match(rateLimitMessage(30), /this is a rate limit\. Try again in 30 seconds\./);
  assert.match(rateLimitMessage(900), /Try again in 15 minutes\./);
});
test('Retry-After: header first, then envelope retry_after, else 60; capped at one hour', () => {
  const res = h => ({ headers: { get: k => (k === 'retry-after' ? h : null) } });
  assert.equal(retryAfterFromResponse(res('60'), null), 60);
  assert.equal(retryAfterFromResponse(res('15'), { error: { data: { retry_after: 60 } } }), 15);
  assert.equal(retryAfterFromResponse(res(null), { error: { data: { retry_after: 42 } } }), 42);
  assert.equal(retryAfterFromResponse(res(null), null), 60);
  assert.equal(retryAfterSeconds('junk'), 60); assert.equal(retryAfterSeconds(-5), 60); assert.equal(retryAfterSeconds(99999), 3600);
  assert.equal(retryAfterOf({ retryAfter: 20 }), 20); assert.equal(retryAfterOf({ data: { retry_after: 7 } }), 7); assert.equal(retryAfterOf({}), 60);
});
test('isRateLimited: RATE_LIMITED code, "429" code or HTTP 429', () => {
  assert.ok(isRateLimited({ code: 'RATE_LIMITED' })); assert.ok(isRateLimited({ code: '429' })); assert.ok(isRateLimited({ status: 429 }));
  assert.ok(!isRateLimited({ code: 'NOT_AUTHORIZED', status: 403 })); assert.ok(!isRateLimited(null));
});
test('holdRetry keeps the control disabled with a countdown, then enables it after the wait', () => {
  let t = 0, tick = null, ready = 0;
  const button = { disabled: false, textContent: 'Try again', dataset: {} };
  holdRetry(button, 60, { now: () => t, setTimer: fn => { tick = fn; return 1; }, clearTimer: () => { tick = null; }, onReady: () => ready++ });
  assert.equal(button.disabled, true); assert.equal(button.textContent, 'Try again (60 s)'); assert.equal(button.dataset.rateLimited, 'true');
  t = 59_000; tick(); assert.equal(button.disabled, true); assert.equal(button.textContent, 'Try again (1 s)');
  t = 60_000; tick(); assert.equal(button.disabled, false); assert.equal(button.textContent, 'Try again'); assert.equal(ready, 1);
  assert.equal(button.dataset.rateLimited, undefined);
});
