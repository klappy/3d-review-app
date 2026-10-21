// UI Next (v4) results lane: in-screen links. Status: provisional (playbook rule 12).
// Every link goes through the shared helper ui-next/src/screens/href.js (carries ?w= and ?theme=).
// Results-lane screens are written as literal href("results"...) calls, so test/ui-next-links.test.ts checks them against the registry.
// Cross-lane destinations are named once here, in OUT, by the name the owning lane registers in screens/<lane>/index.js
// (fanout brief). On this lane branch the sibling registries are still empty, so the shared links test cannot resolve these
// names yet; test/ui-next-results-screens.test.ts checks each OUT name against REGISTRY as soon as its owning lane is merged.
import { href } from "../href.js";

export { href };

/** Cross-lane screen names: [name, owning lane] (boards: Results*.dc.html, Report*.dc.html link targets). */
export const OUT = Object.freeze({
  nextStep: ["next-step", "actions"], // NextStep(.Phone) — "Plan the next step", Improve tab
  share: ["share", "actions"], // Share(.Phone) — "Reopen collection" (ResultsHeld)
  closeCollection: ["close-collection", "collect"], // CloseCollection — More actions
  collect: ["collect", "collect"], // Collect — Collect tab, "Meeting offline?" (#offline), phone More actions (state=menu)
  people: ["people", "people"], // People(.Phone) — "People with access", "Share results with someone"
  setup1: ["setup1", "setup"], // Setup1 — "Edit details and dates"
  setup5: ["setup5", "setup"], // Setup5(.Phone) — Prepare tab
  project: ["project", "setup"], // Project(.Phone) — crumb and phone project link
  workspace: ["workspace", "people"], // Workspace — the desktop top bar's brand
  menu: ["menu", "actions"], // MenuPhone — the phone header's account button
});

/** A link to a cross-lane screen by its OUT key; extra as href(); hash appended after the query (e.g. "offline"). */
export function out(key, extra = {}, hash) {
  if (!Object.hasOwn(OUT, key)) throw new TypeError(`results links: unknown cross-lane destination "${String(key)}"`);
  const url = href(OUT[key][0], extra);
  return hash ? `${url}#${hash}` : url;
}
