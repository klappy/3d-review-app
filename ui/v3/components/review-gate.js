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
