// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import Workspace from '../ui-next/src/screens/people/Workspace.svelte';
import { groupRows } from '../ui-next/src/screens/people/people-data.js';
import fixture from '../ui-next/fixtures/people/workspace.json';
import { workspaceModel } from '../ui-next/src/app/data.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const candidates = [
  { id:'partial',title:'Project with a private review',directRole:'owner',groupingEligible:false },
  { id:'eligible',title:'Project and all reviews owned',directRole:'owner',groupingEligible:true },
  { id:'unknown',title:'Eligibility unavailable',directRole:'owner' },
  { id:'inherited',title:'Inherited project owner',directRole:null,groupingEligible:true },
];
it('the live workspace adapter preserves caller-scoped eligibility without inferring it from a project role', async () => {
  const rows = candidates.map(c => ({ id:c.id,name:c.title,direct_role:c.directRole,...(c.groupingEligible === undefined ? {} : {grouping_eligible:c.groupingEligible}) }));
  vi.stubGlobal('fetch', vi.fn(async (url:string) => new Response(JSON.stringify({ok:true,result:url === '/v2/projects' ? {projects:rows} : {workspace:{id:'w1',name:'Workspace',role:'member'},projects:[]}}),{status:200,headers:{'content-type':'application/json'}})));
  const data = await workspaceModel('w1',{principal:{id:'synthetic-owner',display_name:'Synthetic Owner'}});
  expect(groupRows(data.group).map(c=>c.can)).toEqual([false,true,false,false]);
  expect(data.group.candidates.map(c=>c.groupingEligible)).toEqual([false,true,undefined,true]);
});
it('requires a positive server eligibility result as well as direct project and workspace authority',()=>{
  expect(groupRows({workspaceRole:'member',candidates}).map(r=>r.can)).toEqual([false,true,false,false]);
  expect(groupRows({workspaceRole:'viewer',candidates}).every(r=>!r.can)).toBe(true);
});
it.each([false,true])('the live grouping picker blocks partial/unknown/inherited candidates and dispatches only eligible selection (phone=%s)',async phone=>{
  const ongroup=vi.fn();
  const data={...fixture,group:{workspaceRole:'owner',candidates}};
  const v=render(Workspace,{phone,group:true,data,ongroup});
  const radios=[...v.container.querySelectorAll('dialog input[type=radio]')] as HTMLInputElement[];
  expect(radios.map(r=>r.disabled)).toEqual([true,false,true,true]);
  expect(radios[1].checked).toBe(true);
  await fireEvent.click(v.container.querySelector('dialog .btn-primary')!);
  expect(ongroup).toHaveBeenCalledWith('eligible');
  ongroup.mockClear();
  await v.rerender({phone,group:true,data:{...data,group:{...data.group,candidates:candidates.map(c=>({...c,groupingEligible:false}))}},ongroup});
  const action=v.container.querySelector('dialog .btn-primary') as HTMLButtonElement;
  expect(action.disabled).toBe(true);
  await fireEvent.click(action);
  expect(ongroup).not.toHaveBeenCalled();
  expect(v.container.textContent).toContain('every review');
});
