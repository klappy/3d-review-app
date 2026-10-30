// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,waitFor} from '@testing-library/svelte';
import SurveyLinks from '../ui-next/src/app/SurveyLinks.svelte';
import {createSurveyLinks,surveyLinkRequest} from '../ui-next/src/app/survey-links.js';
const surveys=[{id:'s/1',name:'Community survey',state:'selected'}];
afterEach(()=>{cleanup();sessionStorage.clear();});
function harness(extra:any={}) {
 let context={aid:'a1',principalId:'p1',bearer:'bearer'};
 const calls:any[]=[];
 const request=vi.fn(async(url:string,init?:any)=>{
  calls.push({url,body:init?.body,method:init?.method});
  if(url==='/v2/me')return {principal:{id:context.principalId}};
  if(init?.method==='DELETE')return {id:'link1',status:'revoked'};
  if(init?.body.mode==='dry_run')return {survey_id:'s/1',confirm_token:'confirm',reuses:'link1'};
  return {link_id:'link1',entry_fragment:'#survey=private_link',reused:true};
 });
 const flow=createSurveyLinks({aid:'a1',surveys,principalId:'p1',role:'member',bearer:'bearer',request,context:()=>context,origin:'https://example.test',...extra});
 return {flow,calls,request,setContext:(next:any)=>{context={...context,...next};}};
}
describe('participant link management',()=>{
 it('previews and cancels without executing or disclosing a link',async()=>{
  const h=harness();await h.flow.prepare();expect(h.flow.state.stage).toBe('preview');expect(h.flow.state.link).toBe(null);
  h.flow.cancel();expect(h.flow.state.stage).toBe('idle');expect(h.calls.filter(c=>c.body?.mode==='execute')).toHaveLength(0);
 });
 it('issues the exact preview then revokes with confirmation and no invented GET state route',async()=>{
  const onrevoked=vi.fn();const h=harness({onrevoked});await h.flow.prepare();await h.flow.confirm();
  expect(h.flow.state.link?.url).toBe('https://example.test/next/?ui_next=on#survey=private_link');
  expect(h.calls.find(c=>c.body?.mode==='execute')).toEqual({url:'/v2/assessments/a1/surveys/s%2F1/links',method:'POST',body:{mode:'execute',confirm_token:'confirm'}});
  h.flow.prepareRevoke();h.flow.cancel();expect(h.calls.filter(c=>c.method==='DELETE')).toHaveLength(0);
  h.flow.prepareRevoke();await h.flow.revoke();expect(h.flow.state.link).toBe(null);expect(h.flow.state.stage).toBe('idle');expect(onrevoked).toHaveBeenCalledWith({aid:'a1',sid:'s/1',id:'link1'});
  expect(h.calls.filter(c=>c.method==='DELETE')[0].url).toBe('/v2/assessments/a1/surveys/s%2F1/links/link1');
  expect(h.calls.filter(c=>c.url.includes('/links')&&!c.method)).toHaveLength(0);
 });
 it('refuses viewer management without a request',async()=>{
  const h=harness({role:'viewer'});await h.flow.prepare();expect(h.flow.state.stage).toBe('refused');expect(h.request).not.toHaveBeenCalled();
 });
 it('locks uncertain execute and never silently retries',async()=>{
  const h=harness();await h.flow.prepare();h.request.mockImplementationOnce(async()=>({principal:{id:'p1'}})).mockImplementationOnce(async()=>{throw new Error('unknown');});
  await h.flow.confirm();expect(h.flow.state.stage).toBe('uncertain');const count=h.request.mock.calls.length;await h.flow.prepare();await h.flow.confirm();expect(h.request).toHaveBeenCalledTimes(count);
 });
 it('clears a pending preview on principal or bearer changes',async()=>{
  for(const next of [{principalId:'p2'},{bearer:'new'}]){
   const h=harness();await h.flow.prepare();h.setContext(next);await h.flow.confirm();expect(h.flow.state.stage).toBe('changed');expect(h.flow.state.preview).toBe(null);expect(h.calls.filter(c=>c.body?.mode==='execute')).toHaveLength(0);
  }
 });
 it('does not disclose an in-flight result after disposal or review change',async()=>{
  for(const dispose of [true,false]){
   const h=harness();await h.flow.prepare();let release:(x:any)=>void=()=>{};
   h.request.mockImplementationOnce(async()=>({principal:{id:'p1'}})).mockImplementationOnce(()=>new Promise(r=>{release=r;}));
   const work=h.flow.confirm();await vi.waitFor(()=>expect(h.request.mock.calls.at(-1)?.[1]?.body?.mode).toBe('execute'));
   if(dispose)h.flow.dispose();else h.setContext({aid:'a2'});
   release({link_id:'link1',entry_fragment:'#survey=private_link'});await work;expect(h.flow.state.link).toBe(null);
  }
 });
 it('freezes the request bearer rather than reading a later session token',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({ok:true,result:{principal:{id:'p1'}}})));const request=surveyLinkRequest('old-bearer',fetcher);
  sessionStorage.setItem('facilitatorToken','different');await request('/v2/me');expect(fetcher.mock.calls[0][1].headers.authorization).toBe('Bearer old-bearer');
 });
 it('renders explicit preview, cancel, disclosure and revoke flows',async()=>{
  const calls:any[]=[];const request=vi.fn(async(url:string,init?:any)=>{
   calls.push({url,method:init?.method,body:init?.body});if(url==='/v2/me')return {principal:{id:'p1'}};
   if(init?.method==='DELETE')return {id:'l1',status:'revoked'};
   if(init?.body.mode==='dry_run')return {survey_id:'s/1',confirm_token:'confirm'};
   return {link_id:'l1',entry_fragment:'#survey=private_link'};
  });
  const view=render(SurveyLinks,{aid:'a1',surveys,principalId:'p1',role:'member',request});
  await fireEvent.click(view.getByRole('button',{name:'Preview participant link'}));await waitFor(()=>view.getByRole('button',{name:'Confirm link'}));
  await fireEvent.click(view.getByRole('button',{name:'Cancel'}));expect(calls.filter(c=>c.body?.mode==='execute')).toHaveLength(0);
  await fireEvent.click(view.getByRole('button',{name:'Preview participant link'}));await waitFor(()=>view.getByRole('button',{name:'Confirm link'}));
  await fireEvent.click(view.getByRole('button',{name:'Confirm link'}));await waitFor(()=>view.getByLabelText('Participant link'));
  await fireEvent.click(view.getByRole('button',{name:'Revoke this link'}));await fireEvent.click(view.getByRole('button',{name:'Confirm revocation'}));
  await waitFor(()=>expect(view.queryByLabelText('Participant link')).toBe(null));expect(calls.filter(c=>c.method==='DELETE')).toHaveLength(1);
 });
});
