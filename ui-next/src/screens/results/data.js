// UI Next (v4) results lane: data adapter. Status: provisional (playbook rule 12).
// Reads the built-report shape the current UI already reads and derives every level through the current UI's pure modules
// (import only, no backend change): ui/assess/v3-assessment.js v3ScoreBand + V3_BAND_CUTOFFS (band words, provisional cut-offs,
// minimum responses), ui/report-lenses.js lensSpreadRows + lensLabel (cross-perspective spread rows, perspective names),
// ui/report-radar.js radarModel + wrap (radar spokes and label wrapping). Fixtures: ui-next/fixtures/results/*.json.
// Boards: cookbook design/2026-10-15-glass-redesign/canvas Results*, Report*, ReportDetailed (.dc.html).
import { v3ScoreBand, V3_BAND_CUTOFFS } from "../../../../ui/assess/v3-assessment.js";
import { lensSpreadRows, lensLabel, lensRespondents, constructName, lensesCopy } from "../../../../ui/report-lenses.js";
import { radarModel, wrap } from "../../../../ui/report-radar.js";
import { LENSES } from "../../../../ui/lens-surveys.js";
import REPORT from "../../../fixtures/results/report.json";
import ANSWERS from "../../../fixtures/results/answers.json";

export { REPORT, ANSWERS, lensLabel };
export const LENS_ORDER = Object.freeze(["team", "community", "church"]);

// One lens key for every lens read (R5-1). The live built report spells perspectives the way ui/lens-surveys.js LENSES does
// ("Translation Team", "Community", "Church": payload.lenses, lens_scores and the evidence label prefixes), the fixtures use the
// short ids; both, in any case, map through LENSES and lensLabel to team | community | church. Anything else is not a
// perspective here (null), and LENS_ORDER filters it out as before.
const KEY_OF = new Map(LENS_ORDER.flatMap((key) => [[key, key], ...LENSES.filter((name) => lensLabel(name) === lensLabel(key)).map((name) => [name.toLowerCase(), key])]));
export const lensKey = (lens) => (typeof lens === "string" ? KEY_OF.get(lens.trim().toLowerCase()) ?? null : null);
const keyed = (lens) => lensKey(lens) ?? lens;
const canon = new WeakMap();
/** The payload with every lens read on the keys above: payload.lenses[].lens, cross_lens_multi / cross_lens_single
 *  lens_scores[].lens and the evidence label prefix ("Church — Involved Pastor" -> "church — Involved Pastor"), so the
 *  adapter's exact matches, ui/report-lenses.js lensRespondents and lensSpreadRows all read one spelling. Live sub-dimensions
 *  carry n_items_included where the fixtures carry items (lensCards reads either). Pure; cached per payload object. */
export function canonicalPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  if (canon.has(payload)) return canon.get(payload);
  const obj = (v) => v && typeof v === "object";
  const scores = (entries) => (Array.isArray(entries) ? entries.map((e) => (obj(e) && Array.isArray(e.lens_scores) ? { ...e, lens_scores: e.lens_scores.map((s) => (obj(s) ? { ...s, lens: keyed(s.lens) } : s)) } : e)) : entries);
  const label = (e) => {
    if (!obj(e) || typeof e.label !== "string") return e;
    const [head, ...rest] = e.label.split(" — "), key = lensKey(head);
    return key ? { ...e, label: [key, ...rest].join(" — ") } : e;
  };
  const out = { ...payload };
  if (Array.isArray(payload.lenses)) out.lenses = payload.lenses.map((l) => (obj(l) ? { ...l, lens: keyed(l.lens) } : l));
  if ("cross_lens_multi" in payload) out.cross_lens_multi = scores(payload.cross_lens_multi);
  if ("cross_lens_single" in payload) out.cross_lens_single = scores(payload.cross_lens_single);
  if (Array.isArray(payload.evidence)) out.evidence = payload.evidence.map(label);
  canon.set(payload, out);
  return out;
}
export const MIN_RESPONSES = V3_BAND_CUTOFFS.minResponses; // answer splits (complementary suppression) keep this floor
// Per-perspective level minimum: the SERVER decides it (src/report-admission.ts perspectiveLevelMinimum, served as
// level_minimum_responses on GET /v2/assessments/{aid}/results: DEV 1, every other environment 3). Until a served value is
// read, or when it is absent or not a whole number >= 1, UI Next uses the SAFE floor (V3_BAND_CUTOFFS.minResponses, 3), never 1.
// Under the minimum a perspective reads More input needed; at or over it, low counts are shown by the coverage cue (drops).
export const SAFE_LEVEL_MIN = V3_BAND_CUTOFFS.minResponses;
/** The level minimum a served value allows: a whole number >= 1, else the safe floor. */
export const levelMinimumOf = (served) => (Number.isInteger(served) && served >= 1 ? served : SAFE_LEVEL_MIN);
let levelMin = SAFE_LEVEL_MIN, sessionMin = null;
const valid = (v) => Number.isInteger(v) && v >= 1;
/** The session's policy from GET /v2/me (app/session.js me()). It stands until the session is forgotten; null clears it. */
export function useSessionLevelMinimum(served) { sessionMin = valid(served) ? served : null; levelMin = sessionMin ?? SAFE_LEVEL_MIN; return levelMin; }
/** Record a per-review read's level_minimum_responses. An absent, failed or malformed value never overwrites a policy the session
 *  already served: it falls back to that, and to the safe 3 only when no value was ever served. */
