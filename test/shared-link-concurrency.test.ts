import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { submit } from "../src/handlers/response";
import { sha256 } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"shared-concurrency",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"shared-race"}}]}));
let db:D1Database,env:any,owner:string;
const issuePath='/v2/assessments/assess_tavo_collect/surveys/survey_tavo/links';
async function http(path:string,body:unknown,bearer?:string){const r=await app.fetch(new Request('https://local.invalid'+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify(body)}),env);return {status:r.status,...await r.json() as any};}
async function fresh(){const dry=await http(issuePath,{mode:'dry_run',params:{}},owner);expect(dry.ok).toBe(true);const made=await http(issuePath,{mode:'execute',params:{},confirm_token:dry.result.confirm_token},owner);expect(made.ok).toBe(true);const opened=await http('/v2/participate/link',{token:made.result.link_token});expect(opened.ok).toBe(true);return {...opened.result,link_id:made.result.link_id};}
const send=(bearer:string,key:string,answers:unknown={Q1:4})=>http('/v2/participate/responses',{idempotency_key:key,answers},bearer);
const count=async(id:string)=>Number((await db.prepare('SELECT COUNT(*) AS n FROM response WHERE respondent_id=?').bind(id).first<{n:number}>())?.n);
function context(p:any, override:D1Database=db):Ctx{return{db:override,env:{...env,DB:override},principal:{kind:'participant',id:p.respondent_id,respondentId:p.respondent_id,participantSurveyId:p.survey_id},traceId:'tr_concurrency_'+crypto.randomUUID(),now:()=>new Date(),log:()=>{}};}
beforeAll(async()=>{
 db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0007_shared_link_context.sql','seed/synthetic.sql']){
 const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');await db.batch(sql.split(';\n').map(x=>x.trim()).filter(Boolean).map(x=>db.prepare(x)));}
 env={DB:db,SESSION_SECRET:'synthetic-shared-race',ENVIRONMENT:'dev'};owner=await mintSession(env,'person_mara','user');
},60000);
afterAll(()=>mf.dispose());
describe('shared-link atomic response identity',()=>{
 it('eight simultaneous identical requests produce one response and one stable response identity',async()=>{
  const p=await fresh();const responses=await Promise.all(Array.from({length:8},()=>send(p.participant_token,'same')));
  expect(responses.map(r=>({status:r.status,ok:r.ok}))).toEqual(Array.from({length:8},()=>({status:200,ok:true})));
  expect(new Set(responses.map(r=>r.result.response_id)).size).toBe(1);expect(await count(p.respondent_id)).toBe(1);
  expect(responses.filter(r=>!r.result.duplicate)).toHaveLength(1);
  expect(Number((await db.prepare('SELECT COUNT(*) AS n FROM shared_response_claim WHERE respondent_id=?').bind(p.respondent_id).first<{n:number}>())?.n)).toBe(1);
 });
 it('different keys or changed answers race to one winner without any500',async()=>{
  for(const differentPayload of [false,true]){
   const p=await fresh();const responses=await Promise.all(Array.from({length:8},(_,i)=>send(p.participant_token,differentPayload?'one':'key-'+i,{Q1:differentPayload?(i%2?3:4):4})));
   expect(responses.every(r=>r.status!==500)).toBe(true);expect(await count(p.respondent_id)).toBe(1);
   const success=responses.filter(r=>r.ok);expect(success.length).toBeGreaterThan(0);expect(new Set(success.map(r=>r.result.response_id)).size).toBe(1);
   const failures=responses.filter(r=>!r.ok);expect(failures.length).toBeGreaterThan(0);expect(failures.every(r=>r.error.code===(differentPayload?'INVALID_PARAMS':'STAGE_CONFLICT'))).toBe(true);
  }
 });
 it('a nonconstraint batch error remains a failure and creates no partial row',async()=>{
  const p=await fresh();const failure=new Error('synthetic transient D1 failure');
  const broken={prepare:db.prepare.bind(db),batch:async()=>{throw failure;}} as unknown as D1Database;
  await expect(submit(context(p,broken),{idempotency_key:'fault',answers:{Q1:4}})).rejects.toBe(failure);
  expect(await count(p.respondent_id)).toBe(0);
  expect(Number((await db.prepare('SELECT COUNT(*) AS n FROM shared_response_claim WHERE respondent_id=?').bind(p.respondent_id).first<{n:number}>())?.n)).toBe(0);
  expect((await send(p.participant_token,'fault')).ok).toBe(true);
 });
 it('transaction rollback removes response when claim insertion fails',async()=>{
  const p=await fresh();
  await db.prepare("CREATE TRIGGER fail_shared_claim BEFORE INSERT ON shared_response_claim BEGIN SELECT RAISE(ABORT, 'synthetic claim fault'); END").run();
  try{await expect(submit(context(p),{idempotency_key:'rollback',answers:{Q1:4}})).rejects.toThrow('synthetic claim fault');expect(await count(p.respondent_id)).toBe(0);}
  finally{await db.prepare('DROP TRIGGER fail_shared_claim').run();}
  expect((await send(p.participant_token,'rollback')).ok).toBe(true);
 });
 it('completed revoke or close between precheck and batch prevents new insertion',async()=>{
  for(const action of ['revoke','close']){
   const p=await fresh();let called=false;
   const raced={prepare:db.prepare.bind(db),batch:async(statements:D1PreparedStatement[])=>{
    called=true;if(action==='revoke')await db.prepare("UPDATE invitation SET status='revoked' WHERE id=?").bind(p.link_id).run();
    else await db.prepare("UPDATE assessment_survey SET collection_status='closed' WHERE id=?").bind(p.survey_id).run();
    return db.batch(statements);
   }} as unknown as D1Database;
   await expect(submit(context(p,raced),{idempotency_key:'race',answers:{Q1:4}})).rejects.toBeTruthy();expect(called).toBe(true);expect(await count(p.respondent_id)).toBe(0);
   await db.prepare("UPDATE assessment_survey SET collection_status='open' WHERE id=?").bind(p.survey_id).run();
  }
 });
 it('rejects mixed legacy/shared association instead of trusting whichever session row is first',async()=>{
  const p=await fresh();await db.prepare('INSERT INTO participant_session (id,assessment_survey_id,respondent_id,token_hash,created_at,expires_at) VALUES (?,?,?,?,?,?)')
   .bind('ps_ambiguous',p.survey_id,p.respondent_id,await sha256('synthetic-other-token'),new Date().toISOString(),'2099-01-01T00:00:00Z').run();
  expect((await send(p.participant_token,'ambiguous')).ok).toBe(false);expect(await count(p.respondent_id)).toBe(0);
 });
 it('link expiry while a request waits for its batch cannot authorize a new insertion',async()=>{
  const p=await fresh();await db.prepare('UPDATE invitation SET expires_at=? WHERE id=?').bind(new Date(Date.now()+500).toISOString(),p.link_id).run();
  let reached=false;
  const delayed={prepare:db.prepare.bind(db),batch:async(statements:D1PreparedStatement[])=>{reached=true;await new Promise(resolve=>setTimeout(resolve,600));return db.batch(statements);}} as unknown as D1Database;
  await expect(submit(context(p,delayed),{idempotency_key:'expiry-race',answers:{Q1:4}})).rejects.toBeTruthy();
  expect(reached).toBe(true);expect(await count(p.respondent_id)).toBe(0);
 });

});
