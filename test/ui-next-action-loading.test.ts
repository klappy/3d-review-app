// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as D from '../ui-next/src/app/data.js';
import * as S from '../ui-next/src/app/session.js';
import * as W from '../ui-next/src/app/workspace-actions.js';
import { setToken } from '../ui-next/src/app/api.js';
import { setLiveChrome } from '../ui-next/src/app/chrome.js';
import workspace from '../ui-next/fixtures/people/workspace.json';
const me={principal:{id:'actor-A',display_name:'Actor A',kind:'user',provisioned:true,access_mode:'my'},grants:[]};
const rows=[{id:'project-A',name:'Verified project',organization:'Fixture organization',role:'owner',assessment_count:1,response_count:2}];
const response=(result:unknown,status=200)=>new Response(JSON.stringify(status===200?{ok:true,result}:{ok:false,error:result}),{status});
function deferred<T>(){let resolve!:(v:T)=>void;let reject!:(e:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
async function flush(){await tick();for(let i=0;i<20;i++)await Promise.resolve();await tick();}
async function go(hash:string){history.replaceState(null,'','/next/?ui_next=on'+hash);await fireEvent(window,new HashChangeEvent('hashchange'));await flush();}
function setup(phone=false){vi.stubGlobal('matchMedia',(q:string)=>({matches:phone&&q.includes('max-width'),addEventListener(){},removeEventListener(){}}));vi.spyOn(S,'me').mockResolvedValue(me);vi.stubGlobal('fetch',vi.fn(async()=>response(me)));}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();S.forget();setToken(null);setLiveChrome(null);history.replaceState(null,'','/next/?ui_next=on');});
describe('local account menu lifecycle',()=>{
 it.each([false,true])('repeated menu open/close and back/forward preserve the actual view and make zero destination/history reads (phone=%s)',async phone=>{
  setup(phone);const projects=vi.spyOn(D,'projects').mockResolvedValue(rows),historyRead=vi.spyOn(D,'homeModel');location.hash='#/projects';const view=render(Live);
  await view.findByRole('link',{name:'Verified project'});const heading=view.getByRole('heading',{name:'Projects'}),main=heading.closest('main')!,header=view.container.querySelector('header');
  for(let i=0;i<3;i++){
   await go('#/menu');await view.findByRole('navigation',{name:'Workspace and account'});expect(view.getByRole('heading',{name:'Projects',hidden:true})).toBe(heading);expect(view.container.querySelector('header')).toBe(header);expect(main.inert).toBe(true);expect(view.container.querySelector('[data-loading-frame]')).toBeNull();
   await fireEvent.click(view.getByRole('button',{name:'Close',exact:true}));await flush();expect(view.queryByRole('dialog')).toBeNull();expect(view.getByRole('heading',{name:'Projects'})).toBe(heading);expect(main.inert).toBe(false);
  }
  await go('#/menu');await view.findByRole('navigation',{name:'Workspace and account'});await go('#/projects');expect(view.getByRole('heading',{name:'Projects'})).toBe(heading);
  await go('#/menu');await view.findByRole('navigation',{name:'Workspace and account'});expect(projects).toHaveBeenCalledTimes(1);expect(historyRead).not.toHaveBeenCalled();
 });
 it('keeps menu failure/retry local and ignores a late identity after close',async()=>{
  setup(true);vi.spyOn(D,'projects').mockResolvedValue(rows);location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Verified project'});const node=view.getByRole('heading',{name:'Projects'});
  let fail=true;const late=deferred<Response>();vi.stubGlobal('fetch',vi.fn(()=>fail?Promise.resolve(response({code:'UNAVAILABLE',message:'Bounded menu failure'},503)):late.promise));
  await go('#/menu');await view.findByRole('alert');expect(view.container.contains(node)).toBe(true);fail=false;await fireEvent.click(view.getByRole('button',{name:'Retry menu'}));
  await fireEvent.click(view.getByRole('button',{name:'Close',exact:true}));await flush();late.resolve(response({principal:{...me.principal,id:'former',display_name:'Late former actor'}}));await flush();
  expect(view.getByRole('heading',{name:'Projects'})).toBe(node);expect(view.container.textContent).not.toContain('Late former actor');
 });
 it('discards old private background before adopting a confirmed different menu identity',async()=>{
  setup(true);vi.spyOn(D,'projects').mockResolvedValue(rows);location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Verified project'});
  vi.stubGlobal('fetch',vi.fn(async()=>response({principal:{...me.principal,id:'actor-B',display_name:'Actor B'}})));
  await go('#/menu');await view.findByRole('navigation',{name:'Workspace and account'});expect(view.container.textContent).not.toMatch(/Verified project|Actor A/);expect(view.container.textContent).toContain('Actor B');
 });
});
describe('retained same-context reads and ordinary actions',()=>{
 it.each([false,true])('retains nodes on same-context read, shows local retry on failure, and then updates without a global loading page (phone=%s)',async phone=>{
  setup(phone);const pending=deferred<typeof rows>();vi.spyOn(D,'projects').mockResolvedValueOnce(rows).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([{...rows[0],name:'Updated project'}]);
  location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Verified project'});const heading=view.getByRole('heading',{name:'Projects'}),header=view.container.querySelector('header'),main=heading.closest('main')!;
  await go('#/projects?refresh=1');expect(view.getByRole('heading',{name:'Projects',hidden:true})).toBe(heading);expect(view.container.querySelector('header')).toBe(header);expect(main.inert).toBe(true);expect(main.getAttribute('aria-busy')).toBe('true');expect(view.container.querySelector('[data-loading-frame]')).toBeNull();
  pending.reject(new Error('Refresh fixture failed'));await view.findByRole('button',{name:'Retry update'});expect(view.container.textContent).toContain('Verified project');expect(main.inert).toBe(true);
  await fireEvent.click(view.getByRole('button',{name:'Retry update'}));await view.findByRole('link',{name:'Updated project'});expect(view.getByRole('heading',{name:'Projects'})).toBe(heading);expect(main.inert).toBe(false);
 });
 it('focus-confirmed identity change clears old private content while new reads are pending',async()=>{
  setup();const next=deferred<typeof rows>();vi.spyOn(D,'projects').mockResolvedValueOnce(rows).mockReturnValueOnce(next.promise);location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Verified project'});
  const other={principal:{...me.principal,id:'actor-B',display_name:'Actor B'}};vi.mocked(S.me).mockResolvedValue(other);vi.stubGlobal('fetch',vi.fn(async()=>response(other)));
  await fireEvent(window,new Event('focus'));await waitFor(()=>expect(view.queryByText('Verified project')).toBeNull());next.resolve([{...rows[0],name:'Other actor project'}]);await view.findByRole('link',{name:'Other actor project'});
 });
 it('workspace rename/readback keeps destination nodes; a late rename after navigation cannot reload the new view',async()=>{
  setup();const data={...workspace,id:'workspace-A',name:'Workspace A',role:'owner',projects:[]};const reread=deferred<typeof data>();vi.spyOn(D,'workspaceModel').mockResolvedValueOnce(data).mockReturnValueOnce(reread.promise);const renamed=deferred<any>();vi.spyOn(W,'renameWorkspace').mockReturnValue(renamed.promise);
  location.hash='#/workspace/workspace-A';const view=render(Live);await view.findByRole('button',{name:'Rename workspace'});const header=view.container.querySelector('header');
  await fireEvent.click(view.getByRole('button',{name:'Rename workspace'}));await fireEvent.input(view.getByLabelText('Workspace name'),{target:{value:'Workspace renamed'}});await fireEvent.click(view.getByRole('button',{name:'Save workspace name'}));
  renamed.resolve({...data,name:'Workspace renamed',undo:null});await flush();expect(view.container.querySelector('header')).toBe(header);expect(view.container.querySelector('[data-loading-frame]')).toBeNull();reread.resolve({...data,name:'Workspace renamed'});await view.findByText('Workspace renamed');
  const late=deferred<any>();vi.mocked(W.renameWorkspace).mockReturnValue(late.promise);await fireEvent.click(view.getByRole('button',{name:'Rename workspace'}));await fireEvent.click(view.getByRole('button',{name:'Save workspace name'}));
  vi.spyOn(D,'projects').mockResolvedValue(rows);await go('#/projects');await view.findByRole('link',{name:'Verified project'});late.resolve({...data,name:'Late workspace'});await flush();expect(view.container.textContent).not.toContain('Late workspace');expect(vi.mocked(D.projects)).toHaveBeenCalledTimes(1);
 });
});