export function useLevelMinimum(served) { levelMin = valid(served) ? served : sessionMin ?? SAFE_LEVEL_MIN; return levelMin; }
/** The level minimum in force now (the served value, else 3). */
export const currentLevelMin = () => levelMin;
/** v3ScoreBand cut-offs with the level minimum in force. */
export const levelCutoffs = () => Object.freeze({ ...V3_BAND_CUTOFFS, minResponses: levelMin });
/** Coverage (quantity) beside the level (quality): drops filled by how many people answered (no jar: the Level's Jars imagery owns the jar). Provisional tiers, presentation only. */
export function coverageOf(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return { fill: 0, word: "" }; // not counted: no jar word on a guess
  const k = Number(n);
  return k <= 0 ? { fill: 0, word: "No drops yet" } : k < 3 ? { fill: 1, word: "A few drops" } : k < 6 ? { fill: 2, word: "Filling up" } : { fill: 3, word: "Well filled" };
}

// Band word (v3ScoreBand) -> Level key (ui-next/src/Level.svelte LEVELS; design-system.md section 4 level words).
export const LEVEL_KEY = Object.freeze({ Strong: "strong", Growing: "growing", "Needs support": "support", "Needs urgent attention": "urgent", "More input needed": "more" });
export const LEVEL_WORD = Object.freeze(Object.fromEntries(Object.entries(LEVEL_KEY).map(([w, k]) => [k, w])));
export function levelOf(score, responses) {
  const word = v3ScoreBand(score, responses, levelCutoffs());
  const key = LEVEL_KEY[word];
  if (!key) throw new TypeError(`results: v3ScoreBand returned an unknown band "${word}"`);
  return key;
}

/** One response-count resolver for every place a perspective is placed or hidden (R4-2). Snapshot first: a built report's level
 *  and coverage rest on that report's own immutable evidence n (ui/report-lenses.js lensRespondents of the payload), never on
 *  answers that arrived after it was built. `counts` (the live survey counts) stand in only where the payload carries no count
 *  for that perspective; with neither, null (More input needed). Cards, evidence tables, band and score barbells, the tensions
 *  order and the radar all read it, so a perspective under the minimum is hidden in every one of them, with or without `counts`.
 *  prefer "live" (the held preview only, which shows the collection as it stands, not a built report) reads `counts` first. */
export function responsesFor(payload, counts, { prefer = "report" } = {}) {
  const evidence = lensRespondents(canonicalPayload(payload));
  if (prefer === "live") return (lens) => counts?.[lens] ?? evidence.get(lens) ?? null;
  return (lens) => evidence.get(lens) ?? counts?.[lens] ?? null;
}
/** Live responses a built report does not include yet, per perspective: the live count over the report's own evidence n, else 0
 *  (no evidence count to compare, or no live count). Presentation only: never a level, never a coverage tier. */
