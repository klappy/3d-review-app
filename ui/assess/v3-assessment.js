// ui/assess/v3-assessment.js — v3 lane 3: state-driven primary, settled + "not yet confirmed" counts, results band layout.
// Source: klappy/3d-review-cookbook design-system-v3 @66d97f3 (prototype/app.js V.assessment / V.results; ADOPTION.md).
// Rulings (captain, tier B, 2026-09-24): (a) denominator only when the facilitator entered one; (b) settled count and
// "n not yet confirmed" side by side; (c) results use the band layout. Each is one flag below. API contract unchanged:
// this module only reads what the API already returns and never invents a number the server did not send.

import { stepper, ensureStepperStyle } from '../v3/components/stepper.js';
import { responseCount } from '../v3/components/response-count.js'; // component: Response count (ruling 12:34)
import { bandCard, bandLegend, BAND_LEGEND } from '../v3/components/band-card.js'; // component: Band card + legend (ruling 12:34)
import { evidenceTable } from '../v3/components/evidence-table.js'; // component: Evidence table (ruling 12:34)
import { learnMore } from '../v3/components/learn-more.js'; // component: Learn more (lane 9 L9-24)

export const V3_FLAGS = Object.freeze({ expectedCountOptional: true, showUnconfirmed: true, bandResults: true, nextStepPage: true });

// App stage ids (prepare/collect/understand/improve) → v3 plain state words and the one primary action per state.
export const V3_STAGES = Object.freeze({
  prepare: { word: 'Setup not finished', primary: 'Continue setup', view: 'prepare' },
  collect: { word: 'Collecting responses', primary: 'Share the survey', view: 'collect' },
  understand: { word: 'Ready to look at results', primary: 'Look at the results', view: 'understand' },
  improve: { word: 'Reviewed', primary: 'Open the next step', view: 'improve' },
});

// ADOPTION.md: v3 actions map onto cap.assessment.set_stage; the stored stage ids do not change.
export const V3_SET_STAGE = Object.freeze({ launch: 'collect', recordReview: 'understand', saveAndFinish: 'improve' });

const esc0 = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function v3StageWord(stage) { return V3_STAGES[stage]?.word || 'Setup not finished'; }

/** One primary action for the assessment page, driven by stage. Viewers get no Share/Continue action. */
export function v3StagePrimary(stage, canEdit, href = v => `#${v}`, esc = esc0) {
  const s = V3_STAGES[stage] || V3_STAGES.prepare;
  if (!canEdit && (s.view === 'collect' || s.view === 'prepare')) return '';
  return `<a class="rv-btn primary" data-v3-primary="${esc(s.view)}" href="${esc(href(s.view))}">${esc(s.primary)}</a>`;
}

const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));

/** Settled count, optional denominator (ruling a) and "n not yet confirmed" side by side (ruling b).
 *  `unconfirmed` is shown only when the server reports it; the facilitator side never guesses it. */
// U05 / B31 (lanes-1321): facilitators never see the server's internal hold reason (e.g. "D7 scoring, threshold, and
// differencing policy unresolved"): held cards carry only their band word + count; the Results block says this once. The evidence
// table behind "Show evidence and details" shows a plain phrase too (V3_HELD_LIMIT), never the server reason.
export const V3_HELD_TEXT = 'Results appear after a report is built from at least three responses per group.';
// U05 validator (lanes-1510): every facilitator-visible held reason is a plain phrase; the server's reason string is never rendered.
export const V3_HELD_LIMIT = 'Held until a report is built';
export const V3_REPORTS_HELD = 'Reports are held for now.';
export const V3_REPORT_HELD = 'This report is held for now.';
// Bincy 07 / RULING a (B-07, lanes-1321): the wizard keeps "How many do you expect?" per survey in this browser only
// (v3/wizard.js EXPECTED_KEY 'v3:expected', never sent to the API). Collect reads it back so "n of N responded" shows
// where N was given; anything missing, zero or unreadable → null → plain "n responded".
export const V3_EXPECTED_KEY = 'v3:expected';
export function v3ExpectedFor(surveyId, store) {
  try {
    const n = Number(JSON.parse(store?.getItem(V3_EXPECTED_KEY) || '{}')[surveyId]);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch { return null; }
}

export function v3CountLine(counts = {}, esc = esc0, flags = V3_FLAGS) {
  return responseCount(counts, esc, { expectedOptional: !!flags.expectedCountOptional, showUnconfirmed: !!flags.showUnconfirmed }); // component: Response count
}

const BAND_WORDS = new Set(['Strong', 'Growing', 'Needs support', 'Needs urgent attention', 'More input needed']);

// Prototype frame 10 legend (design-system-v3 V.results): one colour dot per band word, colours from tokens only.
export const V3_LEGEND = BAND_LEGEND;

// CAPTAIN RULING 12:22 (ASK.md option 1): PROVISIONAL cut-offs, labelled provisional on the page. One flip here.
// Input (captain 11:42): the latest built report's per-perspective score (payload.lenses[].score, 0–100) and the server's
// survey response counts for that perspective. Below the minimum count → "More input needed". Read-only; no contract change.
export const V3_BAND_CUTOFFS = Object.freeze({ provisional: true, strong: 75, growing: 60, needsSupport: 40, minResponses: 3 });
export const V3_BAND_PROVISIONAL = 'Provisional bands: 75 and above Strong · 60–74 Growing · 40–59 Needs support · below 40 Needs urgent attention. At least 3 responses per perspective, otherwise More input needed.';
/** Score → band word. `responses` null/undefined or below the minimum → "More input needed". */
export function v3ScoreBand(score, responses, c = V3_BAND_CUTOFFS) {
  const n = num(responses), s = scoreOf(score);
  if (n === null || n < c.minResponses || !Number.isFinite(s)) return 'More input needed';
  return s >= c.strong ? 'Strong' : s >= c.growing ? 'Growing' : s >= c.needsSupport ? 'Needs support' : 'Needs urgent attention';
}
/** Per-perspective scores from a built report ({payload:{lenses:[{lens,score,sub_dimensions:[{sub_dimension,score}]}]}}). */
const scoreOf = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); // null/''/bool → NaN, never 0
export function v3ReportScores(report) {
  const ls = report && report.payload && Array.isArray(report.payload.lenses) ? report.payload.lenses : [];
  const out = {};
  for (const l of ls) if (l && typeof l.lens === 'string' && Number.isFinite(scoreOf(l.score)))
    out[l.lens] = { score: scoreOf(l.score), subs: (Array.isArray(l.sub_dimensions) ? l.sub_dimensions : []).filter(x => x && typeof x.sub_dimension === 'string' && Number.isFinite(scoreOf(x.score))).map(x => ({ name: x.sub_dimension, score: scoreOf(x.score) })) };
  return out;
}

