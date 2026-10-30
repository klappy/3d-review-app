// Existing workspace capabilities. Successful mutations are verified by an independent read.
import { api, enc } from './api.js';
const endpoint = id => `/v2/workspaces/${enc(id)}`;
export async function renameWorkspace(workspace, value, request = api) {
  if (workspace.role !== 'owner') throw new Error('Only a workspace owner can rename it.');
  const name = String(value ?? '').trim();
  if (!name) throw new Error('Enter a workspace name.');
  await request(endpoint(workspace.id), { method: 'PATCH', body: { name } });
  const saved = (await request(endpoint(workspace.id))).workspace;
  if (saved?.id !== workspace.id || saved.name !== name) throw new Error('The saved name could not be verified. Reload before trying again.');
  return saved;
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
