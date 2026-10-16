// One wording and one retry behaviour for every rate-limit refusal a person can hit (ticket
// 3d-workshop-same-ip § Amendment, DoD 6: "rate limits should say so in the app and then let them retry in one minute").
// The server sends `retry-after: 60` on HTTP 429 and `error.data.retry_after` in the envelope; the UI says plainly
// that it is a rate limit and enables its retry control once that wait is over.
export const RATE_LIMIT_SECONDS = 60;
export const RATE_LIMIT_MESSAGE = 'Too many requests right now — this is a rate limit. Try again in one minute.';

// Seconds to wait: a positive Retry-After (header or envelope), else one minute. Capped at one hour.
export function retryAfterSeconds(value) {
  const n = Math.ceil(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3600) : RATE_LIMIT_SECONDS;
}
// The wait a refusal carries: error.retryAfter (set by the fetch helpers from the header) or the envelope's retry_after.
export function retryAfterOf(error) {
  return retryAfterSeconds(error?.retryAfter ?? error?.data?.retry_after ?? error?.retry_after);
}
export function isRateLimited(error) {
  const code = String(error?.code || '');
  return code === 'RATE_LIMITED' || code === '429' || Number(error?.status) === 429;
}
// The plain message for a wait. One minute reads as the house wording; any other Retry-After is named as given.
export function rateLimitMessage(seconds) {
  const s = retryAfterSeconds(seconds);
  if (s === RATE_LIMIT_SECONDS) return RATE_LIMIT_MESSAGE;
  const wait = s < 120 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`;
  return `Too many requests right now — this is a rate limit. Try again in ${wait}.`;
}
// Read the wait from a fetch Response (header first, then the JSON envelope already parsed by the caller).
export function retryAfterFromResponse(response, data) {
  const header = response?.headers?.get?.('retry-after');
  return retryAfterSeconds(header ?? data?.error?.data?.retry_after ?? data?.retry_after);
}
// Keep a retry control disabled for the wait, with a visible countdown, then enable it again.
// Returns a cancel function. Timer and clock are injectable for tests.
export function holdRetry(button, seconds, { label, setTimer = setInterval, clearTimer = clearInterval, now = Date.now, onReady } = {}) {
  if (!button) return () => {};
  const base = label ?? button.dataset.retryLabel ?? button.textContent;
  button.dataset.retryLabel = base;
  const until = now() + retryAfterSeconds(seconds) * 1000;
  let id = null;
  const done = () => { if (id !== null) clearTimer(id); id = null; button.disabled = false; button.textContent = base; delete button.dataset.rateLimited; delete button.dataset.retryLabel; };
  const tick = () => {
    const left = Math.ceil((until - now()) / 1000);
    if (left <= 0) { done(); onReady?.(); return; }
    button.disabled = true; button.dataset.rateLimited = 'true'; button.textContent = `${base} (${left} s)`;
  };
  tick();
  id = setTimer(tick, 1000);
  id?.unref?.(); // Node test runs: a pending countdown never holds the process open (browsers return a number)
  return done;
}