/** Band layout (ruling c): one card per perspective, a band word never a score. With a built report's scores (`scores`,
 *  from v3ReportScores) each card is banded by the provisional cut-offs, gated on the perspective's server response count
 *  (`groups`); each sub-dimension gets its own band word under the same gate. Without scores a held result renders every
 *  card as an evidence gap with the server's reason — no band is invented. */
export function v3BandsMarkup(results, lenses, esc = esc0, groups = null, scores = null) {
  const r = results || {};
  const given = Array.isArray(r.bands) ? r.bands : [];
  const scored = !!(scores && lenses.some(l => scores[l]));
  const held = !scored && (!given.length || r.status === 'held');
  const cards = lenses.map(lens => {
    const sc = scored ? scores[lens] : null, g = groups && groups[lens], n = g && g.loaded ? g.responses : null;
    const b = given.find(x => x && x.perspective === lens);
    const word = sc ? v3ScoreBand(sc.score, n) : !held && b && BAND_WORDS.has(b.band) ? b.band : 'More input needed';
    const suppressed = !sc && b && b.state === 'suppressed';
    const note = sc ? (sc.subs.length ? `<ul class="v3-band-subs small">${sc.subs.map(x => `<li data-v3-sub="${esc(x.name)}">${esc(x.name)} · <strong>${esc(v3ScoreBand(x.score, n))}</strong></li>`).join('')}</ul>` : '')
      : scored ? '<p class="muted">Not in the latest report.</p>'
      : held ? '' // lane 9 L9-24: the held reason is said once under the cards, not once per card (U05: one plain line, never the server's policy code)
      : suppressed ? '<div class="note">Withheld to protect a small group. This is an evidence gap, not a poor result.</div>'
      : b && b.text ? `<p>${esc(b.text)}</p>` : '';
    const count = groups ? `<div class="v3-band-count small muted" data-v3-band-count="${esc(lens)}">${esc(v3GroupCountText(groups[lens]))}</div>` : '';
    return bandCard({ lens, word, bodyHtml: note, countHtml: count }, esc);
  }).join('');
  const legend = bandLegend(V3_LEGEND, esc);
  const prov = scored && V3_BAND_CUTOFFS.provisional ? learnMore(`<p class="small muted" data-v3-provisional>${esc(V3_BAND_PROVISIONAL)}</p>`) : ''; // lane 9 L9-24: cut-offs behind Learn more
  const heldLine = held ? `<p class="muted" data-v3-band-held>${esc(V3_HELD_TEXT)}</p>` : '';
  return `<div class="v3-bands three" data-v3-bands="${scored ? 'provisional' : held ? 'held' : 'shown'}">${cards}</div>${heldLine}${legend}${prov}`;
}

