import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {list as responseList} from '../src/handlers/response';
import {summary} from '../src/handlers/results';
import {build,get as reportGet,list as reportList} from '../src/handlers/report';
import app from '../src/index';
import {JSDOM} from 'jsdom';
import {renderReport as renderCurrentReport} from '../ui/report-view.js';
import {mintSession} from '../src/auth';
import type {Ctx} from '../src/handlers/types';
import {participantReportMinimum,perspectiveLevelMinimum,translationAgreementMinimum} from '../src/report-admission';
import {storedReportDocument} from '../ui/pdf/report-formats.js';
import {lensRespondents} from '../ui/report-lenses.js';
import {perspectiveRadarModels} from '../ui/report-perspective-radar.js';
import {radarModel} from '../ui/report-radar.js';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'summit-one-response',modules:true,script:"export default {fetch(){return new Response('x')}}",d1Databases:{DB:'summit-one-response'}}]}));
let db:D1Database;
const src='assess_syn_earning-trust-2026-01', one='assess_s28_one', full='assess_s28_full', zero='assess_s28_zero', three='assess_s28_three';
// production (reports enabled) keeps the five-response floor; DEV's floor is one response (report-admission.ts participantReportMinimum).
const ctx=(ENVIRONMENT='dev'):Ctx=>({env:{DB:db,SESSION_SECRET:'s28-test',ENVIRONMENT,PARTICIPANT_REPORTS:'enabled'} as unknown as Ctx['env'],db,principal:{id:'person_mara',kind:'user'},traceId:'tr_s28',now:()=>new Date('2026-09-30T16:00:00.000Z'),log:()=>{}});
const run=(sql:string,...a:unknown[])=>db.prepare(sql).bind(...a).run();
async function clone(aid:string,limit:number,template:string|null=null){
 await run(`INSERT INTO assessment (id,project_id,language_id,name,purpose,period,format,stage,created_at,created_by) SELECT ?1,project_id,language_id,name||' (participant)',purpose,period,format,stage,created_at,created_by FROM assessment WHERE id=?2`,aid,src);
 await run(`INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) SELECT ?1||id,principal_id,scope_type,?1,role,created_at FROM "grant" WHERE scope_type='assessment' AND scope_id=?2`,aid,src);
 await run(`INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) SELECT ?1||id,?1,template_id,template_version,state,collection_status,created_at FROM assessment_survey WHERE assessment_id=?2`,aid,src);
 await run(`INSERT INTO response (id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,source,submitted_at) SELECT ?1||r.id,?1||r.assessment_survey_id,?1||r.respondent_id,?1||r.idempotency_key,r.answers_json,r.template_id,r.template_version,'participant',r.submitted_at FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=?2 AND (?4 IS NULL OR r.template_id=?4) ORDER BY r.id LIMIT ?3`,aid,src,limit,template);
}
beforeAll(async()=>{
 db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql','migrations/0011_context.sql','migrations/0012_translation.sql','migrations/0013_passages.sql']){
  const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
  const statements=sql.split(';\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
 }
 await clone(one,1);await clone(zero,0);
},60000);
afterAll(()=>mf.dispose());
const reports=async(aid:string)=>Number((await db.prepare('SELECT count(*) AS n FROM synthetic_report WHERE assessment_id=?').bind(aid).first<{n:number}>())?.n);

