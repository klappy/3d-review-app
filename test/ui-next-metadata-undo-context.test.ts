// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as D from '../ui-next/src/app/data.js';
import * as S from '../ui-next/src/app/session.js';
import * as SU from '../ui-next/src/app/setup.js';
import { setToken } from '../ui-next/src/app/api.js';
import fixture from '../ui-next/fixtures/setup/setup.json';
const person = { principal: { id: 'owner', display_name: 'Owner' } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
async function flush() { await tick(); for (let n = 0; n < 20; n++) await Promise.resolve(); await tick(); }
async function go(hash: string) { location.hash = hash; await fireEvent(window, new HashChangeEvent('hashchange')); await flush(); }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setToken(null); S.forget(); SU.forgetAll(); });
function harness({ pause = '', viewerB = false, mode = 'my' } = {}) {
 const signedIn = { principal: { ...person.principal, access_mode: mode } };
 const draft = SU.freshDraft('p'); draft.name = 'Review A'; draft.language = 'l'; draft.purpose = 'Passage'; draft.closes = '2099-01-01';
 const state: any = { key:'A', aid:'A', draft, role:'owner', stage:'prepare', snap:SU.snapOf(draft), pre:[], projects:[{id:'p',name:'Project'}], templates:[], languages:[{id:'l',name:'Language'}], passages:[], fileStorage:true };
 const original = { id:'A', project_id:'p', role:'owner', stage:'prepare', ...SU.snapOf(draft) };
 let saved = { ...original }, armed = false;
 const pending = deferred<Response>(), writes: any[] = [], calls: string[] = [];
 const response = (result: any, extra = {}) => new Response(JSON.stringify({ok:true,result,...extra}));
 vi.spyOn(S,'me').mockResolvedValue(signedIn as any);
 vi.spyOn(D,'assessment').mockImplementation(async aid => ({assessment:{id:aid,role:aid==='B'&&viewerB?'viewer':'owner',stage:'prepare'}} as any));
 vi.spyOn(SU,'openSetup').mockImplementation(async aid => { if(aid !== 'A') throw new Error('Unexpected draft '+aid); return state; });
 vi.spyOn(D,'setupModel').mockImplementation(async aid => { const model = structuredClone(fixture); model.summary[0].main = aid==='A' ? saved.name : 'Review B'; model.phoneSummary[0].value = aid==='A' ? saved.name : 'Review B'; return model as any; });
 vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
  calls.push(url);
  if(armed && ((pause==='identity'&&url==='/v2/me') || (pause==='readback'&&url==='/v2/assessments/A'&&(!init.method||init.method==='GET')))) { armed=false; return pending.promise; }
  if(url==='/v2/me') return response(signedIn);
  if(url==='/v2/assessments/A' && init.method==='PATCH') { const body=JSON.parse(init.body); writes.push({url,method:'PATCH',body}); saved={...saved,...body}; return response({assessment:saved},{capability:'cap.assessment.update',receipt:{actor:'owner',scope:{type:'assessment',id:'A'},inverse:'self:restore-prior',undo_token:'private-A-token'}}); }
  if(url==='/v2/assessments/A') return response({assessment:saved,surveys:[]});
  if(url==='/v2/undo/private-A-token') { writes.push({url,method:init.method}); saved={...original}; return response({undone:'cap.assessment.update'}); }
  return response({email_links:false});
 }));
 return { state, writes, calls, saved:()=>saved, arm:()=>{armed=true;}, release:(identity=signedIn)=>pending.resolve(response(pause==='identity'?identity:{assessment:saved,surveys:[]})) };
}
async function saveA() {
 location.hash='#/setup/1?review=A'; const view=render(Live);
 await fireEvent.input(await view.findByLabelText('Name this review'),{target:{value:'Review A revised'}});
 await fireEvent.click(view.getByRole('button',{name:'Continue'}));
 await view.findByRole('button',{name:'Undo saved details'});
 return view;
}
it.each([false,true])('a real saved A receipt is absent on B summary (viewer=%s), including a retained old button event',async viewerB=>{
 const f=harness({viewerB}); const view=await saveA();
 expect(f.writes.filter(x=>x.method==='PATCH')).toHaveLength(1);
 const stale=view.getByRole('button',{name:'Undo saved details'});
 await go(viewerB?'#/setup/1?review=B':'#/review/B'); await view.findByText('Review B');
 expect(view.queryByRole('button',{name:'Undo saved details'})).toBeNull();
 await fireEvent.click(stale); await flush();
 expect(f.writes.some(x=>x.url.startsWith('/v2/undo/'))).toBe(false);
 expect(f.saved().name).toBe('Review A revised');
});
it('the matching A summary retains its receipt and actually undoes only A once',async()=>{
 const f=harness(); const view=await saveA(); await go('#/review/A'); await view.findByText('Review A revised');
 await fireEvent.click(view.getByRole('button',{name:'Undo saved details'}));
 await waitFor(()=>expect(f.saved().name).toBe('Review A'));
 await waitFor(()=>expect(view.queryByRole('button',{name:'Undo saved details'})).toBeNull());
 expect(f.writes.filter(x=>x.url.startsWith('/v2/undo/'))).toEqual([{url:'/v2/undo/private-A-token',method:'POST'}]);
});
it.each(['identity','readback'])('A→B while Undo %s is pending cannot dispatch an old receipt write or reload B',async pause=>{
 const f=harness({pause}); const view=await saveA(); f.arm(); const count=f.calls.length;
 await fireEvent.click(view.getByRole('button',{name:'Undo saved details'}));
 await waitFor(()=>expect(f.calls.slice(count)).toContain(pause==='identity'?'/v2/me':'/v2/assessments/A'));
 await go('#/review/B'); await view.findByText('Review B'); f.release(); await flush();
 expect(f.writes.some(x=>x.url.startsWith('/v2/undo/'))).toBe(false);
 expect(view.getByText('Review B')).toBeTruthy(); expect(location.hash).toBe('#/review/B');
 expect(view.queryByRole('button',{name:'Undo saved details'})).toBeNull();
});

it.each(['mode','actor','credential'])('a pending Undo identity check rejects a changed %s before POST',async change=>{
 const f=harness({pause:'identity',mode:'global'}); const view=await saveA(); f.arm();
 await fireEvent.click(view.getByRole('button',{name:'Undo saved details'}));
 await waitFor(()=>expect(f.calls.at(-1)).toBe('/v2/me'));
 if(change==='credential') setToken('synthetic-replacement-credential');
 f.release({principal:{...person.principal,id:change==='actor'?'replacement':'owner',access_mode:change==='mode'?'my':'global'}});
 await flush();
 expect(f.writes.some(x=>x.url.startsWith('/v2/undo/'))).toBe(false);
 expect(f.saved().name).toBe('Review A revised');
});
