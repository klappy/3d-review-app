// Existing workspace capabilities. Successful mutations are verified by an independent read.
import { api, apiFull, enc } from './api.js';
const endpoint = id => `/v2/workspaces/${enc(id)}`;
export async function renameWorkspace(workspace, value, request = api, requestFull = request === api ? apiFull : null) {
  if (workspace.role !== 'owner') throw new Error('Only a workspace owner can rename it.');
  const name = String(value ?? '').trim();
  if (!name) throw new Error('Enter a workspace name.');
  const options = { method: 'PATCH', body: { name } };
  const receipt = requestFull ? (await requestFull(endpoint(workspace.id), options)).receipt : (await request(endpoint(workspace.id), options)).receipt;
  const saved = (await request(endpoint(workspace.id))).workspace;
  if (saved?.id !== workspace.id || saved.name !== name) throw new Error('The saved name could not be verified. Reload before trying again.');
  const token = receipt?.scope?.type === 'workspace' && receipt.scope.id === workspace.id && receipt.inverse !== 'none' && typeof receipt.undo_token === 'string' ? receipt.undo_token : null;
  return { ...saved, undo: token ? { token, workspaceId: workspace.id, priorName: workspace.name, used: false } : null };
}
export async function ungroupProject(workspace, project, request = api) {
  if (!(workspace.role === 'owner' || (workspace.role === 'member' && project.directRole === 'owner'))) throw new Error('A workspace owner or direct project owner must remove this project.');
  await request(`${endpoint(workspace.id)}/projects/${enc(project.id)}`, { method: 'DELETE' });
  const saved = await request(endpoint(workspace.id));
  if (saved.workspace?.id !== workspace.id || !Array.isArray(saved.projects) || saved.projects.some(p => p.id === project.id)) throw new Error('The removal could not be verified. Reload before trying again.');
  return saved;
}
export function workspaceProjects(projects, query = '', view = 'Active') {
  const find = String(query).trim().toLocaleLowerCase();
  return projects.filter(p => (view === 'All' || (view === 'Archived' ? !!p.archived_at : !p.archived_at)) && (!find || [p.title,p.language,p.format].some(v => String(v ?? '').toLocaleLowerCase().includes(find))));
}

export async function createWorkspace(value, request = api) {
  const name = String(value ?? '').trim();
  if (!name) throw new Error('Enter a workspace name.');
  const result = await request('/v2/workspaces', { method: 'POST', body: { name } });
  if (!result.workspace?.id) throw new Error('The new workspace could not be confirmed. Reload before trying again.');
  const saved = (await request(endpoint(result.workspace.id))).workspace;
  if (saved?.id !== result.workspace.id || saved.name !== name) throw new Error('The new workspace could not be verified. Reload before trying again.');
  return saved;
}
export async function setWorkspaceArchived(workspace, archived, request = api) {
  if (workspace.role !== 'owner') throw new Error('Only a workspace owner can archive or restore it.');
  await request(`${endpoint(workspace.id)}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' });
  const saved = (await request(endpoint(workspace.id))).workspace;
  if (saved?.id !== workspace.id || !!saved.archived_at !== archived) throw new Error('The workspace state could not be verified. Reload before trying again.');
  return saved;
}
export async function previewWorkspaceDeletion(workspace, request = api) {
  if (workspace.role !== 'owner') throw new Error('Only a workspace owner can delete it.');
  const result = await request(endpoint(workspace.id), { method: 'DELETE', body: { mode: 'dry_run' } });
  const affected = result.impact?.affected;
  const row = Array.isArray(affected) && affected.length === 1 ? affected[0] : null;
  if (typeof result.confirm_token !== 'string' || !result.confirm_token || result.workspace?.id !== workspace.id || row?.workspace !== workspace.id || !['projects','assessments','responses','grants'].every(k => Number.isSafeInteger(row[k]) && row[k] >= 0) || result.impact.irreversible !== true || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw new Error('The deletion preview could not be read. No deletion was confirmed.');
  return { workspace, impact: result.impact, token: result.confirm_token, expires: Date.now() + result.expires_in * 1000, used: false };
}
export async function executeWorkspaceDeletion(preview, request = api) {
  if (!preview || preview.used || Date.now() >= preview.expires) throw new Error('Preview deletion again before confirming.');
  if (preview.impact.affected[0].projects !== 0) throw new Error('Only an empty workspace can be deleted. Remove its projects first.');
  preview.used = true; // Consume locally before sending: an uncertain response must never be automatically replayed.
  const result = await request(endpoint(preview.workspace.id), { method: 'DELETE', body: { mode: 'execute', confirm_token: preview.token } });
  if (result.deleted !== true || result.id !== preview.workspace.id) throw new Error('The deletion could not be confirmed. Reload before trying again.');
  const saved = await request('/v2/workspaces');
  if (!Array.isArray(saved.workspaces) || saved.workspaces.some(w => w.id === preview.workspace.id)) throw new Error('The deletion could not be verified. Reload before trying again.');
  return saved.workspaces;
}

export async function undoWorkspaceRename(undo, request = api) {
  if (!undo || undo.used || typeof undo.token !== 'string' || !undo.token) throw new Error('This rename has no available undo receipt.');
  undo.used = true;
  const result = await request(`/v2/undo/${enc(undo.token)}`, { method: 'POST' });
  if (result.undone !== 'cap.workspace.update') throw new Error('The rename undo could not be confirmed. Reload before trying again.');
  const saved = (await request(endpoint(undo.workspaceId))).workspace;
  if (saved?.id !== undo.workspaceId || saved.name !== undo.priorName) throw new Error('The restored workspace name could not be verified. Reload before trying again.');
  return saved;
}
