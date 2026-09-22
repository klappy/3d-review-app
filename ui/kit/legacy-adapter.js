// Presentation-only adapter for the legacy staff survey code batch (issue → preview → confirmed once-only export).
// Paints an existing DOM region; owns no state, no transport, no storage, no timers. Controllers (ui/app.js) decide
// permissions, requests, confirmation and invalidation; this module only writes text/hidden/class on nodes that already
// exist, so control node identity (and each control's disabled state) is never replaced from here.
// Kit idiom follows the accepted K2 coordinator adaptation (ui/kit/views-coordinator.js): glass panel, contextual row,
// compact .row action grouping, "Action review" preview section, note[role=status] receipt. No revoke/undo/email/PDF.
export const CODE_IDS = Object.freeze(['code-count', 'issue-codes', 'issued-ids', 'preview-export', 'export-impact', 'release-codes', 'codes-output']);
export const PHASES = Object.freeze(['idle', 'issued', 'previewed', 'released']);
const text = (node, value) => { if (node) node.textContent = value == null ? '' : String(value); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Static markup for the region. Same control ids as before so the existing handlers bind unchanged; content nodes are
// painted by paintCodeBatch. Headings/notes are kit classes already served to the legacy page.
export function codeBatchMarkup() {
  return `<section class="glass panel code-batch" data-code-batch aria-labelledby="code-batch-title">`
    + `<div class="row"><div><p class="eyebrow">Collect</p><h3 id="code-batch-title">One-time codes</h3></div><span class="badge" data-code-phase>Not issued</span></div>`
    + `<p class="muted" data-code-context></p>`
    + `<div class="row code-batch-issue"><label>Number of one-time codes<input id="code-count" type="number" min="1" max="100" step="1" value="1" inputmode="numeric"></label>`
    + `<button id="issue-codes" type="button">Issue code IDs</button></div>`
    + `<p id="issued-ids" class="note" role="status">No code batch issued in this page session.</p>`
    + `<div class="row code-batch-actions"><button id="preview-export" type="button">Preview credential release</button>`
    + `<button id="release-codes" type="button" class="primary" disabled>Confirm and reveal codes once</button></div>`
    + `<section class="glass panel code-batch-review" data-code-review hidden aria-label="Action review"><h2 data-code-review-title>Preview</h2><p id="export-impact" class="note" role="status"></p></section>`
    + `<pre id="codes-output" class="code-batch-output" hidden aria-label="Released code values"></pre>`
    + `<p class="note">Codes are shown only after a separate confirmed export. Save/print now; these values cannot be exported again. No email delivery is configured.</p>`
    + `</section>`;
}

// model: { phase, context, count, ids, impact, expiresIn, codesText, failure }
//   phase      one of PHASES; anything else paints as 'idle'
//   context    short string naming the selected survey (may be '')
//   ids        array of issued id strings (issued|previewed|released)
//   impact     preview impact object or string (previewed)
//   expiresIn  seconds (previewed)
//   codesText  already-joined "id: code" lines (released) — painted with textContent only
//   failure    optional human message; painted into export-impact as a warning without changing phase
// Returns the phase actually painted. Never touches `disabled` on any control.
export function paintCodeBatch(root, model = {}) {
  if (!root) return 'idle';
  const $ = id => root.querySelector('#' + id);
  const phase = PHASES.includes(model.phase) ? model.phase : 'idle';
  const ids = Array.isArray(model.ids) ? model.ids.map(String) : [];
  text(root.querySelector('[data-code-context]'), model.context ? `Survey ${model.context}` : 'Choose a survey to issue codes.');
  const badge = root.querySelector('[data-code-phase]');
  text(badge, { idle: 'Not issued', issued: `${ids.length} ID(s) issued`, previewed: 'Preview ready', released: 'Released once' }[phase]);
  if (badge) badge.dataset.phase = phase;
  text($('issued-ids'), phase === 'idle' ? 'No code batch issued in this page session.' : `${ids.length} code ID(s) issued: ${ids.join(', ')}`);
  const review = root.querySelector('[data-code-review]'), reviewTitle = root.querySelector('[data-code-review-title]');
  const impact = $('export-impact');
  if (impact) impact.classList.remove('warning');
  if (phase === 'previewed') {
    text(reviewTitle, 'Confirm action');
    const impactText = typeof model.impact === 'string' ? model.impact : JSON.stringify(model.impact ?? {});
    text(impact, `Release ${Number(model.count ?? ids.length)} code value(s) once; impact: ${impactText}. Confirmation expires in ${Number(model.expiresIn ?? 0)} seconds.`);
    if (review) review.hidden = false;
  } else if (phase === 'released') {
    text(reviewTitle, 'Released');
    text(impact, 'Released once. Save/print now; these values cannot be exported again.');
    if (review) review.hidden = false;
  } else if (phase === 'issued') {
    text(reviewTitle, 'Preview');
    text(impact, 'Preview and confirm to reveal code values.');
    if (review) review.hidden = false;
  } else { text(reviewTitle, 'Preview'); text(impact, ''); if (review) review.hidden = true; }
  if (model.failure) { text(impact, String(model.failure)); if (impact) impact.classList.add('warning'); if (review) review.hidden = false; text(reviewTitle, 'Needs attention'); }
  const out = $('codes-output');
  if (out) { out.textContent = phase === 'released' ? String(model.codesText ?? '') : ''; out.hidden = phase !== 'released'; }
  return phase;
}

// Validation mirror for the count field: integer 1–100. Pure; the controller still enforces it before any request.
export function validCount(value) { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null; }
export { esc };
