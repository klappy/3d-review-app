// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import Print from '../ui-next/src/screens/actions/Print.svelte';
import fixture from '../ui-next/fixtures/actions/review.json';
function model(aid:string, ids:string[], checked:number[]) {return {...fixture,aid,checked,surveys:ids.map(id=>({id,name:`Survey ${id}`,open:true})),groups:[],lwc:{assessment:null,project:[]}};}
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('retained Print survey identity',()=>{
 it('resets A3 selection to B1 without stale indexes or old PDF URLs',async()=>{
  const onprint=vi.fn();
  const q=render(Print,{props:{phone:true,pdfEnabled:true,data:model('A',['a','b','c'],[0,1,2]),onprint}});
  expect(q.getAllByRole('button',{name:/Download Survey .* PDF/})).toHaveLength(3);
  await q.rerender({phone:true,pdfEnabled:true,data:model('B',['d'],[0]),onprint});
  expect(q.getAllByRole('button',{name:/Download Survey .* PDF/})).toHaveLength(1);
  expect(q.queryByRole('button',{name:'Download Survey a PDF'})).toBeNull();
  await fireEvent.click(q.getByRole('button',{name:'Print 1 survey'}));
  expect(onprint).toHaveBeenLastCalledWith({picked:['d'],lang:'en',paper:'A4'});
 });
 it('retains selected survey identity across same-length reorder and prunes removed ids',async()=>{
  const onprint=vi.fn();
  const q=render(Print,{props:{phone:true,pdfEnabled:true,data:model('A',['a','b','c'],[0]),onprint}});
  await q.rerender({phone:true,pdfEnabled:true,data:model('A',['c','b','a'],[0]),onprint});
  expect(q.getByRole('button',{name:'Download Survey a PDF'})).toBeTruthy();
  expect(q.queryByRole('button',{name:'Download Survey c PDF'})).toBeNull();
  await fireEvent.click(q.getByRole('button',{name:'Print 1 survey'}));
  expect(onprint.mock.calls.at(-1)?.[0].picked).toEqual(['a']);
  await q.rerender({phone:true,pdfEnabled:true,data:model('A',['c'],[0]),onprint});
  expect(q.queryByRole('button',{name:/Download Survey .* PDF/})).toBeNull();
  expect((q.getByRole('button',{name:'Print surveys'}) as HTMLButtonElement).disabled).toBe(true);
 });
 it('aborts pending PDF preparation when review identity changes',async()=>{
  let signal:AbortSignal|undefined;
  const fetch=vi.fn((_url:string,init:RequestInit)=>{signal=init.signal as AbortSignal; return new Promise(()=>{});});
  vi.stubGlobal('fetch',fetch);
  const q=render(Print,{props:{phone:true,pdfEnabled:true,data:model('A',['a'],[0]),onprint:vi.fn()}});
  await fireEvent.click(q.getByRole('button',{name:'Download Survey a PDF'}));
  expect(fetch.mock.calls[0][0]).toContain('/assessments/A/surveys/a/');
  await q.rerender({phone:true,pdfEnabled:true,data:model('B',['a'],[0]),onprint:vi.fn()});
  expect(signal?.aborted).toBe(true);
  expect(q.getByRole('button',{name:'Download Survey a PDF'})).toBeTruthy();
  expect(q.queryByRole('button',{name:'Preparing PDF…'})).toBeNull();
 });
});
