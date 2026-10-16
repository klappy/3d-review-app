// One message for every one-minute rate-limit refusal a person can see (workshop same-IP ticket, DoD 6): it says it is
// a rate limit, that nothing was lost, and that a retry after one minute will work. The server sends Retry-After: 60.
// It names no source ("this network", "this session"): the same copy covers the per-address, per-session (wr:) and
// global (g:) limiters, and the page cannot tell which one refused (review 6207996655, copy finding).
export const RATE_LIMIT_LEAD = 'Rate limit: too many requests right now.';
export const RATE_LIMIT_COPY = `${RATE_LIMIT_LEAD} Nothing was lost. Try again in one minute.`;
/** The server's plain message for every one-minute limiter (src/ratelimit.ts RATE_LIMIT_MESSAGE). */
export const SERVER_MINUTE_MESSAGE = 'rate limit — try again in a minute';
export const isRateLimited = (status, code) => Number(status) === 429 || String(code || '') === 'RATE_LIMITED' || String(code || '') === '429';
/** true when the refusal is one of the one-minute limiters. Any other cap (the hourly invite cap, the 900 s mail cap)
 *  keeps the server's own message, hint and retry time — telling that person "one minute" makes them fail again. */
export const isOneMinuteLimit = (message, retryAfter) => {
  const s = retryAfter == null || retryAfter === '' ? NaN : Number(retryAfter);
  if (Number.isFinite(s) && s > 60) return false;
  return !message || message === SERVER_MINUTE_MESSAGE;
};
const wait = s => s >= 3600 && s % 3600 === 0 ? `${s / 3600} hour${s === 3600 ? '' : 's'}` : s >= 60 ? `${Math.ceil(s / 60)} minutes` : s === 1 ? '1 second' : `${s} seconds`;
/** The text a person sees for a rate-limit refusal: the one-minute copy, or the server's message + hint + its retry. */
export const rateLimitText = (message, hint, retryAfter) => {
  if (isOneMinuteLimit(message, retryAfter)) return RATE_LIMIT_COPY;
  const s = Number(retryAfter);
  const parts = [message || 'Rate limit.', hint].filter(Boolean).join(' — ');
  return Number.isFinite(s) && s > 60 ? `${parts} (retry after ${wait(s)})` : parts;
};
/** retry_after from the envelope, else the Retry-After header (the mail cap sends only the header). An empty header
 *  counts as absent, so it never hides the envelope's value (review 6207520971 item 5). */
const present = v => v == null || String(v).trim() === '' ? undefined : v;
export const retryAfterOf = (error, response) => present(error?.data?.retry_after) ?? present(response?.headers?.get?.('retry-after'));
/** The Error a page throws for a refused envelope. A rate-limit refusal already folds the server hint into its text
 *  (rateLimitText), so it carries no separate .hint — a caller that appends e.hint would paint it twice (Bugbot 4290741304). */
export const refusalError = (status, error, response) => {
  const limited = isRateLimited(status, error?.code);
  const e = new Error(limited ? rateLimitText(error?.message, error?.hint, retryAfterOf(error, response)) : error?.message || `Request failed (${status})`);
  e.code = error?.code || String(status); e.status = status; e.hint = limited ? undefined : error?.hint;
  if (limited) e.retryAfter = retryAfterOf(error, response);
  return e;
};

// ---- The timed retry control (DoD 6: "let them retry in one minute"). The wording above says how long; this keeps the
// control that was refused disabled for exactly that wait, with a visible countdown, then enables it again.
export const RATE_LIMIT_SECONDS = 60;
/** Seconds to wait: a positive Retry-After (header or envelope), else one minute. Clamped to 1..3600. */
export const retryAfterSeconds = value => {
  const n = Math.ceil(Number(present(value)));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3600) : RATE_LIMIT_SECONDS;
};
/** The wait in words for copy beside a held control: "one minute" for the standard 60 s (or no Retry-After), else the
 *  server's Retry-After wait ("30 seconds", "2 minutes"), so the words match the countdown (#496 review finding 1). */
