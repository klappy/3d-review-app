// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Tools from '../ui-next/src/app/EntityTools.svelte';
import { archiveEntity, deleteEntity, moveEntityStage } from '../ui-next/src/app/entity-actions.js';
import { v3NextSerialize } from '../ui/assess/v3-assessment.js';

const review = { id:'a', name:'SAMPLE review', project_id:'hidden-parent', role:'owner', direct_role:'owner', stage:'prepare', can_archive:false };
const preview = { confirm_token:'fixture-confirm', impact:{ affected:[{assessment:'a',surveys:0,responses:0}] } };
const response = (result:unknown) => new Response(JSON.stringify({ok:true,result}));
const refusal = (code='NOT_AUTHORIZED_AT_SCOPE', status=403) => new Response(JSON.stringify({ok:false,error:{code,message:'Request refused'}}),{status});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});

it('confirms an assessment-only owner deletion without requiring access to its hidden parent',async()=>{
 const request=vi.fn(async(_url:string, init:any)=>{
  if(init?.method==='DELETE') return {deleted:true,id:'a'};
  throw Object.assign(new Error('Parent not visible'),{code:'NOT_FOUND_OR_NOT_VISIBLE',status:404});
 });
 await expect(deleteEntity('assessment',review,preview,request)).resolves.toMatchObject({deleted:true,id:'a'});
 expect(request.mock.calls).toEqual([['/v2/assessments/a',{method:'DELETE',body:{mode:'execute',confirm_token:'fixture-confirm'}}]]);
});

it.each([false,true])('confirmed deletion has a truthful terminal state and authorized Home escape (phone=%s)',async(phone)=>{
 const calls:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any={})=>{
  const body=init.body?JSON.parse(init.body):null;calls.push({url,method:init.method,body});
  if(init.method==='DELETE')return response(body.mode==='dry_run'?preview:{deleted:true,id:'a'});
  return refusal('NOT_FOUND_OR_NOT_VISIBLE',404);
 }));
 const v=render(Tools,{phone,type:'assessment',entity:review});
 await fireEvent.click(v.getByRole('button',{name:'Preview deletion'}));
 await v.findByRole('group',{name:'Confirm deletion'});
 await fireEvent.click(v.getByRole('button',{name:'Cancel'}));
 expect(calls.filter(c=>c.body?.mode==='execute')).toHaveLength(0);
 await fireEvent.click(v.getByRole('button',{name:'Preview deletion'}));
 await v.findByRole('group',{name:'Confirm deletion'});
 const execute=v.getByRole('button',{name:'Confirm deletion'});
 await fireEvent.click(execute);await fireEvent.click(execute);
 await v.findByRole('heading',{name:'Review deleted'});
 expect(v.getByRole('link',{name:'Home',exact:true}).getAttribute('href')).toBe('#/');
 expect(v.queryByRole('button',{name:'Preview deletion'})).toBeNull();
 expect(v.container.textContent).not.toMatch(/unknown|could not be confirmed/i);
 expect(calls.filter(c=>c.body?.mode==='execute')).toHaveLength(1);
 expect(calls.some(c=>c.url.includes('hidden-parent'))).toBe(false);
});

it.each([
 ['prepare',['collect']],['collect',['prepare','understand']],['understand',['collect','improve']],['improve',['understand']]
])('offers only server-legal adjacent targets from %s',(stage,targets)=>{
 const v=render(Tools,{type:'assessment',entity:{...review,stage}});
 expect(v.getAllByRole('button').filter(b=>b.textContent?.startsWith('Move to ')).map(b=>b.textContent)).toEqual((targets as string[]).map(s=>`Move to ${s}`));
});

it('does not offer archive to an assessment-only direct owner without project authority',()=>{
 const v=render(Tools,{type:'assessment',entity:review});
 expect(v.queryByRole('button',{name:'Archive review'})).toBeNull();
 expect(v.container.textContent).toMatch(/direct review member.*project/i);
 expect(v.getByRole('button',{name:'Preview deletion'})).toBeTruthy();
});

it('eligible archive verifies the saved state and remains distinct from stage controls',async()=>{
 const calls:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any={})=>{
  calls.push({url,method:init.method});
  return response({assessment:{...review,can_archive:true,archived_at:'2026-10-31'}});
 }));
 const v=render(Tools,{type:'assessment',entity:{...review,can_archive:true}});
 await fireEvent.click(v.getByRole('button',{name:'Archive review'}));
 await v.findByText('Archive state saved and verified.');
 expect(calls).toEqual([{url:'/v2/assessments/a/archive',method:'POST'},{url:'/v2/assessments/a',method:'GET'}]);
 expect(v.getByRole('button',{name:'Unarchive review'})).toBeTruthy();
});

it('a definite stage refusal permits recovery and never reports a successful change',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>refusal('STAGE_CONFLICT',409)));
 const v=render(Tools,{type:'assessment',entity:review});
 await fireEvent.click(v.getByRole('button',{name:'Move to collect'}));
 await waitFor(()=>expect(v.container.textContent).toMatch(/refused/i));
 expect((v.getByRole('button',{name:'Move to collect'}) as HTMLButtonElement).disabled).toBe(false);
 expect(v.container.textContent).not.toContain('Stage changed and verified.');
});

it('a lost stage-write response stays uncertain and cannot be retried by repeated clicks',async()=>{
 const request=vi.fn(async()=>{throw new Error('Network dropped');});vi.stubGlobal('fetch',request);
 const v=render(Tools,{type:'assessment',entity:review});const button=v.getByRole('button',{name:'Move to collect'});
 await fireEvent.click(button);await v.findByRole('button',{name:'Reload current state'});
 await fireEvent.click(button);
 expect(request).toHaveBeenCalledTimes(1);expect((button as HTMLButtonElement).disabled).toBe(true);
 expect(v.container.textContent).not.toMatch(/Nothing was changed|Stage changed and verified/);
});

