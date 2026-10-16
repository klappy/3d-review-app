// UI Next (v4) Lens dot. Status: provisional.
// Contract: 3d-review-cookbook design/2026-10-15-glass-redesign/canvas/design-system.md section 2, Lens dot row
// (.lensdot[data-lens], .pt[data-lens]; 10px dot; perspective by data-lens, never by class letter) and
// section 1.2 Sizes (--dot 10). Perspective names: section 4, perspective row.
// Values: design/2026-10-15-glass-redesign/generator/gen.py .lensdot / .pt[data-lens] rules (lines 47-49).
// Ported: the data-lens colour binding on .lensdot and .pt, and the 10px .lensdot.
// Perspective colour is graphic-only (validation V-33): the dot is a graphic with an accessible name
// (role="img" + aria-label), or aria-hidden when adjacent visible text already names the perspective.
// Not ported: the band and numeric barbells and .pt geometry/placement; any extension of data-lens
// beyond .lensdot and .pt (V-39).
import { h } from "./h.js";

/** The three perspectives, keyed by data-lens value, with their on-screen names. */
export const LENSES = Object.freeze({ team: "Translation team", community: "Community", church: "Church" });

function render(kind, props = {}) {
  const { lens, label, decorative = false } = props;
  const fn = kind === "pt" ? "renderLensPoint" : "renderLensDot";
  if (!Object.hasOwn(LENSES, lens)) throw new TypeError(`${fn}(): unknown lens "${lens}" (team | community | church)`);
  if (label !== undefined && !(typeof label === "string" && label.trim())) throw new TypeError(`${fn}(): label must be non-empty text`);
  if (decorative && label !== undefined) throw new TypeError(`${fn}(): a decorative dot takes no label`);
  const attrs = { class: kind === "pt" ? "pt" : "lensdot", "data-lens": lens };
  if (decorative) attrs["aria-hidden"] = "true";
  else {
    attrs.role = "img";
    attrs["aria-label"] = label === undefined ? LENSES[lens] : label.trim();
  }
  return h("span", attrs);
}

/**
 * renderLensDot(props) -> HTMLSpanElement (.lensdot[data-lens], 10px)
 * props:
 *   lens        "team" | "community" | "church" (required)
 *   label       accessible name; defaults to the perspective name
 *   decorative  true when adjacent visible text names the perspective: aria-hidden, no name
 */
export function renderLensDot(props) {
  return render("dot", props);
}

/**
 * renderLensPoint(props) -> HTMLSpanElement (.pt[data-lens]) — the colour binding only;
 * size and placement belong to the barbell, which is not ported. Same props as renderLensDot.
 */
export function renderLensPoint(props) {
  return render("pt", props);
}
