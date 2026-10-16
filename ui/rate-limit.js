// One message for every rate-limit refusal a person can see (workshop same-IP ticket, DoD 6): it says it is a rate
// limit, that nothing was lost, and that a retry after one minute will work. The server sends Retry-After: 60.
export const RATE_LIMIT_COPY = 'Rate limit: too many requests from this network right now. Nothing was lost. Try again in one minute.';
export const isRateLimited = (status, code) => Number(status) === 429 || String(code || '') === 'RATE_LIMITED' || String(code || '') === '429';