it('a readback refusal after accepted archive remains uncertain rather than claiming nothing changed',async()=>{
 let count=0;vi.stubGlobal('fetch',vi.fn(async()=>++count===1?response({assessment:{...review,archived_at:'today'}}):refusal()));
 const v=render(Tools,{type:'assessment',entity:{...review,can_archive:true}});
 const button=v.getByRole('button',{name:'Archive review'});await fireEvent.click(button);
 await v.findByRole('button',{name:'Reload current state'});
 expect((button as HTMLButtonElement).disabled).toBe(true);
 expect(v.container.textContent).not.toContain('Nothing was changed by this request.');
});

it('an explicit deletion refusal is truthful and allows a fresh preview, with no automatic execute retry',async()=>{
 const calls:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url:string,init:any={})=>{
  const body=JSON.parse(init.body);calls.push(body);return body.mode==='dry_run'?response(preview):refusal();
 }));
 const v=render(Tools,{type:'assessment',entity:review});
 await fireEvent.click(v.getByRole('button',{name:'Preview deletion'}));await v.findByRole('group',{name:'Confirm deletion'});
 await fireEvent.click(v.getByRole('button',{name:'Confirm deletion'}));
 await waitFor(()=>expect(v.container.textContent).toMatch(/refused/i));
 expect((v.getByRole('button',{name:'Preview deletion'}) as HTMLButtonElement).disabled).toBe(false);
 expect(calls.filter(c=>c.mode==='execute')).toHaveLength(1);
 expect(v.queryByRole('heading',{name:'Review deleted'})).toBeNull();
});

it('interrupted deletion stays locked and repeated taps never issue a second execute',async()=>{
 let rejectWrite:(error:Error)=>void=()=>{};
 const calls:any[]=[];vi.stubGlobal('fetch',vi.fn(async(_url:string,init:any={})=>{
  const body=JSON.parse(init.body);calls.push(body);
  if(body.mode==='dry_run')return response(preview);
  return new Promise<Response>((_resolve,reject)=>{rejectWrite=reject;});
 }));
 const v=render(Tools,{phone:true,type:'assessment',entity:review});
 await fireEvent.click(v.getByRole('button',{name:'Preview deletion'}));await v.findByRole('group',{name:'Confirm deletion'});
 const execute=v.getByRole('button',{name:'Confirm deletion'});await fireEvent.click(execute);await fireEvent.click(execute);
 expect(calls.filter(c=>c.mode==='execute')).toHaveLength(1);
 rejectWrite(new Error('Disconnected after sending'));
 await v.findByRole('button',{name:'Reload current state'});
 expect(v.container.textContent).toMatch(/outcome is unknown/i);
 expect(v.container.textContent).not.toMatch(/Nothing was changed|Review deleted|Nothing was deleted/);
 const again=v.getByRole('button',{name:'Preview deletion'});expect((again as HTMLButtonElement).disabled).toBe(true);
 await fireEvent.click(again);expect(calls).toHaveLength(2);
});

it('failed deletion preview can be retried and never claims an execution occurred',async()=>{
 let count=0;const request=vi.fn(async()=>{if(++count===1)throw new Error('Offline');return response(preview);});vi.stubGlobal('fetch',request);
 const v=render(Tools,{type:'assessment',entity:review});const button=v.getByRole('button',{name:'Preview deletion'});
 await fireEvent.click(button);await waitFor(()=>expect(v.container.textContent).toContain('No deletion was requested.'));
 expect((button as HTMLButtonElement).disabled).toBe(false);expect(v.queryByRole('button',{name:'Reload current state'})).toBeNull();
 await fireEvent.click(button);await v.findByRole('group',{name:'Confirm deletion'});expect(request).toHaveBeenCalledTimes(2);
 await fireEvent.click(v.getByRole('button',{name:'Cancel'}));expect(request).toHaveBeenCalledTimes(2);
});

it('programmatic nonadjacent stage target is refused before any request',async()=>{
 const request=vi.fn();await expect(moveEntityStage(review,'improve',request)).rejects.toMatchObject({outcome:'refused'});
 expect(request).not.toHaveBeenCalled();
});

it('archive refusal after authority changes is recoverable and never claims an applied write',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>refusal('NOT_FOUND_OR_NOT_VISIBLE',404)));
 const v=render(Tools,{type:'assessment',entity:{...review,can_archive:true}});const button=v.getByRole('button',{name:'Archive review'});
 await fireEvent.click(button);await waitFor(()=>expect(v.container.textContent).toContain('Nothing was changed by this request.'));
 expect((button as HTMLButtonElement).disabled).toBe(false);expect(v.container.textContent).not.toContain('Archive state saved and verified.');
});

it('stage readback keeps durable completion lock and current archive metadata',async()=>{
 const completed=v3NextSerialize({text:'Saved plan',complete:true});
 const request=vi.fn(async(_url,options)=>options?{}:{assessment:{...review,stage:'collect',can_archive:true,notes_next_steps:completed}});
 const saved=await moveEntityStage(review,'collect',request);
 expect(saved).toMatchObject({id:'a',stage:'collect',can_archive:true,complete:true,role:'viewer',granted_role:'owner'});
});

it('readback cannot verify another entity with a coincidentally matching archive state',async()=>{
 const request=vi.fn(async(_url,options)=>options?{}:{assessment:{...review,id:'b',archived_at:'today'}});
 await expect(archiveEntity('assessment',review,true,request)).rejects.toMatchObject({outcome:'unknown'});
});
