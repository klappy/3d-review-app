// UI Next (v4) explore lane: data adapters for the Explore and Feedback screens. Status: provisional (playbook rule 12).
// Adapts through the current UI's pure modules (import only, no backend change):
//   - level words: v3ScoreBand() in ui/assess/v3-assessment.js (the one level function design-system.md section 3 names;
//     captain-ruled provisional cut-offs, at least 3 responses per perspective);
//   - the feedback gate: feedback.load() in ui/assess/feedback.js (signed-in, not the sample tour).
// Fixtures in ui-next/fixtures/explore/ stand in for the capabilities the boards cite but the server lacks (rollups; see RESULTS-explore.md).
import { v3ScoreBand, V3_STAGES } from "../../../../ui/assess/v3-assessment.js";
import { feedback } from "../../../../ui/assess/feedback.js";
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

/** "18 / 30" when the facilitator entered an expected count, "24" when not, an em dash before any response (Explore board). */
export function responsesText(r) {
  if (!r || !Number.isInteger(r.n)) return "—";
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

/** Phone list rows: one level per row (the boards draw the translation-team level). */
export function phoneRows(rows) {
  return rows.map((r) => ({ ...r, level: levelOf(r.team) ?? "more" }));
}

/** The feedback gate from the current UI: allowed only for a signed-in, non-sample session. */
export async function feedbackAllowed(ctx) {
  const model = await feedback.load(ctx);
  return model.allowed === true;
}
