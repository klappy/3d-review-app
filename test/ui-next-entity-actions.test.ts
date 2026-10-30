// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Tools from '../ui-next/src/app/EntityTools.svelte';
import Projects from '../ui-next/src/app/Projects.svelte';
import { archiveEntity, deleteEntity } from '../ui-next/src/app/entity-actions.js';
const original = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = original; });
const response = result => new Response(JSON.stringify({ ok: true, result }));
it('deletion preview and cancel never execute the deletion', async () => {
  const calls: any[] = [];
  globalThis.fetch = vi.fn(async (_url, init: any) => { calls.push(JSON.parse(init.body)); return response({ confirm_token: 'local-confirm', impact: { affected: [{ assessments: 0, languages: 0 }] } }); }) as any;
  const v = render(Tools, { type: 'project', entity: { id: 'p', name: 'Project', role: 'owner' } });
  await fireEvent.click(v.getByText('Preview deletion'));
  await waitFor(() => v.getByRole('group', { name: 'Confirm deletion' }));
  await fireEvent.click(v.getByText('Cancel'));
  expect(calls).toEqual([{ mode: 'dry_run' }]);
  expect(v.queryByText('Confirm deletion')).toBeNull();
});
it('a completed review retains direct owner deletion but no content stage writes', () => {
  const v = render(Tools, { type: 'assessment', entity: { id: 'a', name: 'Review', project_id: 'p', role: 'viewer', granted_role: 'owner', direct_role: 'owner', complete: true } });
  expect(v.getByText('Preview deletion')).toBeDefined();
  expect(v.queryByText('Move to collect')).toBeNull();
});
it('an inherited assessment owner cannot see the direct-owner deletion action', () => {
  const v = render(Tools, { type: 'assessment', entity: { id: 'a', name: 'Review', role: 'owner', direct_role: null } });
  expect(v.queryByText('Preview deletion')).toBeNull();
});
it('archive requires independently matching state, and deletion requires absence from the actual list', async () => {
  await expect(archiveEntity('project', { id: 'p' }, true, async () => ({ project: { id: 'p', archived_at: null } }))).rejects.toThrow('could not be verified');
  const calls: any[] = [];
  await expect(deleteEntity('assessment', { id: 'a', project_id: 'p' }, { confirm_token: 'x' }, async (url, init) => {
    calls.push({ url, init }); return init ? { deleted: true } : { assessments: [{ id: 'a' }] };
  })).rejects.toThrow('could not be verified');
  expect(calls[1].url).toBe('/v2/projects/p/assessments');
});
it('project creation can cancel without writes and return the verified new project to the retained setup draft', async () => {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (url, init: any) => { calls.push(`${init.method} ${url}`); return response({ project: { id: 'new-project', name: 'New project' } }); }) as any;
  const v = render(Projects, { projects: [], returnToSetup: true });
  await fireEvent.click(v.getByText('New project')); await fireEvent.click(v.getByText('Cancel')); expect(calls).toEqual([]);
  await fireEvent.click(v.getByText('New project'));
  await fireEvent.input(v.getByLabelText('Project name'), { target: { value: 'New project' } });
  await fireEvent.click(v.getByText('Create project'));
  await waitFor(() => expect(location.hash).toBe('#/setup/1?project=new-project'));
  expect(calls).toEqual(['POST /v2/projects', 'GET /v2/projects/new-project']);
});