export function newerFor(payload, counts) {
  const evidence = lensRespondents(canonicalPayload(payload));
  return (lens) => { const was = evidence.get(lens), now = Number(counts?.[lens]); return Number.isFinite(was) && Number.isFinite(now) && now > was ? now - was : 0; };
}
/** "2 newer responses not in this report yet" (Results cards; the printed report is the snapshot and never says it). */
export const newerText = (k) => (k > 0 ? `${k} newer ${k === 1 ? "response" : "responses"} not in this report yet` : "");
/** "6 responses", "1 response" (ui/report-lenses.js lensesCopy.respondents); with no count anywhere, the current UI's words
 *  ("responses not counted"), never "null responses" (R5-2). */
export const responsesText = (n) => (n === null || n === undefined ? lensesCopy.noCount : lensesCopy.respondents(n));

// The four bands on the band barbell, low to high (design-system.md Lens dot / barbell row: four-band axis).
export const BANDS = Object.freeze(["urgent", "support", "growing", "strong"]);
export const BAND_SHORT = Object.freeze({ urgent: "Urgent", support: "Support", growing: "Growing", strong: "Strong" });
export const bandCentre = (band) => 12.5 + 25 * BANDS.indexOf(band);

/** Per-perspective cards: [{ lens, label, n, newer, level, rows: [{ name, score, level, items, note }] }] in lens order (n: the
 *  report's own evidence count, responsesFor; newer: live responses after it, newerFor); a perspective
 *  missing from the payload has no card (callers iterate, never index). An area at "more" (under the minimum responses, or no
 *  score) carries score null, so no table or label can print a score the level hides (R3-1). */
/** A built report's total responses: the sum of the snapshot counts its cards display (lensCards n, the report's own evidence;
 *  0 for a perspective that had none). Never the live survey total, which is only for the "newer responses" notice. */
export const snapshotTotal = (cards) => list(cards).reduce((t, c) => t + (Number.isFinite(Number(c?.n)) && c.n !== null ? Number(c.n) : 0), 0);
/** The perspectives a review sent out: its selected, non-archived surveys, as lens keys in LENS_ORDER (a survey without a state, as
 *  older reads return it, counts as selected). A perspective never sent out is not in the list, so it stays hidden. */
export const sentLenses = (surveys) => LENS_ORDER.filter((k) => list(surveys).some((s) => s && !s.archived_at && (s.state ?? "selected") === "selected" && lensKey(s.perspective) === k));
/** sent (sentLenses): a perspective the review sent out but the built payload has no lens for had no response when the report was
 *  built (the capture keeps response-backed perspectives only), so it gets a card at More input needed with n 0 and no rows or score;
 *  any live answers since then are its "newer" count. Without sent (fixtures, a printed report with no survey list) nothing is added. */
export function lensCards(raw, counts, { prefer = "report", sent } = {}) {
  const payload = canonicalPayload(raw);
  const lenses = Array.isArray(payload?.lenses) ? payload.lenses : [], responses = responsesFor(payload, counts, { prefer });
  const newer = prefer === "live" ? () => 0 : newerFor(payload, counts);
  const absent = (lens) => {
    const live = Number(counts?.[lens]), k = Number.isFinite(live) && live > 0 ? live : 0;
    return { lens, label: lensLabel(lens), n: prefer === "live" ? k : 0, newer: prefer === "live" ? 0 : k, level: "more", rows: [], absent: true };
  };
  return LENS_ORDER.map((lens) => lenses.find((l) => l && l.lens === lens) ?? (list(sent).includes(lens) ? absent(lens) : null)).filter(Boolean).map((l) => {
    if (l.absent) return l;
    const n = responses(l.lens);
    return {
      lens: l.lens, label: lensLabel(l.lens), n, newer: newer(l.lens), level: levelOf(l.score, n),
      rows: (Array.isArray(l.sub_dimensions) ? l.sub_dimensions : []).filter(Boolean).map((s) => {
        const level = levelOf(s.score, n);
        return { name: s.sub_dimension, score: level === "more" ? null : s.score ?? null, level, items: s.items ?? s.n_items_included, note: s.note };
      }),
    };
  });
}

