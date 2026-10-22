// UI Next (v4) session store. Status: provisional. Reads the same identity the current UI reads (GET /v2/me) and signs in/out by the
// same routes (ui/assess/scope.js entry page: /v2/auth/email link, /v2/auth/link + /v2/auth/session code; assess.js signOut: DELETE /v2/auth/session).
import { api, classify, setToken } from "./api.js";
let cached = null; // { principal, grants } | null (signed out) ; undefined = not read yet
export async function me({ fresh = false } = {}) {
  if (cached !== null && cached !== undefined && !fresh) return cached;
  try { cached = await api("/v2/me"); }
  catch (e) { if (classify(e) === "unauthenticated") { cached = null; return null; } throw e; }
  return cached;
}
export const forget = () => { cached = undefined; };
export function initialsOf(p) {
  const n = String(p?.display_name || "").trim();
  if (n) return n.split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return "You".slice(0, 1);
}
export const firstName = (p) => (String(p?.display_name || "").trim().split(/\s+/)[0] || "You");
// Email link (DEV/production): one POST; the server mails the link, which signs the browser in by cookie and lands on /#session=.
export async function emailLink(email) { return api("/v2/auth/email", { method: "POST", body: { email } }); }
// Are email links on in this environment? The current UI's probe (ui/assess/assess.js loadEmailLinks): GET /v2/auth/email?probe,
// an environment fact with no session; off (production normally: MAGIC_LINK disabled) means sign-in is the Access page.
let emailLinks;
export async function emailLinksOn() {
  if (typeof emailLinks === "boolean") return emailLinks;
  try { const r = await fetch("/v2/auth/email?probe", { headers: { accept: "application/json" }, credentials: "same-origin", redirect: "error", cache: "no-store", ...(typeof AbortSignal?.timeout === "function" ? { signal: AbortSignal.timeout(2000) } : {}) }); emailLinks = r.ok && (await r.json())?.email_links === true; }
  catch { emailLinks = false; }
  return emailLinks;
}
export const ACCESS_HREF = "/v2/auth/access";
// Synthetic code sign-in (DEV sandbox only: name@…example.invalid): the code comes back in-band and the session is a bearer this tab keeps.
export async function requestCode(email) { return api("/v2/auth/link", { method: "POST", body: { email } }); }
export async function redeemCode(email, code) {
  const r = await api("/v2/auth/session", { method: "POST", body: { email, code } });
  if (!r?.session) throw new Error("The server answered without a session token.");
  setToken(r.session); forget();
  return r;
}
// Sign out only when the server confirms it (signed_out: true, src/handlers/platform.ts) or says the session is already gone
// (unauthenticated); an unknown outcome keeps the local identity and throws, so a shared device is never shown as signed out
// while the HttpOnly cookie may still be live.
export async function signOut() {
  try { const r = await api("/v2/auth/session", { method: "DELETE" }); if (r?.signed_out !== true) throw new Error("The server did not confirm the sign-out."); }
  catch (e) { if (classify(e) !== "unauthenticated") throw e; }
  setToken(null); forget();
}
