// Greet by the account's own display name, the email as fallback (captain ruling a1, 2026-10-02; cookbook
// work/queued/2026-09-29-3d-train22-audit-backlog/RULING-2026-10-02-greet-alias.md). The name comes ONLY from the caller's
// own GET /v2/me (principal.display_name); it is set or cleared with PATCH /v2/me (cap.me.update). Pure: returns plain
// strings or escaped HTML; no fetch, no DOM. Greeting helpers return PLAIN text — callers set textContent or escape.
export const NAME_MAX = 60;
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plainEmail = e => typeof e === 'string' && e.trim() && [...e.trim()].length <= 254 ? e.trim() : '';

/** The signed-in account's own display name, or '' (unset, not a string, or out of bounds). */
export function displayNameOf(principal) {
  const v = principal?.display_name;
  if (typeof v !== 'string') return '';
  const s = v.replace(/\s+/g, ' ').trim();
  return s && [...s].length <= NAME_MAX ? s : '';
}
/** Who to greet: the display name, else the email, else ''. Plain text. */
export function greetingName(principal, email) { return displayNameOf(principal) || plainEmail(email); }
/** "Welcome, <name or email>" or plain "Welcome". Plain text. */
export function welcomeLine(principal, email) { const n = greetingName(principal, email); return n ? `Welcome, ${n}` : 'Welcome'; }
/** The header account line: "Account: <name or email>" or "Signed in". Plain text. */
export function accountLine(principal, email) { const n = greetingName(principal, email); return n ? `Account: ${n}` : 'Signed in'; }

// First sign-in ask: shown while the account has no name and this person has not skipped it on this device.
export const skipKey = id => `3dr.name-ask.skipped.${id}`;
export function shouldAskName(principal, skipped) {
  return !!principal && (principal.kind === 'user' || principal.kind === 'support') && !displayNameOf(principal) && !skipped;
}
/** The skippable "What should we call you?" card (home, first sign-in). Escaped HTML. */
export function nameAskCard({ value = '', busy = false, message = '' } = {}) {
  return `<section class="v3h-card v3h-name-ask" data-name-ask aria-labelledby="name-ask-title"><h2 id="name-ask-title">What should we call you?</h2><p class="v3h-meta">Optional. Others on your reviews see this name instead of your email. You can change it later from the account menu.</p><form data-name-form class="line"><label class="field">Your name<input name="display_name" type="text" maxlength="${NAME_MAX}" autocomplete="name" value="${ESC(value)}" ${busy ? 'disabled' : ''}></label><div class="actions"><button type="submit" class="primary" ${busy ? 'disabled' : ''}>Save name</button><button type="button" data-name-skip ${busy ? 'disabled' : ''}>Skip</button></div><p class="small muted" role="status" data-name-status>${ESC(message)}</p></form></section>`;
}
/** Value to send for a typed name: trimmed text, or null to clear. Returns { ok, value } or { ok:false, message }. */
export function nameToSend(raw) {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return { ok: true, value: null };
  if ([...s].length > NAME_MAX) return { ok: false, message: `Use ${NAME_MAX} characters or fewer.` };
  return { ok: true, value: s };
}
