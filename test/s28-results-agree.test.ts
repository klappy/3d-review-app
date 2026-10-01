import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {summary} from '../src/handlers/results';
import {list as responseList} from '../src/handlers/response';
import {build,get as reportGet,list as reportList} from '../src/handlers/report';
import {SUPPRESSION_THRESHOLD} from '../src/handlers/common';
import {captureForBuild} from '../src/report-capture';
import {attestCapture} from '../src/report-attestation';
import type {Ctx} from '../src/handlers/types';
// S28 (persona C, 0.24.1 agent track): below the D7 minimum, Results, the responses list and the report tell the same truth —
// how many responses are in, how many are needed, scores held — and no report is scored from too few answers.
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'s28-results-agree',modules:true,script:"export default {fetch(){return new Response('x')}}",d1Databases:{DB:'s28-fixture'}}]}));
let db:D1Database;
const src='assess_syn_earning-trust-2026-01', one='assess_s28_one', full='assess_s28_full';
const ctx=():Ctx=>({env:{DB:db,SESSION_SECRET:'s28-test',ENVIRONMENT:'dev'} as unknown as Ctx['env'],db,principal:{id:'person_mara',kind:'user'},traceId:'tr_s28',now:()=>new Date('2026-09-30T16:00:00.000Z'),log:()=>{}});
const run=(sql:string,...a:unknown[])=>db.prepare(sql).bind(...a).run();
async function clone(aid:string,limit:number){
 await run(`INSERT INTO assessment (id,project_id,language_id,name,purpose,period,format,stage,created_at,created_by) SELECT ?1,project_id,language_id,name||' (participant)',purpose,period,format,stage,created_at,created_by FROM assessment WHERE id=?2`,aid,src);
 await run(`INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) SELECT ?1||id,principal_id,scope_type,?1,role,created_at FROM "grant" WHERE scope_type='assessment' AND scope_id=?2`,aid,src);
 await run(`INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) SELECT ?1||id,?1,template_id,template_version,state,collection_status,created_at FROM assessment_survey WHERE assessment_id=?2`,aid,src);
 await run(`INSERT INTO response (id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,source,submitted_at) SELECT ?1||r.id,?1||r.assessment_survey_id,?1||r.respondent_id,?1||r.idempotency_key,r.answers_json,r.template_id,r.template_version,'participant',r.submitted_at FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=?2 ORDER BY r.id LIMIT ?3`,aid,src,limit);
}
beforeAll(async()=>{
 db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql']){
  const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
  const statements=sql.split(';\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
 }
 await clone(one,1);await clone(full,50);
},60000);
afterAll(()=>mf.dispose());
const reports=async(aid:string)=>Number((await db.prepare('SELECT count(*) AS n FROM synthetic_report WHERE assessment_id=?').bind(aid).first<{n:number}>())?.n);
describe('S28: Results, responses list and report agree below the D7 minimum',()=>{
 it('below the minimum: all three are held and name the same numbers; no report is built',async()=>{
  const want={suppressed:true,status:'held',responses_in:1,responses_needed:SUPPRESSION_THRESHOLD};
  const r:any=(await summary(ctx(),{aid:one})).result, l:any=(await responseList(ctx(),{aid:one})).result;
  const preview:any=(await build(ctx(),{aid:one},{dryRun:true} as any)).result, made:any=(await build(ctx(),{aid:one})).result;
  const listed:any=(await reportList(ctx(),{aid:one})).result;
  for(const view of [r,l,preview,made,listed])expect(view).toMatchObject(want);
  expect(new Set([r,l,preview,made,listed].map(v=>v.reason)).size).toBe(1);
  expect(r.reason).toBe(`1 response so far; at least ${SUPPRESSION_THRESHOLD} are needed before any score is shown. Scores are held until then.`);
  expect(r.summary).toBeNull();expect(l.responses).toEqual([]);expect(made.report).toBeNull();expect(listed.reports).toEqual([]);
  expect(await reports(one)).toBe(0);
 },60000);
 it('a stored or listed participant report re-attests through the same minimum, so reads hold too',async()=>{
  // get and list re-attest the capture before disclosure; the minimum lives in that one attestation step.
  const c=await captureForBuild(ctx(),src);expect(c.eligible).toBe(true);if(!c.eligible)return;
  const participant=c.capture.rows.map(row=>({...row,responseId:'p_'+row.responseId}));
  expect(await attestCapture(src,participant.slice(0,SUPPRESSION_THRESHOLD-1),true)).toEqual({eligible:false,reason:'BELOW_MINIMUM'});
  expect((await attestCapture(src,participant.slice(0,SUPPRESSION_THRESHOLD),true)).eligible).toBe(true);
  expect((await attestCapture(src,c.capture.rows.slice(0,1))).eligible).toBe(true); // synthetic fixtures (not respondents): unchanged
 },60000);
 it('at or above the minimum: unchanged — Results and the list keep the D7 hold, the report still builds',async()=>{
  const r:any=(await summary(ctx(),{aid:full})).result, l:any=(await responseList(ctx(),{aid:full})).result;
  expect(r).toMatchObject({suppressed:true,status:'held',reason:'D7 scoring, threshold, and differencing policy unresolved',summary:null});
  expect(l).toMatchObject({suppressed:true,status:'held',reason:'D7 disclosure policy unresolved',responses:[]});
  for(const v of [r,l]){expect(v).not.toHaveProperty('responses_in');expect(v).not.toHaveProperty('responses_needed');}
  const preview:any=(await build(ctx(),{aid:full},{dryRun:true} as any)).result;expect(preview).toMatchObject({suppressed:false,status:'ready'});
  const made:any=(await build(ctx(),{aid:full})).result;expect(made.suppressed).toBe(false);expect(made.report?.id).toMatch(/^sreport_/);
 },60000);
});
