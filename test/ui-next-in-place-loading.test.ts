// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as D from '../ui-next/src/app/data.js';
import * as S from '../ui-next/src/app/session.js';
import { setLiveChrome } from '../ui-next/src/app/chrome.js';
import { setToken } from '../ui-next/src/app/api.js';
const actor = { principal: { id: 'fixture', kind: 'user', provisioned: true, display_name: 'Current User', super_admin: true, access_mode: 'my' } };
const projects = [{ id: 'p1', name: 'Current project', organization: 'Fixture team', role: 'owner', assessment_count: 2, response_count: 6 }];
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
async function go(hash: string) { location.hash=hash; await fireEvent(globalThis,new Event('hashchange')); await tick(); }
afterEach(() => { cleanup(); vi.restoreAllMocks(); S.forget(); setToken(null); setLiveChrome(null); });
describe('real destination stays in place during loading', () => {
  it.each([false,true])('keeps the real public Landing nodes during identity resolution (phone=%s)', async phone => {
    vi.stubGlobal('matchMedia', () => ({matches:phone,addEventListener(){},removeEventListener(){}}));
    const identity=deferred<null>(); vi.spyOn(S,'me').mockReturnValue(identity.promise);
    location.hash='#/'; const view=render(Live as never,{props:{}});
    await waitFor(() => expect(view.container.querySelector('[data-destination="landing"]')).not.toBeNull());
    const root=view.container.querySelector('[data-destination="landing"]')!;
    const hero=view.getByRole('heading',{level:1});
    const header=view.container.querySelector('header');
    expect(hero.textContent?.trim().length).toBeGreaterThan(10);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(view.container.querySelector('[data-loading-frame]')).toBeNull();
    expect(view.container.querySelector('.loading-bar')).toBeNull();
    if(!phone) { expect(view.container.querySelector('.l-media')).not.toBeNull(); expect(view.getByRole('heading',{name:'Three perspectives on one translation'})).not.toBeNull(); }
    identity.resolve(null);
    await waitFor(() => expect(root.getAttribute('aria-busy')).toBe('false'));
    expect(view.container.querySelector('[data-destination="landing"]')).toBe(root);
    expect(view.getByRole('heading',{level:1})).toBe(hero);
    expect(view.container.querySelector('header')).toBe(header);
    vi.unstubAllGlobals();
  });
  it('keeps Projects heading, controls, card and verified compact access control mounted while real fields resolve', async () => {
    vi.spyOn(S,'me').mockResolvedValue(actor); const data=deferred<typeof projects>(); vi.spyOn(D,'projects').mockReturnValue(data.promise);
    location.hash='#/projects'; const view=render(Live as never,{props:{}});
    await waitFor(() => expect(view.getByRole('combobox',{name:'Access mode'})).not.toBeNull());
    const root=view.container.querySelector('[data-destination="projects"]')!;
    const heading=view.getByRole('heading',{name:'Projects'}), search=view.getByRole('searchbox',{name:'Search projects'}), filter=view.getByRole('combobox',{name:'Show projects'});
    const card=root.querySelector('[data-project-entry] .l-card'), access=view.getByRole('combobox',{name:'Access mode'}), header=view.container.querySelector('header');
    expect((search as HTMLInputElement).disabled).toBe(true); expect((filter as HTMLSelectElement).disabled).toBe(true);
    expect(view.queryByText('No projects match this view.')).toBeNull();
    expect((root.querySelector('[data-project-entry]') as HTMLElement).inert).toBe(true);
    data.resolve(projects); await waitFor(() => expect(view.getByRole('link',{name:'Current project'})).not.toBeNull());
    expect(view.getByRole('heading',{name:'Projects'})).toBe(heading); expect(view.getByRole('searchbox',{name:'Search projects'})).toBe(search);
    expect(view.getByRole('combobox',{name:'Show projects'})).toBe(filter); expect(root.querySelector('[data-project-entry] .l-card')).toBe(card);
    expect(view.getByRole('combobox',{name:'Access mode'})).toBe(access); expect(view.container.querySelector('header')).toBe(header);
    expect((search as HTMLInputElement).disabled).toBe(false); expect(root.getAttribute('aria-busy')).toBe('false');
  });
  it('keeps unknown identity neutral and never borrows previous-account rows or chrome', async () => {
    const identity=deferred<typeof actor>(); vi.spyOn(S,'me').mockReturnValue(identity.promise); const data=deferred<typeof projects>(); vi.spyOn(D,'projects').mockReturnValue(data.promise);
    setLiveChrome({who:'Old Account',initials:'OA',workspace:'Secret Workspace'}); location.hash='#/projects'; const view=render(Live as never,{props:{}});
    await waitFor(() => expect(view.getByRole('searchbox',{name:'Search projects'})).not.toBeNull());
    expect(view.container.textContent).not.toMatch(/Old Account|Secret Workspace/); expect(view.queryByRole('combobox',{name:'Access mode'})).toBeNull();
    expect(view.container.querySelector('[data-project-entry]')).not.toBeNull();
    identity.resolve(actor); await waitFor(() => expect(view.getByRole('combobox',{name:'Access mode'})).not.toBeNull());
    data.resolve(projects); await waitFor(() => expect(view.getByRole('link',{name:'Current project'})).not.toBeNull());
  });
  it('separates loading, error+Retry, and real empty outcomes', async () => {
    vi.spyOn(S,'me').mockResolvedValue(actor); const failed=deferred<typeof projects>(); vi.spyOn(D,'projects').mockReturnValueOnce(failed.promise).mockResolvedValueOnce([]);
    location.hash='#/projects'; const view=render(Live as never,{props:{}});
    await waitFor(() => expect(view.getByRole('searchbox',{name:'Search projects'})).not.toBeNull());
    expect(view.queryByText('No projects match this view.')).toBeNull();
    failed.reject(new Error('Fixture read failed'));
    await waitFor(() => expect(view.getByText('Fixture read failed')).not.toBeNull()); expect(view.container.querySelector('[data-destination="projects"]')).toBeNull();
    await fireEvent.click(view.getByRole('button',{name:'Retry'}));
    await waitFor(() => expect(view.getByText('No projects match this view.')).not.toBeNull());
    expect(view.container.querySelector('[data-project-entry]')).toBeNull();
  });
  it('ignores interrupted Projects data and clears project data on a replacement-account navigation', async () => {
    vi.spyOn(S,'me').mockResolvedValue(actor); const old=deferred<typeof projects>(); vi.spyOn(D,'projects').mockReturnValueOnce(old.promise).mockResolvedValueOnce(projects);
    location.hash='#/projects'; const view=render(Live as never,{props:{}});
    await waitFor(() => expect(view.getByRole('searchbox',{name:'Search projects'})).not.toBeNull()); await go('#/welcome');
    await waitFor(() => expect(view.container.querySelector('[data-destination="landing"]')).not.toBeNull());
    old.resolve([{...projects[0],name:'Late private project'}]); await tick();
    expect(view.container.textContent).not.toContain('Late private project');
    await go('#/projects'); await waitFor(() => expect(view.getByRole('link',{name:'Current project'})).not.toBeNull());
    const identity=deferred<typeof actor>(); vi.mocked(S.me).mockReturnValue(identity.promise); setToken('replacement-fixture');
    await go('#/projects?new-account=1'); expect(view.container.textContent).not.toContain('Current project'); expect(view.container.textContent).not.toContain('Current User');
    identity.resolve(actor); await tick();
  });
});