/** A perspective's score may show on an area only at a band level: asked, scored, and at or over the minimum responses. Under the
 *  minimum it contributes nothing a reader could work back to its score: no dot, spread, tensions order, radar point or table cell. */
const placed = (score, n) => BANDS.includes(levelOf(score, n));

const list = (v) => (Array.isArray(v) ? v : []);
/** Every cross-perspective area as lensSpreadRows reads it (exact), read one entry at a time so each keeps its payload position:
 *  { name, spread, lenses, order (cross_lens_multi then cross_lens_single), multi, question }. A malformed entry (null, no
 *  scored perspective) is skipped, never thrown (R4-3); a blank or odd name reads as constructName gives it ("—", "42"). */
function areas(report) {
  const payload = canonicalPayload(report?.payload);
  if (!payload || typeof payload !== "object") return [];
  const entries = [...list(payload.cross_lens_multi).map((e) => [e, true]), ...list(payload.cross_lens_single).map((e) => [e, false])];
  return entries.map(([entry, multi], order) => {
    const row = lensSpreadRows({ payload: { cross_lens_multi: [entry], evidence: payload.evidence } }, { exact: true })[0];
    return row ? { ...row, order, multi, question: entry.question } : null;
  }).filter(Boolean);
}
const byName = (all, names) => list(names).map((name) => all.find((a) => a.name === name)).filter(Boolean);

/** One band-barbell row per area name: dots placed at band centres, spread 5% apart in lens order when bands are shared.
 *  A perspective under the minimum responses (level "more") has no band, so it gets no dot and no part in the verdict, span or
 *  spread; like a perspective not asked, it is named in notes ("Church more input needed"). notes: the words after the verdict.
 *  spread: points between the placed scores only (the payload's own spread when every scored perspective is placed), null under two. */
export function bandRow(report, counts, name) {
  const row = areas(report).find((r) => r.name === name);
  if (!row) throw new TypeError(`results: no cross-perspective area "${name}" in the report`);
  return band(row, responsesFor(report?.payload, counts));
}
function band(row, responses) {
  const { name, question } = row;
  const asked = LENS_ORDER.filter((lens) => row.lenses.some((s) => s.lens === lens));
  const levelled = asked.map((lens) => {
    const s = row.lenses.find((x) => x.lens === lens);
    return { lens, label: lensLabel(lens), score: s.score, level: levelOf(s.score, responses(lens)) };
  });
  const dots = levelled.filter((d) => BANDS.includes(d.level));
  const scores = dots.map((d) => d.score);
  const spread = scores.length < 2 ? null : dots.length === row.lenses.length ? row.spread : Math.max(...scores) - Math.min(...scores);
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
  return { name, question, dots, more, apart, span, verdict, notAsked, notes, spread, perspectives: asked.length };
}

/** bandRow for each name the report has as a cross-perspective area; a name the payload lacks is skipped, never thrown (R3-3). */
export function bandRows(report, counts, names) {
  const responses = responsesFor(report?.payload, counts);
  return byName(areas(report), names).map((a) => band(a, responses));
}

/** design-system.md section 4 report copy by the level minimum in force (Codex P1 4382475714): the footer's privacy clause (after
 *  "Built from N responses on <date> · <clause> ·") and the last sentence of "How to read the scores". */
export const footPrivacy = (min = currentLevelMin()) => (min === 1
  ? "nothing here names a person; where one person from a perspective has answered, its level and scores reflect that person's answers"
  : `nothing here identifies a person: a perspective shows only with at least ${min} answers`);
export const readingPrivacy = (min = currentLevelMin()) => (min === 1
  ? "Nothing in this report names a person, but while only one person from a perspective has answered, its level and scores reflect that person's answers."
  : `Nothing in this report identifies a person: a perspective's level and scores show only once at least ${min} people from it have answered.`);

/** "Where to look next" for a live built report (live QA Q4; the fixtures carry the board's own): the weakest areas the cards show,
 *  urgent before needs-support, in perspective order, at most `max`, as [lens, area] pairs. Derived from the levels, never stored. */
