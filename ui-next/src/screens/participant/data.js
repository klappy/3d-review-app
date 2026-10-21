// UI Next (v4) participant lane: fixture -> view data, adapted through the current participant UI's pure modules. Status: provisional.
// Reused read-only (no backend change): ui/participate/i18n.js (UI_EN, SURVEYOR_EN, passageNames), ui/shared-link.js (fill),
// ui/present.js (reviewAnswer), ui/participant-view.js (aboutFields), ui/rate-limit.js (isRateLimited, retryAfterSeconds),
// ui/lens-surveys.js (LENSES: the three perspectives a survey's `perspective` names).
// Screen copy is the boards' (cookbook design/2026-10-15-glass-redesign/canvas P*.dc.html); where an app string says the same thing
// word for word it is read from the app module, so the two cannot drift. Divergences are wiring debt (cookbook RESULTS-participant.md).
// Links between screens are built with the shared screens/href.js href() in the .svelte files (it carries ?w= and ?theme=).
import fixture from "../../../fixtures/participant/survey.json";
import { UI_EN, SURVEYOR_EN, passageNames } from "../../../../ui/participate/i18n.js";
import { fill } from "../../../../ui/shared-link.js";
import { reviewAnswer } from "../../../../ui/present.js";
import { aboutFields } from "../../../../ui/participant-view.js";
import { isRateLimited, retryAfterSeconds } from "../../../../ui/rate-limit.js";
import { LENSES } from "../../../../ui/lens-surveys.js";

export const DATA = fixture;
export const LABELS = Object.freeze({ start: UI_EN.start, back: UI_EN.back, next: UI_EN.next, change: UI_EN.change, interviewAnother: SURVEYOR_EN.interviewAnother });

// A screen's ?state=: a value the screen draws, else undefined (the default state). An unknown value never throws.
export const pickState = (state, states) => (states.includes(state) ? state : undefined);

// The survey's lens key for the chips (data-lens): its perspective is one of ui/lens-surveys.js LENSES; anything else is neutral (null).
const LENS_KEY = Object.freeze({ "Translation Team": "team", Church: "church", Community: "community" });
export const lensOf = (perspective) => (LENSES.includes(perspective) ? LENS_KEY[perspective] : null);
export const surveyLens = (d = DATA) => lensOf(d.form.template.perspective);

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

// The count is the fields drawn (aboutFields), never a stored number; one field reads "1 question, optional".
export function aboutLine(n) {
  if (n === 1) return "About you · 1 question, optional";
  return `About you · ${n} questions, ${n === 2 ? "both" : "all"} optional`;
}
export function about(d = DATA) {
  const fields = aboutFields(d.form);
  return { fields, eyebrow: aboutLine(fields.length), values: d.about };
}

// Question n (1-based, as "Question 3 of 13"). n comes from ?q=; a missing or unknown n shows the fixture's current question.
export function questionNumber(q, d = DATA) {
  const n = Number(q);
  if (q != null && q !== "" && Number.isInteger(n) && n >= 1 && n <= d.form.items.length) return n;
  return d.form.items.findIndex((i) => i.id === d.current) + 1;
}
export function question(q, d = DATA) {
  const all = d.form.items;
  const n = questionNumber(q, d);
  if (!n) throw new TypeError(`participant fixture: no item "${d.current}"`);
  const item = all[n - 1];
  return { item, n, total: all.length, of: fill(UI_EN.questionOf, { n, total: all.length }), perspective: d.form.template.perspective, options: choices(item), value: d.answers[item.id] };
}
// ?q= read from the page URL (the route passes only phone, theme and state); undefined where there is none.
export const qParam = (from = globalThis.location?.search ?? "") => new URLSearchParams(from).get("q") ?? undefined;

// Review rows: the board's four (reviewShown), or every item when all is true ("Show all 13 answers"). Each row knows its question number.
export function review(all = false, d = DATA) {
  const ids = all ? d.form.items.map((i) => i.id) : d.reviewShown;
  const n = (id) => d.form.items.findIndex((i) => i.id === id) + 1;
  return { rows: ids.map((id) => ({ id, n: n(id), q: itemById(id).text, a: reviewAnswer(itemById(id), d.answers[id]) })), total: d.form.items.length, all };
}

// PProblem vs PProblemBusy: the app's own rate-limit test picks the state from the fixture's error; ?state=busy forces it; any other
// ?state= is ignored. The busy bar is the retry attempts (attempt of attempts): decorative, the retry line is the live text.
export function problem(state, d = DATA) {
  const s = pickState(state, ["busy"]);
  const busy = s === "busy" || (s === undefined && isRateLimited(d.problem.error.status, d.problem.error.code));
  if (!busy) return { busy: false, closedOn: d.problem.closedOn, receipt: d.receipt };
  const b = d.busy;
  if (!isRateLimited(b.error.status, b.error.code)) throw new TypeError("participant fixture: the busy state needs a rate-limit refusal");
  return { busy: true, attempt: b.attempt, attempts: b.attempts, retry: `Retrying in ${retryAfterSeconds(b.error.retryAfter)} s · attempt ${b.attempt} of ${b.attempts}`, diag: `${b.error.code} · ${b.error.status} · ${b.at}` };
}
