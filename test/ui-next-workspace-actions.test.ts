// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import Workspace from '../ui-next/src/screens/people/Workspace.svelte';
import fixture from '../ui-next/fixtures/people/workspace.json';
import { renameWorkspace, ungroupProject, workspaceProjects } from '../ui-next/src/app/workspace-actions.js';
import { setLiveContext } from '../ui-next/src/screens/href.js';
afterEach(() => { cleanup(); setLiveContext(null); });
const w = { id:'workspace/1', role:'owner' };
describe('workspace lifecycle', () => {
 it('renames through encoded capability and independent readback; rejects stale state', async () => {
  const request = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({workspace:{...w,name:'New name'}});
  await expect(renameWorkspace(w,' New name ',request)).resolves.toMatchObject({name:'New name'});
  expect(request.mock.calls).toEqual([['/v2/workspaces/workspace%2F1',{method:'PATCH',body:{name:'New name'}}],['/v2/workspaces/workspace%2F1']]);
  await expect(renameWorkspace(w,'Other',async()=>({workspace:{...w,name:'Old'}}))).rejects.toThrow('could not be verified');
 });
 it('does not write for viewer rename or inherited member ungroup; verifies removal independently', async () => {
  const request=vi.fn();
  await expect(renameWorkspace({...w,role:'viewer'},'New',request)).rejects.toThrow('owner');
  await expect(ungroupProject({...w,role:'member'},{id:'p',directRole:null},request)).rejects.toThrow('direct project owner');
  expect(request).not.toHaveBeenCalled();
  request.mockResolvedValueOnce({grouped:false}).mockResolvedValueOnce({workspace:w,projects:[]});
  await ungroupProject(w,{id:'p/1'},request);
  expect(request.mock.calls[0]).toEqual(['/v2/workspaces/workspace%2F1/projects/p%2F1',{method:'DELETE'}]);
  await expect(ungroupProject(w,{id:'p'},async()=>({workspace:w,projects:[{id:'p'}]}))).rejects.toThrow('could not be verified');
 });
 it('filters actual cards by status and text, never drops archived from All', () => {
  const cards=[{id:'1',title:'Alpha',language:'French'},{id:'2',title:'Beta',archived_at:'today'}];
  expect(workspaceProjects(cards).map(x=>x.id)).toEqual(['1']);
  expect(workspaceProjects(cards,'','All')).toHaveLength(2);
  expect(workspaceProjects(cards,'beta','Archived').map(x=>x.id)).toEqual(['2']);
  expect(workspaceProjects(cards,'french','All').map(x=>x.id)).toEqual(['1']);
 });
 for(const phone of [false,true]) it(`cancel and confirm removal ${phone ? 'phone':'desktop'}; reload receives updated data`, async()=>{
  setLiveContext({wid:w.id,pid:'p'});
  const data={...fixture,id:w.id,role:'owner',projects:[{...fixture.projects[0],id:'p',title:'Synthetic project',directRole:'owner'}]};
  const onungroup=vi.fn().mockResolvedValue(undefined),onrename=vi.fn().mockResolvedValue(undefined);
  const v=render(Workspace,{phone,data,onungroup,onrename});
  await fireEvent.click(v.getByRole('button',{name:'Remove Synthetic project from workspace'}));
  expect(v.getByText(/People whose access comes only/)).toBeTruthy();
  await fireEvent.click(v.getByRole('button',{name:'Cancel'}));expect(onungroup).not.toHaveBeenCalled();
  await fireEvent.click(v.getByRole('button',{name:'Remove Synthetic project from workspace'}));
  await fireEvent.click(v.getByRole('button',{name:'Confirm removal'}));
  await waitFor(()=>expect(onungroup).toHaveBeenCalledWith(data.projects[0]));
  await v.rerender({phone,data:{...data,projects:[]},onungroup,onrename});
  expect(v.queryByText('Synthetic project')).toBeNull();
  await fireEvent.click(v.getByRole('button',{name:'Rename workspace'}));
  await fireEvent.input(v.getByLabelText('Workspace name'),{target:{value:'Renamed'}});
  await fireEvent.click(v.getByRole('button',{name:'Save workspace name'}));
  await waitFor(()=>expect(onrename).toHaveBeenCalledWith('Renamed'));
 });
});
