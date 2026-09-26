// component: Response count (captain ruling 12:34). ONE count line for collect (07) and results (10): settled responses
// ("n of N responded" only when the facilitator gave N — RULING a) beside "n not yet confirmed" (RULING b). Pure string
// builder: no reads; never shows a denominator or an unconfirmed number the caller did not pass.
const esc0 = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));

/** `opts.expectedOptional` / `opts.showUnconfirmed` default on (RULING a/b). */
export function responseCount({ responses, expected, unconfirmed } = {}, esc = esc0, { expectedOptional = true, showUnconfirmed = true } = {}) {
  const got = num(responses) ?? 0, of = expectedOptional ? num(expected) : null, unc = num(unconfirmed);
  const settled = !of ? `${got} responded` : got < of ? `${got} of ${of} responded` : `${got} responded · ${of} expected`; // U39: never "6 of 3"
  const pending = !showUnconfirmed || unc === null ? ''
    : `<span class="${unc ? 'badge' : 'muted'}" data-v3-unconfirmed="${unc}">${unc} not yet confirmed</span>`;
  return `<span class="v3-count" data-v3-settled="${got}">${esc(settled)}</span>${pending ? ` <span aria-hidden="true">·</span> ${pending}` : ''}`;
}
