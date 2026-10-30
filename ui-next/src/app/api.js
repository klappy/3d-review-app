// UI Next (v4) live API client. Status: provisional. The same call the current UI makes (ui/assess/assess.js api()): same-origin
// JSON, cookie session, plus the legacy facilitatorToken bearer when this tab holds one (code sign-in). No new backend.
import { observeActivity } from "./activity.js";
import { refusalError } from "../../../ui/rate-limit.js";
import { classify } from "../../../ui/assess/scope.js";
export { classify };
export function token() { try { return sessionStorage.getItem("facilitatorToken"); } catch { return null; } }
export function setToken(t) { try { if (t) sessionStorage.setItem("facilitatorToken", t); else sessionStorage.removeItem("facilitatorToken"); } catch { /* ignore */ } }
export async function apiFull(url, { method = "GET", body } = {}) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  const t = token();
  if (t) headers.authorization = `Bearer ${t}`;
  let r;
  try { r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "same-origin", cache: "no-store" }); }
  catch { const e = new Error("API unavailable. For a write, its outcome is unknown."); e.status = 0; throw e; }
  let j = null;
  try { j = await r.json(); } catch { /* unreadable */ }
  if (!r.ok || !j?.ok) throw refusalError(r.status, j?.error, r);
  observeActivity(j, t);
  return j;
}
export async function api(url, options) { return (await apiFull(url, options)).result; }
// A dangerous capability (links, report build): dry_run -> confirm_token -> execute, as ui/assess/share.js and report-build.js do.
// method: the route's verb (POST by default; PATCH for a role change, as ui/assess/permissions.js sends it).
export async function confirmed(url, params = {}, { method = "POST" } = {}) {
  const p = await api(url, { method, body: { ...params, mode: "dry_run" } });
  if (p?.suppressed === true || p?.status === "held") return { held: true, preview: p };
  if (typeof p?.confirm_token !== "string") throw new Error("Invalid preview");
  return { held: false, preview: p, result: await api(url, { method, body: { ...params, mode: "execute", confirm_token: p.confirm_token } }) };
}
export const enc = (v) => encodeURIComponent(String(v ?? ""));
