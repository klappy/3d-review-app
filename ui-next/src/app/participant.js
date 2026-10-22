// UI Next (v4) participant store. Status: provisional (cookbook work/active/2026-10-21-ui-next-demo-wiring/HANDOFF-wiring-2315.md step 5).
// Wraps the current UI's journey controller (ui/participate/controller.js: open/resume, drafts, receipt-per-device, idempotent submit,
// rate-limit and closed states) and its code redeem (ui/assess/scope.js entry page, the same POST /v2/participate/code), and turns the
// journey's phases into the participant lane's screens. No new transport: the shared-link client is the only network path.
//   opening -> (loading) · form -> p-welcome … p-question · review -> p-review · receipt -> p-receipt
//   unavailable + rateLimited -> p-problem?state=busy · unavailable (closed, link gone, cannot resume, transient) -> p-problem
//   redeem refused -> p-code?state=error · redeem 429 -> p-problem?state=busy
import { createParticipantJourney } from "../../../ui/participate/controller.js";
import { deviceStorage, digestNamespace, rememberCurrent, scopedStorage, parseEntryFragment } from "../../../ui/shared-link.js";
import { passageNames } from "../../../ui/participate/i18n.js";
import { isRateLimitedError, retryAfterSeconds } from "../../../ui/rate-limit.js";
import { api } from "./api.js";
import { CODE_REFUSED } from "../../../ui/assess/scope.js";

const tab = () => { try { return globalThis.sessionStorage; } catch { return null; } };
const device = () => { try { return globalThis.localStorage; } catch { return null; } };

let journey = null;
let listeners = new Set();
let draft = {};
const emit = () => { for (const f of listeners) f(snapshot()); };
export function subscribe(f) { listeners.add(f); return () => listeners.delete(f); }

// The controller reads window.location.hash as the survey entry and strips it; under /next/ the hash is also the route, so it sees only
// a `#survey=` fragment (anything else reads as no fragment: resume the tab's session), and "Interview another" on a code session lands
// on the code screen instead of the current UI's /#survey.
function win() {
  const w = globalThis.window;
  return {
    location: { get hash() { const h = w.location.hash; return parseEntryFragment(h) ? h : ""; }, get pathname() { return w.location.pathname; }, get search() { return w.location.search; }, assign: () => { w.location.hash = "#/p/code"; } },
    history: { replaceState: (a, b, url) => w.history.replaceState(a, b, url) },
  };
}
function ensure() {
  if (journey) return journey;
  journey = createParticipantJourney({ window: win(), storage: deviceStorage({ device: device(), tab: tab() }), onChange: () => emit() });
  return journey;
}
// The survey model the participant screens draw (ui-next/src/screens/participant/data.js functions take it as `d`): the live form
// in place of the fixture. No "I don't know" row is appended (it is not in the instrument; a fixture-only design row, CORRECTIONS R33).
export function model(state = journey?.state) {
  if (!state) return null;
  const form = state.form ?? { items: [], template: { perspective: "" }, passages: [] }; // a receipt or an unavailable link may arrive before any form
  const items = (form.items || []).map((it) => ({ ...it, options: (it.options || []).map((o) => ({ ...o, text: o.text || o.label || o.code, exclusive: !!o.exclusive })) }));
  const passages = Array.isArray(form.passages) ? form.passages : [];
  const names = passageNames(passages.map((p) => ({ reference: p.reference || p.title || "" })).filter((p) => p.reference)) || "the passage";
  return {
    live: true,
    survey: { language: form.language || "", passages: passages.map((p) => ({ reference: p.reference || p.title || "" })), medium: form.format ? `${form.format} draft` : "draft", perspective: form.template?.perspective || "", minutes: Math.max(2, Math.round(items.length / 2)), names, assessment: form.assessment, project: form.project },
    form: { ...form, items },
    passage: { verses: [], page: 1, pages: 1, list: passages },
    about: draft._about ?? {},
    answers: draft,
    current: items[0]?.id,
    reviewShown: items.map((i) => i.id),
    receipt: state?.receipt?.receipt_code || state?.receipt?.response_id || state?.receipt?.id || "",
    code: { placeholder: "K7Q 4F2", entered: "" },
    notice: state?.notice || "",
    phase: state?.phase,
    busy: !!state?.busy,
    rateLimited: state?.rateLimited === true,
    retryAfter: state?.retryAfter,
  };
}
export function snapshot() { return { state: journey?.state ?? null, model: model(), draft }; }

