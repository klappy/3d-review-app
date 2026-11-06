import {reportResultErrors} from './report-contract-check';
import {get as getReport} from '../src/handlers/report';
import {form,submit} from '../src/handlers/response';
import {print as printSurvey} from '../src/handlers/survey';
import {list as listTemplates,get as getTemplate,render as renderTemplate} from '../src/handlers/template';
import {parseItems} from '../src/handlers/common';
import {participantReportsAllowed} from '../src/report-admission';
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
 it('admits only DEV or explicitly enabled production',()=>{
  expect(participantReportsAllowed({ENVIRONMENT:'dev'})).toBe(true);
  expect(participantReportsAllowed({ENVIRONMENT:'production',PARTICIPANT_REPORTS:'enabled'})).toBe(true);
  for(const ENVIRONMENT of ['production','staging','DEV','',undefined]) for(const PARTICIPANT_REPORTS of ['', 'on', 'true', 'ENABLED', ' enabled ', undefined])
   expect(participantReportsAllowed({ENVIRONMENT,PARTICIPANT_REPORTS})).toBe(false);
  for(const ENVIRONMENT of ['staging','DEV','',undefined]) expect(participantReportsAllowed({ENVIRONMENT,PARTICIPANT_REPORTS:'enabled'})).toBe(false);
  expect(participantReportsAllowed()).toBe(false);
 });
 it('production opt-in reuses the report and disabling it holds stored reports again',async()=>{
  const enabled={...ctx('production'),env:{ENVIRONMENT:'production',PARTICIPANT_REPORTS:'enabled'}};
  const preview=await store.observeBuildEligibility(enabled,aid);expect(preview.ok&&preview.marker.eligible).toBe(true);
  const r=await store.buildMaterialized(enabled,aid);expect(r.ok).toBe(true);if(!r.ok)return;
  const dev=await store.buildMaterialized(ctx('dev'),aid);expect(dev.ok&&dev.value.payload).toEqual(r.value.payload);
  const got=await store.readMaterialized(enabled,r.value.id);expect(got.ok&&got.value.captureDigest).toBe(r.value.captureDigest);
  const listed=await store.listMaterialized(enabled,aid);expect(listed.ok&&listed.value.reports.map(x=>x.id)).toContain(r.value.id);
  const off=await store.readMaterialized(ctx('production'),r.value.id);expect(off.ok).toBe(false);if(!off.ok)expect(off.reason).toBe('HELD');
  const ungranted={...enabled,principal:{id:'ungranted',kind:'user' as const}};
  const hidden=await store.readMaterialized(ungranted,r.value.id);expect(hidden.ok).toBe(false);if(!hidden.ok)expect(hidden.reason).toBe('NOT_VISIBLE');
 },60000);
 it('production admission retains the five-response floor',async()=>{
  const c=await captureForBuild(ctx(),src);expect(c.eligible).toBe(true);if(!c.eligible)return;
  const rows=c.capture.rows.slice(0,4).map(row=>({...row,responseId:'p_'+row.responseId}));
  expect(await attestCapture(src,rows,participantReportsAllowed({ENVIRONMENT:'production',PARTICIPANT_REPORTS:'enabled'}))).toEqual({eligible:false,reason:'BELOW_MINIMUM'});
 });
});

 it('Decision 25 is shared by existing survey form, print, template render and submission without changing old rows',async()=>{
   const before=(await db.prepare('SELECT * FROM response WHERE assessment_survey_id IN (SELECT id FROM assessment_survey WHERE assessment_id=?) ORDER BY id').bind(aid).all()).results;
   const storedTemplates=(await db.prepare('SELECT * FROM survey_template ORDER BY id,version').all()).results;
   for(const [tid,itemId,text] of [['tpl_validation','TR-Q2','We do not have a translation brief'],['tpl_mid_level','ML-Q2','The team does not have a translation brief']]){
     const existing=await db.prepare('SELECT id FROM assessment_survey WHERE assessment_id=? AND template_id=? AND template_version=2').bind(aid,tid).first<{id:string}>();
     const sid=existing?.id??'amendment_'+tid;
     if(existing)await run("UPDATE assessment_survey SET state='selected',collection_status='open' WHERE id=?",sid);
     else await run("INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) VALUES (?,?,?,2,'selected','open','2026-11-05')",sid,aid,tid);
     const c={...ctx('dev'),env:{...ctx('dev').env,DB:db},traceId:'tr_decision25',log:()=>{},principal:{kind:'participant',id:'decision25_'+tid,respondentId:'decision25_'+tid,participantSurveyId:sid}} as unknown as Ctx;
     const presented=await form(c,{});
     const items=presented.result.items as any[];
     expect(items.find(i=>i.id===itemId).options).toEqual(expect.arrayContaining([expect.objectContaining({code:'no-brief',text})]));
     const member={...c,principal:{kind:'user',id:'person_mara'}} as Ctx;
     const printed=await printSurvey(member,{aid,sid});expect(printed.result.html).toContain(text);
     const catalogue=await listTemplates(member,{});const details=await getTemplate(member,{id:tid,ver:2});
     const entry=(catalogue.result.templates as any[]).find(t=>t.id===tid&&t.version===2);
     expect(entry.instrument_amendment).toBe('605edb47d2280568f0f5860f7b1921c12a814222');
     expect(entry.instrument_amendment).toBe((details.result.template as any).instrument_amendment);
     expect(entry).not.toHaveProperty('items_json');
     const template=await renderTemplate(member,{id:tid,ver:2});expect((template.result.template as any).instrument_amendment).toBe(entry.instrument_amendment);expect((template.result.items as any[]).find(i=>i.id===itemId).options).toEqual(expect.arrayContaining([expect.objectContaining({code:'no-brief',text})]));
     const raw=await db.prepare('SELECT * FROM survey_template WHERE id=? AND version=2').bind(tid).first<any>();
     const full=parseItems(raw),answers=Object.fromEntries(full.map(i=>[i.id,i.type==='text'?'fixture':i.type==='multi'?[i.options![0].code]:i.options![0].code]));answers[itemId]='no-brief';
     const submitted=await submit(c,{idempotency_key:'decision25_'+tid,answers});
     const response=await db.prepare('SELECT * FROM response WHERE id=?').bind(submitted.result.response_id).first<any>();
     expect(JSON.parse(response.answers_json)[itemId]).toBe('no-brief');expect(response.template_version).toBe(2);expect(JSON.parse(response.provenance_json).instrument_amendment).toBe('605edb47d2280568f0f5860f7b1921c12a814222');
     expect((await submit(c,{idempotency_key:'decision25_'+tid,answers})).result.duplicate).toBe(true);
   }
   expect((await db.prepare('SELECT * FROM survey_template ORDER BY id,version').all()).results).toEqual(storedTemplates);
   for(const row of before)expect(await db.prepare('SELECT * FROM response WHERE id=?').bind(row.id).first()).toEqual(row);
 },60000);

 it('production report transport hides the one church status in a 3-team/1-church/1-community snapshot',async()=>{
   const target='assess_decision25_privacy';
   const source=await captureForBuild(ctx(),src);if(!source.eligible)throw new Error('fixture capture unavailable');
   await run('INSERT INTO assessment (id,project_id,language_id,name,purpose,period,format,stage,created_at,created_by) SELECT ?,project_id,language_id,name,purpose,period,format,stage,created_at,created_by FROM assessment WHERE id=?',target,src);
   await run('INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES (?, ?, ?, ?, ?, ?)',target+'_grant','person_mara','assessment',target,'owner','2026-11-05');
   let index=0;
   for(const [templateId,n] of [['tpl_validation',3],['tpl_involved_pastor',1],['tpl_written',1]] as const){
     const example=source.capture.rows.find(r=>r.selectedTemplateId===templateId);if(!example)throw new Error('missing fixture template '+templateId);
     const sid=target+'_'+templateId;
     await run("INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) VALUES (?,?,?,?, 'selected','open','2026-11-05')",sid,target,templateId,example.selectedTemplateVersion);
     const answers=JSON.parse(example.answersRaw);if(templateId==='tpl_validation')answers['TR-Q2']='no-brief';if(templateId==='tpl_involved_pastor')answers['CHIP-Q1']='not-aware';
     for(let i=0;i<n;i++)await run("INSERT INTO response (id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,source,submitted_at) VALUES (?,?,?,?,?,?,?,'participant','2026-11-05')",target+'_r'+index,sid,target+'_respondent'+index,'key'+index++,JSON.stringify(answers),templateId,example.selectedTemplateVersion);
   }
   const c={...ctx('production'),env:{ENVIRONMENT:'production',PARTICIPANT_REPORTS:'enabled'},traceId:'tr_decision25_privacy',log:()=>{}} as unknown as Ctx;
   const built=await store.buildMaterialized(c,target);if(!built.ok)throw new Error('fixture build held');
   expect((built.value.payload as any).translation_type_agreement.church_statuses).toEqual(['not-aware']);
   const disclosed=await getReport(c,{id:built.value.id});expect(reportResultErrors('cap.report.get',disclosed.result)).toEqual([]);
   const visible=(disclosed.result.report as any).payload.translation_type_agreement;
   expect(disclosed.result.level_minimum_responses).toBe(3);
   expect(visible.team_statuses).toEqual(['no-brief']);expect(visible.church_statuses).toEqual([]);expect(visible.church_values).toEqual([]);expect(visible.agree).toBe(null);
   expect(JSON.stringify(disclosed.result)).not.toContain('not-aware');
   // Disclosure never mutates the immutable stored payload or capture.
   const stored=await store.readMaterialized(c,built.value.id);expect(stored.ok&&stored.value.payload).toEqual(built.value.payload);
 },60000);
