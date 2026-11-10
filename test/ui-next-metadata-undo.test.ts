// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import * as SU from '../ui-next/src/app/setup.js';
import UndoNotice from '../ui-next/src/app/UndoNotice.svelte';
afterEach(()=>{cleanup();vi.unstubAllGlobals();SU.forgetAll();});
function fixture({ receipt=true, actor='actor-1', stale=false, uncertainUndo=false }={}) {
 const draft=SU.freshDraft('p');draft.name='Old name';draft.language='l';
 const original={id:'review/a',project_id:'p',role:'owner',stage:'prepare',...SU.snapOf(draft)};
 let saved={...original};const calls:any[]=[];
 const st:any={aid:original.id,role:'owner',stage:'prepare',draft:{...draft,name:'Updated name',location:'Workshop'},snap:SU.snapOf(draft),pre:[],projects:[],templates:[]};
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any={})=>{
  const body=init.body?JSON.parse(init.body):null;calls.push({url,method:init.method,body});
  let result:any={};let extra:any={};
  if(url==='/v2/me') result={principal:{id:actor}};
  else if(url.startsWith('/v2/undo/')) {if(uncertainUndo)throw new Error('Unknown outcome');saved={...original};result={undone:'cap.assessment.update'};}
  else if(init.method==='PATCH') {if(!stale)saved={...saved,...body};result={assessment:saved};if(receipt)extra={capability:'cap.assessment.update',receipt:{id:'receipt',actor:'actor-1',scope:{type:'assessment',id:original.id},inverse:'self:restore-prior',undo_token:'undo/private-token'}};}
  else result={assessment:saved,surveys:[]};
  return new Response(JSON.stringify({ok:true,result,...extra}),{status:200});
 }));
 return {st,calls,original,read:()=>saved,change:(fields:any)=>{saved={...saved,...fields};}};
}
it('retains actual immutable receipt, undo calls token route once and independently verifies restoration',async()=>{
 const f=fixture();await SU.saveDetails(f.st);
 expect(f.st.undo).toMatchObject({aid:'review/a',actor:'actor-1',prior:{name:'Old name',location:null},saved:{name:'Updated name',location:'Workshop'}});
 expect(Object.isFrozen(f.st.undo)).toBe(true);expect(Object.isFrozen(f.st.undo.prior)).toBe(true);
 const restored=await SU.undoDetails(f.st);expect(restored.name).toBe('Old name');expect(restored.location).toBeNull();expect(f.st.undo).toBeNull();
 expect(f.calls.filter(x=>x.method==='PATCH')).toHaveLength(1);
 expect(f.calls.filter(x=>x.url.startsWith('/v2/undo/'))).toEqual([{url:'/v2/undo/undo%2Fprivate-token',method:'POST',body:null}]);
 expect(f.calls.at(-1)).toMatchObject({url:'/v2/assessments/review%2Fa',method:'GET'});
 await expect(SU.undoDetails(f.st)).rejects.toThrow('no undo receipt');
});
it('does not invent undo when receipt absent and does not credit failed readback',async()=>{
 const noReceipt=fixture({receipt:false});await SU.saveDetails(noReceipt.st);expect(noReceipt.st.undo).toBeNull();
 const stale=fixture({stale:true});await expect(SU.saveDetails(stale.st)).rejects.toThrow('could not be verified');expect(stale.st.undo).toBeNull();
});
it('refuses different actor, changed entity, stale edits and completed review before undo write',async()=>{
 for(const mode of ['actor','entity','stale','later-purpose','complete']) {
  const f=fixture({actor:mode==='actor'?'different':'actor-1'});await SU.saveDetails(f.st);
  if(mode==='entity')f.st.aid='other';if(mode==='stale')f.change({location:'Other edit'});if(mode==='later-purpose')f.change({purpose:'A later passage edit'});if(mode==='complete')f.change({notes_next_steps:'[This review is complete.]'});
  await expect(SU.undoDetails(f.st)).rejects.toThrow();expect(f.calls.some(x=>x.url.startsWith('/v2/undo/'))).toBe(false);
 }
});
it('uncertain undo consumes local receipt without retry and viewer cannot save',async()=>{
 const f=fixture({uncertainUndo:true});await SU.saveDetails(f.st);await expect(SU.undoDetails(f.st)).rejects.toThrow();expect(f.st.undo).toBeNull();
 await expect(SU.undoDetails(f.st)).rejects.toThrow('no undo receipt');expect(f.calls.filter(x=>x.url.startsWith('/v2/undo/'))).toHaveLength(1);
 f.st.role='viewer';await expect(SU.saveDetails(f.st)).rejects.toThrow('read-only');
});
for(const phone of [false,true])it(`UndoNotice only exposes the action, never token, and prevents repeated click ${phone}`,async()=>{
 const undo={aid:'review/a',token:'secret-should-not-appear'};let release:any;const onundo=vi.fn(()=>new Promise(resolve=>{release=resolve;}));
 const v=render(UndoNotice,{undo,onundo});expect(v.container.innerHTML).not.toContain(undo.token);
 await fireEvent.click(v.getByRole('button',{name:'Undo saved details'}));expect(onundo).toHaveBeenCalledTimes(1);
 await fireEvent.click(v.getByRole('button',{name:'Restoring…'}));expect(onundo).toHaveBeenCalledTimes(1);
 release();await waitFor(()=>v.getByText('Review details restored and verified.'));
 expect(v.getByRole('button',{name:'Undo saved details'}).hasAttribute('disabled')).toBe(true);
});
