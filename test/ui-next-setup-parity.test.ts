// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import Setup1 from '../ui-next/src/screens/setup/Setup1.svelte';
import Setup2 from '../ui-next/src/screens/setup/Setup2.svelte';
import fixture from '../ui-next/fixtures/setup/setup.json';
// @ts-expect-error plain JS adapter
import * as SU from '../ui-next/src/app/setup.js';
const response = (result:unknown) => ({ok:true,status:200,json:async()=>({ok:true,result})});
let calls: {url:string,method:string,body:any}[];
let held:any[];
beforeEach(()=>{
 calls=[];held=[];SU.forgetAll();
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit={})=>{
  const method=init.method||'GET',body=init.body?JSON.parse(String(init.body)):undefined;
  calls.push({url,method,body});
  if(url==='/v2/projects') return response({projects:[{id:'old',name:'Old',role:'owner'},{id:'new',name:'New',role:'member'}]});
  if(url==='/v2/templates')return response({templates:[]});
  if(url.endsWith('/languages'))return response({languages:[]});
  if(url.endsWith('/passages')&&method==='POST') {held.push({id:`p${held.length}`,kind:body.url?'link':'reference',media:body.url?'link':'reference',...body});return response({passage:held.at(-1)});}
  if(url.endsWith('/passages'))return response({passages:held});
  if(url.includes('/passages/')&&method==='DELETE'){held=held.filter(p=>!url.endsWith('/'+p.id));return response({removed:true});}
  if(url.includes('/surveys/')&&method==='DELETE')return response({archived:true,preserved_responses:3});
  return response({});
 }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();SU.forgetAll();});
const state=()=>({aid:'a',role:'owner',stage:'prepare',passages:[],fileStorage:true,draft:SU.freshDraft('old'),pre:[],templates:[],snap:{}});
describe('contracted setup parity',()=>{
 it('creates named-only references, reads them back, includes them in passageView, and removes by identity',async()=>{
  const st=state();await SU.addPassage(st,{reference:'Mark 1–4',title:'Workshop passage'});
  expect(calls.find(c=>c.method==='POST')?.body).toEqual({reference:'Mark 1–4',title:'Workshop passage'});
  const view=SU.passageView(st);expect(view.files[0]).toMatchObject({kind:'reference',name:'Workshop passage',reference:'Mark 1–4',href:''});
  const reloaded=await SU.passages('a');expect(reloaded.passages[0].reference).toBe('Mark 1–4');
  await SU.removePassage(st,'p0');expect(st.passages).toEqual([]);expect((await SU.passages('a')).passages).toEqual([]);
 });
 it('preserves link title and reference in the existing API contract',async()=>{
  const st=state();await SU.addPassageLink(st,' https://example.invalid/video ',' Sign video ',' Mark 1 ');
  expect(calls.find(c=>c.method==='POST')?.body).toEqual({url:'https://example.invalid/video',title:'Sign video',reference:'Mark 1'});
  expect(SU.passageView(st).files[0]).toMatchObject({reference:'Mark 1',href:'https://example.invalid/video'});
 });
 it('selects an explicitly created authorized project while preserving the unsaved draft and clearing its old language',async()=>{
  const st=await SU.openSetup(null,{pid:'old'});st.draft.name='Unsaved name';st.draft.purpose='Keep passage';st.draft.language='old-language';
  const returned=await SU.openSetup(null,{pid:'new'});
  expect(returned.draft).toMatchObject({project:'new',name:'Unsaved name',purpose:'Keep passage',language:''});
  await SU.openSetup(null,{pid:'unauthorized'});expect(returned.draft.project).toBe('new');
 });
 it('requires launched-survey removal preview and cancellation performs no DELETE',async()=>{
  const st:any=state();st.stage='collect';st.pre=[{id:'s',template:'t',name:'Team'}];st.draft.groups={t:{checked:false}};
  await expect(SU.saveGroups(st)).rejects.toThrow('Confirm');expect(calls).toEqual([]);
  const confirm=vi.fn(async()=>false);expect(await SU.saveGroups(st,{confirmRemoval:confirm})).toEqual({saved:false,cancelled:true});
  expect(confirm).toHaveBeenCalledWith(st.pre);expect(calls).toEqual([]);expect(st.pre).toHaveLength(1);
  expect(await SU.saveGroups(st,{confirmRemoval:async()=>true})).toEqual({saved:true});
  expect(calls.map(c=>[c.method,c.url])).toEqual([['DELETE','/v2/assessments/a/surveys/s']]);expect(st.pre).toEqual([]);
 });
 it('keeps a completed/viewer setup read-only for new attachment and survey mutations',async()=>{
  const st=state();st.role='viewer';await expect(SU.addPassage(st,{reference:'Mark 1'})).rejects.toThrow('read-only');await expect(SU.saveGroups(st)).rejects.toThrow('read-only');await expect(SU.saveContext(st)).rejects.toThrow('read-only');expect(calls).toEqual([]);
 });
 for(const phone of [false,true])it(`offers create-project and named/link attachment controls on ${phone?'phone':'desktop'}`,async()=>{
  const details=render(Setup1,{props:{phone,onfield:vi.fn()}});expect(details.getByRole('link',{name:'Create a project'}).getAttribute('href')).toBe('#/projects?return=setup1');details.unmount();
  const onattach=vi.fn();const q=render(Setup2,{props:{phone,data:{...fixture.passage,name:'Mark 1',files:[{id:'ref',name:'Named only',kind:'reference',reference:'Mark 1',href:'',note:'Passage reference'}]},onnext:vi.fn(),onfield:vi.fn(),onattach}});
  expect(q.queryByRole('button',{name:'Preview'})).toBeNull();
  await fireEvent.input(q.getByRole('textbox',{name:'Passage title (optional)'}),{target:{value:'Reading'}});
  await fireEvent.input(q.getByRole('textbox',{name:'Passage reference'}),{target:{value:'Mark 1'}});
  await fireEvent.click(q.getByRole('button',{name:'Add passage'}));expect(onattach).toHaveBeenCalledWith({title:'Reading',reference:'Mark 1',url:''});
 });
});