// U2 evidence toggle + table, U3 folded into one footer line (PARITY.md U2/U3; prototype V.results frame 10:
// "Show evidence and details" / "Simple view", table Evidence · What we can say · Limit). Bincy screen 10 (group counts)
// is met by the per-perspective count on each band card. Every number here is a server count; nothing is scored.
/** Group count text for one perspective: {surveys, loaded, responses} from the per-survey count reads. */
export function v3GroupCountText(g) {
  if (!g || !g.surveys) return 'Not asked in this review';
  if (!g.loaded) return 'Count not loaded yet'; // the server has sent no count: show no number
  const n = num(g.responses) ?? 0, base = `${n} response${n === 1 ? '' : 's'}`;
  return g.loaded === g.surveys ? base : `${base} so far (${g.loaded} of ${g.surveys} survey counts loaded)`;
}
/** One evidence row per perspective. The result read is held until D7, so "what we can say" is the held state, never a band. */
export function v3EvidenceRows(results, lenses, groups = {}, scores = null) {
  const r = results || {}, held = !(Array.isArray(r.bands) && r.bands.length) || r.status === 'held';
  return lenses.map(lens => {
    const g = groups[lens], counted = v3GroupCountText(g);
    if (!g || !g.surveys) return [lens, 'Not asked in this review', 'Missing data is not a low result'];
    const sc = scores && scores[lens];
    if (sc) { const n = g.loaded ? g.responses : null, w = v3ScoreBand(sc.score, n);
      return [lens, `${w} (provisional) · score ${sc.score} · ${counted}`, w === 'More input needed' ? `Fewer than ${V3_BAND_CUTOFFS.minResponses} responses` : 'Provisional cut-offs; people who did not answer may see it differently']; }
    const b = !held && Array.isArray(r.bands) ? r.bands.find(x => x && x.perspective === lens) : null;
    const say = b && BAND_WORDS.has(b.band) ? b.band : held ? 'Held · no band yet' : 'More input needed';
    const limit = held ? V3_HELD_LIMIT : !g.loaded ? 'Count not loaded yet' : (num(g.responses) ?? 0) === 0 ? 'No responses yet' : 'People who did not answer may see it differently';
    return [lens, `${say} · ${counted}`, limit];
  });
}
export const V3_EVIDENCE_FOOTER = 'Descriptive items are shown, not scored. Choose-all-that-apply items show overlap, not a number. Missing data is not a low result. Bands come from validated scoring and report templates; no number is invented here.';
export function v3EvidenceMarkup(rows, open, esc = esc0) {
  return evidenceTable(rows, open, esc, { footer: V3_EVIDENCE_FOOTER }); // component: Evidence table
}

export const v3css = `.v3-bands{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:12px 0}
.v3-bands .band{padding:16px;border:1px solid var(--line);border-radius:12px}.v3-bands .word{font-size:20px;font-weight:600;margin:4px 0 8px}
.v3-count{font-weight:600}.v3-bands .v3-band-count{font-size:13px;margin-top:8px}.v3-band-subs{margin:0 0 6px;padding-left:18px}.v3-evidence table{width:100%;border-collapse:collapse}.v3-evidence td,.v3-evidence th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}.v3-summary .row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}`;

// U4 review gate (PARITY.md U4; prototype V.results frame 10). One primary per state, each a single cap.assessment.set_stage
// move (the server allows one step at a time): Collecting → "Record my review" (checkbox first) → Reviewing →
// "Choose a next step" → Improving. Viewers get the state word only. No new capability, no new stored field.
export { V3_REVIEW_CHECK, v3GateAction, reviewGate as v3ReviewGateMarkup } from '../v3/components/review-gate.js'; // component: Review gate (ruling 12:34)
/** The only write: POST /v2/assessments/:id/stage { stage } (cap.assessment.set_stage), stage from V3_SET_STAGE. */
export function v3SetStage(api, enc, aid, action) {
  const stage = V3_SET_STAGE[action];
  if (!stage) return Promise.reject(new Error(`unknown v3 action ${action}`));
  return api(`/v2/assessments/${enc(aid)}/stage`, { method: 'POST', body: { stage } });
}

// Screen 11 "Next step" (Bincy 04_screen_inventory #11; prototype V.next frame 11, provisional). Same two stored notes
// (notes_reflection, notes_next_steps) — no new field: the prototype's "Follow up on" date and Bincy's suggested-areas list
// are not stored by the contract, so they are not drawn (PARITY A5/I1). The stage move to Improving stays on the Understand
// gate ("Choose a next step", U4); this page only saves the two notes (no second write, no race with navigation — Bugbot on #197).
export const V3_NEXT = Object.freeze({
  eyebrow: 'Next step', title: 'What happens next?', reflection: 'What you noticed', next: 'The next step',
  reflectionHint: 'In your words. This stays with this review.', nextHint: 'e.g. A listening session with the church group',
  footer: 'There is no fixed schedule. Start another review when it is appropriate; this one keeps its history.',
  save: 'Save notes',
});

// component: Stepper (captain ruling 12:28 + 12:34). The assessment page's stage strip is the wizard's Stepper, imported
// not copied: the server stage is the active dot, earlier stages ticked, every step links to its view (href from caller).
export const V3_STAGE_ORDER = Object.freeze(['prepare', 'collect', 'understand', 'improve']);
export function v3StageStepper(stage, hrefFor = () => null) {
  const labels = { prepare: 'Prepare', collect: 'Collect', understand: 'Understand', improve: 'Improve' };
  const i = V3_STAGE_ORDER.indexOf(stage);
  return stepper(V3_STAGE_ORDER.map(v => ({ label: labels[v], href: hrefFor(v) })), i < 0 ? 1 : i + 1, { label: 'Assessment stages' });
}
export { ensureStepperStyle };
