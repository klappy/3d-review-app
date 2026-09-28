import test from 'node:test';
import * as v3 from './v3-shell.js';
import assert from 'node:assert/strict';
import { demoApi, sampleParticipantEnvironment, sampleResponses } from './demo.js';
import { createParticipantJourney } from './participate/controller.js';
import { views } from './assess/views.js';
import { routes } from './assess/cards.js';
const esc = x => String(x ?? '');
test('sample assessment uses real Understand module with 12 synthetic responses and inspectable report', async () => {
 const current = await demoApi('/v2/assessments/demo-assessment');
 const ctx = { api: demoApi, current, enc: encodeURIComponent, esc, routes };
 const model = await views.understand.load(ctx, { aid: 'demo-assessment' });
 const html = views.understand.render(ctx, model);
 for (const n of [2,4,6]) assert.match(html, new RegExp(`${n} responses`));
 assert.match(html, /data-open-report="demo-report"/);
 const {report} = await demoApi('/v2/reports/demo-report');
 assert.equal(report.payload.synthetic, true); assert.equal(report.payload.source_commit, 'f042cde553761a6a7f24132cef7802f956378ee0');
 assert.equal(sampleResponses.reduce((n,s)=>n+s.count,0),12);
});
test('demo refuses every mutation and unknown read without network fallback', async () => {
 const original=globalThis.fetch; globalThis.fetch=()=>{throw Error('network must not be called');};
 try { for (const method of ['POST','PATCH','PUT','DELETE']) await assert.rejects(demoApi('/v2/assessments/demo-assessment', {method}), /Nothing is sent or saved/); await assert.rejects(demoApi('/v2/secret'), /demonstration/); } finally { globalThis.fetch=original; }
});
test('all three synthetic responses use real participant start, review, edit, local submit and receipt recovery; reload is isolated', async () => {
 const original=globalThis.fetch; globalThis.fetch=()=>{throw Error('network must not be called');};
 try { for(let i=0;i<3;i++) { const env=sampleParticipantEnvironment(i); const journey=createParticipantJourney(env); await journey.start(); assert.equal(journey.state.phase,'form'); assert.ok(journey.state.form.items.length>=10); journey.save(env.sampleAnswers); journey.review(env.sampleAnswers); assert.equal(journey.state.phase,'review'); journey.edit(); assert.equal(journey.state.phase,'form'); journey.review(env.sampleAnswers); await journey.submit(); assert.equal(journey.state.phase,'receipt'); assert.equal(journey.state.receipt.response_id,'practice-only-not-saved'); const fresh=createParticipantJourney(sampleParticipantEnvironment(i)); await fresh.start(); assert.equal(fresh.state.phase,'form'); assert.equal(fresh.state.draft,null); } } finally { globalThis.fetch=original; }
});
test('actual demo shell strips credential fragments and never reads or changes staff storage', async () => {
 const { readFileSync } = await import('node:fs'); const { runInNewContext } = await import('node:vm');
 const { isDemo, memoryStorage } = await import('./demo.js');
 const source=readFileSync(new URL('./assess/assess.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export function /g,'function ');
 let storageTouches=0; const location={search:'?demo=1',hash:'#session=staff-secret',pathname:'/'};
 const box={ ...v3, isDemo, memoryStorage, demoApi, document:{getElementById:()=>null}, location, history:{replaceState:(_,__,url)=>{location.hash=url.slice(url.indexOf('#'));}}, get sessionStorage(){storageTouches++;throw Error('Demo touched staff storage');} };
 const shell=runInNewContext(source+'\n({scrubCredentialHash,setToken,api})',box);
 shell.scrubCredentialHash(); assert.equal(location.hash,'#assessment/demo-assessment/collect');
 shell.setToken('another-secret'); await shell.api('/v2/me'); await assert.rejects(shell.api('/v2/auth/session',{method:'DELETE'})); assert.equal(storageTouches,0);
});
