// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import Explore from '../ui-next/src/screens/explore/Explore.svelte';
// @ts-expect-error plain JS module
import { selectReviews, projectOptions, reviewCsv } from '../ui-next/src/screens/explore/discovery.js';
const reviews = [
 { id:'a', title:'Zulu', projectId:'p1',project:'Same name',language:'Hindi',stage:'collect',updatedAt:'2026-10-01',updated:'Oct 1',href:'#/review/a/collect',lenses:null },
 { id:'b', title:'Alpha', projectId:'p2',project:'Same name',language:'Lao',stage:'understand',updatedAt:'2026-10-29',updated:'Oct 29',href:'#/review/b/results',lenses:null },
];
const data = {user:{first:'Test',initials:'T'},workspace:'Test',reviews, projects:[{id:'p1',name:'Same name'},{id:'p2',name:'Same name'},{id:'empty',name:'Empty project'}],levelMinimum:3};
afterEach(cleanup);
describe('authorized discovery cross-sections',()=>{
 it('combines search, project and stage without mutating input; title and raw-date sorts differ',()=>{
  expect(selectReviews(reviews).map((r:any)=>r.id)).toEqual(['b','a']);
  const reverseDates = reviews.map(r => ({...r,updatedAt:r.id==='a'?'2026-10-30':'2026-10-01'}));
  expect(selectReviews(reverseDates).map((r:any)=>r.id)).toEqual(['a','b']);
  expect(selectReviews(reverseDates,{sort:'title'}).map((r:any)=>r.id)).toEqual(['b','a']);
  expect(selectReviews(reviews,{search:' HINDI ',project:'p1',stage:'collect',sort:'title'}).map((r:any)=>r.id)).toEqual(['a']);
  expect(selectReviews(reviews,{project:'p2',stage:'collect'})).toEqual([]);
  expect(reviews.map(r=>r.id)).toEqual(['a','b']);
 });
 it('keeps same-name projects distinct and includes authorized empty projects',()=>{
  expect(projectOptions(data.projects,reviews).map((p:any)=>p.id).sort()).toEqual(['empty','p1','p2']);
 });
 it('quotes CSV and prevents spreadsheet formula interpretation',()=>{
  expect(reviewCsv([{title:'=SUM(1)',project:'x,"y"'}])).toContain('"\'=SUM(1)"');
  expect(reviewCsv([{title:'x',project:'x,"y"'}])).toContain('"x,""y"""');
 });
 for(const phone of [false,true]) it(`search/filter/reset and project navigation work on ${phone?'phone':'desktop'}`,async()=>{
  const q=render(Explore,{props:{data,phone}});
  expect(q.getByRole('link',{name:'Empty project'}).getAttribute('href')).toBe('#/project/empty');
  await fireEvent.input(q.getByRole('searchbox',{name:'Search reviews'}),{target:{value:'Hindi'}});
  expect(q.queryByRole('link',{name:'Alpha'})).toBeNull();
  expect(q.getByRole('link',{name:'Zulu'}).getAttribute('href')).toBe('#/review/a/collect');
  if(phone) await fireEvent.click(q.getByRole('button',{name:'Filters'}));
  await fireEvent.change(q.getByRole('combobox',{name:'Project'}),{target:{value:'p2'}});
  expect(q.queryByRole('link',{name:'Zulu'})).toBeNull();
  await fireEvent.click(q.getByRole('button',{name:'Reset filters'}));
  expect(q.getByRole('link',{name:'Alpha'})).toBeTruthy();
  expect(q.getByRole('link',{name:'Zulu'})).toBeTruthy();
  await fireEvent.click(q.getByRole('radio',{name:'Table',exact:true}));
  expect(q.getByRole('table')).toBeTruthy();
  await fireEvent.click(q.getByRole('radio',{name:'Cards',exact:true}));
  expect(q.queryByRole('table')).toBeNull();
  if(phone) { await fireEvent.click(q.getByRole('button',{name:'Show reviews'})); expect(q.queryByRole('dialog')).toBeNull(); }
 });
});


