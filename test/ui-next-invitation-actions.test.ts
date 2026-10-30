// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import Actions from '../ui-next/src/app/InvitationActions.svelte';
import { capturePrivateInvitation, readPrivateInvitation, forgetPrivateInvitation, previewInvitations, confirmInvitations, revokeWithConfirmation, privateInvitationFallback } from '../ui-next/src/app/invitation-actions.js';
const invitations = [1,2].map(n => ({id:`inv-${n}`,scope:{type:'project',id:`p${n}`,name:`Project ${n}`},role:'member'}));
const originalFetch=globalThis.fetch;
afterEach(()=>{cleanup();globalThis.fetch=originalFetch;sessionStorage.clear();});
describe('invitation acceptance controls',()=>{
 it('scrubs private token before storage and fallback never embeds it in URL',()=>{
  const calls:any[]=[];const storage={getItem:vi.fn(()=> 'private_token'),setItem:vi.fn(()=>calls.push('store')),removeItem:vi.fn()};
  const env={location:{hash:'#invite=private_token',pathname:'/next/',search:'',assign:vi.fn()},history:{replaceState:vi.fn(()=>calls.push('scrub'))},sessionStorage:storage};
  expect(capturePrivateInvitation(env)).toBe(true);expect(calls).toEqual(['scrub','store']);
  expect(env.history.replaceState.mock.calls[0][2]).toBe('/next/#/invitations?private=1');
  expect(privateInvitationFallback(env)).toBe(true);expect(env.location.assign).toHaveBeenCalledWith('/#invite');
 });
 it('handles unavailable private-token storage without exposing a credential',()=>{
  expect(readPrivateInvitation({getItem(){throw new Error('unavailable');}})).toBe(null);
  expect(()=>forgetPrivateInvitation({removeItem(){throw new Error('unavailable');}})).not.toThrow();
 });
 it('rejects malformed private token and removes stale pending credential',()=>{
  sessionStorage.setItem('pendingInvite','old');
  const env={location:{hash:'#invite=bad%21',pathname:'/next/',search:''},history:{replaceState:vi.fn()},sessionStorage};
  expect(capturePrivateInvitation(env)).toBe(false);expect(readPrivateInvitation()).toBe(null);
 });
 it('previews all without writes, verifies each accepted grant and stops at first uncertain execution',async()=>{
  const request=vi.fn(async(url:string,init?:any)=>{
   if(init?.body.mode==='dry_run'){const n=url.includes('inv-1')?1:2;return {confirm_token:`c${n}`,impact:{affected:[{scope:{type:'project',id:`p${n}`},role:'member'}]}};}
   if(url.includes('inv-2'))throw new Error('unknown');
   if(init?.body.mode==='execute')return {granted:true};
   if(url==='/v2/me/invitations')return {invitations:[invitations[1]]};
   return {grants:[{scope_type:'project',scope_id:'p1',role:'member'}]};
  });
  const previews=await previewInvitations([...invitations,{id:'inv-3',scope:{type:'project',id:'p3'},role:'member'}],{request});expect(request).toHaveBeenCalledTimes(3);
  const out=await confirmInvitations(previews,{request});expect(out.accepted).toEqual([{type:'project',id:'p1'}]);expect(out.failed).toBe(true);
  expect(request.mock.calls.filter(c=>c[1]?.body?.mode==='execute')).toHaveLength(2);
 });
 it('cancel pending revocation sends no mutation or read',async()=>{
  const request=vi.fn();const out=await revokeWithConfirmation({type:'project',id:'p1'},{pending:true,key:'inv-1'},{request,confirm:()=>false});
  expect(out.cancelled).toBe(true);expect(request).not.toHaveBeenCalled();
 });
 it('checks removal with independent scoped readback',async()=>{
  const request=vi.fn().mockResolvedValueOnce({revoked:true}).mockResolvedValueOnce({pending_invitations:[]});
  await revokeWithConfirmation({type:'project',id:'p1'},{pending:true,key:'inv-1'},{request,confirm:()=>true});
  expect(request.mock.calls.map(c=>c[0])).toEqual(['/v2/invitations/inv-1','/v2/project/p1/grants']);
 });
 it('private-token preview cancellation clears credential with no execute and explicit reveal/hide',async()=>{
  sessionStorage.setItem('pendingInvite','private_token');
  const requests:any[]=[];
  globalThis.fetch=vi.fn(async(url:string,init:any)=>{requests.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({ok:true,result:{confirm_token:'confirm',impact:{affected:[{scope:{type:'project',id:'p1'},role:'member'}]}}}));}) as typeof fetch;
  const view=render(Actions,{privateInvitation:true});
  expect(view.queryByLabelText('Private invitation token')).toBe(null);
  await fireEvent.click(view.getByRole('button',{name:'Reveal invitation token'}));expect((view.getByLabelText('Private invitation token')as HTMLInputElement).value).toBe('private_token');
  await fireEvent.click(view.getByRole('button',{name:'Hide invitation token'}));expect(view.queryByLabelText('Private invitation token')).toBe(null);
  await fireEvent.click(view.getByRole('button',{name:'Preview invitation'}));await waitFor(()=>view.getByRole('button',{name:'Confirm acceptance'}));
  await fireEvent.click(view.getByRole('button',{name:'Cancel'}));expect(requests).toHaveLength(1);expect(readPrivateInvitation()).toBe(null);expect(view.getByRole('status').textContent).toContain('No invitation was accepted');
 });
 it('accept all reports progress and confirms before any execute',async()=>{
  let accepted:string[]=[];const requests:any[]=[];
  globalThis.fetch=vi.fn(async(url:string,init:any)=>{const body=init.body?JSON.parse(init.body):null;requests.push({url,body});let result:any;
   if(body?.mode==='dry_run'){const n=url.includes('inv-1')?1:2;result={confirm_token:`c${n}`,impact:{affected:[{scope:{type:'project',id:`p${n}`},role:'member'}]}};}
   else if(body?.mode==='execute'){accepted.push(url.includes('inv-1')?'p1':'p2');result={granted:true};}
   else if(url==='/v2/me/invitations')result={invitations:invitations.filter(i=>!accepted.includes(i.scope.id))};
   else result={grants:accepted.map(id=>({scope_type:'project',scope_id:id,role:'member'}))};
   return new Response(JSON.stringify({ok:true,result}));
  })as typeof fetch;
  const view=render(Actions,{invitations});
  await fireEvent.click(view.getByRole('button',{name:'Preview accepting all invitations'}));await waitFor(()=>view.getByRole('button',{name:'Confirm acceptance'}));
  expect(requests.filter(r=>r.body?.mode==='execute')).toHaveLength(0);
  await fireEvent.click(view.getByRole('button',{name:'Confirm acceptance'}));await waitFor(()=>expect(view.getByRole('status').textContent).toContain('2 invitations accepted and verified'));
  expect(accepted).toEqual(['p1','p2']);
 });
});
