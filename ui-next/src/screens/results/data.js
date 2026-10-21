// UI Next (v4) results lane: data adapter. Status: provisional (playbook rule 12).
// Reads the built-report shape the current UI already reads and derives every level through the current UI's pure modules
// (import only, no backend change): ui/assess/v3-assessment.js v3ScoreBand + V3_BAND_CUTOFFS (band words, provisional cut-offs,
// minimum responses), ui/report-lenses.js lensSpreadRows + lensLabel (cross-perspective spread rows, perspective names),
// ui/report-radar.js radarModel + wrap (radar spokes and label wrapping). Fixtures: ui-next/fixtures/results/*.json.
// Boards: cookbook design/2026-10-15-glass-redesign/canvas Results*, Report*, ReportDetailed (.dc.html).
import { v3ScoreBand, V3_BAND_CUTOFFS } from "../../../../ui/assess/v3-assessment.js";
import { lensSpreadRows, lensLabel } from "../../../../ui/report-lenses.js";
import { radarModel, wrap } from "../../../../ui/report-radar.js";
import REPORT from "../../../fixtures/results/report.json";
import ANSWERS from "../../../fixtures/results/answers.json";

export { REPORT, ANSWERS, lensLabel };
export const LENS_ORDER = Object.freeze(["team", "community", "church"]);
export const MIN_RESPONSES = V3_BAND_CUTOFFS.minResponses;

// Band word (v3ScoreBand) -> Level key (ui-next/src/Level.svelte LEVELS; design-system.md section 4 level words).
export const LEVEL_KEY = Object.freeze({ Strong: "strong", Growing: "growing", "Needs support": "support", "Needs urgent attention": "urgent", "More input needed": "more" });
export const LEVEL_WORD = Object.freeze(Object.fromEntries(Object.entries(LEVEL_KEY).map(([w, k]) => [k, w])));
export function levelOf(score, responses) {
  const word = v3ScoreBand(score, responses);
  const key = LEVEL_KEY[word];
  if (!key) throw new TypeError(`results: v3ScoreBand returned an unknown band "${word}"`);
  return key;
}

// The four bands on the band barbell, low to high (design-system.md Lens dot / barbell row: four-band axis).
export const BANDS = Object.freeze(["urgent", "support", "growing", "strong"]);
export const BAND_SHORT = Object.freeze({ urgent: "Urgent", support: "Support", growing: "Growing", strong: "Strong" });
export const bandCentre = (band) => 12.5 + 25 * BANDS.indexOf(band);

/** Per-perspective cards: [{ lens, label, n, level, rows: [{ name, score, level, items, note }] }] in lens order. */
export function lensCards(payload, counts) {
  const lenses = Array.isArray(payload?.lenses) ? payload.lenses : [];
  return LENS_ORDER.map((lens) => lenses.find((l) => l && l.lens === lens)).filter(Boolean).map((l) => {
    const n = counts?.[l.lens] ?? null;
    return {
      lens: l.lens, label: lensLabel(l.lens), n, level: levelOf(l.score, n),
      rows: (Array.isArray(l.sub_dimensions) ? l.sub_dimensions : []).map((s) => ({ name: s.sub_dimension, score: s.score ?? null, level: levelOf(s.score, n), items: s.items, note: s.note })),
    };
  });
}

