// Actual viewport/DOM geometry regression for the bounded Landing + Projects journey.
// Uses GET-only controlled HTTP fixtures: no credentials, backend writes or real participant data.
// BASE=http://127.0.0.1:8796 PLAYWRIGHT_MODULE=<playwright module> CHROMIUM=<binary> OUT=<dir> node scripts/ui-next-acceptance/in-place-loading.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE || 'http://127.0.0.1:8796';
const out = process.env.OUT || '/tmp/in-place-loading-evidence'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), headless: true });
const fixture = [{ id: 'fixture-project-alpha', name: 'Fixture project Alpha', organization: 'Fixture team', role: 'owner', assessment_count: 2, response_count: 6 }, { id: 'fixture-project-beta', name: 'Fixture project Beta', organization: 'Fixture team', role: 'member', assessment_count: 1, response_count: 3 }];
const actor = { principal: { id: 'fixture-actor', display_name: 'Fixture User', kind: 'user', provisioned: true, super_admin: true, access_mode: 'my' } };
const runs=[];
function gate() { let release; const promise=new Promise(r=>release=r); return {promise,release}; }
async function anchors(page, selectors, capture=false) {
 return page.evaluate(({selectors,capture})=>{
  if(capture) window.__loadingNodes={};
  return { viewport:{width:innerWidth,height:innerHeight}, overflow:document.documentElement.scrollWidth>innerWidth,
   anchors:Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{const node=document.querySelector(selector);if(!node)return[key,null];if(capture)window.__loadingNodes[key]=node;const r=node.getBoundingClientRect();return[key,{x:r.x,y:r.y,width:r.width,height:r.height,sameNode:!window.__loadingNodes?.[key]||window.__loadingNodes[key]===node}];}))};
 },{selectors,capture});
}
function shifts(before,after) {return Object.fromEntries(Object.entries(before.anchors).map(([key,r])=>[key,r&&after.anchors[key]?Math.max(...['x','y','width','height'].map(k=>Math.abs(r[k]-after.anchors[key][k]))):null]));}
try {for(const viewport of [{width:390,height:844},{width:1280,height:800}]) for(const family of ['landing','projects']) {
 const context=await browser.newContext({viewport,reducedMotion:'reduce'});const page=await context.newPage();const identity=gate(), data=gate();const errors=[];const requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/v2/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;requests.push({method:req.method(),path});assert.equal(req.method(),'GET','fixture must never write');let result;
  if(path==='/v2/me') {await identity.promise;result=family==='landing'?null:actor;}
  else if(path==='/v2/projects'){await data.promise;result={projects:fixture};}
  else throw new Error(`Unexpected fixture read ${path}`);
  if(path==='/v2/me'&&family==='landing')return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'NOT_AUTHENTICATED',message:'Fixture signed out'}})});
  await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,result})});
 });
 await page.goto(`${base}/?ui_next=on#/${family==='landing'?'':'projects'}`);
 const destination=page.locator(`[data-destination="${family}"]`);await destination.waitFor();
 await page.evaluate(()=>document.fonts.ready);
 const selectors=family==='landing'?{shell:'[data-destination=landing] .app',header:'header',hero:'[data-destination=landing] h1',...(viewport.width>600?{heroGrid:'[data-tpl=hero-landing]',media:'.l-media',perspectives:'[data-destination=landing] section:nth-child(2) .l-grid'}:{faq:'[aria-label="Common questions"]'})}:{shell:'[data-destination=projects] .app',header:'header',heading:'[data-destination=projects] h1',copy:'[data-destination=projects] .l-page>p:first-of-type',search:'input[type=search]',filter:'main select',archive:'.row-opt',firstCard:'[data-project-entry] .l-card'};
 const unknown=await anchors(page,selectors,family==='landing');
 if(family==='landing')await page.screenshot({path:`${out}/${family}-${viewport.width}-pending.png`,fullPage:true});assert.deepEqual(unknown.viewport,viewport);assert.equal(unknown.overflow,false);
 if(family==='projects'){assert.equal(await page.getByRole('searchbox',{name:'Search projects'}).isDisabled(),true);assert.equal(await page.getByRole('combobox',{name:'Access mode'}).count(),0);}
 identity.release();
 if(family==='projects')await page.getByRole('combobox',{name:'Access mode'}).waitFor();
 else await page.waitForFunction(()=>document.querySelector('[data-destination=landing]')?.getAttribute('aria-busy')==='false');
 const pending=family==='landing'?unknown:await anchors(page,selectors,true);
 if(family==='projects'){assert.equal(await destination.getAttribute('aria-busy'),'true');assert.equal(await page.getByRole('status').filter({hasText:'Loading projects…'}).count(),1);assert.equal(await page.locator('.pending-text').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).animationName==='none')),true);}
 if(family==='projects'){await page.screenshot({path:`${out}/${family}-${viewport.width}-pending.png`,fullPage:true});data.release();await page.getByRole('link',{name:'Fixture project Alpha',exact:true}).waitFor();}
 else {
  // Landing's static content resolves as identity resolves, without a data request or manufactured delay.
  data.release();
 }
 const ready=await anchors(page,selectors);const delta=shifts(pending,ready);
 assert.equal(ready.overflow,false);assert.ok(Object.values(ready.anchors).every(r=>r?.sameNode),'actual destination nodes must persist');
 for(const [key,d] of Object.entries(delta)) {assert.notEqual(d,null,`${key} exists`);assert.ok(d<=1,`${family}/${viewport.width}/${key} shifted ${d}px`);}
 assert.equal(await destination.getAttribute('aria-busy'),'false');assert.deepEqual(errors,[]);
 await page.screenshot({path:`${out}/${family}-${viewport.width}-ready.png`,fullPage:true});
 runs.push({family,viewport,unknownIdentity:unknown,verifiedPending:pending,ready,unknownToVerified:shifts(unknown,pending),verifiedToReady:delta,requests,errors});await context.close();
}} finally {await writeFile(`${out}/geometry.json`,JSON.stringify({provenance:'Local Chromium actual viewport; GET-only controlled synthetic fixtures, no credentials or mutations. Unknown identity boundary measured separately; no total-list-height or global CLS claim.',runs},null,2));await browser.close();}
console.log(JSON.stringify(runs.map(r=>({family:r.family,viewport:r.viewport,unknownToVerified:r.unknownToVerified,verifiedToReady:r.verifiedToReady})),null,2));
