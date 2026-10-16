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
const wait = s => s >= 3600 && s % 3600 === 0 ? `${s / 3600} hour${s === 3600 ? '' : 's'}` : s >= 60 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`;
/** The text a person sees for a rate-limit refusal: the one-minute copy, or the server's message + hint + its retry. */
export const rateLimitText = (message, hint, retryAfter) => {
  if (isOneMinuteLimit(message, retryAfter)) return RATE_LIMIT_COPY;
  const s = Number(retryAfter);
  const parts = [message || 'Rate limit.', hint].filter(Boolean).join(' — ');
  return Number.isFinite(s) && s > 60 ? `${parts} (retry after ${wait(s)})` : parts;
};
/** retry_after from the envelope, else the Retry-After header (the mail cap sends only the header). */
export const retryAfterOf = (error, response) => error?.data?.retry_after ?? response?.headers?.get?.('retry-after') ?? undefined;
/** The Error a page throws for a refused envelope. A rate-limit refusal already folds the server hint into its text
 *  (rateLimitText), so it carries no separate .hint — a caller that appends e.hint would paint it twice (Bugbot 4290741304). */
export const refusalError = (status, error, response) => {
  const limited = isRateLimited(status, error?.code);
  const e = new Error(limited ? rateLimitText(error?.message, error?.hint, retryAfterOf(error, response)) : error?.message || `Request failed (${status})`);
  e.code = error?.code || String(status); e.status = status; e.hint = limited ? undefined : error?.hint;
  return e;
};
