// Next adapter over the existing one-time escrow flow in ui/assess/share.js bindCodes.
// Code values/undo receipts remain in component memory; no storage, logs or automatic retries.
import { token, enc } from "./api.js";
import { refusalError } from "../../../ui/rate-limit.js";
export function codeRequest(bearer = token(), request = globalThis.fetch) {
  return async (url, { method = "GET", body } = {}) => {
    const headers = { accept: "application/json" };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    let r;
    try { r = await request(url, { method, headers, credentials: "same-origin", cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw Object.assign(new Error("The request outcome is unknown."), { status: 0 }); }
    let j; try { j = await r.json(); } catch { throw Object.assign(new Error("The response could not be read."), { status: 0 }); }
    if (!r.ok || !j?.ok) throw refusalError(r.status, j?.error, r);
    return j;
  };
}
export async function undoCodeBatch(request, batch) {
  if (!batch?.undo) return false;
  try { const j = await request(`/v2/undo/${enc(batch.undo)}`, { method: "POST" }); return j?.result?.undone === "cap.survey.issue_codes"; }
  catch { return false; }
}
export async function issueCodeBatch({ aid, sid, count, request, current }) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Choose between 1 and 100 codes.");
  const base = `/v2/assessments/${enc(aid)}/surveys/${enc(sid)}/codes`;
  let batch = null, shown = false;
  try {
    if (!(await current())) return { stage: "changed", message: "Your sign-in or review changed; no codes were issued." };
    const issued = await request(base, { method: "POST", body: { count } });
    const ids = issued?.result?.ids;
    batch = { undo: issued?.receipt?.undo_token ?? null, ids: Array.isArray(ids) ? ids : [], count };
    if (!Array.isArray(ids) || ids.length !== count || new Set(ids).size !== count || ids.some(id => typeof id !== "string" || !id) || !batch.undo) throw new Error("Incomplete batch receipt");
    if (!(await current())) throw new Error("Identity changed");
    const preview = await request(`${base}/export`, { method: "POST", body: { params: { ids }, mode: "dry_run" } });
    if (!preview?.result?.confirm_token) throw new Error("Export was refused");
    if (!(await current())) throw new Error("Identity changed");
    const exported = await request(`${base}/export`, { method: "POST", body: { params: { ids }, mode: "execute", confirm_token: preview.result.confirm_token } });
    const codes = exported?.result?.codes;
    if (!Array.isArray(codes) || codes.length !== count || new Set(codes.map(c => c.id)).size !== count || codes.some(c => !ids.includes(c.id) || typeof c.code !== "string" || !c.code.trim())) throw new Error("Incomplete export");
    if (!(await current())) throw new Error("Identity changed");
    shown = true;
    return { stage: "shown", codes: codes.map(c => ({ id: c.id, code: c.code })), batch, message: "Codes are shown once. Download or copy them before leaving this page." };
  } catch (e) {
    if (!batch) return { stage: e?.status >= 400 ? "refused" : "uncertain", message: e?.status >= 400 ? "Codes were refused. Check your sign-in, role and survey state before trying again." : "Issuance could not be confirmed. Codes may exist; do not create another batch until this is resolved." };
    return { stage: "unseen", batch, message: "The codes could not be shown." };
  } finally {
    if (batch && !shown) batch.undone = await undoCodeBatch(request, batch);
  }
}
export function codesCsv(name, codes) {
  const cell = value => { const raw = String(value); return `"${(/^[=+@\-\t\r]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""')}"`; };
  return `Survey,Access code\r\n${codes.map(c => `${cell(name)},${cell(c.code)}`).join("\r\n")}\r\n`;
}