describe('persistent Projects async boundaries', () => {
  it('never paints old child visibility or lets its finalizer clear a newer load for the same project', async () => {
    const {default:Projects}=await import('../ui-next/src/app/Projects.svelte');
    const old=deferred<Response>(), fresh=deferred<Response>();let reads=0;
    vi.stubGlobal('fetch',vi.fn(()=>++reads===1?old.promise:fresh.promise));
    const view=render(Projects as never,{props:{projects,identityKey:'actor-A',canCreate:true}});
    await fireEvent.click(view.getByRole('button',{name:'Show reviews in Current project'}));
    await view.rerender({projects:[],identityKey:'actor-A',pending:true,canCreate:false});
    await view.rerender({projects,identityKey:'actor-B',pending:false,canCreate:true});
    await fireEvent.click(view.getByRole('button',{name:'Show reviews in Current project'}));
    old.resolve(new Response(JSON.stringify({ok:true,result:{assessments:[{id:'private',name:'Old private child'}]}})));
    await tick();for(let i=0;i<10;i++)await Promise.resolve();await tick();
    expect(view.queryByText('Old private child')).toBeNull();expect(view.getByText('Loading reviews…')).not.toBeNull();
    fresh.resolve(new Response(JSON.stringify({ok:true,result:{assessments:[{id:'visible',name:'New permitted child'}]}})));
    await waitFor(()=>expect(view.getByRole('link',{name:'New permitted child'})).not.toBeNull());expect(view.queryByText('Old private child')).toBeNull();
    vi.unstubAllGlobals();
  });
  it.each([true,false])('never navigates or shows old create errors after a context change (success=%s)',async success=>{
    const {default:Projects}=await import('../ui-next/src/app/Projects.svelte');const post=deferred<Response>();const request=vi.fn(()=>post.promise);vi.stubGlobal('fetch',request);
    location.hash='#/projects';const view=render(Projects as never,{props:{projects,identityKey:'actor-A',canCreate:true}});
    await fireEvent.click(view.getByRole('button',{name:'New project'}));await fireEvent.input(view.getByLabelText('Project name'),{target:{value:'Old actor project'}});
    await fireEvent.submit(view.getByRole('button',{name:'Create project'}).closest('form')!);
    await view.rerender({projects:[],identityKey:'actor-B',pending:true,canCreate:false});await view.rerender({projects,identityKey:'actor-B',pending:false,canCreate:true});
    post.resolve(new Response(JSON.stringify(success?{ok:true,result:{project:{id:'created'}}}:{ok:false,error:{code:'FAILED',message:'Old write uncertain'}}),{status:success?200:500}));
    await tick();for(let i=0;i<15;i++)await Promise.resolve();await tick();
    expect(location.hash).toBe('#/projects');expect(request).toHaveBeenCalledTimes(1);expect(view.container.textContent).not.toMatch(/Old actor project|Old write uncertain/);
    vi.unstubAllGlobals();
  });
});
