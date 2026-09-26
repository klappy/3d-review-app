// U14 (lanes-2111, journey J5): the owner deletes an assessment from its settings. Existing server capability only —
// cap.assessment.delete (DELETE /v2/assessments/{id}, owner): dry_run → confirm_token → execute. D5 holds on the server:
// only an empty assessment is hard-deleted, so a non-empty one gets one plain sentence and no confirm.
// The confirm is the shared in-page one (Review gate askStageMove, as U34/U37), never window.confirm.
const esc0 = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const DELETED_NOTICE = 'Assessment deleted.';
export const DELETE_LABEL = 'Delete assessment';
/** Owners only; members and viewers get nothing. */
export function deleteAssessmentButton(role, { disabled = false } = {}, esc = esc0) {
  return role === 'owner' ? `<span class="actions" data-assessment-more><button type="button" class="quiet small" data-delete-assessment${disabled ? ' disabled' : ''}>${esc(DELETE_LABEL)}</button></span>` : '';
}
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** The dry run's impact as one sentence; ok=false when the server would refuse (D5: not empty). */
export function deleteImpact(dry) {
  const a = dry?.impact?.affected?.[0] || {}, surveys = Number(a.surveys) || 0, responses = Number(a.responses) || 0;
  if (surveys || responses) return { ok: false, sentence: `This assessment has ${count(responses, 'response')} in ${count(surveys, 'survey')}, so it cannot be deleted.` };
  return { ok: true, sentence: 'This deletes the assessment; it has no surveys or responses.' };
}
/** Dry run, then ask in the page, then execute with the confirm token. The caller owns every message and the landing. */
export async function deleteAssessmentFlow(button, { id, api, ask, onDeleted, onRefused, onError, now = () => Date.now(), enc = encodeURIComponent }) {
  const url = `/v2/assessments/${enc(id)}`;
  button.disabled = true;
  let dry;
  try { dry = await api(url, { method: 'DELETE', body: { mode: 'dry_run' } }); } catch (e) { button.disabled = false; onError(e); return; }
  button.disabled = false;
  const impact = deleteImpact(dry);
  if (!impact.ok || typeof dry?.confirm_token !== 'string') { onRefused(impact.ok ? 'Preview deletion again before confirming.' : impact.sentence); return; }
  const expiresAt = now() + (Number(dry.expires_in) || 0) * 1000;
  ask(button, impact.sentence, DELETE_LABEL, async () => {
    if (now() >= expiresAt) { onRefused('Preview deletion again before confirming.'); return; }
    button.disabled = true;
    try { await api(url, { method: 'DELETE', body: { mode: 'execute', confirm_token: dry.confirm_token } }); } catch (e) { button.disabled = false; onError(e); return; }
    onDeleted();
  }, esc0, 'Confirm deleting the assessment');
}
