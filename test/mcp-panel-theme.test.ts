import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const { JSDOM } = createRequire(import.meta.url)('jsdom');
const source = readFileSync(new URL('../ui/mcp/panel-src.html', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function mountPanelTheme('), source.indexOf('const panelTheme ='));
function fixture({ osDark=false, hostTheme, saved, denied=false }: any = {}) {
 const dom=new JSDOM('<select id="panel-theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>',{runScripts:'outside-only',url:'https://panel.test'});
 const timers=new Map<number,Function>(); let timerId=0; dom.window.setTimeout=(fn:Function)=>{timers.set(++timerId,fn);return timerId;}; dom.window.clearTimeout=(id:number)=>{timers.delete(id);};
 const listeners=new Set<Function>(); const media={matches:osDark,addEventListener:(_:string,f:Function)=>listeners.add(f),removeEventListener:(_:string,f:Function)=>listeners.delete(f)};
 dom.window.matchMedia=()=>media;
 if(saved)dom.window.localStorage.setItem('3d-review:mcp-theme',saved);
 if(denied)Object.defineProperty(dom.window,'localStorage',{get(){throw Error('storage denied');}});
 let calls=0; const app:any={getHostContext:()=>({theme:hostTheme}),callServerTool:()=>{calls++;throw Error('Theme must not call tools');}};
 dom.window.app=app; dom.window.eval(helper+'\nwindow.theme=mountPanelTheme(window.app,document,window);');
 const root=dom.window.document.documentElement, select=dom.window.document.querySelector('select');
 return {dom,app,root,select,timers,expire(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());},ready:()=>dom.window.theme.ready(),calls:()=>calls,listeners,setOS(v:boolean){media.matches=v;listeners.forEach(f=>f());},choose(v:string){select.value=v;select.dispatchEvent(new dom.window.Event('change'));}};
}
it('initial host theme wins over OS; pending presentation waits for host initialization',()=>{
 for(const theme of ['light','dark']){const h=fixture({hostTheme:theme,osDark:theme==='light'});expect(h.root.dataset.themePending).toBe('true');h.ready();expect(h.root.dataset.theme).toBe(theme);expect(h.root.dataset.themePending).toBeUndefined();expect(h.calls()).toBe(0);}
});
it('live host changes preserve current unrelated context and update without tool calls',()=>{
 const h=fixture({hostTheme:'light'});h.ready();h.app.onhostcontextchanged({theme:'dark'});expect(h.root.dataset.theme).toBe('dark');h.app.onhostcontextchanged({locale:'en-US'});expect(h.root.dataset.theme).toBe('dark');expect(h.calls()).toBe(0);
});
it('absent host preference follows OS and its changes, but OS cannot override host theme',()=>{
 const h=fixture({osDark:true});h.ready();expect(h.root.dataset.theme).toBe('dark');h.setOS(false);expect(h.root.dataset.theme).toBe('light');h.app.onhostcontextchanged({theme:'dark'});h.setOS(false);expect(h.root.dataset.theme).toBe('dark');h.app.onhostcontextchanged({theme:undefined});expect(h.root.dataset.theme).toBe('light');
});
it('explicit selection wins and persists; System restores host then OS precedence',()=>{
 const h=fixture({hostTheme:'dark'});h.ready();h.choose('light');h.app.onhostcontextchanged({theme:'dark'});h.setOS(true);expect(h.root.dataset.theme).toBe('light');expect(h.dom.window.localStorage.getItem('3d-review:mcp-theme')).toBe('light');h.choose('system');expect(h.root.dataset.theme).toBe('dark');expect(h.dom.window.localStorage.getItem('3d-review:mcp-theme')).toBeNull();const resumed=fixture({hostTheme:'light',saved:'dark'});resumed.ready();expect(resumed.root.dataset.theme).toBe('dark');
});
it('storage denial and invalid saved choices are safe; teardown stops future mutations',()=>{
 for(const opts of [{denied:true},{saved:'untrusted'}]){const h=fixture(opts);h.ready();h.choose('dark');expect(h.root.dataset.theme).toBe('dark');h.choose('system');expect(h.app.onteardown()).toEqual({});expect(h.listeners.size).toBe(0);h.app.onhostcontextchanged({theme:'dark'});h.setOS(true);expect(h.root.dataset.theme).toBe('light');expect(h.calls()).toBe(0);}
});
it('production build embeds shared dark tokens and pending styles instead of external resources',()=>{
 const html=readFileSync(new URL('../src/mcp-panel.html',import.meta.url),'utf8');expect(html).toContain('[data-theme="dark"]');expect(html).toContain('--ink: #edf5fc');expect(html).toMatch(/<html lang="en" data-theme-pending/);expect(html).toContain(':root[data-theme-pending] body { visibility:hidden; animation:theme-pending-reveal 0s 2s forwards; }');expect(html).toContain('@keyframes theme-pending-reveal { to { visibility:visible; } }');expect(html).toContain('panelTheme.ready()');expect(html).not.toMatch(/<link[^>]+theme\.css/);
});

it('a never-settled host connection reveals OS fallback and still accepts a late host theme',()=>{
 const h=fixture({osDark:true});
 expect(h.root.dataset.themePending).toBe('true');expect(h.root.dataset.theme).toBe('dark');
 h.expire();expect(h.root.dataset.themePending).toBeUndefined();expect(h.calls()).toBe(0);
 h.app.onhostcontextchanged({theme:'light'});expect(h.root.dataset.theme).toBe('light');h.ready();expect(h.timers.size).toBe(0);h.dom.window.close();
});
it('host readiness and teardown clear the reveal timer',()=>{
 const h=fixture();h.ready();expect(h.timers.size).toBe(0);h.dom.window.close();
 const gone=fixture();gone.app.onteardown();expect(gone.timers.size).toBe(0);gone.expire();expect(gone.root.dataset.themePending).toBe('true');gone.dom.window.close();
});