/** One band-barbell row per area name: dots placed at band centres, spread 5% apart in lens order when bands are shared. */
export function bandRow(report, counts, name) {
  const row = lensSpreadRows(report, { exact: true }).find((r) => r.name === name);
  if (!row) throw new TypeError(`results: no cross-perspective area "${name}" in the report`);
  const asked = LENS_ORDER.filter((lens) => row.lenses.some((s) => s.lens === lens));
  const dots = asked.map((lens) => {
    const s = row.lenses.find((x) => x.lens === lens);
    return { lens, label: lensLabel(lens), score: s.score, level: levelOf(s.score, counts?.[lens] ?? s.n) };
  });
  for (const band of BANDS) {
    const here = dots.filter((d) => d.level === band);
    here.forEach((d, i) => { d.x = bandCentre(band) + 5 * (i - (here.length - 1) / 2); });
  }
  const idx = dots.map((d) => BANDS.indexOf(d.level)).filter((i) => i >= 0);
  const apart = idx.length ? Math.max(...idx) - Math.min(...idx) : 0;
  const span = apart >= 2 ? { from: 12.5 + 25 * Math.min(...idx), to: 12.5 + 25 * Math.max(...idx) } : null;
  const verdict = apart >= 2 ? `${apart} bands apart — talk about this` : apart === 1 ? "1 band apart" : "same band";
  const notAsked = LENS_ORDER.filter((lens) => !asked.includes(lens)).map(lensLabel);
  const question = (report.payload.cross_lens_multi || []).find((a) => a.construct_name === name)?.question;
  return { name, question, dots, apart, span, verdict, notAsked, spread: row.spread, perspectives: asked.length };
}

/** Numeric barbell rows (detailed report): exact scores on 0-100, red span at two bands apart or more, else a quiet span. */
export function scoreRows(report, counts, names) {
  const rows = lensSpreadRows(report, { exact: true });
  const pick = names ? names.map((n) => rows.find((r) => r.name === n)).filter(Boolean) : rows;
  return pick.map((r) => {
    const band = bandRow(report, counts, r.name);
    const scores = r.lenses.map((s) => s.score);
    return { name: r.name, spread: r.spread, from: Math.min(...scores), to: Math.max(...scores), alarm: band.apart >= 2, notAsked: band.notAsked,
      dots: [...r.lenses].sort((a, b) => a.score - b.score).map((s) => ({ lens: s.lens, label: lensLabel(s.lens), score: s.score })) };
  });
}

/** Radar geometry from radarModel (spokes = the named shared areas), board scale: centre (210,185), radius 118, rings 25..100. */
export function radar(report, names) {
  const multi = (report.payload.cross_lens_multi || []).filter((a) => names.includes(a.construct_name));
  const model = radarModel({ payload: { cross_lens_multi: multi } });
  if (!model) return null;
  const C = [210, 185], R = 118, L = 141.6, k = model.spokes.length;
  const at = (i, r) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / k; return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]; };
  const pts = (r) => model.spokes.map((_, i) => at(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");
  return {
    rings: [25, 50, 75, 100].map((v) => pts((R * v) / 100)),
    spokes: model.spokes.map((name, i) => {
      const [x, y] = at(i, R), [lx, ly] = at(i, L), lines = wrap(name, 16);
      const anchor = Math.abs(lx - C[0]) < 1 ? "middle" : lx > C[0] ? "start" : "end";
      return { name, x: x.toFixed(1), y: y.toFixed(1), lx: lx.toFixed(1), ly: (ly - ((lines.length - 1) * 13) / 2).toFixed(1), anchor, lines };
    }),
    lenses: model.lenses.map(({ lens, scores }) => {
      const marks = scores.map((v, i) => (v === null ? null : { area: model.spokes[i], score: v, xy: at(i, (R * v) / 100).map((n) => n.toFixed(1)) })).filter(Boolean);
      return { lens, label: lensLabel(lens), points: marks.map((m) => m.xy.join(",")).join(" "), marks };
    }),
  };
}

/** Held state: who is below the minimum, in the board's words ("Church 1 — needs 2 more"). */
export function heldLines(counts) {
  return LENS_ORDER.map((lens) => {
    const n = counts?.[lens] ?? 0, short = Math.max(0, MIN_RESPONSES - n);
    return { lens, label: lensLabel(lens), n, short, text: short ? `${lensLabel(lens)} ${n} — needs ${short} more` : `${lensLabel(lens)} ${n} — ready` };
  });
}

/** Answer bars: whole-percent widths of the question's answer count (board: floor). */
export const pct = (count, n) => (n > 0 ? Math.floor((100 * count) / n) : 0);
