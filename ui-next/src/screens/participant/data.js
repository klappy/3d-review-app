// UI Next (v4) participant lane: fixture -> view data, adapted through the current participant UI's pure modules. Status: provisional.
// Reused read-only (no backend change): ui/participate/i18n.js (UI_EN, SURVEYOR_EN, passageNames), ui/shared-link.js (fill),
// ui/present.js (reviewAnswer), ui/participant-view.js (aboutFields), ui/rate-limit.js (isRateLimited, retryAfterSeconds).
// Screen copy is the boards' (cookbook design/2026-10-15-glass-redesign/canvas P*.dc.html); where an app string says the same thing
// word for word it is read from the app module, so the two cannot drift. Divergences are wiring debt (cookbook RESULTS-participant.md).
import fixture from "../../../fixtures/participant/survey.json";
import { UI_EN, SURVEYOR_EN, passageNames } from "../../../../ui/participate/i18n.js";
import { fill } from "../../../../ui/shared-link.js";
import { reviewAnswer } from "../../../../ui/present.js";
import { aboutFields } from "../../../../ui/participant-view.js";
import { isRateLimited, retryAfterSeconds } from "../../../../ui/rate-limit.js";

export const DATA = fixture;
export const LABELS = Object.freeze({ start: UI_EN.start, back: UI_EN.back, next: UI_EN.next, change: UI_EN.change, interviewAnother: SURVEYOR_EN.interviewAnother });

const items = () => DATA.form.items;
export const itemById = (id) => {
  const item = items().find((i) => i.id === id);
  if (!item) throw new TypeError(`participant fixture: no item "${id}"`);
  return item;
};
// The board's last answer row on every choice question (design row, not yet in the app instrument: cookbook CORRECTIONS R33).
export const choices = (item) => (item.options ? [...item.options, DATA.dontKnow] : []);

export function welcome(d = DATA) {
  return {
    eyebrow: `${d.survey.language} · ${passageNames(d.survey.passages)}, ${d.survey.medium}`,
    perspective: d.form.template.perspective,
    length: `${d.form.items.length} questions · about ${d.survey.minutes} minutes`,
  };
}

export function passage(d = DATA) {
  return { title: `Please read ${passageNames(d.survey.passages)} first`, verses: d.passage.verses, page: `Page ${d.passage.page} of ${d.passage.pages}` };
}

export function about(d = DATA) {
  const fields = aboutFields(d.form);
  const n = d.form.about_count;
  return { fields, eyebrow: `About you · ${n} questions, ${n === 2 ? "both" : "all"} optional`, values: d.about };
}

export function question(id = DATA.current, d = DATA) {
  const all = d.form.items;
  const n = all.findIndex((i) => i.id === id) + 1;
  if (!n) throw new TypeError(`participant fixture: no item "${id}"`);
  const item = all[n - 1];
  return { item, n, total: all.length, of: fill(UI_EN.questionOf, { n, total: all.length }), perspective: d.form.template.perspective, options: choices(item), value: d.answers[id] };
}

export function review(d = DATA) {
  return { rows: d.reviewShown.map((id) => ({ id, q: itemById(id).text, a: reviewAnswer(itemById(id), d.answers[id]) })), total: d.form.items.length };
}

// PProblem vs PProblemBusy: the app's own rate-limit test picks the state from the fixture's error; ?state= can force it.
export function problem(state, d = DATA) {
  const busy = state === "busy" || (state === undefined && isRateLimited(d.problem.error.status, d.problem.error.code));
  if (!busy) return { busy: false, closedOn: d.problem.closedOn, receipt: d.receipt };
  const b = d.busy;
  if (!isRateLimited(b.error.status, b.error.code)) throw new TypeError("participant fixture: the busy state needs a rate-limit refusal");
  return { busy: true, retry: `Retrying in ${retryAfterSeconds(b.error.retryAfter)} s · attempt ${b.attempt} of ${b.attempts}`, waited: b.waited, diag: `${b.error.code} · ${b.error.status} · ${b.at}` };
}

// Links between the participant screens keep the phone twin (?w=phone); the ui_next flag is already stored.
export const go = (screen, phone = false, state) => `?screen=${screen}${phone ? "&w=phone" : ""}${state ? `&state=${state}` : ""}`;
