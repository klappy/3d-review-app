// Local GET-only synthetic fixtures; verifies real browser menu DOM preservation.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM});const runs=[];
const out=process.env.OUT||'/tmp/menu-in-place';await mkdir(out,{recursive:true});
try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const page=await context.newPage();const reads=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/v2/**',async route=>{const request=route.request(),path=new URL(request.url()).pathname;assert.equal(request.method(),'GET');reads.push(path);const result=path==='/v2/me'?{principal:{id:'synthetic-actor',display_name:'Fixture User',kind:'user',provisioned:true,access_mode:'my'},grants:[]}:path==='/v2/projects'?{projects:[{id:'synthetic-project',name:'Fixture project',organization:'Fixture team',role:'owner',assessment_count:1,response_count:2}]}:null;assert.ok(result,`Unexpected read ${path}`);await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,result})});});
 await page.goto(`${process.env.BASE||'http://127.0.0.1:8796'}/?ui_next=on#/projects`);await page.getByRole('link',{name:'Fixture project',exact:true}).waitFor();
 await page.evaluate(()=>{window.__keptHeading=document.querySelector('h1');window.__keptHeader=document.querySelector('header');});
 for(let i=0;i<3;i++){await page.evaluate(()=>location.hash='#/menu');await page.getByRole('navigation',{name:'Workspace and account'}).waitFor();assert.equal(await page.locator('[data-loading-frame]').count(),0);assert.equal(await page.evaluate(()=>window.__keptHeading===document.querySelector('h1')&&window.__keptHeader===document.querySelector('header')),true);await page.getByRole('button',{name:'Close',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog'));}
 assert.equal(reads.filter(x=>x==='/v2/projects').length,1);assert.equal(await page.evaluate(()=>innerWidth),width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);runs.push({viewport:{width,height:844},cycles:3,destinationReads:1,reads,errors});await context.close();
}}finally{await browser.close();await writeFile(`${out}/menu.json`,JSON.stringify({provenance:'Local Chromium; actual viewport; synthetic GET-only fixtures. No physical installed-PWA evidence.',runs},null,2));}
console.log(JSON.stringify(runs));
