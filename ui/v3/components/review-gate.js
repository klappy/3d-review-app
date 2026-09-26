// component: Review gate (captain ruling 12:34). Results (10) U4 gate: state badge + one primary per state
// (Collecting → "Record my review" behind a checkbox → Reviewing → "Choose a next step" → Improving). Viewers get the badge only.
// Pure string builder; the write stays with the caller (cap.assessment.set_stage).
const esc0 = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const V3_REVIEW_CHECK = 'I checked the meaning, the missing evidence and any sensitive details';
const CAN_MOVE = new Set(['member', 'owner']);
export function v3GateAction(stage, role) {
  if (!CAN_MOVE.has(String(role || '').toLowerCase())) return null;
  if (stage === 'collect') return { action: 'recordReview', label: 'Record my review', check: true };
  if (stage === 'understand') return { action: 'saveAndFinish', label: 'Choose a next step', check: false };
  return null;
}
export function reviewGate(stage, role, esc = esc0) {
  const reviewed = stage === 'improve', g = v3GateAction(stage, role);
  const badge = `<span class="badge${reviewed ? '' : ' warn'}" data-v3-reviewed="${reviewed}">${reviewed ? 'Reviewed' : 'Draft · a person checks this before sharing'}</span>`;
  if (!g) return `<div class="v3-gate" data-v3-gate="none">${badge}</div>`;
  const check = g.check ? `<label class="choice"><input type="checkbox" data-v3-review-check> ${esc(V3_REVIEW_CHECK)}</label>` : '';
  return `<div class="v3-gate" data-v3-gate="${esc(g.action)}">${badge}${check}<button type="button" class="primary" data-v3-gate-go="${esc(g.action)}"${g.check ? ' disabled' : ''}>${esc(g.label)}</button><p class="status small" role="status" aria-live="polite" data-v3-gate-status></p></div>`;
}
// U34 (lanes-2011, Bincy B37): the stage move is asked in the page, never window.confirm. One button per move (`data-stage`),
// and one in-page confirm under the row that holds it. The write stays with the caller (cap.assessment.set_stage).
export function stageMoveButton(to, label, { primary = false, disabled = false } = {}, esc = esc0) {
  return `<button type="button"${primary ? ' class="primary"' : ''} data-stage="${esc(to)}"${disabled ? ' disabled' : ''}>${esc(label)}</button>`;
}
export function stageMoveConfirm(sentence, confirmLabel, esc = esc0, aria = 'Confirm the stage move') {
  return `<div class="note" data-stage-confirm role="group" aria-label="${esc(aria)}"><p>${esc(sentence)}</p><div class="actions"><button type="button" class="primary" data-stage-confirm-go>${esc(confirmLabel)}</button><button type="button" class="quiet" data-stage-confirm-cancel>Cancel</button></div></div>`;
}
/** Opens the in-page confirm after `button`'s row; Cancel closes it, the confirm button closes it and calls `onConfirm`. */
export function askStageMove(button, sentence, confirmLabel, onConfirm, esc = esc0, aria) { // U14: aria names other in-page asks (delete)
  const doc = button.ownerDocument, row = button.closest('.actions, .title') || button;
  doc.querySelectorAll('[data-stage-confirm]').forEach(n => n.remove());
  const t = doc.createElement('template'); t.innerHTML = stageMoveConfirm(sentence, confirmLabel, esc, aria);
  const box = t.content.firstElementChild; row.after(box);
  box.querySelector('[data-stage-confirm-cancel]').onclick = () => { box.remove(); button.focus(); };
  box.querySelector('[data-stage-confirm-go]').onclick = () => { box.remove(); onConfirm(); };
  box.querySelector('[data-stage-confirm-go]').focus();
  return box;
}
