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

// Band word (v3ScoreBand) -> Level key (Level.svelte, design-system.md section 2 Level row).
const BAND_TO_LEVEL = Object.freeze(Object.fromEntries(Object.entries(LEVELS).map(([key, word]) => [word, key])));
// App stage ids (ui/assess/v3-assessment.js V3_STAGES) -> Stage pill (design-system.md section 2 Stage pill row; glossary words come from Pill).
export const STAGE_PILL = Object.freeze({ prepare: "setup", collect: "collecting", understand: "results", improve: "reviewed" });
export const LENS_KEYS = Object.freeze(["team", "community", "church"]);

/** One perspective's level key from a built report's score and its response count; null when no report exists yet (the board's dash). */
export function levelOf(lens) {
  if (lens === null || lens === undefined) return null;
  const word = v3ScoreBand(lens.score, lens.responses);
  const key = BAND_TO_LEVEL[word];
  if (!key) throw new TypeError(`explore-data: v3ScoreBand returned an unknown band "${word}"`);
  return key;
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
  }));
}

/** The match line's counts from the rows the table shows: reviews, distinct projects and distinct languages
 *  (the board's literal "3 projects · 4 languages" disagrees with its own six rows: 4 projects, 5 languages). */
export function matchCounts(rows) {
  const distinct = (k) => new Set(rows.map((r) => r[k])).size;
  return { reviews: rows.length, projects: distinct("project"), languages: distinct("language") };
}

/** Phone list rows: one level per row (the boards draw the translation-team level). */
export function phoneRows(rows) {
  return rows.map((r) => ({ ...r, level: levelOf(r.team) ?? "more" }));
}