it('a same-actor authoritative reread fences a previously pending private child list without remounting its destination',async()=>{
 const {default:Projects}=await import('../ui-next/src/app/Projects.svelte');const old=deferred<Response>(),fresh=deferred<Response>();let calls=0;vi.stubGlobal('fetch',vi.fn(()=>++calls===1?old.promise:fresh.promise));
 const view=render(Projects,{projects:rows,identityKey:'actor-A:my',readKey:1});const heading=view.getByRole('heading',{name:'Projects'});
 await fireEvent.click(view.getByRole('button',{name:'Show reviews in Verified project'}));await view.rerender({projects:rows,identityKey:'actor-A:my',readKey:2});
 await fireEvent.click(view.getByRole('button',{name:'Show reviews in Verified project'}));old.resolve(response({assessments:[{id:'old',name:'Stale private child'}]}));await flush();
 expect(view.queryByText('Stale private child')).toBeNull();expect(view.getByText('Loading reviews…')).toBeTruthy();fresh.resolve(response({assessments:[]}));await view.findByText('No reviews available to you in this project.');expect(view.getByRole('heading',{name:'Projects'})).toBe(heading);
});

it('response focus is reversible, retains unknown counts, distinguishes duplicate context and resets on identity change',async()=>{
 const {default:Projects}=await import('../ui-next/src/app/Projects.svelte');
 const projects=[{...rows[0],name:'Shared name',workspace_name:'North workspace'}, {...rows[0],id:'empty',name:'Empty accessible project',response_count:0}, {...rows[0],id:'unknown',name:'Unknown count project',response_count:null}, {...rows[0],id:'south',name:'Shared name',workspace_name:'South workspace'}];
 const view=render(Projects,{projects,identityKey:'actor-A:my'});
 expect(view.getByText(/North workspace/)).toBeTruthy();expect(view.getByText(/South workspace/)).toBeTruthy();
 await fireEvent.change(view.getByLabelText('Response view'),{target:{value:'With responses'}});
 expect(view.queryByRole('link',{name:'Empty accessible project'})).toBeNull();expect(view.getByRole('link',{name:'Unknown count project'})).toBeTruthy();expect(view.getByText('Showing 3 of 4 accessible projects.')).toBeTruthy();
 await fireEvent.click(view.getByRole('button',{name:'Reset project filters'}));expect(view.getByRole('link',{name:'Empty accessible project'})).toBeTruthy();
 await fireEvent.change(view.getByLabelText('Response view'),{target:{value:'With responses'}});
 await view.rerender({projects:[projects[1]],identityKey:'actor-B:my'});await flush();expect((view.getByLabelText('Response view') as HTMLSelectElement).value).toBe('All projects');expect(view.getByRole('link',{name:'Empty accessible project'})).toBeTruthy();
});

