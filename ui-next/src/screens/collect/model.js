// UI Next (v4) collect lane view model. Status: provisional. Pure: fixture (or store rows of the same shape) -> what the boards draw.
// Data: ui-next/fixtures/collect/collect.json (mock; one source per value: one room, one link and one code per survey). Stage tabs read
// the current UI's STAGES (ui/stage-screens.js: ids prepare/collect/understand/improve and their labels), so the tab words have one home.
// Links: the shared screens/href.js (carries ?w= and ?theme=); the screens pass registered names only (test/ui-next-links.test.ts).
import { STAGES } from "../../../../ui/stage-screens.js";
import { LENSES } from "../../LensDot.svelte";

// Review stage tabs (gen.py review_tabs; design-system.md §2 Stepper / tabs): done before the current stage, "Now" on the current one.
// hrefs: { stageId: link } built by the caller with href() (ReviewFrame.svelte), so every screen name stays a literal the links test reads.
export function stageTabs(current = "collect", hrefs = {}) {
  const at = STAGES.findIndex((s) => s.id === current);
  if (at < 0) throw new TypeError(`stageTabs: unknown stage "${String(current)}"`);
  return STAGES.map((s, i) => ({ id: s.id, label: s.label, n: i + 1, done: i < at, current: i === at, href: hrefs[s.id] }));
}

const sum = (xs, k) => xs.reduce((n, x) => n + x[k], 0);
// Board bars use int(a / b * 100) (boards_fac.py group_rows): floor, so 2 of 3 draws 66 %.
export const pct = (a, b) => (b > 0 ? Math.floor((a / b) * 100) : 0);

export function collectModel(fx) {
  const groups = fx.groups.map((g) => {
    if (!Object.hasOwn(LENSES, g.lens)) throw new TypeError(`collectModel: unknown lens "${String(g.lens)}"`);
    const surveys = g.surveys.map((s) => ({ ...s, lens: g.lens, pct: pct(s.answered, s.expected), link: fx.linkHost + s.code }));
    return { lens: g.lens, label: LENSES[g.lens], surveys, answered: sum(surveys, "answered"), expected: sum(surveys, "expected") };
  });
  const surveys = groups.flatMap((g) => g.surveys);
  surveys.forEach((s, i) => { s.n = i + 1; }); // 1-based survey number: QRRoomPhone's ?state=<n>
  const r = fx.review;
  return {
    ...fx,
    groups,
    surveys,
    answered: sum(groups, "answered"),
    expected: sum(groups, "expected"),
    meta: `${fx.project.name} · ${r.language} · ${r.modality}`,
    // CloseCollection's per-perspective line: "Translation team 6 · Community 8 · Church 4".
    byLens: groups.map((g) => `${g.label} ${g.answered}`).join(" · "),
  };
}

// An unknown or absent ?state= renders the default state (every lane): never throws.
export const pickState = (state, states, dflt = states[0]) => (states.includes(state) ? state : dflt);

// QRRoomPhone pager: ?state=<n> is the survey number, 1-based; anything else is the default survey (0-based dflt).
export function pickSurvey(state, total, dflt) {
  const k = Number(state);
  return typeof state === "string" && /^\d+$/.test(state) && k >= 1 && k <= total ? k - 1 : dflt;
}

// PrintQR pages for the ticked surveys under a layout: per "survey" = one page each, "sheet" = one sheet of cut cards per
// survey (hand-out cards), "one" = every ticked code on one page. Nothing ticked = 0 pages (the Print button is disabled).
export function printPages(per, ticked) {
  if (!["survey", "sheet", "one"].includes(per)) throw new TypeError(`printPages: unknown layout "${String(per)}"`);
  if (!(ticked > 0)) return 0;
  return per === "one" ? 1 : ticked;
}
export const pagesLabel = (k) => `${k} ${k === 1 ? "page" : "pages"}`;
