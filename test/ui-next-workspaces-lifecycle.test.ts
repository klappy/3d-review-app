// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import Workspaces from '../ui-next/src/app/Workspaces.svelte';
import { createWorkspace, setWorkspaceArchived, previewWorkspaceDeletion, executeWorkspaceDeletion } from '../ui-next/src/app/workspace-actions.js';
afterEach(cleanup);
const owner = {id:'ws/synthetic',name:'Synthetic',role:'owner',project_count:0,archived_at:null};
const preview = (projects=0) => ({workspace:owner,confirm_token:'confirmed-fixture-token',expires_in:300,impact:{irreversible:true,affected:[{workspace:owner.id,projects,assessments:0,responses:0,grants:1}]}});
it('create and archive use independent readbacks; stale response fails',async()=>{
 const request=vi.fn().mockResolvedValueOnce({workspace:owner}).mockResolvedValueOnce({workspace:owner});
 await expect(createWorkspace(' Synthetic ',request)).resolves.toEqual(owner);
 expect(request.mock.calls[0]).toEqual(['/v2/workspaces',{method:'POST',body:{name:'Synthetic'}}]);
 request.mockReset().mockResolvedValueOnce({}).mockResolvedValueOnce({workspace:{...owner,archived_at:'today'}});
 await expect(setWorkspaceArchived(owner,true,request)).resolves.toMatchObject({archived_at:'today'});
 expect(request.mock.calls[0]).toEqual(['/v2/workspaces/ws%2Fsynthetic/archive',{method:'POST'}]);
 await expect(setWorkspaceArchived(owner,false,async()=>({workspace:{...owner,archived_at:'today'}}))).rejects.toThrow('could not be verified');
});
it('server impact preview gates empty-only execute, tokens cannot replay uncertain outcomes',async()=>{
 const request=vi.fn().mockResolvedValue(preview(1));const p=await previewWorkspaceDeletion(owner,request);
 await expect(executeWorkspaceDeletion(p,request)).rejects.toThrow('empty');expect(request).toHaveBeenCalledTimes(1);
 const q=await previewWorkspaceDeletion(owner,async()=>preview());
 const uncertain=vi.fn().mockRejectedValue(new Error('Network unavailable'));
 await expect(executeWorkspaceDeletion(q,uncertain)).rejects.toThrow('Network');
 await expect(executeWorkspaceDeletion(q,uncertain)).rejects.toThrow('Preview deletion again');expect(uncertain).toHaveBeenCalledTimes(1);
 const expired=await previewWorkspaceDeletion(owner,async()=>preview());expired.expires=0;
 await expect(executeWorkspaceDeletion(expired,request)).rejects.toThrow('Preview deletion again');
});
it('refuses malformed impact, stale deletion readback, and non-owner operations',async()=>{
 const request=vi.fn();await expect(previewWorkspaceDeletion({...owner,role:'viewer'},request)).rejects.toThrow('owner');expect(request).not.toHaveBeenCalled();
 await expect(previewWorkspaceDeletion(owner,async()=>({...preview(),impact:{irreversible:true,affected:[]}}))).rejects.toThrow('could not be read');
 const p=await previewWorkspaceDeletion(owner,async()=>preview());
 const stale=vi.fn().mockResolvedValueOnce({deleted:true,id:owner.id}).mockResolvedValueOnce({workspaces:[owner]});
 await expect(executeWorkspaceDeletion(p,stale)).rejects.toThrow('could not be verified');
});
for(const phone of [false,true]) it(`directory cancel deletion and create/archive/reload ${phone}`,async()=>{
 let items=[{...owner}];const calls:any[]=[];
 const request=vi.fn(async(url:string,init:any={})=>{
  calls.push({url,...init});
  if(init.method==='DELETE'&&init.body.mode==='dry_run') return preview();
  if(init.method==='DELETE'){items=items.filter(x=>x.id!==owner.id);return {deleted:true,id:owner.id};}
  if(url==='/v2/workspaces'&&init.method==='POST'){const w={...owner,id:'new',name:init.body.name};items.push(w);return {workspace:w};}
  if(url.endsWith('/archive')){items[0].archived_at='today';return {workspace:items[0]};}
  if(url.endsWith('/unarchive')){items[0].archived_at=null;return {workspace:items[0]};}
  if(url==='/v2/workspaces')return {workspaces:items.map(x=>({...x}))};
  return {workspace:items.find(x=>url.endsWith(encodeURIComponent(x.id)))};
 });
 const v=render(Workspaces,{phone,workspaces:items.map(x=>({...x})),canCreate:true,request});
 await fireEvent.click(v.getByRole('button',{name:'Preview deletion of Synthetic'}));
 await waitFor(()=>v.getByRole('button',{name:'Cancel deletion'}));
 expect(v.getByRole('button',{name:'Cancel deletion'}).parentElement!.hasAttribute('data-wrap')).toBe(true);
 await fireEvent.click(v.getByRole('button',{name:'Cancel deletion'}));
 expect(calls.filter(x=>x.method==='DELETE'&&x.body.mode==='execute')).toHaveLength(0);
 await fireEvent.click(v.getByRole('button',{name:'Archive Synthetic'}));
 await waitFor(()=>expect(v.queryByRole('link',{name:'Synthetic'})).toBeNull());
 await fireEvent.change(v.getByLabelText('Show workspaces'),{target:{value:'Archived'}});
 await fireEvent.click(v.getByRole('button',{name:'Restore Synthetic'}));
 await waitFor(()=>expect(v.queryByRole('link',{name:'Synthetic'})).toBeNull());
 await fireEvent.change(v.getByLabelText('Show workspaces'),{target:{value:'All'}});
 await fireEvent.input(v.getByLabelText('New workspace name'),{target:{value:'Created'}});
 await fireEvent.click(v.getByRole('button',{name:'Create workspace'}));
 await waitFor(()=>v.getByRole('link',{name:'Created'}));
 await fireEvent.click(v.getByRole('button',{name:'Preview deletion of Synthetic'}));
 await waitFor(()=>v.getByRole('button',{name:'Confirm deletion'}));
 await fireEvent.click(v.getByRole('button',{name:'Confirm deletion'}));
 await waitFor(()=>expect(v.queryByRole('link',{name:'Synthetic'})).toBeNull());
 expect(calls.filter(x=>x.method==='DELETE'&&x.body.mode==='execute')).toHaveLength(1);
 expect(v.getByRole('link',{name:'Created'})).toBeTruthy();
});
it('phone owner actions stay compact for long workspace names and retain distinct target context',async()=>{
 const first={...owner,id:'first',name:'Bridge Connectivity Solutions · India'};
 const second={...owner,id:'second',name:'Bridge Connectivity Solutions · partner organisations'};
 let items=[first,second];const writes:any[]=[];
 const request=vi.fn(async(url:string,init:any={})=>{
  if(init.method) writes.push({url,...init});
  if(init.method==='DELETE') return {...preview(),workspace:second,impact:{irreversible:true,affected:[{workspace:second.id,projects:0,assessments:0,responses:0,grants:1}]}};
  if(url.endsWith('/archive')) {items=items.map(w=>w.id===second.id?{...w,archived_at:'today'}:w);return {workspace:items[1]};}
  if(url.endsWith('/unarchive')) {items=items.map(w=>w.id===second.id?{...w,archived_at:null}:w);return {workspace:items[1]};}
  return {workspace:items.find(w=>url.endsWith(w.id))};
 });
 const v=render(Workspaces,{phone:true,workspaces:items,request});
 const archive=v.getByRole('button',{name:`Archive ${second.name}`});
 const deletion=v.getByRole('button',{name:`Preview deletion of ${second.name}`});
 expect(archive.textContent).toBe('Archive');expect(deletion.textContent).toBe('Preview deletion');
 expect(v.getByRole('button',{name:`Archive ${first.name}`})).toBeTruthy();
 await fireEvent.click(deletion);
 await v.findByRole('heading',{name:`Delete ${second.name}?`});
 await fireEvent.click(v.getByRole('button',{name:'Cancel deletion'}));
 expect(writes).toEqual([{url:'/v2/workspaces/second',method:'DELETE',body:{mode:'dry_run'}}]);
 await fireEvent.click(archive);
 await waitFor(()=>expect(v.queryByRole('link',{name:second.name})).toBeNull());
 await fireEvent.change(v.getByLabelText('Show workspaces'),{target:{value:'Archived'}});
 const restore=v.getByRole('button',{name:`Restore ${second.name}`});expect(restore.textContent).toBe('Restore');
 await fireEvent.click(restore);
 await waitFor(()=>expect(v.queryByRole('link',{name:second.name})).toBeNull());
 expect(writes.slice(1).map(w=>w.url)).toEqual(['/v2/workspaces/second/archive','/v2/workspaces/second/unarchive']);
});
it('uncertain create locks repeat writes until explicit reload; viewers get no write controls',async()=>{
 const request=vi.fn().mockRejectedValueOnce(new Error('Outcome unknown')).mockResolvedValueOnce({workspaces:[]});
 const v=render(Workspaces,{workspaces:[{...owner,role:'viewer'}],canCreate:true,request});
 expect(v.queryByRole('button',{name:'Archive Synthetic'})).toBeNull();
 await fireEvent.input(v.getByLabelText('New workspace name'),{target:{value:'New'}});
 await fireEvent.click(v.getByRole('button',{name:'Create workspace'}));
 await waitFor(()=>expect(v.getByRole('button',{name:'Create workspace'}).hasAttribute('disabled')).toBe(true));
 await fireEvent.click(v.getByRole('button',{name:'Create workspace'}));expect(request).toHaveBeenCalledTimes(1);
 await fireEvent.click(v.getByRole('button',{name:'Reload workspaces'}));
 await waitFor(()=>expect(v.getByRole('button',{name:'Create workspace'}).hasAttribute('disabled')).toBe(false));
});
it('rename retains only the actual receipt and undo calls the token route with readback',async()=>{
 const { renameWorkspace, undoWorkspaceRename }=await import('../ui-next/src/app/workspace-actions.js');
 const full=vi.fn().mockResolvedValue({receipt:{scope:{type:'workspace',id:owner.id},inverse:'self:restore-prior',undo_token:'undo/fixture'}});
 const read=vi.fn().mockResolvedValue({workspace:{...owner,name:'Renamed'}});
 const saved=await renameWorkspace(owner,'Renamed',read,full);
 expect(saved.undo).toMatchObject({workspaceId:owner.id,priorName:'Synthetic',token:'undo/fixture'});
 const request=vi.fn().mockResolvedValueOnce({undone:'cap.workspace.update'}).mockResolvedValueOnce({workspace:owner});
 await expect(undoWorkspaceRename(saved.undo,request)).resolves.toEqual(owner);
 expect(request.mock.calls[0]).toEqual(['/v2/undo/undo%2Ffixture',{method:'POST'}]);
 await expect(undoWorkspaceRename(saved.undo,request)).rejects.toThrow('no available undo');
 expect(request).toHaveBeenCalledTimes(2);
});