const summit=():Ctx=>{const c=ctx('production');return {...c,env:{...c.env,SUMMIT_ONE_RESPONSE_REPORTS:'enabled'}}};
it('Summit override is exact, known-environment only, reversible, and does not lower categorical disclosure',()=>{
 for(const flag of [undefined,'disabled','true','ENABLED',' enabled ']){
  const env={ENVIRONMENT:'production',SUMMIT_ONE_RESPONSE_REPORTS:flag};expect(participantReportMinimum(env)).toBe(5);expect(perspectiveLevelMinimum(env)).toBe(3);
 }
 for(const ENVIRONMENT of ['staging','PRODUCTION','',undefined]){
  const env={ENVIRONMENT,SUMMIT_ONE_RESPONSE_REPORTS:'enabled'};expect(participantReportMinimum(env)).toBe(5);expect(perspectiveLevelMinimum(env)).toBe(3);
 }
 expect(participantReportMinimum(summit().env)).toBe(1);expect(perspectiveLevelMinimum(summit().env)).toBe(1);expect(translationAgreementMinimum(summit().env)).toBe(3);
});
it('actual single-response D1 capture builds, reads, lists, and renders Overview/Detailed/full PDF source without changing scores',async()=>{
 const c=summit();
 expect((await summary(c,{aid:one})).result).toMatchObject({report_build_allowed:true,level_minimum_responses:1});
 expect((await build(c,{aid:one},{dryRun:true})).result.status).toBe('ready');
 const made:any=(await build(c,{aid:one})).result;expect(made.suppressed).toBe(false);expect(made.report).toBeTruthy();
 const got:any=(await reportGet(c,{id:made.report.id})).result;expect(got.suppressed).toBe(false);expect(got.level_minimum_responses).toBe(1);
 expect((await reportList(c,{aid:one})).result.reports).toHaveLength(1);
 expect((await responseList(c,{aid:one})).result.responses).toEqual([]);
 expect(got.report.payload.translation_type_agreement).toBeNull();
 const payload=got.report.payload;expect(payload.lenses.length).toBe(1);expect([...lensRespondents(payload).values()]).toEqual([1]);
 const before=JSON.stringify(got);
 const out=process.env.SUMMIT_EVIDENCE,chrome=process.env.PDF_LOCAL_CHROME;
 const session=await mintSession(c.env,'person_mara','user');
 // The current interface consumes this same authenticated GET and served minimum. Preserve its design while proving one-response content.
 const currentRead=await app.fetch(new Request(`https://local.invalid/v2/reports/${made.report.id}`,{headers:{authorization:`Bearer ${session}`}}),c.env);
 expect(currentRead.status).toBe(200);const current=(await currentRead.json() as any).result;
 expect(current.level_minimum_responses).toBe(1);
 const currentDoc=new JSDOM('<html><body><main></main></body></html>').window.document,currentRoot=currentDoc.querySelector('main')!;
 expect(renderCurrentReport({doc:currentDoc,root:currentRoot,report:current.report,minimum:current.level_minimum_responses})).toBe(true);
 expect(currentRoot.textContent).toContain('1 response');
 expect(currentRoot.querySelector('.report-lens-score')?.textContent).toBe(String(payload.lenses[0].score));
 expect(currentRoot.querySelector('[data-perspective-radar]')).toBeNull();
 let rendered=0;
 for(const format of ['overview','detailed','full']){
  const html=storedReportDocument(got,{minimum:got.level_minimum_responses,format,identity:{title:'One-response local fixture'}});
  expect(html).toContain('<html');expect(html).not.toContain('NaN');
  if(format !== 'overview'){expect(html).toContain('data-perspective-radar');expect(html).toContain('Community subdimensions');expect(html).toContain('<polygon');}
  const browser={quickAction:async (_:string,options:any)=>{
   rendered++;expect(options.html).not.toContain('answersRaw');
   if(format!=='overview')expect(options.html).toContain('data-perspective-radar');
   if(out){mkdirSync(out,{recursive:true});const path=`${out}/one-response-${format}`;writeFileSync(path+'.html',options.html);
    if(chrome){execFileSync(chrome,['--headless','--no-sandbox','--disable-crash-reporter',`--user-data-dir=${out}/chrome-profile`,'--no-pdf-header-footer',`--print-to-pdf=${path}.pdf`,`file://${path}.html`],{timeout:30000,stdio:'pipe'});return new Response(readFileSync(path+'.pdf'),{headers:{'content-type':'application/pdf'}});}
   }
   return new Response('%PDF-1.7 local transport fixture',{headers:{'content-type':'application/pdf'}});
  }};
  const response=await app.fetch(new Request(`https://local.invalid/v2/reports/${made.report.id}/pdf?format=${format}`,{headers:{authorization:`Bearer ${session}`}}),{...c.env,PDF_BROWSER:browser} as any);
  expect(response.status,format).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('content-type')).toBe('application/pdf');
  expect(new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()).slice(0,5))).toBe('%PDF-');
  const rolledBack=await app.fetch(new Request(`https://local.invalid/v2/reports/${made.report.id}/pdf?format=${format}`,{headers:{authorization:`Bearer ${session}`}}),{...c.env,SUMMIT_ONE_RESPONSE_REPORTS:undefined,PDF_BROWSER:browser} as any);
  expect(rolledBack.status).toBe(409);

 }
 expect(rendered).toBe(3);expect(JSON.stringify(got)).toBe(before);
 // Exercise the actual radar input: a single perspective has real subdimensions, but no shared-construct comparison axes.
 expect(payload.lenses[0].sub_dimensions.length).toBeGreaterThanOrEqual(3);expect(radarModel(got.report)).toBeNull();
 const models=perspectiveRadarModels(got.report,got.level_minimum_responses);expect(models).toHaveLength(1);
 expect(models[0].lenses[0].scores).toEqual(payload.lenses[0].sub_dimensions.map((s:any)=>s.score));
 expect(models[0].n).toBe(1);
 if(out)writeFileSync(out+'/one-response-payload.json',JSON.stringify(got,null,2));
 // Rollback re-attests and holds this same immutable report again; zero responses never qualify.
 expect((await reportGet(ctx('production'),{id:made.report.id})).result.suppressed).toBe(true);
 expect((await build(c,{aid:zero})).result.suppressed).toBe(true);
 const noAdmission={...c,env:{...c.env,PARTICIPANT_REPORTS:undefined}};
 expect((await summary(noAdmission,{aid:one})).result.report_build_allowed).toBe(false);
 const ungranted={...c,principal:{kind:'user' as const,id:'not-granted'}};
 await expect(reportGet(ungranted,{id:made.report.id})).rejects.toThrow();
},120000);

