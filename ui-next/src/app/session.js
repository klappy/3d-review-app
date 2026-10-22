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
// Synthetic code sign-in (DEV sandbox only: name@…example.invalid): the code comes back in-band and the session is a bearer this tab keeps.
export async function requestCode(email) { return api("/v2/auth/link", { method: "POST", body: { email } }); }
export async function redeemCode(email, code) {
  const r = await api("/v2/auth/session", { method: "POST", body: { email, code } });
  if (!r?.session) throw new Error("The server answered without a session token.");
  setToken(r.session); forget();
  return r;
}
export async function signOut() {
  try { await api("/v2/auth/session", { method: "DELETE" }); } catch { /* the credential may already be gone */ }
  setToken(null); forget();
}
