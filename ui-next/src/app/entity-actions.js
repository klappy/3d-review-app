import { api, enc } from './api.js';
import { v3CompleteLock } from '../../../ui/assess/v3-assessment.js';
const stages = ['prepare', 'collect', 'understand', 'improve'];
const refusalCodes = new Set(['NOT_AUTHENTICATED', 'NOT_AUTHORIZED_AT_SCOPE', 'WRONG_TOOL_FOR_CLASS', 'CONFIRM_REQUIRED', 'CONFIRM_EXPIRED', 'INVALID_PARAMS', 'NOT_FOUND_OR_NOT_VISIBLE', 'STAGE_CONFLICT', 'RESERVED_NOT_BUILT', 'NO_INVERSE', 'RATE_LIMITED']);
const outcomeError = (message, outcome, cause) => Object.assign(new Error(message), { outcome, cause });
async function write(request, path, options) {
  try { return await request(path, options); }
  catch (error) {
    // Only a structured server refusal establishes that this write was not applied.
    // A transport error, unreadable response or later readback failure cannot do so.
    if (refusalCodes.has(error?.code)) throw outcomeError(error.message, 'refused', error);
    throw outcomeError(error?.message || 'The write outcome could not be confirmed.', 'unknown', error);
  }
}
async function readback(request, path, type, matches, message) {
  try {
    const saved = (await request(path))[type];
    if (!saved || !matches(saved)) throw new Error(message);
    return type === 'assessment' ? v3CompleteLock(saved) : saved;
  } catch (error) { throw outcomeError(message, 'unknown', error); }
}
export function adjacentStages(stage) {
  const index = stages.indexOf(stage);
  return index < 0 ? [] : stages.filter((_, target) => Math.abs(target - index) === 1);
}
export function entityPath(type, id) {
  if (!['project', 'assessment'].includes(type) || !id) throw new Error('Choose a project or review.');
  return `/v2/${type === 'project' ? 'projects' : 'assessments'}/${enc(id)}`;
}
export async function archiveEntity(type, entity, archived, request = api) {
  const path = entityPath(type, entity.id);
  await write(request, `${path}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST', body: {} });
  return readback(request, path, type, saved => saved.id === entity.id && !!saved.archived_at === archived, 'Archive state could not be verified. Reload before trying again.');
}
export async function moveEntityStage(entity, stage, request = api) {
  if (!adjacentStages(entity.stage).includes(stage)) throw outcomeError('Move one stage at a time.', 'refused');
  const path = entityPath('assessment', entity.id);
  await write(request, `${path}/stage`, { method: 'POST', body: { stage } });
  return readback(request, path, 'assessment', saved => saved.id === entity.id && saved.stage === stage, 'Stage could not be verified. Reload before trying again.');
}
export async function previewEntityDelete(type, entity, request = api) {
  try {
    const result = await request(entityPath(type, entity.id), { method: 'DELETE', body: { mode: 'dry_run' } });
    if (!result?.confirm_token) throw new Error('The deletion preview could not be confirmed.');
    return result;
  } catch (error) { throw outcomeError(`${error?.message || 'The deletion preview is unavailable.'} No deletion was requested.`, 'not-started', error); }
}
export async function deleteEntity(type, entity, preview, request = api) {
  if (!preview?.confirm_token) throw outcomeError('Preview the deletion before confirming it.', 'not-started');
  const result = await write(request, entityPath(type, entity.id), { method: 'DELETE', body: { mode: 'execute', confirm_token: preview.confirm_token } });
  if (result?.deleted !== true || (result.id !== undefined && result.id !== entity.id)) throw outcomeError('Deletion could not be confirmed. Reload before trying again.', 'unknown');
  // The assessment endpoint acknowledges its atomic deletion. A direct review
  // owner need not have permission to list the parent project after that success.
  if (type === 'assessment') return result;
  try {
    const list = await request('/v2/projects');
    if (!Array.isArray(list.projects) || list.projects.some(x => x.id === entity.id)) throw new Error('Project is still listed.');
  } catch (error) { throw outcomeError('Deletion could not be verified. Reload the list before trying again.', 'unknown', error); }
  return result;
}
