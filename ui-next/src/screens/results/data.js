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

/** One band-barbell row per area name: dots placed at band centres, spread 5% apart in lens order when bands are shared.
 *  A perspective under the minimum responses (level "more") has no band, so it gets no dot and no part in the verdict or
 *  span; like a perspective not asked, it is named in notes ("Church more input needed"). notes: the words after the verdict. */
export function bandRow(report, counts, name) {
  const row = lensSpreadRows(report, { exact: true }).find((r) => r.name === name);
  if (!row) throw new TypeError(`results: no cross-perspective area "${name}" in the report`);
  const asked = LENS_ORDER.filter((lens) => row.lenses.some((s) => s.lens === lens));
  const levelled = asked.map((lens) => {
    const s = row.lenses.find((x) => x.lens === lens);
    return { lens, label: lensLabel(lens), score: s.score, level: levelOf(s.score, counts?.[lens] ?? s.n) };
  });
  const dots = levelled.filter((d) => BANDS.includes(d.level));
  const more = levelled.filter((d) => !BANDS.includes(d.level)).map((d) => d.label);
  for (const band of BANDS) {
    const here = dots.filter((d) => d.level === band);
    here.forEach((d, i) => { d.x = bandCentre(band) + 5 * (i - (here.length - 1) / 2); });
  }
  const idx = dots.map((d) => BANDS.indexOf(d.level));
  const apart = idx.length ? Math.max(...idx) - Math.min(...idx) : 0;
  const span = apart >= 2 ? { from: 12.5 + 25 * Math.min(...idx), to: 12.5 + 25 * Math.max(...idx) } : null;
  const verdict = dots.length < 2 ? "too few perspectives to compare" : apart >= 2 ? `${apart} bands apart — talk about this` : apart === 1 ? "1 band apart" : "same band";
  const notAsked = LENS_ORDER.filter((lens) => !asked.includes(lens)).map(lensLabel);
  const notes = [...more.map((l) => `${l} more input needed`), ...notAsked.map((l) => `${l} not asked`)];
  const question = (report.payload.cross_lens_multi || []).find((a) => a.construct_name === name)?.question;
  return { name, question, dots, more, apart, span, verdict, notAsked, notes, spread: row.spread, perspectives: asked.length };
}

/** The words after a row's lead ("same band", "gap 14", the levels): " · "-joined, so no separator is lost in markup. */
export const withNotes = (lead, row) => [lead, ...row.notes].filter(Boolean).join(" · ");

/** Numeric barbell rows (detailed report): exact scores on 0-100, red span at two bands apart or more, else a quiet span.
 *  Only the perspectives bandRow places get a dot (under the minimum: no score shown, named in notes). */
export function scoreRows(report, counts, names) {
  const rows = lensSpreadRows(report, { exact: true });
  const pick = names ? names.map((n) => rows.find((r) => r.name === n)).filter(Boolean) : rows;
  return pick.map((r) => {
    const band = bandRow(report, counts, r.name);
    const placed = r.lenses.filter((s) => band.dots.some((d) => d.lens === s.lens));
    const scores = placed.map((s) => s.score);
    return { name: r.name, spread: r.spread, from: scores.length ? Math.min(...scores) : 0, to: scores.length ? Math.max(...scores) : 0, alarm: band.apart >= 2, notes: band.notes,
      dots: [...placed].sort((a, b) => a.score - b.score).map((s) => ({ lens: s.lens, label: lensLabel(s.lens), score: s.score })) };
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

// Answers (ResultsAnswers boards): anonymous rows per perspective (fixtures/results/answers.json) aggregated here, as a
// responses-aggregate read would (wiring debt 6 in the cookbook receipt). A split groups the rows by one attribute. Board footer:
// "splits with fewer than 3 answers are hidden". Hiding only the small group is not enough: Everyone minus the shown groups gives
// its answers back. So a question shows its split only when every group, counted by answers to that question, meets
// MIN_RESPONSES (complementary suppression); otherwise the question shows Everyone and says the split is held.
export const SPLITS = Object.freeze(ANSWERS.splits.map(([key, label]) => Object.freeze({ key, label })));
export const ANSWER_LENSES = Object.freeze(LENS_ORDER.filter((lens) => Object.hasOwn(ANSWERS.lenses, lens)));
/** A known perspective key, else the fixture default (an unknown ?state= renders the default). */
export const answerLens = (lens) => (ANSWER_LENSES.includes(lens) ? lens : ANSWERS.default);
/** A known split key, else "everyone". */
export const answerSplit = (split) => (SPLITS.some((s) => s.key === split) ? split : "everyone");

function tally(q, i, rows) {
  const counts = q.options.map(() => 0);
  let n = 0;
  for (const r of rows) {
    const a = r.a[i];
    if (a === null || a === undefined) continue;
    n += 1;
    for (const k of Array.isArray(a) ? a : [a]) {
      if (!Number.isInteger(k) || k < 0 || k >= counts.length) throw new TypeError(`results answers: option ${String(k)} out of range on ${q.id}`);
      counts[k] += 1;
    }
  }
  return { n, options: q.options.map((label, k) => [label, counts[k]]) };
}

/** One perspective's answers, optionally split: { lens, label, answers, modality, focus: { area, level }, split, questions }.
 *  Each question: { id, q, others, n, options } for Everyone, plus groups (the split, [] when unsplit or held) and held
 *  (true when the split is active but a group has fewer than MIN_RESPONSES answers to this question). */
export function answerView(lens, split = "everyone") {
  const key = answerLens(lens), by = answerSplit(split), L = ANSWERS.lenses[key];
  const card = lensCards(REPORT.desktop.payload, REPORT.desktop.counts).find((c) => c.lens === key);
  const area = card?.rows.find((r) => r.name === L.focus);
  if (!area) throw new TypeError(`results answers: focus area "${L.focus}" is not a ${key} area in the report`);
  const groups = [];
  if (by !== "everyone") for (const r of L.rows) {
    const g = groups.find((x) => x.label === String(r[by]));
    if (g) g.rows.push(r); else groups.push({ label: String(r[by]), rows: [r] });
  }
  return {
    lens: key, label: lensLabel(key), answers: L.rows.length, modality: ANSWERS.modality,
    focus: { area: area.name, level: area.level }, split: by,
    questions: L.questions.map((q, i) => {
      const all = tally(q, i, L.rows);
      const parts = groups.map((g) => ({ label: g.label, ...tally(q, i, g.rows) }));
      const held = parts.some((g) => g.n < MIN_RESPONSES);
      return { id: q.id, q: q.q, others: q.others, n: all.n, options: all.options, held, groups: held ? [] : parts };
    }),
  };
}
