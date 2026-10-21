// UI Next (v4) collect lane view model. Status: provisional. Pure: fixture (or store rows of the same shape) -> what the boards draw.
// Data: ui-next/fixtures/collect/collect.json (mock; every value is a board value). Stage tabs read the current UI's STAGES
// (ui/stage-screens.js: ids prepare/collect/understand/improve and their labels), so the tab words have one home.
import { STAGES } from "../../../../ui/stage-screens.js";
import { LENSES } from "../../LensDot.svelte";
import qrcode from "../../../../ui/assess/vendor-qrcode.js";

// Cross-screen links under the flag: ?screen=<name>[&w=phone][&state=...][#hash]. Names outside this lane are the fanout's
// kebab names for the boards the canvas links to (setup5, results, next-step, share, print, paper-entry, people, project, setup1, setup2).
export function href(screen, { phone = false, state, hash } = {}) {
  const q = new URLSearchParams({ screen });
  if (phone) q.set("w", "phone");
  if (state) q.set("state", state);
  return `?${q}${hash ? `#${hash}` : ""}`;
}

// Review stage tabs (gen.py review_tabs; design-system.md §2 Stepper / tabs): done before the current stage, "Now" on the current one.
const TAB_SCREEN = { prepare: "setup5", collect: "collect", understand: "results", improve: "next-step" };
export function stageTabs(current = "collect", phone = false) {
  const at = STAGES.findIndex((s) => s.id === current);
  if (at < 0) throw new TypeError(`stageTabs: unknown stage "${String(current)}"`);
  return STAGES.map((s, i) => ({ id: s.id, label: s.label, n: i + 1, done: i < at, current: i === at, href: href(TAB_SCREEN[s.id], { phone }) }));
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

// A real code for a short link, through the current UI's vendored qrcode-generator (ui/assess/vendor-qrcode.js, the Share card's own
// library): version 1 (21x21, the .qr contract grid), error correction L, byte mode (up to 17 bytes). Longer links need a larger version,
// which the 21-column .qr grid cannot draw yet (wiring debt, RESULTS-collect.md); they return null.
export function qrModules(text) {
  if (typeof text !== "string" || !text) return null;
  try {
    const q = qrcode(1, "L");
    q.addData(text);
    q.make();
    if (q.getModuleCount() !== 21) return null;
    let s = "";
    for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) s += q.isDark(r, c) ? "1" : "0";
    return s;
  } catch {
    return null;
  }
}
