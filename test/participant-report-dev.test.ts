import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import * as store from '../src/synthetic-report-store';
import {captureForBuild} from '../src/report-capture';
import {attestCapture} from '../src/report-attestation';
import {renderSyntheticReport,REPORT_SCHEMA} from '../src/synthetic-report-renderer';
import type {Ctx} from '../src/handlers/types';
// Captain ruling 2026-09-24 15:03: participant-source responses build reports on DEV only.
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'participant-report-dev',modules:true,script:"export default {fetch(){return new Response('x')}}",d1Databases:{DB:'participant-fixture'}}]}));
let db:D1Database;
const src='assess_syn_earning-trust-2026-01', aid='assess_participant_clone';
const ctx=(env?:string)=>({db,principal:{id:'person_mara',kind:'user' as Ctx['principal']['kind']},now:()=>new Date('2026-09-24T19:10:00.000Z'),...(env===undefined?{}:{env:{ENVIRONMENT:env}})});
const run=(sql:string,...a:unknown[])=>db.prepare(sql).bind(...a).run();
beforeAll(async()=>{
 db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql']){
  const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
  const statements=sql.split(';\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
 }
 await run(`INSERT INTO assessment (id,project_id,language_id,name,purpose,period,format,stage,created_at,created_by) SELECT ?1,project_id,language_id,name||' (participant)',purpose,period,format,stage,created_at,created_by FROM assessment WHERE id=?2`,aid,src);
 await run(`INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) SELECT 'p_'||id,principal_id,scope_type,?1,role,created_at FROM "grant" WHERE scope_type='assessment' AND scope_id=?2`,aid,src);
 await run(`INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) SELECT 'p_'||id,?1,template_id,template_version,state,collection_status,created_at FROM assessment_survey WHERE assessment_id=?2`,aid,src);
 await run(`INSERT INTO response (id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,source,submitted_at) SELECT 'p_'||r.id,'p_'||r.assessment_survey_id,'pseudo_'||r.respondent_id,r.idempotency_key,r.answers_json,r.template_id,r.template_version,'participant',r.submitted_at FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=?1`,src);
},60000);
afterAll(()=>mf.dispose());
describe('participant-source reports (DEV only)',()=>{
 it('holds participant-only builds outside dev (production, unknown, missing)',async()=>{
  for(const env of ['production','','DEV',undefined]){
   const r=await store.buildMaterialized(ctx(env),aid);expect(r.ok).toBe(false);if(!r.ok)expect(r.reason).toBe('HELD');
  }
  expect((await captureForBuild(ctx(),aid)).eligible).toBe(false);
 },60000);
 it('builds, reads and lists a participant-only report on dev with the same report shape',async()=>{
  const r=await store.buildMaterialized(ctx('dev'),aid);expect(r.ok).toBe(true);if(!r.ok)return;
  expect((r.value.payload as {schema?:string}).schema??REPORT_SCHEMA).toBe(REPORT_SCHEMA);
  const syn=await store.buildMaterialized(ctx(),src);expect(syn.ok).toBe(true);if(!syn.ok)return;
  expect(Object.keys(r.value.payload as object).sort()).toEqual(Object.keys(syn.value.payload as object).sort());
  const got=await store.readMaterialized(ctx('dev'),r.value.id);expect(got.ok&&got.value.captureDigest).toBe(r.value.captureDigest);
  const listed=await store.listMaterialized(ctx('dev'),aid);expect(listed.ok&&listed.value.reports.map(x=>x.id)).toEqual([r.value.id]);
  const again=await store.buildMaterialized(ctx('dev'),aid);expect(again.ok&&again.value.id).toBe(r.value.id);
  // Stored participant report stays held when read outside dev.
  const prod=await store.readMaterialized(ctx('production'),r.value.id);expect(prod.ok).toBe(false);
 },60000);
 it('refuses a mixed synthetic+participant capture and leaves the synthetic path unchanged',async()=>{
  const c=await captureForBuild(ctx(),src);expect(c.eligible).toBe(true);if(!c.eligible)return;
  const rows=c.capture.rows.map((row,i)=>i===0?{...row,responseId:'p_'+row.responseId}:{...row});
  expect(await attestCapture(src,rows,true)).toEqual({eligible:false,reason:'MIXED_SOURCE'});
  expect((await attestCapture(src,rows)).eligible).toBe(false);
  const plain=await attestCapture(src,c.capture.rows),dev=await attestCapture(src,c.capture.rows,true);
  expect(dev).toEqual(plain);expect(plain.eligible).toBe(true);
  expect((await renderSyntheticReport(src,c.capture.rows,true))).toEqual(await renderSyntheticReport(src,c.capture.rows));
 },60000);
});
