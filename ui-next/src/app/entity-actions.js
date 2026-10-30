import { api, enc } from './api.js';
export function entityPath(type, id) {
  if (!['project', 'assessment'].includes(type) || !id) throw new Error('Choose a project or review.');
  return `/v2/${type === 'project' ? 'projects' : 'assessments'}/${enc(id)}`;
}
export async function archiveEntity(type, entity, archived, request = api) {
  const path = entityPath(type, entity.id);
  await request(`${path}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST', body: {} });
  const saved = (await request(path))[type];
  if (!saved || !!saved.archived_at !== archived) throw new Error('Archive state could not be verified. Reload before trying again.');
  return saved;
}
export async function previewEntityDelete(type, entity, request = api) {
  const result = await request(entityPath(type, entity.id), { method: 'DELETE', body: { mode: 'dry_run' } });
  if (!result?.confirm_token) throw new Error('The deletion preview could not be confirmed.');
  return result;
}
export async function deleteEntity(type, entity, preview, request = api) {
  const result = await request(entityPath(type, entity.id), { method: 'DELETE', body: { mode: 'execute', confirm_token: preview.confirm_token } });
  if (result?.deleted !== true) throw new Error('Deletion could not be confirmed. Reload the list before trying again.');
  const collection = type === 'project' ? '/v2/projects' : `/v2/projects/${enc(entity.project_id)}/assessments`;
  const list = await request(collection);
  if (!Array.isArray(list[type === 'project' ? 'projects' : 'assessments']) || list[type === 'project' ? 'projects' : 'assessments'].some(x => x.id === entity.id)) throw new Error('Deletion could not be verified. Reload the list before trying again.');
  return result;
}