export const waitWords = value => { const s = retryAfterSeconds(value); return s === RATE_LIMIT_SECONDS ? 'one minute' : wait(s); };
/** true for an Error a page built from a refused envelope (refusalError, or any error carrying .status / .code). */
export const isRateLimitedError = error => isRateLimited(error?.status, error?.code);
/** Participant translation refused by a rate limit (DoD 6): the page stays in English; the words name the wait. */
export const rateLimitedTranslate = retryAfter => `${RATE_LIMIT_LEAD} Showing English. Try again in ${waitWords(retryAfter)}.`;
const left = s => s >= 120 ? `${Math.ceil(s / 60)} min` : `${s} s`;
/** Keep a retry control disabled for the wait, with a visible countdown, then enable it again. While the hold runs the
 *  button carries data-rate-limited, so a page's busy/idle repaint must leave it alone. Returns a cancel function.
 *  Timer and clock are injectable for tests. */
const holds = new WeakMap(); // button → cancel of its running hold: a second hold replaces the first, never stacks
export function holdRetry(button, seconds, { label, setTimer = setInterval, clearTimer = clearInterval, now = Date.now, onReady } = {}) {
  if (!button) return () => {};
  const base = label ?? button.dataset.retryLabel ?? button.textContent;
  holds.get(button)?.();
  button.dataset.retryLabel = base;
  const until = now() + retryAfterSeconds(seconds) * 1000;
  let id = null;
  let over = false;
  const label_ = () => button.dataset.retryLabel || base; // a page may swap dataset.retryLabel mid-wait (language switch)
  const done = () => { if (over) return; over = true; if (id !== null) clearTimer(id); id = null; if (holds.get(button) === done) holds.delete(button); button.disabled = false; button.textContent = label_(); delete button.dataset.rateLimited; delete button.dataset.retryLabel; };
  holds.set(button, done);
  const tick = () => {
    const s = Math.ceil((until - now()) / 1000);
    if (s <= 0) { done(); onReady?.(); return; }
    button.disabled = true; button.dataset.rateLimited = 'true'; button.textContent = `${label_()} (${left(s)})`;
  };
  tick();
  id = setTimer(tick, 1000);
  id?.unref?.(); // Node test runs: a pending countdown never holds the process open (browsers return a number)
  return done;
}
/** A repaint that restores controls after a request skips any control still under holdRetry (Bugbot 4290666357). */
export const underHold = button => button?.dataset?.rateLimited === 'true';
/** Set a control's words without ending its countdown: under a hold the new words go to the label the hold paints. */
export function setControlLabel(node, text) { if (!node) return; if (underHold(node)) node.dataset.retryLabel = text; else node.textContent = text; }
/** true once a rate-limited "unavailable" screen's wait is over: its retry control shows and no longer counts down.
 *  Reads the state's flag, not the notice text, so a longer cap's own message ("…15 minutes") is replaced too.
 *  Tests the button itself: the page hides it while a Try again request is in flight and leaves it hidden if that
 *  request rejects, so "try again now" never points at nothing (#490 re-review low; #495 review nit). */
export const rateLimitWaitOver = (state, button) => state?.phase === 'unavailable' && state?.rateLimited === true && !!button && !button.hidden && !underHold(button);
/** true while a Try again request is in flight: the controller is busy and the page hid the retry control. */
export const rateLimitRetrying = (state, button) => state?.phase === 'unavailable' && state?.rateLimited === true && state?.busy === true && !!button && button.hidden === true;
/** The notice a rate-limited screen shows instead of the controller's, or null to keep it: neutral words while a Try
 *  again is in flight (the wait copy has already run out, #495 review low), the ready words once the wait is over. */
export const rateLimitNotice = (state, button, { retrying, ready }) => rateLimitRetrying(state, button) ? retrying : rateLimitWaitOver(state, button) ? ready : null;
