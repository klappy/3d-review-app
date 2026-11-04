// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import Explore from '../ui-next/src/screens/explore/Explore.svelte';
// @ts-expect-error plain JS module
import { viewPreferenceKey, saveView, loadView, deleteView, groupReviews, selectReviews } from '../ui-next/src/screens/explore/discovery.js';
const projects=[{id:'p1',name:'One'},{id:'p2',name:'Two'}];
const reviews=[{id:'a',title:'First',projectId:'p1',project:'One',language:'Hindi',stage:'collect',href:'#/review/a',updated:'today',lenses:null},{id:'b',title:'Second',projectId:'p2',project:'Two',language:'Lao',stage:'prepare',href:'#/review/b',updated:'today',lenses:null}];
const data={user:{first:'Test',initials:'T'},workspace:'Test',projects,reviews,levelMinimum:3,viewKey:'account-a:my'};
afterEach(()=>{cleanup();localStorage.clear();});
describe('browser-scoped saved Explore preferences',()=>{
 it('separates account, access mode and origin keys and stores only preference fields',()=>{
  const a=viewPreferenceKey('a:my','https://one.example'),global=viewPreferenceKey('a:global','https://one.example'),b=viewPreferenceKey('b:my','https://one.example'),other=viewPreferenceKey('a:my','https://two.example');
  expect(new Set([a,global,b,other]).size).toBe(4);
  expect(saveView(localStorage,a,{search:'Hindi',project:'p1',stage:'collect',sort:'title',view:'cards',group:'project',reviews,token:'never'},projects)).toBe(true);
  expect(JSON.parse(localStorage.getItem(a)!)).toEqual({search:'Hindi',project:'p1',stage:'collect',sort:'title',view:'cards',group:'project'});
  for(const key of [global,b,other])expect(loadView(localStorage,key,projects)).toBeNull();
  expect(loadView(localStorage,a,[]).project).toBe('');
  expect(deleteView(localStorage,a)).toBe(true);expect(loadView(localStorage,a,projects)).toBeNull();
 });
 it('groups only the filtered authorized rows, keeps same-name project IDs distinct',()=>{
  const filtered=selectReviews(reviews,{search:'Hindi'});
  expect(groupReviews(filtered,'stage')).toEqual([{id:'collect',label:'Collecting',rows:[reviews[0]]}]);
  expect(groupReviews(reviews.map(r=>({...r,project:'Same'})),'project')).toHaveLength(2);
  expect(groupReviews(reviews,'language').map((g:any)=>g.label)).toEqual(['Hindi','Lao']);
 });
 it('explicitly saves/loads/deletes and resets state on account/access changes',async()=>{
  const q=render(Explore,{props:{data}});
  await fireEvent.input(q.getByRole('searchbox',{name:'Search reviews'}),{target:{value:'Hindi'}});
  await fireEvent.change(q.getByRole('combobox',{name:'Group by'}),{target:{value:'language'}});
  await fireEvent.click(q.getByRole('button',{name:'Save this view'}));
  expect(q.getByText(/View saved on this browser/)).toBeTruthy();
  await fireEvent.click(q.getByRole('button',{name:'Reset filters'}));
  expect(q.getByRole('link',{name:'Second'})).toBeTruthy();
  await fireEvent.click(q.getByRole('button',{name:'Load saved view'}));
  expect(q.queryByRole('link',{name:'Second'})).toBeNull();
  expect(q.getByRole('heading',{name:'Hindi · 1'})).toBeTruthy();
  await q.rerender({data:{...data,viewKey:'account-a:global'}});
  expect((q.getByRole('searchbox',{name:'Search reviews'}) as HTMLInputElement).value).toBe('');
  await fireEvent.click(q.getByRole('button',{name:'Load saved view'}));
  expect(q.getByText(/No saved view is available/)).toBeTruthy();
  await q.rerender({data:{...data,viewKey:'account-b:my'}});
  await fireEvent.click(q.getByRole('button',{name:'Load saved view'}));
  expect(q.getByText(/No saved view is available/)).toBeTruthy();
  await q.rerender({data});await fireEvent.click(q.getByRole('button',{name:'Delete saved view'}));
  await fireEvent.click(q.getByRole('button',{name:'Load saved view'}));expect(q.getByText(/No saved view is available/)).toBeTruthy();
 });
 it('phone sheet selections can be saved, loaded and deleted from view actions after results',async()=>{
  const q=render(Explore,{props:{data,phone:true}});
  await fireEvent.click(q.getByRole('button',{name:'Filters'}));
  await fireEvent.change(q.getByRole('combobox',{name:'Project'}),{target:{value:'p1'}});
  await fireEvent.change(q.getByRole('combobox',{name:'Group by'}),{target:{value:'language'}});
  await fireEvent.click(q.getByRole('button',{name:'Show reviews'}));
  await fireEvent.click(q.getByRole('button',{name:'Save this view'}));
  expect(q.getByText(/View saved on this browser/)).toBeTruthy();
  await fireEvent.click(q.getByRole('button',{name:'Filters · 1'}));
  await fireEvent.click(q.getByRole('button',{name:'Reset filters'}));
  await fireEvent.click(q.getByRole('button',{name:'Show reviews'}));
  expect(q.getByRole('link',{name:'Second'})).toBeTruthy();
  await fireEvent.click(q.getByRole('button',{name:'Load saved view'}));
  expect(q.queryByRole('link',{name:'Second'})).toBeNull();
  expect(q.getByRole('heading',{name:'Hindi · 1'})).toBeTruthy();
  expect(q.getByRole('button',{name:'Download CSV'})).toBeTruthy();
  await fireEvent.click(q.getByRole('button',{name:'Delete saved view'}));
  await fireEvent.click(q.getByRole('button',{name:'Load saved view'}));
  expect(q.getByText(/No saved view is available/)).toBeTruthy();
 });
 it('revalidates removed project IDs and never restores saved rows',async()=>{
  const key=viewPreferenceKey(data.viewKey);saveView(localStorage,key,{project:'p1',group:'stage'},projects);
  const q=render(Explore,{props:{data:{...data,projects:[projects[1]],reviews:[reviews[1]]}}});
  await fireEvent.click(q.getByRole('button',{name:'Load saved view'}));
  expect((q.getByRole('combobox',{name:'Project'}) as HTMLSelectElement).value).toBe('');
  expect(q.getByRole('link',{name:'Second'})).toBeTruthy();expect(q.queryByRole('link',{name:'First'})).toBeNull();
 });
});
