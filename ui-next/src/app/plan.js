import { api, enc } from './api.js';

// Notes use the existing assessment contract. Keep the text readable in the current design.
export async function savePlan(aid, notes, request = api) {
  const patch = { notes_reflection: String(notes.notes_reflection ?? ''), notes_next_steps: String(notes.notes_next_steps ?? '') };
  await request(`/v2/assessments/${enc(aid)}/notes`, { method: 'PATCH', body: patch });
  const { assessment } = await request(`/v2/assessments/${enc(aid)}`);
  if (Object.entries(patch).some(([k, v]) => String(assessment?.[k] ?? '') !== v)) throw new Error('The saved notes could not be verified. Reopen the review before trying again.');
  return assessment;
}
