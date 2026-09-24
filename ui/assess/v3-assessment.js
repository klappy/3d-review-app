// ui/assess/v3-assessment.js — v3 lane 3: state-driven primary, settled + "not yet confirmed" counts, results band layout.
// Source: klappy/3d-review-cookbook design-system-v3 @66d97f3 (prototype/app.js V.assessment / V.results; ADOPTION.md).
// Rulings (captain, tier B, 2026-09-24): (a) denominator only when the facilitator entered one; (b) settled count and
// "n not yet confirmed" side by side; (c) results use the band layout. Each is one flag below. API contract unchanged:
// this module only reads what the API already returns and never invents a number the server did not send.

export const V3_FLAGS = Object.freeze({ expectedCountOptional: true, showUnconfirmed: true, bandResults: true });

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
    ? '<span class="muted" data-v3-unconfirmed="unreported">not yet confirmed: none reported</span>'
    : `<span class="${unc ? 'badge' : 'muted'}" data-v3-unconfirmed="${unc}">${unc} not yet confirmed</span>`;
  return `<span class="v3-count" data-v3-settled="${got}">${esc(settled)}</span>${pending ? ` <span aria-hidden="true">·</span> ${pending}` : ''}`;
}

const BAND_WORDS = new Set(['Strong', 'Growing', 'Needs support', 'Needs urgent attention', 'More input needed']);
const LENS_CLASS = { 'Translation Team': 'team', Church: 'church', Community: 'community' };

/** Band layout (ruling c): one card per perspective, a band word never a score. A held result renders every card as an
 *  evidence gap with the server's reason — no band is invented. */
export function v3BandsMarkup(results, lenses, esc = esc0) {
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
    return `<div class="glass band lens ${LENS_CLASS[lens] || ''}" data-v3-band="${esc(lens)}"><div class="eyebrow">${esc(lens)}</div><div class="word">${esc(word)}</div>${note}</div>`;
  }).join('');
  const legend = '<div class="legend small muted" data-v3-legend>Strong · Growing · Needs support · Needs urgent attention · More input needed</div>';
  return `<div class="v3-bands three" data-v3-bands="${held ? 'held' : 'shown'}">${cards}</div>${legend}`;
}

export const v3css = `.v3-bands{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:12px 0}
.v3-bands .band{padding:16px;border:1px solid var(--line);border-radius:12px}.v3-bands .word{font-size:20px;font-weight:600;margin:4px 0 8px}
.v3-count{font-weight:600}.v3-summary .row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}`;
