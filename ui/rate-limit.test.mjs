import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE_LIMIT_COPY, holdRetry, isRateLimitedError, rateLimitText, refusalError, retryAfterOf, retryAfterSeconds, underHold } from './rate-limit.js';

const res = h => ({ headers: { get: k => (k === 'retry-after' ? h : null) } });
test('DoD 6: one-minute refusals read the house copy; a non-minute cap never says "one minute"', () => {
  assert.equal(rateLimitText(undefined, undefined, 60), RATE_LIMIT_COPY);
  const hourly = rateLimitText('at most 30 collaborator invitations per hour', 'this cap resets over the next hour, not the next minute', 3600);
  assert.doesNotMatch(hourly, /Try again in one minute/); assert.match(hourly, /retry after 1 hour/);
});
test('retryAfterOf: envelope first, then header; an empty header falls through to the envelope', () => {
  assert.equal(retryAfterOf({ data: { retry_after: 42 } }, res('15')), 42);
  assert.equal(retryAfterOf({}, res('15')), '15');
  assert.equal(retryAfterOf({ data: { retry_after: 42 } }, res('')), 42);
  assert.equal(retryAfterOf({ data: { retry_after: '' } }, res('30')), '30');
  assert.equal(retryAfterOf({}, res('')), undefined);
});
test('retryAfterSeconds clamps to 1..3600 and defaults to one minute', () => {
  assert.equal(retryAfterSeconds('junk'), 60); assert.equal(retryAfterSeconds(-5), 60); assert.equal(retryAfterSeconds(''), 60);
  assert.equal(retryAfterSeconds(undefined), 60); assert.equal(retryAfterSeconds('15'), 15); assert.equal(retryAfterSeconds(99999), 3600);
});
test('refusalError carries the wait for a rate limit; isRateLimitedError reads status or code', () => {
  const e = refusalError(429, { code: 'RATE_LIMITED', data: { retry_after: 3600 }, message: 'at most 30 collaborator invitations per hour' });
  assert.equal(e.retryAfter, 3600); assert.ok(isRateLimitedError(e));
  assert.ok(isRateLimitedError({ code: '429' })); assert.ok(isRateLimitedError({ status: 429 }));
  assert.ok(!isRateLimitedError({ code: 'NOT_AUTHORIZED', status: 403 })); assert.ok(!isRateLimitedError(null));
  assert.equal(refusalError(403, { code: 'NOT_AUTHORIZED' }).retryAfter, undefined);
});
test('holdRetry keeps the control disabled with a countdown, then enables it after the wait', () => {
  let t = 0, tick = null, ready = 0;
  const button = { disabled: false, textContent: 'Try again', dataset: {} };
  holdRetry(button, 60, { now: () => t, setTimer: fn => { tick = fn; return 1; }, clearTimer: () => { tick = null; }, onReady: () => ready++ });
  assert.equal(button.disabled, true); assert.equal(button.textContent, 'Try again (60 s)'); assert.ok(underHold(button));
  t = 59_000; tick(); assert.equal(button.disabled, true); assert.equal(button.textContent, 'Try again (1 s)');
  t = 60_000; tick(); assert.equal(button.disabled, false); assert.equal(button.textContent, 'Try again'); assert.equal(ready, 1);
  assert.ok(!underHold(button));
});
test('holdRetry honours a non-minute cap: an hourly wait counts down in minutes, not "one minute"', () => {
  let t = 0, tick = null;
  const button = { disabled: false, textContent: 'Invite', dataset: {} };
  holdRetry(button, 3600, { now: () => t, setTimer: fn => { tick = fn; return 1; }, clearTimer: () => {} });
  assert.equal(button.textContent, 'Invite (60 min)'); assert.equal(button.disabled, true);
  t = 3_540_000; tick(); assert.equal(button.textContent, 'Invite (60 s)');
});
test('a second holdRetry on one button replaces the first: one timer, no early enable from the old one', () => {
  let t = 0; const timers = new Map(); let next = 0;
  const opts = { now: () => t, setTimer: fn => { timers.set(++next, fn); return next; }, clearTimer: id => timers.delete(id) };
  const button = { disabled: false, textContent: 'Try again', dataset: {} };
  const first = holdRetry(button, 10, opts);
  t = 5_000; holdRetry(button, 60, opts);
  assert.equal(timers.size, 1, 'the first interval was cleared'); assert.equal(button.textContent, 'Try again (60 s)');
  t = 11_000; [...timers.values()].forEach(fn => fn());
  assert.equal(button.disabled, true, 'still held by the second wait'); assert.ok(underHold(button));
  first(); assert.equal(button.disabled, true, "the stale cancel does not end the running hold");
  t = 65_000; [...timers.values()].forEach(fn => fn());
  assert.equal(button.disabled, false); assert.equal(button.textContent, 'Try again'); assert.equal(timers.size, 0);
});
