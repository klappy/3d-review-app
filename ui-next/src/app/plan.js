import { api, enc } from './api.js';
import { v3NextParse, v3NextSerialize, v3IsComplete } from '../../../ui/assess/v3-assessment.js';

// Notes use the existing assessment contract. Keep the text readable in the current design.
export async function savePlan(aid, notes, request = api, { complete = false } = {}) {
  const previous = await request(`/v2/assessments/${enc(aid)}`);
  const metadata = v3NextParse(previous.assessment?.notes_next_steps);
  // Completion adds only the marker to the latest notes observed after stage advancement.
  // It must not replay the earlier editor snapshot over a colleague's intervening save.
  const patch = { notes_reflection: String((complete ? previous.assessment?.notes_reflection : notes.notes_reflection) ?? ''), notes_next_steps: v3NextSerialize({ ...metadata, text: complete ? metadata.text : String(notes.notes_next_steps ?? ''), complete: complete || metadata.complete }) };
  await request(`/v2/assessments/${enc(aid)}/notes`, { method: 'PATCH', body: patch });
  const { assessment } = await request(`/v2/assessments/${enc(aid)}`);
  if (Object.entries(patch).some(([k, v]) => String(assessment?.[k] ?? '') !== v)) throw new Error('The saved notes could not be verified. Reopen the review before trying again.');
  return assessment;
}

export async function completePlan(aid, request = api) {
  let { assessment } = await request(`/v2/assessments/${enc(aid)}`);
  if (v3IsComplete(assessment)) return assessment;
  if (!['collect', 'understand', 'improve'].includes(assessment?.stage)) throw new Error('Launch the review before completing it.');
  for (const stage of assessment.stage === 'collect' ? ['understand', 'improve'] : assessment.stage === 'understand' ? ['improve'] : []) {
    await request(`/v2/assessments/${enc(aid)}/stage`, { method: 'POST', body: { stage } });
  }
  const stored = await savePlan(aid, {}, request, { complete: true });
  if (stored.stage !== 'improve' || !v3IsComplete(stored)) throw new Error('Completion could not be verified. Reopen this review before retrying.');
  return stored;
}
