// UI Next (v4) Stage pill. Status: provisional.
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2, Stage pill row
// (.pill[data-stage], dot + label); section 1.2 Stage row (stage tokens all neutral; the five labels).
// Values: generator/gen.py .pill rules (lines 44-46) and status() (lines 173-176).
// Ported: setup, collecting, results, reviewed, done - dot + label, label text from the contract only.
// Not ported: data-stage=closed (validation V-09: "Collection closed" folds into Results ready per section 1.2,
// while section 2 still lists closed; the stage value list is not yet defined).
import { h } from "./h.js";

// Label text from design-system.md section 1.2 Stage row. Callers pass a stage, never a label.
export const STAGE_LABELS = Object.freeze({
  setup: "Setting up",
  collecting: "Collecting",
  results: "Results ready",
  reviewed: "Reviewed",
  done: "Completed",
});

export const STAGES = Object.freeze(Object.keys(STAGE_LABELS));

/**
 * renderPill(props) -> HTMLSpanElement
 * props:
 *   stage  "setup" | "collecting" | "results" | "reviewed" | "done" (required)
 * Renders <span class="pill" data-stage="..."><i aria-hidden="true"></i>Label</span>.
 * A free-text label is refused: the label is chosen by the stage (contract: label text from the glossary).
 */
export function renderPill(props = {}) {
  const { stage } = props;
  if ("label" in props) throw new TypeError("renderPill(): the label comes from the stage, not the caller");
  if (stage === "closed") throw new TypeError('renderPill(): stage "closed" is not in the ported contract yet');
  if (typeof stage !== "string" || !Object.hasOwn(STAGE_LABELS, stage)) throw new TypeError(`renderPill(): unknown stage "${String(stage)}"`);
  return h("span", { class: "pill", "data-stage": stage }, h("i", { "aria-hidden": "true" }), STAGE_LABELS[stage]);
}