export function lookNextOf(cards, max = 3) {
  const weak = list(cards).flatMap((c) => list(c.rows).filter((r) => r.level === "urgent" || r.level === "support").map((r) => ({ lens: c.lens, area: r.name, level: r.level })));
  return [...weak.filter((w) => w.level === "urgent"), ...weak.filter((w) => w.level === "support")].slice(0, max).map((w) => [w.lens, w.area]);
}
/** "What stands out" for a live built report (live QA Q4): one plain sentence from what the report already shows, each perspective's
 *  level and the widest gap two or more bands apart, never a judgement the data does not carry. "" when there is nothing to say. */
export function standsOutOf(cards, rows) {
  const lv = list(cards).map((c) => `${c.label} ${LEVEL_WORD[c.level].toLowerCase()}`);
  const wide = list(rows).filter((r) => r.apart >= 2).sort((x, y) => y.apart - x.apart)[0];
  const parts = [];
  if (lv.length) parts.push(`Overall: ${lv.join(", ")}.`);
  if (wide) parts.push(`The perspectives are furthest apart on ${wide.name} (${wide.dots.map((d) => `${d.label} ${LEVEL_WORD[d.level].toLowerCase()}`).join(", ")}).`);
  return parts.join(" ");
}

/** The words after a row's lead ("same band", "gap 14", the levels): " · "-joined, so no separator is lost in markup. */
export const withNotes = (lead, row) => [lead, ...row.notes].filter(Boolean).join(" · ");
/** A numeric row's lead: "gap 14", or, with fewer than two placed perspectives, the band row's words (never "gap null"). */
export const gapLead = (row) => (row.spread === null || row.spread === undefined ? "too few perspectives to compare" : `gap ${fmtScore(row.spread)}`);
/** A score or spread as shown: a whole number (display only; geometry, bands, ordering and exports keep the raw value). */
export const fmtScore = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : String(Math.round(Number(v))));

/** Numeric barbell rows (detailed report): exact scores on 0-100, red span at two bands apart or more, else a quiet span.
 *  Only the perspectives band() places get a dot, a spread or a place in the order (under the minimum: no score shown, named
 *  in notes). With names: those areas in that order. Without: biggest placed spread first, areas under two placed last (R3-1);
 *  ties break on payload order (a unique index, so no further key is needed): a key no hidden score can move (R4-1), never
 *  lensSpreadRows' full-spread order. */
export function scoreRows(report, counts, names) {
  const all = areas(report), responses = responsesFor(report?.payload, counts);
  if (names) return byName(all, names).map((a) => scoreRow(a, responses));
  return all.map((a) => ({ a, row: scoreRow(a, responses) }))
    .sort(({ a: x, row: p }, { a: y, row: q }) => (p.spread === null) - (q.spread === null) || (q.spread ?? 0) - (p.spread ?? 0) || x.order - y.order)
    .map(({ row }) => row);
}
/** The one gap ordering every screen uses (live QA N4): the detailed report's tensions order (scoreRows: biggest placed spread first,
 *  ties on payload order), as band rows, keeping only areas where two placed perspectives sit at least one band apart. A same-band
 *  pair is never a gap. */
export function gapRows(report, counts) {
  const order = scoreRows(report, counts).filter((r) => r.spread !== null).map((r) => r.name);
  return bandRows(report, counts, order).filter((r) => r.dots.length >= 2 && r.apart >= 1);
}
/** Every cross_lens_multi area in payload order (detailed report page 2, "All areas compared"), malformed entries skipped and
 *  blank or odd names kept as constructName reads them (R4-3). */
export function comparedRows(report, counts) {
  const responses = responsesFor(report?.payload, counts);
  return areas(report).filter((a) => a.multi).map((a) => scoreRow(a, responses));
}
function scoreRow(area, responses) {
  const b = band(area, responses), scores = b.dots.map((d) => d.score);
  return { name: area.name, spread: b.spread, from: scores.length ? Math.min(...scores) : 0, to: scores.length ? Math.max(...scores) : 0, alarm: b.apart >= 2, notes: b.notes,
    dots: [...b.dots].sort((x, y) => x.score - y.score).map((d) => ({ lens: d.lens, label: d.label, score: d.score })) };
}

