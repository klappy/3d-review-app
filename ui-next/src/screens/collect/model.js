// UI Next (v4) collect lane view model. Status: provisional. Pure: fixture (or store rows of the same shape) -> what the boards draw.
// Data: ui-next/fixtures/collect/collect.json (mock; one source per value: one room, one link and one code per survey). Its values are
// what the boards draw (3d-review-cookbook design/2026-10-15-glass-redesign/canvas Collect*, CloseCollection*, QRRoom*, PrintQR*
// .dc.html @a594830); where boards disagree (room counts, QRRoomPhone's Community link and code) it keeps the majority value and the
// cookbook's work/active/2026-10-21-ui-next-screens-fanout/RESULTS-collect.md itemises the board line. qr strings are the boards' 21x21
// placeholder modules (generator gen.py qr(seed)), row-major, 1 = dark. The provenance lives here, not in the JSON, so the bundle
// carries none of it. Stage tabs read
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

// QRRoomPhone pager: ?state=<n> is the survey number, 1-based; anything else is the default survey (0-based dflt), clamped to the
// surveys there are (a store row may hold fewer than the fixture's default). No surveys: -1 (the screen draws its empty state).
export function pickSurvey(state, total, dflt = 0) {
  if (!(Number.isInteger(total) && total > 0)) return -1;
  const k = Number(state);
  if (typeof state === "string" && /^\d+$/.test(state) && k >= 1 && k <= total) return k - 1;
  return Math.min(Math.max(Number.isInteger(dflt) ? dflt : 0, 0), total - 1);
}

// PrintQR's ticked surveys, keyed by survey code (never by position), in the review's survey order; unknown codes are dropped.
export const pickedSurveys = (surveys, codes) => surveys.filter((s) => codes.includes(s.code));

// PrintQR pages for the ticked surveys under a layout: per "survey" = one page each, "sheet" = one sheet of cut cards per
// survey (hand-out cards), "one" = every ticked code on one page. Nothing ticked = 0 pages (the Print button is disabled).
// The preview draws the first page of the chosen layout: "survey" the first ticked survey's full-page code, "sheet" that survey's
// cards (layout.cards of them), "one" every ticked code.
export function printPages(per, ticked) {
  if (!["survey", "sheet", "one"].includes(per)) throw new TypeError(`printPages: unknown layout "${String(per)}"`);
  if (!(ticked > 0)) return 0;
  return per === "one" ? 1 : ticked;
}
// A count and its noun (or noun + verb) for one and for any other number: "1 page" / "3 pages", "1 response is" / "18 responses are".
export const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
export const pagesLabel = (k) => plural(k, "page", "pages");

// PrintQR's layout choice, keyed by its title (never by position): the chosen layout when the data still has it, else the data's
// first, so a data row with fewer layouts never leaves the choice pointing at nothing. A data row with no layouts is a data error.
export function pickLayout(layouts, title) {
  if (!(Array.isArray(layouts) && layouts.length > 0)) throw new TypeError("pickLayout: the print data has no layouts");
  return layouts.find((l) => l.title === title) ?? layouts[0];
}