// Where the journey's phase lands the participant: [screen, query].
export function screenFor(state) {
  if (!state) return ["p-code", {}];
  switch (state.phase) {
    case "form": return ["p-welcome", {}];
    case "review": return ["p-review", {}];
    case "receipt": return ["p-receipt", {}];
    case "unavailable": return ["p-problem", {}]; // a server-asked wait (upstream 429) is said on the one problem board; no busy state
    default: return [null, {}];
  }
}

// start(): a `#survey=` fragment opens that link (and is stripped from the address bar by the controller); without one the tab's
// current participant session resumes (a reload mid-survey, or a code handed over by redeem()). Answers in the draft come back too.
let starting = null; // one open at a time: a route change while the link is opening joins it instead of racing it
export async function start({ retry = false } = {}) {
  if (starting) return starting;
  starting = (async () => { try { return await open({ retry }); } finally { starting = null; } })();
  return starting;
}
async function open({ retry }) {
  const j = ensure();
  const s = await j.start({ retry });
  if (s?.phase === "form" && s.draft) draft = { ...s.draft };
  if (s?.phase === "review" && j.state?.answers) draft = { ...j.state.answers };
  emit();
  return s;
}
export const state = () => journey?.state ?? null;
export const hasSession = () => !!parseEntryFragment(globalThis.location?.hash || "") || !!(tab()?.getItem("shared:current"));

export function answer(id, value) {
  draft = { ...draft, [id]: value };
  journey?.save(draft);
  emit();
}
export function setAbout(values) { draft = { ...draft, _about: values || {} }; journey?.setContext(values || {}); emit(); }
export function toReview() { ensure(); if (journey.state.phase === "form") journey.review(cleaned(draft)); return journey.state; }
export function editAnswers() { if (journey?.state.phase === "review") journey.edit(); return journey?.state; }
// Required questions still unanswered (the instrument's own `required`, as ui/participant-view.js itemError checks): [{ id, n, text }].
export function missing() {
  const items = model()?.form.items ?? [];
  const empty = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
  return items.map((it, i) => ({ id: it.id, n: i + 1, text: it.text, required: it.required !== false && ["single", "multi", "scale", "text"].includes(it.type) })).filter((x) => x.required && empty(draft[x.id]));
}
export async function submit() {
  ensure();
  const gaps = missing();
  if (gaps.length) return { phase: journey.state.phase, missing: gaps };
  if (journey.state.phase === "form") journey.review(cleaned(draft));
  if (journey.state.phase !== "review") return journey.state;
  const s = await journey.submit();
  emit();
  return s;
}
export async function another() { const s = await ensure().another(); emit(); return s; }
export async function recover() { const s = await ensure().recover(); emit(); return s; }
const cleaned = (d) => { const out = {}; for (const [k, v] of Object.entries(d)) if (k !== "_about" && v !== undefined) out[k] = Array.isArray(v) && !v.length ? null : v; return out; };

// Code entry (ui/assess/scope.js entry.bind: POST /v2/participate/code {code}); the bearer goes into the same scoped session slot the
// link path uses, so start() resumes it like a link. Returns { ok } | { ok:false, error, busy, retryAfter }.
export async function redeem(code) {
  const c = String(code || "").replace(/\s+/g, "").toUpperCase();
  if (!c) return { ok: false, error: CODE_REFUSED };
  try {
    const r = await api("/v2/participate/code", { method: "POST", body: { code: c } });
    const token = r?.participant_token || r?.participant;
    if (!token) return { ok: false, error: "The server accepted the code but returned no participant token." };
    const ns = await digestNamespace(token), slot = scopedStorage(tab(), ns);
    slot.set("bearer", token); slot.set("via", "code"); rememberCurrent(tab(), ns);
    journey = null; draft = {};
    return { ok: true };
  } catch (e) {
    if (isRateLimitedError(e)) return { ok: false, busy: true, retryAfter: retryAfterSeconds(e.retryAfter), error: e.message };
    return { ok: false, error: CODE_REFUSED };
  }
}
export function reset() { journey = null; draft = {}; }