it('every available seeded survey form can build a single-response Summit report without inventing missing dimensions',async()=>{
 const templates=(await db.prepare('SELECT DISTINCT r.template_id AS id FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=? ORDER BY r.template_id').bind(src).all<{id:string}>()).results;
 expect(templates.length).toBeGreaterThanOrEqual(3);
 for(const {id} of templates){
  const aid='assess_summit_form_'+id;await clone(aid,1,id);
  const result:any=(await build(summit(),{aid})).result;expect(result.suppressed,id).toBe(false);
  const report=result.report,counts=[...lensRespondents(report.payload).values()];expect(counts,id).toEqual([1]);
  const dimensions=report.payload.lenses.flatMap((l:any)=>l.sub_dimensions);
  const models=perspectiveRadarModels(report,1);
  for(const model of models)expect(model.spokes.length).toBe(dimensions.length);
  if(dimensions.filter((d:any)=>typeof d.score==='number'&&Number.isFinite(d.score)).length<3)expect(models).toHaveLength(0);
 }
},60000);

it('G02 history guard: changing current zero-response survey selection cannot change an existing named PDF',async()=>{
 const c=summit(),made:any=(await build(c,{aid:one})).result;
 const session=await mintSession(c.env,'person_mara','user');let rendered='';
 const browser={quickAction:async(_:string,options:any)=>{rendered=options.html;return new Response('%PDF-local',{headers:{'content-type':'application/pdf'}})}};
 const get=async(format:string)=>{
  const response=await app.fetch(new Request(`https://local.invalid/v2/reports/${made.report.id}/pdf?format=${format}`,{headers:{authorization:`Bearer ${session}`}}),{...c.env,PDF_BROWSER:browser} as any);
  expect(response.status).toBe(200);expect(rendered).toContain('Other perspectives’ participation is unknown.');return rendered;
 };
 const zeroSurveys=(await db.prepare('SELECT s.id,s.state FROM assessment_survey s LEFT JOIN response r ON r.assessment_survey_id=s.id WHERE s.assessment_id=? GROUP BY s.id HAVING count(r.id)=0').bind(one).all<{id:string;state:string}>()).results;
 expect(zeroSurveys.length).toBeGreaterThan(0);
 const before=new Map();for(const f of ['overview','detailed'])before.set(f,await get(f));
 try{
  for(const s of zeroSurveys)await run("UPDATE assessment_survey SET state='archived' WHERE id=?",s.id);
  for(const f of ['overview','detailed'])expect(await get(f),f).toBe(before.get(f));
 }finally{for(const s of zeroSurveys)await run('UPDATE assessment_survey SET state=? WHERE id=?',s.state,s.id);}
},60000);
