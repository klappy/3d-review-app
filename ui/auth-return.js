// One tab's chosen sign-in UI, not a persistent UI preference or a return URL.
const KEY = '3dr-auth-return-ui';
export function rememberAuthReturn(ui, storage) {
  try { (storage ?? globalThis.sessionStorage).setItem(KEY, ui); } catch { /* optional intent */ }
}
export function authReturnUI(storage) {
  try {
    const s = storage ?? globalThis.sessionStorage;
    // The current invitation consumer owns its pending credential and continuation.
    if (s.getItem('pendingInvite')) return 'legacy';
    return s.getItem(KEY);
  } catch { return null; }
}
export function clearAuthReturn(storage) {
  try { (storage ?? globalThis.sessionStorage).removeItem(KEY); } catch { /* optional intent */ }
}

const legacyDocuments = new WeakSet();
// A callback consumes the marker. Re-arm it at every real legacy sign-in action,
// including account switching within the same document, before its handlers run.
// Only UI intent is stored; credentials and navigation stay with their owners.
export function installLegacyAuthReturn(document, storage) {
  if (!document?.addEventListener || legacyDocuments.has(document)) return;
  legacyDocuments.add(document);
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.target?.closest?.('a[href="/v2/auth/access"], a[href="/v2/auth/email"]'))
      rememberAuthReturn('legacy', storage);
  }, true);
  document.addEventListener('submit', event => {
    if (!event.defaultPrevented && event.target?.matches?.('form[action="/v2/auth/email"]'))
      rememberAuthReturn('legacy', storage);
  }, true);
}
