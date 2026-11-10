// UI Next (v4) setup lane: in-screen links. Status: provisional (playbook rule 12).
// Every link goes through the shared helper ui-next/src/screens/href.js (carries ?w= and ?theme=).
// Setup-lane screens (setup1..setup5, project) are built in the lane (SetupFrame stepHref, Project to()).
// Cross-lane destinations are named once here, in OUT, by the name the owning lane registers in screens/<lane>/index.js
// (fanout brief; checked on origin/ui-next-<lane>). On this lane branch the sibling registries are still empty, so the shared
// test/ui-next-links.test.ts cannot resolve these names yet (VALIDATION-setup-r2 N1); test/ui-next-setup-screens.test.ts checks
// each OUT name against REGISTRY as soon as its owning lane is merged. Same shape as the results lane's screens/results/links.js.
import { href } from "../href.js";

/** Cross-lane screen names: key -> [registered name, owning lane] (boards: Setup5*.dc.html, Project*.dc.html link targets). */
export const OUT = Object.freeze({
  collect: ["collect", "collect"], // Collect(.Phone): "Launch the survey" (Setup5), a collecting review row (Project)
  results: ["results", "results"], // Results(.Phone): a review with results (Project)
  nextStep: ["next-step", "actions"], // NextStep(.Phone): a done review (Project)
  people: ["people", "people"], // People(.Phone): "People" (Project)
  workspace: ["workspace", "people"], // Workspace(.Phone): the workspace link over the project title (Project)
});

/** A link to a cross-lane screen by its OUT key; extra and from as href(). */
export function out(key, extra = {}, from) {
  if (!Object.hasOwn(OUT, key)) throw new TypeError(`setup links: unknown cross-lane destination "${String(key)}"`);
  return from === undefined ? href(OUT[key][0], extra) : href(OUT[key][0], extra, from);
}
