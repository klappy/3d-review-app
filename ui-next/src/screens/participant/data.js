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
export const itemById = (id, d = DATA) => {
  const item = d.form.items.find((i) => i.id === id);
  if (!item) throw new TypeError(`participant fixture: no item "${id}"`);
  return item;
};
// The board's last answer row on every choice question (design row, not yet in the app instrument: cookbook CORRECTIONS R33).
// It carries the app's own option flag `exclusive` (ui/participant-view.js itemError: an exclusion choice cannot be combined).
// Live (app/participant.js model, no dontKnow row): the instrument's own options only (HANDOFF-wiring-2315 step 8).
export const choices = (item, d = DATA) => (item.options ? (d.dontKnow ? [...item.options, d.dontKnow] : [...item.options]) : []);
// The item as the participant sees it: its options plus "I don't know", so the app's own functions (reviewAnswer, itemError) know the row.
const asShown = (item, d = DATA) => (item.options ? { ...item, options: choices(item, d) } : item);

// A multi answer after one box is ticked (on) or unticked: an exclusive row stands alone ("I don't know", and the instrument's own
// exclusion options, e.g. CW-Q8 "We don't use it": src/handlers/common.ts renderItems serves flag "exclusion" as exclusive); ticking
// any other row drops it. Single answers are one code. The result always passes the app's itemError exclusion check.
export function pick(item, value, code, on, d = DATA) {
  if (item.type !== "multi") return on ? code : value;
  const cur = Array.isArray(value) ? value : [];
  if (!on) return cur.filter((c) => c !== code);
  const ex = new Set(choices(item, d).filter((o) => o.exclusive).map((o) => o.code));
  return ex.has(code) ? [code] : [...cur.filter((c) => c !== code && !ex.has(c)), code];
}

// The line under a multi field that holds an exclusive row: the app's own words (UI_EN.exclusionNote), drawn where the v3 page draws
// it (ui/participate/page.js draw: multi item with an exclusive option); null for any other item, so nothing is drawn.
export const exclusionNote = (item, d = DATA) => (item.type === "multi" && choices(item, d).some((o) => o.exclusive) ? UI_EN.exclusionNote : null);

export function welcome(d = DATA) {
  return {
    eyebrow: [d.survey.language, d.survey.passages?.length ? `${passageNames(d.survey.passages)}, ${d.survey.medium}` : d.survey.assessment || d.survey.medium].filter(Boolean).join(" · "),
    perspective: d.form.template.perspective,
    length: `${d.form.items.length} questions · about ${d.survey.minutes} minutes`,
  };
}

export function passage(d = DATA) {
  const named = d.survey.passages?.length ? passageNames(d.survey.passages) : "the passage";
  return { title: `Please read ${named} first`, verses: d.passage.verses || [], page: d.passage.pages > 1 ? `Page ${d.passage.page} of ${d.passage.pages}` : "", list: d.passage.list || [] };
}

// The count is the fields drawn (aboutFields), never a stored number; one field reads "1 question, optional"; no field, no line.
export function aboutLine(n) {
  if (!n) return null;
  if (n === 1) return "About you · 1 question, optional";
  return `About you · ${n} questions, ${n === 2 ? "both" : "all"} optional`;
}
export function about(d = DATA) {
  const fields = aboutFields(d.form);
  return { fields, eyebrow: aboutLine(fields.length), values: d.about };
}
// "About you" is a step only when the form turns demographics on (aboutFields, S15a); otherwise the flow goes passage -> question 1
// and question 1's Back goes to the passage.
export const hasAbout = (d = DATA) => aboutFields(d.form).length > 0;
// Skip leaves the page with nothing chosen (an untouched field sends nothing: ui/participant-view.js); Next keeps the choices.
export const skipAbout = () => ({});

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
  return { item, n, total: all.length, of: fill(UI_EN.questionOf, { n, total: all.length }), perspective: d.form.template.perspective, options: choices(item, d), value: d.answers[item.id], other: d.answers?._other?.[item.id] ?? "" };
}
// ?q= read from the page URL (the route passes only phone, theme and state); undefined where there is none.
export const qParam = (from = globalThis.location?.search ?? "") => new URLSearchParams(from).get("q") ?? undefined;

// Review rows: the board's four (reviewShown), or every item when all is true ("Show all 13 answers"). Each row knows its question number.
export function review(all = false, d = DATA) {
  const ids = all ? d.form.items.map((i) => i.id) : d.reviewShown;
  const n = (id) => d.form.items.findIndex((i) => i.id === id) + 1;
  return { rows: ids.map((id) => ({ id, n: n(id), q: itemById(id, d).text, a: reviewAnswer(asShown(itemById(id, d), d), d.answers[id], d.answers._other?.[id]) })), total: d.form.items.length, all };
}

// PProblem: the one problem board (send not confirmed; closed / link gone / already answered as the other cases). The former
// PProblemBusy state (refused by the app rate limiter, automatic retry) is RETIRED: the app carries no participant/IP limiter
// (cookbook RULING-2026-10-16-scrap-app-ratelimit; PR 198), so that state cannot occur. ?state= is ignored. Live (d.live): the
// journey's own notice (ui/participate/controller.js copy) is the headline's explanation; a wait the server asked for (an upstream
// 429 passed through) is said plainly, never retried by the page on its own.
export function problem(state, d = DATA) {
  if (d.live) {
    // Receipt → "Interview another" after a reload: the controller keeps no raw link token on purpose (ui/participate/controller.js
    // 9–11, 133–139), so the next person needs the original link. Nothing failed to send: no retry, no unrelated cases.
    const saved = !!d.notice && d.notice === SURVEYOR_EN.openLinkForNext;
    return { busy: false, closedOn: "", receipt: d.receipt, notice: d.notice || "", retryAfter: d.rateLimited ? d.retryAfter : undefined, saved };
  }
  return { busy: false, closedOn: d.problem.closedOn, receipt: d.receipt };
}
