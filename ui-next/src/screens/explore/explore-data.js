// UI Next (v4) explore lane: data adapters for the Explore screen. Status: provisional (playbook rule 12).
// Adapts through the current UI's pure modules (import only, no backend change):
//   - level words: v3ScoreBand() in ui/assess/v3-assessment.js (the one level function design-system.md section 3 names;
//     captain-ruled provisional cut-offs, at least 3 responses per perspective).
// The feedback gate (ui/assess/feedback.js load: signed in, not the sample tour) is not imported: no board draws its not-allowed state.
// No version string is shown or imported (design-lens@1 rule 5): the server stamps every feedback submission with the version and
// the HYGIENE 19 build stamp (src/handlers/feedback-provenance.ts).
// Fixture provenance (comments are stripped at build, so the public /next/ bundle carries no cookbook paths; the JSON has no notes):
//   - ui-next/fixtures/explore/explore.json: the words of cookbook design/2026-10-15-glass-redesign/canvas Explore.dc.html (desktop
//     table), ExplorePhone.dc.html and ExploreFiltersPhone.dc.html (phone list, filters sheet). Stages are app stage ids
//     (V3_STAGES); levels are each perspective's built-report score and response count, never stored as words. They stand in for
//     the list/roll-up capabilities the boards cite but the server lacks (cap.rollup.*). The board's match line literal is not kept:
//     matchCounts() counts the rows.
//   - ui-next/fixtures/explore/feedback.json: the words of Feedback.dc.html (desktop dialog over the page the user was on) and
//     FeedbackPhone.dc.html (phone page); "from" is the page and review the dialog names.
import { v3ScoreBand, V3_STAGES } from "../../../../ui/assess/v3-assessment.js";
import { LEVELS } from "../../Level.svelte";
import { levelOf as bandLevel, currentLevelMin } from "../results/data.js";

// Band word (v3ScoreBand) -> Level key (Level.svelte, design-system.md section 2 Level row).
const BAND_TO_LEVEL = Object.freeze(Object.fromEntries(Object.entries(LEVELS).map(([key, word]) => [word, key])));
// App stage ids (ui/assess/v3-assessment.js V3_STAGES) -> Stage pill (design-system.md section 2 Stage pill row; glossary words come from Pill).
export const STAGE_PILL = Object.freeze({ prepare: "setup", collect: "collecting", understand: "results", improve: "reviewed" });
export const LENS_KEYS = Object.freeze(["team", "community", "church"]);

/** One perspective's level key from a built report's score and its response count; null when no report exists yet (the board's dash).
 *  Banded by the results lane's levelOf, so Explore, Results, Project and Workspace share one cut-off: the server's level minimum
 *  (level_minimum_responses, read by app/data.js exploreModel), else the safe 3. */
export function levelOf(lens) {
  if (lens === null || lens === undefined) return null;
  return bandLevel(lens.score, lens.responses);
}

/** Stage pill for an app stage id; throws on an id the app does not have. */
export function stagePill(stage) {
  if (!Object.hasOwn(V3_STAGES, stage)) throw new TypeError(`explore-data: unknown app stage "${String(stage)}"`);
  return STAGE_PILL[stage];
}

/** "18 / 30" when the facilitator entered an expected count, "24" when not, an em dash before any response (Explore board),
 *  including a count of 0 with or without an expected count. */
export function responsesText(r) {
  if (!r || !Number.isInteger(r.n) || r.n === 0) return "—";
  return Number.isInteger(r.expected) ? `${r.n} / ${r.expected}` : String(r.n);
}

/** Table rows for the Explore board: stage pill, responses text and one level key (or null) per perspective. */
export function exploreRows(reviews) {
  return reviews.map((r) => ({
    ...r,
    pill: stagePill(r.stage),
    responsesText: responsesText(r.responses),
    levels: Object.fromEntries(LENS_KEYS.map((k) => [k, r.lenses ? levelOf(r.lenses[k]) : null])),
    // Each level's response count for its coverage cue (count variant under the Level; Codex P2 4383334399).
    counts: Object.fromEntries(LENS_KEYS.map((k) => [k, countOf(r.lenses?.[k])])),
  }));
}

/** The match line's counts from the rows the table shows: reviews, distinct projects and distinct languages
 *  (the board's literal "3 projects · 4 languages" disagrees with its own six rows: 4 projects, 5 languages). */
export function matchCounts(rows) {
  const distinct = (k) => new Set(rows.map((r) => r[k])).size;
  return { reviews: rows.length, projects: distinct("project"), languages: distinct("language") };
}

/** The Explore table footer's assurance by the served level minimum (Codex P1 4384112230; design-system.md:609 @c4bd0164, the same
 *  policy as Help's Privacy topic and the report footer): at 1 a level shown with one response is that person's answers, so the
 *  footer never claims nothing identifies a participant; at N or more, the level shows only with at least N responses. */
export const tableAssurance = (min = currentLevelMin()) => (min === 1
  ? "Nothing here names a participant; a level shown with one response reflects that person's answers."
  : `Nothing here identifies a participant: a level shows only with at least ${min} responses.`);
/** A perspective's response count, or null when none is carried (the cue then reads "responses not counted"). */
const countOf = (lens) => (Number.isInteger(lens?.responses) && lens.responses >= 0 ? lens.responses : null);
/** Phone list rows: one level per row (the boards draw the translation-team level) and, under it, that same perspective's count
 *  (Codex P2 4383879651; design-system.md §2 Coverage cue, Explore placement @5180eb72, R72 as corrected: the count beside a level is that
 *  same perspective's count), null when the team carries none (the cue then reads "responses not counted"). */
export function phoneRows(rows) {
  return rows.map((r) => { const team = r.team ?? r.lenses?.team ?? null; return { ...r, level: levelOf(team) ?? "more", n: countOf(team) }; });
}
