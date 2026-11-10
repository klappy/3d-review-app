import { api } from "./api.js";

export const NAME_SKIP_KEY = (id) => `3dr.name.skip:${id}`;
export const ACCOUNT_LINKS = Object.freeze({ roadmap: "/roadmap/", versions: "/roadmap/#versions" });
export function shouldAskName(principal, storage) {
  if (!principal?.id || !["user", "support"].includes(principal.kind) || principal.display_name?.trim()) return false;
  try { return !storage?.getItem(NAME_SKIP_KEY(principal.id)); } catch { return true; }
}
export function skipAccountName(principal, storage) {
  if (!principal?.id) return;
  try { storage?.setItem(NAME_SKIP_KEY(principal.id), "1"); } catch {}
}
export async function loadAccountSettings(expectedId = null, request = api) {
  const me = await request("/v2/me");
  const principal = me?.principal;
  if (!principal?.id || !["user", "support"].includes(principal.kind)) throw new Error("Sign in with your own account to edit your name.");
  if (expectedId && principal.id !== expectedId) throw new Error("The signed-in account changed. Reload account settings.");
  return principal;
}
export async function saveAccountName(principal, value, request = api) {
  if (!principal?.id || !["user", "support"].includes(principal.kind)) throw new Error("Only a signed-in account can edit its name.");
  const name = String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim() || null;
  if (name && [...name].length > 80) throw new Error("Use up to 80 characters for your name.");
  // Read identity again, then use the handler's existing own-account id guard. A changed session must not rename someone else.
  await loadAccountSettings(principal.id, request);
  const result = await request("/v2/me", { method: "PATCH", body: { display_name: name, id: principal.id } });
  if (result?.principal?.id !== principal.id || (result.principal.display_name || null) !== name) throw new Error("The name save could not be confirmed. Reload before trying again.");
  const saved = await loadAccountSettings(principal.id, request);
  if ((saved.display_name || null) !== name) throw new Error("The saved name could not be verified. Reload before trying again.");
  return saved;
}
export async function loadReleaseInfo(fetcher = globalThis.fetch) {
  const read = async (url, allowUnhealthy = false) => {
    const response = await fetcher(url, { headers: { accept: "application/json" }, credentials: "omit", cache: "no-store" });
    if (!response.ok && !allowUnhealthy) throw new Error("Release information is unavailable. Try again.");
    return response.json();
  };
  const [health, changes] = await Promise.all([read("/v2/health", true), read("/changelog.json")]);
  if (!health?.result?.version || !Array.isArray(changes?.versions)) throw new Error("Release information could not be read. Try again.");
  return { health: health.result, changes };
}
export async function loadRoadmapHistory(id, generation, after = 0, fetcher = globalThis.fetch) {
  const response = await fetcher(`/v2/roadmap/items/${encodeURIComponent(id)}/history?after=${after}&limit=25`, { credentials: "omit", cache: "no-store" });
  const body = await response.json();
  if (!response.ok || !body?.ok || !Array.isArray(body.result?.events)) throw new Error("History could not be loaded. Try again.");
  if (body.result.generation !== generation) throw Object.assign(new Error("Public history changed. Refresh the roadmap before reading this history."), { code: "STALE_GENERATION" });
  if (body.result.next !== null && (!Number.isSafeInteger(body.result.next) || body.result.next <= after)) throw new Error("The history page could not be verified. Try again.");
  return body.result;
}