/** Radar geometry from radarModel (spokes = the named shared areas), board scale: centre (210,185), radius 118, rings 25..100.
 *  Only placed scores reach radarModel (R3-1): a perspective under the minimum has no polygon, point or <title>, and an area
 *  is a spoke only when two placed perspectives scored it. legend: the drawn perspectives in lens order; notes: the others
 *  ("Church more input needed", "Church not asked"). null under radarModel's minimum spokes. */
export function radar(report, names, counts) {
  const payload = canonicalPayload(report?.payload) ?? {}, responses = responsesFor(payload, counts);
  const want = list(names);
  const named = list(payload.cross_lens_multi).filter((a) => a && typeof a === "object" && want.includes(constructName(a.construct_name)));
  const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN); // as ui/report-lenses.js
  const scored = (a) => (Array.isArray(a.lens_scores) ? a.lens_scores : []).filter((s) => s && LENS_ORDER.includes(s.lens) && Number.isFinite(num(s.score)));
  const multi = named.map((a) => ({ ...a, lens_scores: scored(a).filter((s) => placed(s.score, responses(s.lens))) }));
  const model = radarModel({ payload: { cross_lens_multi: multi } });
  if (!model) return null;
  const drawn = LENS_ORDER.filter((lens) => model.lenses.some((l) => l.lens === lens));
  const asked = LENS_ORDER.filter((lens) => named.some((a) => scored(a).some((s) => s.lens === lens)));
  const notes = LENS_ORDER.filter((lens) => !drawn.includes(lens)).map((lens) => `${lensLabel(lens)} ${asked.includes(lens) ? "more input needed" : "not asked"}`);
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
      const pts = scores.map((v, i) => (v === null ? null : { area: model.spokes[i], score: v, xy: at(i, (R * v) / 100).map((c) => c.toFixed(1)) }));
      const marks = pts.filter(Boolean);
      // design-system.md "The skipped spoke" (V-29): closed only when every spoke is scored; otherwise one open line per run of adjacent
      // scored spokes, wrapping past the last spoke, so nothing crosses a skipped spoke; a lone scored spoke stays a marker only.
      const closed = marks.length === k;
      const runs = [];
      if (!closed && marks.length) {
        const start = pts.findIndex((p) => p === null); // begin just after a skip, so a run that wraps past the last spoke stays whole
        let run = [];
        for (let j = 1; j <= k; j++) { const p = pts[(start + j) % k]; if (p) run.push(p.xy.join(",")); else { if (run.length > 1) runs.push(run.join(" ")); run = []; } }
        if (run.length > 1) runs.push(run.join(" "));
      }
      const skipped = model.spokes.filter((_, i) => pts[i] === null);
      return { lens, label: lensLabel(lens), closed, points: closed ? marks.map((m) => m.xy.join(",")).join(" ") : "", runs, marks, skipped };
    }),
    legend: drawn.map((lens) => ({ lens, label: lensLabel(lens) })),
    notes,
  };
}

/** A small count in words for copy that names it ("The two perspectives as one shape"); past six, the digits. */
export const countWord = (n) => ["no", "one", "two", "three", "four", "five", "six"][n] ?? String(n);
/** Detailed report sheets: 1 head + radar + tensions, 2 all areas, then the evidence two perspectives a sheet; no sheet is
 *  empty, so a report with two perspectives has three pages, not an empty "(continued)" one (R4-5). */
export const evidenceSheets = (cards) => list(cards).filter((c) => list(c.rows).length).flatMap((c, i, a) => (i % 2 ? [] : [a.slice(i, i + 2)])); // a perspective with no areas (none at build time) has no evidence table
export const detailedPages = (cards) => 2 + evidenceSheets(cards).length;

/** Held state: who is below the minimum, in the board's words ("Church 1 — needs 2 more"). */
export function heldLines(counts) {
  return LENS_ORDER.map((lens) => {
    const n = counts?.[lens] ?? 0, short = Math.max(0, levelMin - n);
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
