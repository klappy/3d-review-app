// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,cleanup,waitFor} from '@testing-library/svelte';
import Live from '../ui-next/src/app/Live.svelte';
import {forget} from '../ui-next/src/app/session.js';
afterEach(()=>{cleanup();forget();vi.unstubAllGlobals();history.replaceState({},'','/');});
for(const width of ['phone','desktop'])it(`live default consumes top-level dark/${width}, and hash theme wins`,async()=>{
 history.replaceState({},'',`/next/?ui_next=on&theme=dark&w=${width}`);
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({ok:false,error:{code:'NOT_AUTHENTICATED',message:'Fixture signed out'}}),{status:401,headers:{'content-type':'application/json'}})));
 const v=render(Live);
 await waitFor(()=>expect(v.container.querySelector('.app')?.getAttribute('data-theme')).toBe('dark'));
 expect(v.container.querySelector('.app')?.getAttribute('data-w')).toBe(width==='phone'?'phone':null);
 location.hash='/welcome?theme=light';window.dispatchEvent(new HashChangeEvent('hashchange'));
 await waitFor(()=>expect(v.container.querySelector('.app')?.getAttribute('data-theme')).toBe('light'));
 expect(v.container.querySelector('.app')?.getAttribute('data-w')).toBe(width==='phone'?'phone':null);
});
