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
  await fireEvent.change(q.getByRole('combobox',{name:'Project'}),{target:{value:'p2'}});
  expect(q.queryByRole('link',{name:'Zulu'})).toBeNull();
  await fireEvent.click(q.getByRole('button',{name:'Reset filters'}));
  expect(q.getByRole('link',{name:'Alpha'})).toBeTruthy();
  expect(q.getByRole('link',{name:'Zulu'})).toBeTruthy();
  await fireEvent.click(q.getByRole('radio',{name:'Table',exact:true}));
  expect(q.getByRole('table')).toBeTruthy();
  await fireEvent.click(q.getByRole('radio',{name:'Cards',exact:true}));
  expect(q.queryByRole('table')).toBeNull();
 });
});
