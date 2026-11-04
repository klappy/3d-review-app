// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,waitFor} from '@testing-library/svelte';
import {tick} from 'svelte';
import Live from '../ui-next/src/app/Live.svelte';
import * as S from '../ui-next/src/app/session.js';
import * as D from '../ui-next/src/app/data.js';
import * as A from '../ui-next/src/app/access-mode.js';
import {setLiveChrome} from '../ui-next/src/app/chrome.js';
const actor={principal:{id:'synthetic-admin',kind:'user',provisioned:true,display_name:'Fixture Admin',super_admin:true,access_mode:'my'}};
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();S.forget();setLiveChrome(null);document.cookie='review_access=my; Path=/';});
it.each([false,true])('verified Landing uses account chrome and a compact served-mode selector inside header (phone=%s)',async phone=>{
 vi.stubGlobal('matchMedia',()=>({matches:phone,addEventListener(){},removeEventListener(){}}));const identity=deferred<typeof actor>();vi.spyOn(S,'me').mockReturnValue(identity.promise);location.hash='#/welcome';const view=render(Live);await view.findByRole('heading',{level:1});const header=view.container.querySelector('header');expect(view.queryByRole('combobox',{name:'Access mode'})).toBeNull();
 identity.resolve(actor);const control=await view.findByRole('combobox',{name:'Access mode'});expect(control.closest('header')).toBe(header);expect(view.queryByRole('link',{name:'Sign in',exact:true})).toBeNull();expect((control as HTMLSelectElement).value).toBe('my');expect(view.container.querySelector('[data-next-utilities]')).toBeNull();expect(header?.querySelector('[aria-label^="Account menu"], [aria-label="Workspace and account"]')).not.toBeNull();
});
it.each([null,{principal:{...actor.principal,super_admin:false}}])('does not offer Support to an unknown/signed-out or ordinary account (%s)',async me=>{
 vi.spyOn(S,'me').mockResolvedValue(me);location.hash='#/welcome';const view=render(Live);await view.findByRole('heading',{level:1});await tick();expect(view.queryByRole('combobox',{name:'Access mode'})).toBeNull();if(!me)expect(view.getByRole('link',{name:'Sign in',exact:true})).toBeTruthy();
});
it('mode change clears pending private data and fences old completion before existing full navigation',async()=>{
 const pending=deferred<any[]>();vi.spyOn(S,'me').mockResolvedValue(actor);vi.spyOn(D,'projects').mockReturnValue(pending.promise);const switcher=vi.spyOn(A,'switchAccessMode').mockReturnValue(true);location.hash='#/projects';const view=render(Live);const control=await view.findByRole('combobox',{name:'Access mode'});await fireEvent.change(control,{target:{value:'global'}});expect(switcher).toHaveBeenCalledWith(actor.principal,'global',expect.anything());expect((view.getByRole('combobox',{name:'Access mode'}) as HTMLSelectElement).disabled).toBe(true);pending.resolve([{id:'private',name:'Old scope private project',role:'owner',response_count:1}]);await tick();await Promise.resolve();expect(view.container.textContent).not.toContain('Old scope private project');
});
it('a confirmed actor change removes the prior admin mode control and private view',async()=>{
 vi.spyOn(S,'me').mockResolvedValue(actor);vi.spyOn(D,'projects').mockResolvedValue([{id:'private',name:'Private project',role:'owner',response_count:1}]);location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Private project'});expect(view.getByRole('combobox',{name:'Access mode'})).toBeTruthy();const next={principal:{...actor.principal,id:'ordinary',super_admin:false}};vi.mocked(S.me).mockResolvedValue(next);vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({ok:true,result:next}))));vi.mocked(D.projects).mockResolvedValue([]);await fireEvent(window,new Event('focus'));await waitFor(()=>expect(view.queryByRole('link',{name:'Private project'})).toBeNull());expect(view.queryByRole('combobox',{name:'Access mode'})).toBeNull();
});
it('a failed preference navigation keeps old data cleared and exposes explicit reload recovery',async()=>{
 vi.spyOn(S,'me').mockResolvedValue(actor);vi.spyOn(D,'projects').mockResolvedValue([{id:'private',name:'Private before switch',role:'owner',response_count:1}]);vi.spyOn(A,'switchAccessMode').mockImplementation(()=>{throw new Error('Synthetic navigation unavailable');});location.hash='#/projects';const view=render(Live);await view.findByRole('link',{name:'Private before switch'});await fireEvent.change(view.getByRole('combobox',{name:'Access mode'}),{target:{value:'global'}});await view.findByRole('alert');expect(view.queryByRole('link',{name:'Private before switch'})).toBeNull();expect((view.getByRole('combobox',{name:'Access mode'}) as HTMLSelectElement).disabled).toBe(true);expect(view.getByRole('button',{name:'Reload to verify access'})).toBeTruthy();expect(vi.mocked(D.projects)).toHaveBeenCalledTimes(1);
});
