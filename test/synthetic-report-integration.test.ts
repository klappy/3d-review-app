import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {beforeAll,beforeEach,afterEach,afterAll,describe,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import * as store from '../src/synthetic-report-store';
import {captureForBuild} from '../src/report-capture';
import {renderSyntheticReport,REPORT_VERSIONS,REPORT_SCHEMA} from '../src/synthetic-report-renderer';
import {canonicalJson} from '../src/report-canonical-json';
import type {Ctx} from '../src/handlers/types';
import {SerialOperation} from './helpers/serial-operation';
import sourceFixture from './fixtures/synthetic-report-renderer-v1.json';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'c2a-real-integration',modules:true,script:"export default {fetch(){return new Response('local synthetic fixture')}}",d1Databases:{DB:'c2a-fixture'}}]}));
let db:D1Database;
const aid='assess_syn_earning-trust-2026-01';
const context=(database=db,id='person_mara',kind:Ctx['principal']['kind']='user')=>({db:database,principal:{id,kind},now:()=>new Date('2026-09-17T07:41:08.000Z')});
const exec=(sql:string,...args:any[])=>db.prepare(sql).bind(...args).run();
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const marker=(eligible:boolean,assessment_id=aid)=>({assessment_id,eligible,policy_version:REPORT_VERSIONS.policy});
const held=(assessment_id=aid)=>({ok:false,reason:'HELD',marker:marker(false,assessment_id)});
const invisible={ok:false,reason:'NOT_VISIBLE'};
const unavailable={ok:false,reason:'UNAVAILABLE'};
const noUpdate="CREATE TRIGGER synthetic_report_no_update BEFORE UPDATE ON synthetic_report BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END";
const noDelete="CREATE TRIGGER synthetic_report_no_delete BEFORE DELETE ON synthetic_report BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END";
function intercept(fn:(sql:string,args:unknown[],method:string,next:()=>Promise<any>)=>Promise<any>):D1Database{
 return {prepare(sql:string){return{bind(...args:unknown[]){const stmt=db.prepare(sql).bind(...args);return Object.fromEntries(['first','all','run'].map(method=>[method,()=>fn(sql,args,method,()=> (stmt as any)[method]())]));}}}} as unknown as D1Database;
}
async function clearReports(){await exec('DROP TRIGGER synthetic_report_no_delete');await exec('DELETE FROM synthetic_report');await exec(noDelete);}
async function restoreResponse(row:Record<string,unknown>){await exec('INSERT INTO response ('+Object.keys(row).join(',')+') VALUES ('+Object.keys(row).map(()=>'?').join(',')+')',...Object.values(row));}
async function capture(id=aid){const c=await captureForBuild(context(),id);if(!c.eligible)throw new Error('fixture capture refused');return c.capture;}
async function report(id=aid){const r=await store.buildMaterialized(context(),id);expect(r.ok,id).toBe(true);if(!r.ok)throw new Error('fixture report refused');return r.value;}
async function alter(id:string,values:Record<string,unknown>){await exec('DROP TRIGGER synthetic_report_no_update');try{await exec('UPDATE synthetic_report SET '+Object.keys(values).map(k=>k+'=?').join(',')+' WHERE id=?',...Object.values(values),id);}finally{await exec(noUpdate);}}
beforeAll(async()=>{
 db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql']){
  const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
  const statements=sql.split(';\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
 }
},60000);
const corpusOperation = new SerialOperation();
// Await timed-out bodies before any subsequent test can clear or reuse the D1 fixture.
beforeEach(() => corpusOperation.drain(),15000);
afterEach(() => corpusOperation.drain(),15000);
afterAll(async () => { try { await corpusOperation.drain(); } finally { await mf.dispose(); } },30000);
describe('real compiled renderer with local D1',()=>{
 describe.sequential('all34/425 corpus with shared coexistence', () => {
  const measurements:any[]=[]; let total=0,max=0,corpusStarted=0;
  beforeAll(async () => { await clearReports(); corpusStarted=performance.now(); });
  Object.keys(sourceFixture.contexts).forEach((id,index) => {
   it(`roundtrips context ${index+1}/34 with exact renderer bytes and tuple key`, () => corpusOperation.run(async () => {
    const contextIndex=index+1; let phaseStarted=0;
    const phaseStart=(phase:string)=>{corpusOperation.assertHealthy();phaseStarted=performance.now();console.log('C2A_PHASE '+JSON.stringify({contextIndex,phase,event:'START',elapsedMs:phaseStarted-corpusStarted}));};
    const phaseEnd=(phase:string)=>{corpusOperation.assertHealthy();const now=performance.now();console.log('C2A_PHASE '+JSON.stringify({contextIndex,phase,event:'END',elapsedMs:now-corpusStarted,durationMs:now-phaseStarted}));};
   phaseStart('capture');
   const c=await capture(id);total+=c.rows.length;max=Math.max(max,c.rows.length);
   phaseEnd('capture');
   phaseStart('expected-render');
   const expected=await renderSyntheticReport(id,c.rows);expect(expected.eligible).toBe(true);if(!expected.eligible)throw new Error('gold render refused');
   phaseEnd('expected-render');
   phaseStart('build');
   const start=performance.now(),r=await report(id),buildMs=performance.now()-start;
   phaseEnd('build');
   expect(canonicalJson(r.payload)).toBe(expected.payloadJson);
   phaseStart('get');
   const readStart=performance.now(),read=await store.readMaterialized(context(),r.id),getMs=performance.now()-readStart;
   phaseEnd('get');
   expect(read.ok).toBe(true);if(read.ok)expect(canonicalJson(read.value.payload)).toBe(expected.payloadJson);
   phaseStart('list');
   const listStart=performance.now(),list=await store.listMaterialized(context(),id),listMs=performance.now()-listStart;
   phaseEnd('list');
   expect(list.ok).toBe(true);if(list.ok){expect(list.value.reports.map(x=>x.id)).toEqual([r.id]);expect(list.value.afterId).toBeNull();}
   phaseStart('repeat-build');
   const again=await report(id);expect(again.id).toBe(r.id);
   phaseEnd('repeat-build');
   phaseStart('raw-row');
   const row=await db.prepare('SELECT * FROM synthetic_report WHERE id=?').bind(r.id).first<any>();
   phaseEnd('raw-row');
   expect(row.payload_json).toBe(expected.payloadJson);expect(row.payload_sha256).toBe(hash(expected.payloadJson));
   expect([row.source_pin,row.index_root,row.scorer_version,row.narrative_version,row.policy_version,row.output_schema_version]).toEqual([sourceFixture.source_commit,'d964f81639e0929ce5f53156b28e3902732b98d2394c6d8dc31c9d14a22fb7dd',REPORT_VERSIONS.scorer,REPORT_VERSIONS.narrative,REPORT_VERSIONS.policy,REPORT_SCHEMA]);
   if(id===aid)expect(row.report_key).toBe('68b602d11a77162f72320c43827d30d33ed9f95fca9dfe5cb07f18905176a52d');
   measurements.push({assessmentId:id,responses:c.rows.length,captureBytes:Buffer.byteLength(c.packedCapture),payloadBytes:Buffer.byteLength(expected.payloadJson),buildMs,getMs,listMs});
   }));
  });
  it('retains all34 reports and exactly425 responses together', async () => {
   expect(measurements).toHaveLength(34);expect(total).toBe(425);expect(max).toBe(23);
   expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(34);
   console.log('C2A_REAL_CORPUS '+JSON.stringify({elapsedMs:performance.now()-corpusStarted,measurements,totalResponses:total,maxValidSameAssessmentResponses:max,runtime:process.version,measurementKind:'local Node plus Miniflare wall time; not Worker CPU or peak memory'}));
  });
 });
 describe('refusal and race regressions', () => {
 beforeEach(clearReports);
 it('refuses rehashed well-typed semantic forgery, not just malformed schema',async()=>{
  const r=await report(),original=await db.prepare('SELECT payload_json,payload_sha256 FROM synthetic_report WHERE id=?').bind(r.id).first<any>();
  const mutations=[
   (p:any)=>{p.unapproved='extra';},(p:any)=>{delete p.evidence;},(p:any)=>{p.assessment_id='other';},
   (p:any)=>{p.source_commit='other';},(p:any)=>{p.schema_version='other';},(p:any)=>{p.synthetic=false;},
   (p:any)=>{p.versions.scorer='other';},(p:any)=>{p.versions.policy='other';},(p:any)=>{p.versions.narrative='other';},
   (p:any)=>{p.lenses[0].score+=1e-9;},(p:any)=>{p.narrative[0]+=' forged';},(p:any)=>{p.evidence[0].n++;},
   (p:any)=>{p.lenses.reverse();},(p:any)=>{p.translation_type_agreement='wrong';},(p:any)=>{p.response_ids=['hidden'];}
  ];
  for(const mutate of mutations){const p=JSON.parse(original.payload_json);mutate(p);const raw=JSON.stringify(p);await alter(r.id,{payload_json:raw,payload_sha256:hash(raw)});expect(await store.readMaterialized(context(),r.id)).toEqual(held());expect(await store.listMaterialized(context(),aid)).toEqual(held());}
  const duplicate='{"schema_version":"wrong",'+original.payload_json.slice(1);await alter(r.id,{payload_json:duplicate,payload_sha256:hash(duplicate)});expect(await store.readMaterialized(context(),r.id)).toEqual(held());
  await alter(r.id,original);expect((await store.readMaterialized(context(),r.id)).ok).toBe(true);
 });
 it('eligible empty, authorized empty capture and invisible target have distinct bounded results',async()=>{
  expect(await store.observeBuildEligibility(context(),aid)).toEqual({ok:true,marker:marker(true)});
  expect(await store.listMaterialized(context(),aid)).toEqual({ok:true,value:{reports:[],afterId:null}});
  const r=await report(),c=await capture(),saved=[];
  for(const row of c.rows)saved.push(await db.prepare('SELECT * FROM response WHERE id=?').bind(row.responseId).first<any>());
  try{
   for(const row of saved)await exec('DELETE FROM response WHERE id=?',row.id);
   const observation=await db.prepare(store.REPORT_OBSERVE_SQL).bind('user',null,aid,'person_mara','member').first<any>();expect(observation).toEqual({assessment_id:aid,current_capture:null});
   expect(await store.observeBuildEligibility(context(),aid)).toEqual({ok:true,marker:marker(false)});
   expect(await store.buildMaterialized(context(),aid)).toEqual(held());expect(await store.readMaterialized(context(),r.id)).toEqual(held());expect(await store.listMaterialized(context(),aid)).toEqual(held());
   for(const ctx of [context(db,'absent'),context(db,'absent','support'),context(db,'person_mara','participant'),context(db,'person_mara','anonymous')]){
    expect(await store.observeBuildEligibility(ctx,aid)).toEqual(invisible);expect(await store.buildMaterialized(ctx,aid)).toEqual(invisible);expect(await store.readMaterialized(ctx,r.id)).toEqual(invisible);expect(await store.listMaterialized(ctx,aid)).toEqual(invisible);
   }
   expect(await store.observeBuildEligibility(context(),'unknown')).toEqual(invisible);expect(await store.readMaterialized(context(),'unknown')).toEqual(invisible);
  }finally{for(const row of saved)await restoreResponse(row);}
 });
 it('preview/get/list markers use the exact before-or-after authoritative observation only',async()=>{
  const r=await report(),c=await capture(),response=c.rows[0];
  const grant=(await db.prepare('SELECT id FROM "grant" WHERE principal_id=? AND scope_type=? AND scope_id=?').bind('person_mara','assessment',aid).first<any>()).id;
  const actions=[
   {invisible:true,change:()=>exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aid),restore:()=>exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aid)},
   {invisible:true,change:()=>exec('UPDATE "grant" SET scope_id=? WHERE id=?','other_scope',grant),restore:()=>exec('UPDATE "grant" SET scope_id=? WHERE id=?',aid,grant)},
   {invisible:false,change:()=>exec('UPDATE response SET answers_json=? WHERE id=?','{}',response.responseId),restore:()=>exec('UPDATE response SET answers_json=? WHERE id=?',response.answersRaw,response.responseId)}
  ];
  for(const action of actions)for(const which of ['preview','get','list'])for(const when of ['before','after']){
   let calls=0;const raced=intercept(async(sql,args,method,next)=>{calls++;if(when==='before')await action.change();const result=await next();if(when==='after')await action.change();return result;});
   try{
    const result=which==='preview'?await store.observeBuildEligibility(context(raced),aid):which==='get'?await store.readMaterialized(context(raced),r.id):await store.listMaterialized(context(raced),aid);
    expect(calls).toBe(1);
    if(when==='after'){expect(result.ok).toBe(true);if(which==='preview')expect(result).toEqual({ok:true,marker:marker(true)});}
    else expect(result).toEqual(action.invisible?invisible:which==='preview'?{ok:true,marker:marker(false)}:held());
   }finally{await action.restore();}
  }
 });
 it('post-write observation distinguishes grant loss, ineligibility and eligible conflict without stale markers',async()=>{
  const c=await capture(),response=c.rows[0];
  for(const action of [
   {expected:invisible,change:()=>exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aid),restore:()=>exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aid)},
   {expected:held(),change:()=>exec('UPDATE response SET answers_json=? WHERE id=?','{}',response.responseId),restore:()=>exec('UPDATE response SET answers_json=? WHERE id=?',response.answersRaw,response.responseId)}
  ]){
   let changed=false;const raced=intercept(async(sql,args,method,next)=>{const result=await next();if(sql===store.REPORT_COMMIT_SQL&&!changed){changed=true;await action.change();}return result;});
   try{expect(await store.buildMaterialized(context(raced),aid)).toEqual(action.expected);expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);}finally{await action.restore();await clearReports();}
  }
  // Captured known subset with no existing row: guard declines after known append,
  // fresh target remains eligible, so exact attempted identity is CONFLICT.
  const saved=await db.prepare('SELECT * FROM response WHERE id=?').bind(response.responseId).first<any>();await exec('DELETE FROM response WHERE id=?',response.responseId);
  let old;try{old=await capture();}finally{await restoreResponse(saved);}
  expect(await store.commitMaterialized(context(),aid,old!)).toEqual({ok:false,reason:'CONFLICT'});
  expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(0);
 });
 it('post-write disclosure observes changes after its SELECT only on the next call',async()=>{
  let reads=0;const raced=intercept(async(sql,args,method,next)=>{const result=await next();if(sql===store.REPORT_BUILD_RESULT_SQL){reads++;await exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aid);}return result;});
  try{const built=await store.buildMaterialized(context(raced),aid);expect(built.ok).toBe(true);expect(reads).toBe(1);if(built.ok)expect(await store.readMaterialized(context(),built.value.id)).toEqual(invisible);}
  finally{await exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aid);}
 });
 it('preview requires member scope and exposes database failure without a marker',async()=>{
  expect(await store.observeBuildEligibility(context(db,'person_mara','support'),aid)).toEqual({ok:true,marker:marker(true)});
  await exec('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_type=? AND scope_id=?','viewer','person_mara','assessment',aid);
  try{expect(await store.observeBuildEligibility(context(),aid)).toEqual(invisible);}finally{await exec('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_type=? AND scope_id=?','owner','person_mara','assessment',aid);}
  const failed=intercept(async()=>{throw new Error('sensitive internal error');});expect(await store.observeBuildEligibility(context(failed),aid)).toEqual(unavailable);
 });
 it('transport loss reports uncertainty and same-capture retry converges; changed capture may create a second key',async()=>{
  const c=await capture(),saved=await db.prepare('SELECT * FROM response WHERE id=?').bind(c.rows[0].responseId).first<any>();
  await exec('DELETE FROM response WHERE id=?',saved.id);
  try{
   let writes=0;const lost=intercept(async(sql,args,method,next)=>{const result=await next();if(sql===store.REPORT_COMMIT_SQL){writes++;throw new Error('response lost after commit');}return result;});
   expect(await store.buildMaterialized(context(lost),aid)).toEqual(unavailable);expect(writes).toBe(1);
   expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);
   const recovered=await report();expect((await report()).id).toBe(recovered.id);
  }finally{await restoreResponse(saved);}
  await report();expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(2);
 });
 it('real original-capture validation preserves known append and validates all six page candidates',async()=>{
  const id='assess_syn_trust-outvoted-expert-2028-01',c=await capture(id),removed:any[]=[];
  expect(c.rows.length).toBe(23);const original=await report(id);
  try{for(const row of c.rows.slice(0,6)){removed.push(await db.prepare('SELECT * FROM response WHERE id=?').bind(row.responseId).first());await exec('DELETE FROM response WHERE id=?',row.responseId);await report(id);}}
  finally{for(const row of removed)await restoreResponse(row);}
  const old=await store.readMaterialized(context(),original.id);expect(old.ok).toBe(true);if(old.ok)expect(old.value.payload).toEqual(original.payload);
  const start=performance.now(),page=await store.listMaterialized(context(),id),localWallMs=performance.now()-start;expect(page.ok).toBe(true);if(!page.ok)return;
  expect(page.value.reports).toHaveLength(5);expect(page.value.afterId).not.toBeNull();
  const second=await store.listMaterialized(context(),id,page.value.afterId);expect(second.ok).toBe(true);if(second.ok){expect(second.value.reports).toHaveLength(2);expect(second.value.afterId).toBeNull();}
  const rows=await db.prepare(store.REPORT_LIST_SQL).bind('user',null,id,'person_mara','viewer',null,6).all<any>();expect(rows.results).toHaveLength(6);
  console.log('C2A_REAL_PAGE '+JSON.stringify({localWallMs,rows:6,originalRenders:6,currentAttestations:1,serializedPageBytes:Buffer.byteLength(JSON.stringify(rows.results)),maxSerializedRowBytes:Math.max(...rows.results.map(r=>Buffer.byteLength(JSON.stringify(r)))),payloadBytes:rows.results.map(r=>Buffer.byteLength(r.payload_json)),d1Meta:rows.meta,notWorkerCPU:true}));
  const sixth=rows.results[5],changed=JSON.parse(sixth.payload_json);changed.narrative.push('forged lookahead');const raw=JSON.stringify(changed);
  await alter(sixth.id,{payload_json:raw,payload_sha256:hash(raw)});expect(await store.listMaterialized(context(),id)).toEqual(held(id));
  await alter(sixth.id,{payload_json:sixth.payload_json,payload_sha256:sixth.payload_sha256});
  const huge=JSON.stringify('\\'.repeat(262143));expect(Buffer.byteLength(huge)).toBe(524288);
  for(const row of rows.results)await alter(row.id,{capture_json:huge,payload_json:huge,payload_sha256:hash(huge)});
  const malformed=await db.prepare(store.REPORT_LIST_SQL).bind('user',null,id,'person_mara','viewer',null,6).all<any>();
  const refusalStart=performance.now();expect(await store.listMaterialized(context(),id)).toEqual(held(id));
  console.log('C2A_MALFORMED_PAGE '+JSON.stringify({rows:malformed.results.length,serializedPageBytes:Buffer.byteLength(JSON.stringify(malformed.results)),maxSerializedRowBytes:Math.max(...malformed.results.map(r=>Buffer.byteLength(JSON.stringify(r)))),refusalLocalWallMs:performance.now()-refusalStart,interpretation:'local transport only, actual platform gate open'}));
 });
 });
});
