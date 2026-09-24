// ui/assess/v3-assessment.js — v3 lane 3: state-driven primary, settled + "not yet confirmed" counts, results band layout.
// Source: klappy/3d-review-cookbook design-system-v3 @66d97f3 (prototype/app.js V.assessment / V.results; ADOPTION.md).
// Rulings (captain, tier B, 2026-09-24): (a) denominator only when the facilitator entered one; (b) settled count and
// "n not yet confirmed" side by side; (c) results use the band layout. Each is one flag below. API contract unchanged:
// this module only reads what the API already returns and never invents a number the server did not send.

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
export function v3CountLine({ responses, expected, unconfirmed } = {}, esc = esc0, flags = V3_FLAGS) {
  const got = num(responses) ?? 0, of = flags.expectedCountOptional ? num(expected) : null, unc = num(unconfirmed);
  const settled = of ? `${got} of ${of} responded` : `${got} responded`;
  const pending = !flags.showUnconfirmed ? '' : unc === null
    ? '' // the server did not report one: show nothing rather than a number it never sent
    : `<span class="${unc ? 'badge' : 'muted'}" data-v3-unconfirmed="${unc}">${unc} not yet confirmed</span>`;
  return `<span class="v3-count" data-v3-settled="${got}">${esc(settled)}</span>${pending ? ` <span aria-hidden="true">·</span> ${pending}` : ''}`;
}

const BAND_WORDS = new Set(['Strong', 'Growing', 'Needs support', 'Needs urgent attention', 'More input needed']);
const LENS_CLASS = { 'Translation Team': 'team', Church: 'church', Community: 'community' };

/** Band layout (ruling c): one card per perspective, a band word never a score. A held result renders every card as an
 *  evidence gap with the server's reason — no band is invented. */
export function v3BandsMarkup(results, lenses, esc = esc0, groups = null) {
  const r = results || {};
  const given = Array.isArray(r.bands) ? r.bands : [];
  const held = !given.length || r.status === 'held';
  const cards = lenses.map(lens => {
    const b = given.find(x => x && x.perspective === lens);
    const word = !held && b && BAND_WORDS.has(b.band) ? b.band : 'More input needed';
    const suppressed = b && b.state === 'suppressed';
    const note = held ? `<p class="muted" data-v3-band-held>${esc(r.reason || 'Results are held.')}</p>`
      : suppressed ? '<div class="note">Withheld to protect a small group. This is an evidence gap, not a poor result.</div>'
      : b && b.text ? `<p>${esc(b.text)}</p>` : '';
    const count = groups ? `<div class="v3-band-count small muted" data-v3-band-count="${esc(lens)}">${esc(v3GroupCountText(groups[lens]))}</div>` : '';
    return `<div class="glass band lens ${LENS_CLASS[lens] || ''}" data-v3-band="${esc(lens)}"><div class="eyebrow">${esc(lens)}</div><div class="word">${esc(word)}</div>${note}${count}</div>`;
  }).join('');
  const legend = '<div class="legend small muted" data-v3-legend>Strong · Growing · Needs support · Needs urgent attention · More input needed</div>';
  return `<div class="v3-bands three" data-v3-bands="${held ? 'held' : 'shown'}">${cards}</div>${legend}`;
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
export function v3EvidenceRows(results, lenses, groups = {}) {
  const r = results || {}, held = !(Array.isArray(r.bands) && r.bands.length) || r.status === 'held';
  return lenses.map(lens => {
    const g = groups[lens], counted = v3GroupCountText(g);
    if (!g || !g.surveys) return [lens, 'Not asked in this review', 'Missing data is not a low result'];
    const b = !held && Array.isArray(r.bands) ? r.bands.find(x => x && x.perspective === lens) : null;
    const say = b && BAND_WORDS.has(b.band) ? b.band : held ? 'Held · no band yet' : 'More input needed';
    const limit = held ? (r.reason || 'Results are held') : !g.loaded ? 'Count not loaded yet' : (num(g.responses) ?? 0) === 0 ? 'No responses yet' : 'People who did not answer may see it differently';
    return [lens, `${say} · ${counted}`, limit];
  });
}
export const V3_EVIDENCE_FOOTER = 'Descriptive items are shown, not scored. Choose-all-that-apply items show overlap, not a number. Missing data is not a low result. Bands come from validated scoring and report templates; no number is invented here.';
export function v3EvidenceMarkup(rows, open, esc = esc0) {
  const btn = `<button type="button" class="quiet" data-v3-evidence-toggle aria-expanded="${open ? 'true' : 'false'}">${open ? 'Simple view' : 'Show evidence and details'}</button>`;
  const table = `<div class="v3-evidence" data-v3-evidence${open ? '' : ' hidden'}><h3>What supports this view?</h3><table class="table"><thead><tr><th>Evidence</th><th>What we can say</th><th>Limit</th></tr></thead><tbody>${rows.map(e => `<tr>${e.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="small muted footer">${esc(V3_EVIDENCE_FOOTER)}</p></div>`;
  return { btn, table };
}

export const v3css = `.v3-bands{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:12px 0}
.v3-bands .band{padding:16px;border:1px solid var(--line);border-radius:12px}.v3-bands .word{font-size:20px;font-weight:600;margin:4px 0 8px}
.v3-count{font-weight:600}.v3-bands .v3-band-count{font-size:13px;margin-top:8px}.v3-evidence table{width:100%;border-collapse:collapse}.v3-evidence td,.v3-evidence th{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}.v3-summary .row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}`;

// U4 review gate (PARITY.md U4; prototype V.results frame 10). One primary per state, each a single cap.assessment.set_stage
// move (the server allows one step at a time): Collecting → "Record my review" (checkbox first) → Reviewing →
// "Choose a next step" → Improving. Viewers get the state word only. No new capability, no new stored field.
export const V3_REVIEW_CHECK = 'I checked the meaning, the missing evidence and any sensitive details';
const CAN_MOVE = new Set(['member', 'owner']);
export function v3GateAction(stage, role) {
  if (!CAN_MOVE.has(String(role || '').toLowerCase())) return null;
  if (stage === 'collect') return { action: 'recordReview', label: 'Record my review', check: true };
  if (stage === 'understand') return { action: 'saveAndFinish', label: 'Choose a next step', check: false };
  return null;
}
export function v3ReviewGateMarkup(stage, role, esc = esc0) {
  const reviewed = stage === 'improve', g = v3GateAction(stage, role);
  const badge = `<span class="badge${reviewed ? '' : ' warn'}" data-v3-reviewed="${reviewed}">${reviewed ? 'Reviewed' : 'Draft · a person checks this before sharing'}</span>`;
  if (!g) return `<div class="v3-gate" data-v3-gate="none">${badge}</div>`;
  const check = g.check ? `<label class="choice"><input type="checkbox" data-v3-review-check> ${esc(V3_REVIEW_CHECK)}</label>` : '';
  return `<div class="v3-gate" data-v3-gate="${esc(g.action)}">${badge}${check}<button type="button" class="primary" data-v3-gate-go="${esc(g.action)}"${g.check ? ' disabled' : ''}>${esc(g.label)}</button><p class="status small" role="status" aria-live="polite" data-v3-gate-status></p></div>`;
}
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