describe('phone discovery filter sheet',()=>{
 it('keeps the initial controls compact and view actions after the matching reviews',()=>{
  const q=render(Explore,{props:{data:{...data,viewKey:'phone-account:my'},phone:true}});
  expect(q.queryByRole('combobox',{name:'Project'})).toBeNull();
  expect(q.queryByRole('combobox',{name:'Stage'})).toBeNull();
  expect(q.queryByRole('combobox',{name:'Group by'})).toBeNull();
  expect(q.getByRole('combobox',{name:'Sort'})).toBeTruthy();
  const review=q.getByRole('link',{name:'Alpha'}), saved=q.getByRole('button',{name:'Save this view'});
  expect(review.compareDocumentPosition(saved) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 });
 it.each(['Cancel','Escape','backdrop'])('%s closes without retaining unfinished filter changes',async(close)=>{
  const q=render(Explore,{props:{data,phone:true}});
  const trigger=q.getByRole('button',{name:'Filters'});
  await fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const sheet=q.getByRole('dialog',{name:'Review filters'});
  expect(sheet.classList.contains('sheet')).toBe(true);
  await fireEvent.change(q.getByRole('combobox',{name:'Project'}),{target:{value:'p1'}});
  await fireEvent.change(q.getByRole('combobox',{name:'Group by'}),{target:{value:'language'}});
  await fireEvent.click(q.getByRole('radio',{name:'Table',exact:true}));
  if(close==='Cancel') await fireEvent.click(q.getByRole('button',{name:'Cancel',exact:true}));
  else if(close==='Escape') await fireEvent(sheet,new Event('cancel',{cancelable:true}));
  else await fireEvent(sheet,new Event('close'));
  expect(q.queryByRole('dialog')).toBeNull();
  expect(q.getByRole('link',{name:'Alpha'})).toBeTruthy();
  expect(q.getByRole('link',{name:'Zulu'})).toBeTruthy();
  expect(q.queryByRole('table')).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
 });
 it('applies filters, grouping and table choice, then retains them on reopening',async()=>{
  const q=render(Explore,{props:{data,phone:true}});
  await fireEvent.click(q.getByRole('button',{name:'Filters'}));
  await fireEvent.change(q.getByRole('combobox',{name:'Project'}),{target:{value:'p1'}});
  await fireEvent.change(q.getByRole('combobox',{name:'Group by'}),{target:{value:'language'}});
  await fireEvent.click(q.getByRole('radio',{name:'Table',exact:true}));
  await fireEvent.click(q.getByRole('button',{name:'Show reviews'}));
  expect(q.queryByRole('dialog')).toBeNull();
  expect(q.queryByRole('link',{name:'Alpha'})).toBeNull();
  expect(q.getByRole('table')).toBeTruthy();
  expect(q.getByRole('heading',{name:'Hindi · 1'})).toBeTruthy();
  await fireEvent.click(q.getByRole('button',{name:'Filters · 1'}));
  expect((q.getByRole('combobox',{name:'Project'}) as HTMLSelectElement).value).toBe('p1');
  expect((q.getByRole('combobox',{name:'Group by'}) as HTMLSelectElement).value).toBe('language');
  expect((q.getByRole('radio',{name:'Table',exact:true}) as HTMLInputElement).checked).toBe(true);
 });
 it('resets an open sheet on account/access change without restoring the old draft',async()=>{
  const q=render(Explore,{props:{data:{...data,viewKey:'account-a:my'},phone:true}});
  await fireEvent.click(q.getByRole('button',{name:'Filters'}));
  await fireEvent.change(q.getByRole('combobox',{name:'Project'}),{target:{value:'p1'}});
  await q.rerender({data:{...data,viewKey:'account-b:my'},phone:true});
  expect(q.queryByRole('dialog')).toBeNull();
  expect(q.getByRole('link',{name:'Alpha'})).toBeTruthy();
  await fireEvent.click(q.getByRole('button',{name:'Filters'}));
  expect((q.getByRole('combobox',{name:'Project'}) as HTMLSelectElement).value).toBe('');
 });
});