it('an authoritative menu refusal removes private background and remains distinct from sign-in',async()=>{
 setup();vi.spyOn(D,'projects').mockResolvedValue(rows);location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Verified project'});
 vi.stubGlobal('fetch',vi.fn(async()=>response({code:'NOT_AUTHORIZED',message:'Fixture access refused'},403)));
 await go('#/menu');await waitFor(()=>expect(view.queryByRole('link',{name:'Verified project'})).toBeNull());expect(view.container.textContent).not.toContain('Sign in to continue');
});

it.each(['identity','scope'])('focus-confirmed %s change in an open menu never falls back to aggregate Home reads',async change=>{
 setup(true);vi.spyOn(D,'projects').mockResolvedValue(rows);const home=vi.spyOn(D,'homeModel');location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Verified project'});await go('#/menu');await view.findByRole('navigation',{name:'Workspace and account'});
 const next={...me,principal:{...me.principal,...(change==='identity'?{id:'actor-B',display_name:'Actor B'}:{access_mode:'global'})}};vi.stubGlobal('fetch',vi.fn(async()=>response(next)));await fireEvent(window,new Event('focus'));await flush();await view.findByRole('navigation',{name:'Workspace and account'});expect(view.queryByRole('link',{name:'Verified project'})).toBeNull();expect(home).not.toHaveBeenCalled();expect(view.container.querySelector('[data-loading-frame]')).toBeNull();
});

it.each(['resolve','reject'])('closing a menu cancels a retained read for a different selected snapshot (%s)',async outcome=>{
 setup(true);const pending=deferred<any>();
 const model=(id:string,title:string)=>({aid:'review-A',review:{id:'review-A',title,project:'Project',projectId:'project-A',language:'English',stage:'closed',responses:0,liveResponses:0},counts:{team:0,community:0,church:0},payload:null,results:{},reportId:id,canBuild:false,held:null});
 vi.spyOn(D,'resultsModel').mockResolvedValueOnce(model('old','Old selected snapshot')).mockReturnValueOnce(pending.promise);
 location.hash='#/review/review-A/results?report=old';const view=render(Live);await view.findByText(/No report has been built for Old selected snapshot/);
 await go('#/review/review-A/results?report=new');await go('#/menu?review=review-A');await view.findByRole('navigation',{name:'Workspace and account'});
 await fireEvent.click(view.getByRole('button',{name:'Close',exact:true}));await flush();expect(location.hash).toBe('#/review/review-A/results?report=old');
 expect(view.container.querySelector('main')?.getAttribute('aria-busy')).toBe('false');
 if(outcome==='resolve')pending.resolve(model('new','New pending snapshot'));else pending.reject(new Error('Late snapshot failure'));await flush();
 expect(view.container.textContent).not.toContain('New pending snapshot');expect(view.container.textContent).not.toContain('Late snapshot failure');expect(vi.mocked(D.resultsModel)).toHaveBeenCalledTimes(2);expect(location.hash).toBe('#/review/review-A/results?report=old');
});
