// Same preference and invalidation contract as ui/assess/assess.js. Authority remains with GET /v2/me.
export const ACCESS_CHANGE = "review_access_change";
export const preferenceOf = (cookie = "") => /(?:^|;\s*)review_access=global(?:;|$)/.test(cookie) ? "global" : "my";
export function switchAccessMode(principal, mode, { document, location, storage, channel } = {}) {
  if (principal?.super_admin !== true || !["my", "global"].includes(mode) || mode === principal.access_mode) return false;
  document.cookie = `review_access=${mode}; Path=/; SameSite=Lax`;
  try { storage?.setItem(ACCESS_CHANGE, String(Date.now())); } catch {}
  try { channel?.postMessage(mode); } catch {}
  // Full navigation destroys pending requests and cached data before another scope is shown.
  location.replace("/next/#/projects");
  location.reload();
  return true;
}
export function watchAccessMode(principal, { document, location, events = globalThis, channel, onChange = () => {} } = {}) {
  if (principal?.super_admin !== true) return () => {};
  let reloading = false;
  const refresh = () => {
    if (reloading || preferenceOf(document.cookie) === principal.access_mode) return;
    reloading = true; onChange(); location.reload();
  };
  const stored = (event) => { if (event.key === ACCESS_CHANGE) refresh(); };
  channel?.addEventListener("message", refresh);
  events.addEventListener("storage", stored);
  events.addEventListener("focus", refresh);
  events.addEventListener("pageshow", refresh);
  return () => {
    channel?.removeEventListener("message", refresh);
    events.removeEventListener("storage", stored);
    events.removeEventListener("focus", refresh);
    events.removeEventListener("pageshow", refresh);
  };
}
