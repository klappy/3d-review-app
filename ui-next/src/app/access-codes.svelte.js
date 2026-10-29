// Share-owned ephemeral controller. Views may move between the phone card and desktop disclosure without losing one-time values.
import { tick } from "svelte";
import { liveContext } from "../screens/href.js";
import { token } from "./api.js";
import { parse } from "./router.js";
import { codeRequest, issueCodeBatch, undoCodeBatch, codesCsv } from "./access-codes.js";
import { CAN_SHARE } from "../screens/actions/legacy.js";
import { copyText } from "../screens/actions/copy.js";
export function createAccessCodesState({ aid = liveContext()?.aid, requestFactory = codeRequest } = {}) {
  const state = $state({ expanded: false, surveys: [], sid: "", count: 20, role: "", stage: "loading", message: "", codes: [], batch: null });
  let owner, bearer, request, mountedHash, alive = true, generation = 0;
  const name = () => state.surveys.find(s => s.id === state.sid)?.name ?? "Survey";
  function clear() { state.codes = []; state.batch = null; }
  function sameContext() { const ctx = liveContext(); return alive && bearer === token() && (ctx === null || ctx.aid === aid) && (globalThis.location?.hash ?? "") === mountedHash; }
  async function current() {
    if (!sameContext()) return false;
    const me = (await request("/v2/me")).result;
    return sameContext() && me?.principal?.id === owner;
  }
  async function load() {
    const gen = ++generation; clear(); state.stage = "loading"; state.message = "";
    bearer = token(); mountedHash = globalThis.location?.hash ?? ""; request = requestFactory(bearer);
    try {
      const me = (await request("/v2/me")).result;
      const model = (await request(`/v2/assessments/${encodeURIComponent(aid)}`)).result;
      if (!alive || gen !== generation) return;
      if (bearer !== token()) { state.stage = "changed"; state.message = "Your sign-in changed. Reload this page to continue."; return; }
      owner = me?.principal?.id; state.role = model.assessment.role;
      state.surveys = (model.surveys ?? []).filter(s => s.state === "selected" && !s.archived_at).map(s => ({ id: s.id, name: s.display_name || s.name || s.template_name || s.id }));
      state.sid = state.surveys[0]?.id ?? ""; state.stage = "idle";
    } catch { if (alive && gen === generation) { state.stage = "load-error"; state.message = "Access-code options could not be loaded. Check your sign-in and try again."; } }
  }
  async function issue() {
    if (state.stage !== "confirm" || !CAN_SHARE.has(state.role)) return;
    const gen = generation, opRequest = request;
    state.stage = "busy"; state.message = "Issuing and exporting codes. Keep this page open…";
    const opCurrent = async () => gen === generation && await current() && gen === generation;
    const result = await issueCodeBatch({ aid, sid: state.sid, count: Number(state.count), request: opRequest, current: opCurrent });
    if (!alive || gen !== generation) { if (result.stage === "shown" && result.batch) await undoCodeBatch(opRequest, result.batch); return; }
    clear();
    if (!sameContext()) { if (result.stage === "shown" && result.batch) await undoCodeBatch(opRequest, result.batch); state.stage = "changed"; state.message = "Your sign-in changed. Codes were cleared; an unseen batch was undone where possible."; return; }
    state.stage = result.stage; state.batch = result.batch ?? null; state.codes = result.codes ?? []; state.message = result.message;
    if (state.stage === "unseen") {
      state.stage = state.batch.undone ? "idle" : "undo-required";
      state.message = state.batch.undone ? "The codes could not be shown, so the batch was undone; no codes remain active from it." : "The codes could not be shown and undo was not confirmed. Retry undo before issuing another batch.";
      if (state.batch.undone) state.batch = null;
    }
  }
  async function undo() {
    if (!state.batch || state.stage === "busy") return;
    const gen = generation, opRequest = request, priorCodes = state.codes; state.stage = "busy"; state.codes = [];
    const ok = await undoCodeBatch(opRequest, state.batch);
    if (!alive || gen !== generation) return;
    let same = sameContext();
    if (same && !ok) { try { same = await current(); } catch (e) { if (e?.status === 401 || e?.status === 403) same = false; } }
    if (!alive || gen !== generation) return;
    if (!same) { clear(); state.stage = "changed"; state.message = "Your sign-in changed. Code values were cleared."; return; }
    state.stage = ok ? "idle" : priorCodes.length ? "shown" : "undo-required";
    if (!ok) state.codes = priorCodes;
    state.message = ok ? "Undone; no codes are active from that batch." : "Undo did not go through. Codes may still be active (redeemed codes cannot be undone). Try undo again.";
    if (ok) state.batch = null;
  }
  function download() {
    const blob = new Blob([codesCsv(name(), state.codes)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "survey-access-codes.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function copy() { state.message = await copyText(state.codes.map(c => c.code).join("\n")) ? "Codes copied. Keep them private." : "Copy failed. Select the codes below and copy them."; }
  function prepare() {
    if (!Number.isInteger(Number(state.count)) || state.count < 1 || state.count > 100) { state.message = "Choose between 1 and 100 codes."; return; }
    state.stage = "confirm"; state.message = "";
  }
  function mount() {
    const dispose = () => { alive = false; generation++; globalThis.removeEventListener("focus", recheck); globalThis.removeEventListener("hashchange", routeChanged); clear(); };
    if (!aid || aid === "sample") { state.stage = "fixture"; return dispose; }
    load();
    globalThis.addEventListener("focus", recheck);
    globalThis.addEventListener("hashchange", routeChanged);
    return dispose;
  }
  async function recheck() {
    const gen = generation;
    if (state.stage === "loading" || !owner) return;
    try { if (await current()) return; }
    catch (e) { if (e?.status !== 401 && e?.status !== 403) { if (alive && gen === generation) state.message = "Your sign-in could not be checked. Your code values are still here; check the connection before continuing."; return; } }
    if (alive && gen === generation) { generation++; clear(); state.stage = "changed"; state.message = "Your sign-in changed. Code values were cleared. Reload this page to continue."; }
  }
  async function routeChanged() {
    if ((globalThis.location?.hash ?? "") === mountedHash) return;
    generation++; clear(); owner = null; state.stage = "loading";
    const route = parse(globalThis.location?.hash ?? "");
    if (route.name !== "share" || !route.params.aid || route.params.aid === "sample") { state.stage = "changed"; state.message = "The review changed. Code values were cleared."; return; }
    const gen = generation;
    await tick();
    if (!alive || gen !== generation) return;
    aid = route.params.aid; load();
  }
  return { state, name, mount, load, issue, undo, download, copy, prepare,
    setExpanded: value => { state.expanded = value; },
    setCount: value => { state.count = value; }, setSurvey: value => { state.sid = value; },
    cancel: () => { state.stage = "idle"; state.message = "Cancelled; no codes were issued."; },
    done: () => { clear(); state.stage = "idle"; state.message = "Code values cleared from this page. The issued codes remain active."; } };
}
