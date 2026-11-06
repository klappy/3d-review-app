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
