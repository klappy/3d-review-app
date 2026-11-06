import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {buildMaterialized,readMaterialized,listMaterialized,REPORT_COMMIT_SQL,REAL_RENDERER} from '../src/synthetic-report-store';
import {attestSelectionCapture,B1_CAPTURE_SQL,SELECTION_CAPTURE_SCHEMA} from '../src/report-capture';
import {deselect,select} from '../src/handlers/survey';
import {canonicalJson} from '../src/report-canonical-json';
import {ATTESTATION_TRUST} from '../src/synthetic-attestation-trust';
import {REPORT_SCHEMA,REPORT_VERSIONS} from '../src/synthetic-report-renderer';
import {storedReportDocument} from '../ui/pdf/report-formats.js';
import {liveReport} from '../ui-next/src/app/data.js';
import {lensCards,bandRows,radar,useLevelMinimum,REPORT} from '../ui-next/src/screens/results/data.js';
import type {Ctx} from '../src/handlers/types';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'selection',modules:true,script:"export default {fetch(){return new Response('x')}}",d1Databases:{DB:'selection'}}]}));
let db:D1Database;
const source='assess_syn_earning-trust-2026-01';
const ctx=(database=db):Ctx=>({db:database,env:{DB:database,ENVIRONMENT:'dev',PARTICIPANT_REPORTS:'enabled'} as Ctx['env'],principal:{id:'person_mara',kind:'user'},now:()=>new Date('2026-11-06T01:00:00Z'),log:()=>{},traceId:'fixture-selection'});
const run=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args).run();
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
async function clone(aid:string){
 await run(`INSERT INTO assessment (id,project_id,language_id,name,purpose,period,format,stage,created_at,created_by) SELECT ?1,project_id,language_id,name,purpose,period,format,stage,created_at,created_by FROM assessment WHERE id=?2`,aid,source);
 await run(`INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) SELECT ?1||id,principal_id,scope_type,?1,role,created_at FROM "grant" WHERE scope_type='assessment' AND scope_id=?2`,aid,source);
 await run(`INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) SELECT ?1||id,?1,template_id,template_version,state,collection_status,created_at FROM assessment_survey WHERE assessment_id=?2`,aid,source);
 await run(`INSERT INTO response (id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,source,submitted_at) SELECT ?1||r.id,?1||r.assessment_survey_id,?1||r.respondent_id,?1||r.idempotency_key,r.answers_json,r.template_id,r.template_version,'participant',r.submitted_at FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=?2 AND r.template_id='tpl_written' ORDER BY r.id LIMIT 1`,aid,source);
}
async function make(aid:string,database=db){const r=await buildMaterialized(ctx(database),aid);expect(r.ok).toBe(true);if(!r.ok)throw new Error(JSON.stringify(r));return r.value;}
async function survey(aid:string,tid:string){return (await db.prepare('SELECT id FROM assessment_survey WHERE assessment_id=? AND template_id=?').bind(aid,tid).first<{id:string}>())!.id;}
beforeAll(async()=>{
 db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql','migrations/0011_context.sql']){
  const statements=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';\n').map(s=>s.trim()).filter(Boolean);
  for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
 }
},60000);
afterAll(()=>mf.dispose());
it('keeps saved radar zero-response notes stable against live counts, and labels known absence precisely',()=>{
 const payload=structuredClone(REPORT.desktop.payload) as any;
 payload.report_selection={schema:'3d-report-selection-v1',selected_perspectives:['Translation Team','Community','Church']};
 payload.lenses=payload.lenses.filter((x:any)=>x.lens!=='church');payload.evidence=payload.evidence.filter((x:any)=>!x.label.startsWith('church'));
 for(const row of [...payload.cross_lens_multi,...(payload.cross_lens_single??[])])row.lens_scores=row.lens_scores.filter((x:any)=>x.lens!=='church');
 const report={payload,sent:['team','community','church'],selectionKnown:true};
 const names=payload.cross_lens_multi.map((x:any)=>x.construct_name);useLevelMinimum(1);
 const a=radar(report,names,{}),b=radar(report,names,{church:20});
 expect(a).not.toBeNull();expect(a.notes).toEqual(b.notes);expect(a.notes).toContain('Church more input needed');
 const absent={...report,sent:['team','community'],payload:{...payload,report_selection:{...payload.report_selection,selected_perspectives:['Translation Team','Community']}}};
 expect(radar(absent,names,{church:20}).notes).toContain('Church not selected at report capture');
});
it('captures selected-zero facts, reuses identical/closed input, binds selection-only changes, and preserves saved presentation',async()=>{
 const aid='selection_identity';await clone(aid);const original=await make(aid);
 expect((original.payload as any).report_selection).toEqual({schema:'3d-report-selection-v1',selected_perspectives:['Church','Community','Translation Team']});
 expect(JSON.stringify(original.payload)).not.toContain('assessment_survey_id');
 await run("UPDATE assessment_survey SET collection_status='closed' WHERE assessment_id=?",aid);
 expect((await make(aid)).id).toBe(original.id);
 const sid=await survey(aid,'tpl_involved_pastor');
 // Unused deselection deletes rather than archives, exactly as the handler specifies.
 expect((await deselect(ctx(),{aid,sid})).result).toMatchObject({deselected:true});
 const changed=await make(aid);expect(changed.reportKey).not.toBe(original.reportKey);expect(changed.captureDigest).toBe(original.captureDigest);
 expect((changed.payload as any).report_selection.selected_perspectives).toEqual(['Community','Translation Team']);
 expect(await readMaterialized(ctx(),original.id)).toMatchObject({ok:true,value:{payload:original.payload}});
 for(const phone of [false,true]){
  const a=liveReport({payload:original.payload,sent:[],counts:{},reportId:original.id},{phone,screen:'report-detailed'});
  const b=liveReport({payload:original.payload,sent:['community'],counts:{},reportId:original.id},{phone,screen:'report-detailed'});
  expect(a).toEqual(b);expect(a.selectionKnown).toBe(true);expect(a.sent).toEqual(['team','community','church']);
  expect(lensCards(a.payload,{}, {sent:a.sent}).filter((x:any)=>x.absent).map((x:any)=>x.label).sort()).toEqual(['Church','Translation team']);
  useLevelMinimum(1);
  const names=[...(a.payload as any).cross_lens_multi,...(a.payload as any).cross_lens_single].map((x:any)=>x.construct_name);
  const absent=(counts:any)=>bandRows(a,counts,names).map((x:any)=>x.notes.filter((n:string)=>n.startsWith('Church ')||n.startsWith('Translation team ')));
  expect(absent({})).toEqual(absent({church:8,team:9}));
  expect(absent({}).flat().some((n:string)=>n==='Church more input needed')).toBe(true);
  expect(radar(a,names,{church:8,team:9})?.notes).toEqual(radar(a,names,{})?.notes);
 }
 for(const format of ['overview','detailed','full']){
  const saved={suppressed:false,report:{id:original.id,payload:original.payload,created_at:original.createdAt}};
  const before=storedReportDocument(saved,{minimum:1,format});
  await run("UPDATE assessment_survey SET collection_status='open' WHERE assessment_id=?",aid);
  const reread=await readMaterialized(ctx(),original.id);if(!reread.ok)throw new Error('held');
  expect(storedReportDocument({...saved,report:{...saved.report,payload:reread.value.payload}},{minimum:1,format})).toBe(before);
  if(format!=='full')expect(before).toContain('More input needed');
 }
});
it('archives zero-response surveys with codes and responding surveys without dropping scores; reselect restores selection',async()=>{
 const aid='selection_archive';await clone(aid);const church=await survey(aid,'tpl_involved_pastor'),community=await survey(aid,'tpl_written');
 await run("INSERT INTO access_code(id,assessment_survey_id,code_hash,created_at) VALUES(?,?,?,?)",'selection_code',church,'fixture-only-code-hash','2026-11-06');
 const before=await make(aid);
 expect((await deselect(ctx(),{aid,sid:church})).result).toMatchObject({archived:true,preserved_responses:0,preserved_codes:1});
 expect((await deselect(ctx(),{aid,sid:community})).result).toMatchObject({archived:true,preserved_responses:1});
 const archived=await make(aid);expect(archived.captureDigest).toBe(before.captureDigest);
 expect((archived.payload as any).lenses).toEqual((before.payload as any).lenses);
 expect((archived.payload as any).report_selection.selected_perspectives).toEqual(['Translation Team']);
 await select(ctx(),{aid,template_id:'tpl_involved_pastor',version:2});
 expect(await survey(aid,'tpl_involved_pastor')).toBe(church);
 expect((await make(aid)).payload).toMatchObject({report_selection:{selected_perspectives:['Church','Translation Team']}});
 // Known empty selection still permits captured archived responses; no score is fabricated or removed.
 const team=await survey(aid,'tpl_validation');await deselect(ctx(),{aid,sid:team});await deselect(ctx(),{aid,sid:church});
 const empty=await make(aid);expect((empty.payload as any).report_selection.selected_perspectives).toEqual([]);
 expect((empty.payload as any).lenses).toEqual((before.payload as any).lenses);
});
it('rejects a selection-only change between observe and INSERT, without committing mixed-time evidence',async()=>{
 const aid='selection_race';await clone(aid);let intercepted=false;
 const racing={prepare(sql:string){return {bind(...args:unknown[]){const stmt=db.prepare(sql).bind(...args);return Object.fromEntries(['first','all','run'].map(method=>[method,async()=>{
  if(sql===REPORT_COMMIT_SQL&&!intercepted){intercepted=true;await run("UPDATE assessment_survey SET state='archived',archived_at='2026-11-06',collection_status='closed' WHERE assessment_id=? AND template_id='tpl_involved_pastor'",aid);}
  return (stmt as any)[method]();
 }]))}}}} as unknown as D1Database;
 expect(await buildMaterialized(ctx(racing),aid)).toEqual({ok:false,reason:'CONFLICT'});
 expect((await db.prepare('SELECT count(*) n FROM synthetic_report WHERE assessment_id=?').bind(aid).first<any>()).n).toBe(0);
 expect((await make(aid)).payload).toMatchObject({report_selection:{selected_perspectives:['Community','Translation Team']}});
});
it('keeps exact legacy key/payload readable and unknown; refuses corrupt, unknown, oversized and mismatched envelopes',async()=>{
 const aid='selection_legacy';await clone(aid);const raw=await db.prepare(B1_CAPTURE_SQL).bind('user',null,aid,'person_mara','member').first<{capture_json:string}>();if(!raw)throw new Error('missing capture');
 // captureForBuild is the unchanged B1 synthetic-only path. Use the same response bytes with explicit participant admission.
 const {attestPackedCapture}=await import('../src/report-capture');
 const legacy=await attestPackedCapture(aid,raw.capture_json,true,1);if(!legacy.eligible)throw new Error('held');
 const payload=await REAL_RENDERER.render(legacy.capture),bytes=canonicalJson(payload);
 const tuple={sourcePin:ATTESTATION_TRUST.sourcePin,indexRoot:ATTESTATION_TRUST.indexRoot,scorerVersion:REPORT_VERSIONS.scorer,narrativeVersion:REPORT_VERSIONS.narrative,policyVersion:REPORT_VERSIONS.policy,outputSchemaVersion:REPORT_SCHEMA};
 const key=sha('3d-materialized-report-v1\0'+canonicalJson({schema:'3d-materialized-report-key-v1',assessmentId:aid,captureDigest:legacy.capture.captureDigest,...tuple}));
 await run('INSERT INTO synthetic_report VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)','selection_old',aid,key,legacy.capture.captureDigest,tuple.indexRoot,tuple.sourcePin,tuple.scorerVersion,tuple.narrativeVersion,tuple.policyVersion,tuple.outputSchemaVersion,legacy.capture.packedCapture,bytes,sha(bytes),'2026-11-05','person_mara');
 const old=await readMaterialized(ctx(),'selection_old');expect(old).toMatchObject({ok:true,value:{reportKey:key,payload}});
 expect((payload as any).report_selection).toBeUndefined();expect(liveReport({payload,sent:['church'],counts:{}},{screen:'report'}).selectionKnown).toBe(false);
 const current=await make(aid);const stored=await db.prepare('SELECT capture_json FROM synthetic_report WHERE id=?').bind(current.id).first<any>();
 // Invalid current selection must not hide otherwise eligible old or new saved reports.
 await run("UPDATE assessment_survey SET archived_at='2026-11-06' WHERE assessment_id=? AND template_id='tpl_involved_pastor'",aid);
 expect((await readMaterialized(ctx(),'selection_old')).ok).toBe(true);expect((await readMaterialized(ctx(),current.id)).ok).toBe(true);
 expect((await listMaterialized(ctx(),aid)).ok).toBe(true);expect((await buildMaterialized(ctx(),aid)).ok).toBe(false);
 const envelope=JSON.parse(stored.capture_json);
 const cases=[['unknown',...envelope.slice(1)], [SELECTION_CAPTURE_SCHEMA,'wrong',...envelope.slice(2)], [...envelope.slice(0,3),[...envelope[3],envelope[3][0]]], [...envelope.slice(0,3),[[...envelope[3][0].slice(0,4),'wrong',envelope[3][0][5]]]], 'x'.repeat(524289)];
 for(const value of cases)expect((await attestSelectionCapture(aid,typeof value==='string'?value:JSON.stringify(value),true,1)).eligible).toBe(false);
});
