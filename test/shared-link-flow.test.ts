import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { sha256 } from "../src/handlers/common";

const mf = new Miniflare(convertV4MiniflareOptions({workers:[{name:"shared-flow",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"shared-flow"}}]}));
let db: D1Database, env:any, owner:string, viewer:string;
const path="/v2/assessments/assess_tavo_collect/surveys/survey_tavo/links";
async function call(method:string,url:string,body?:unknown,bearer?:string) {
  const r=await app.fetch(new Request("https://local.invalid"+url,{method,headers:{"content-type":"application/json",...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);
  return {status:r.status,...await r.json() as any};
}
async function issue(expires_at?:string|null) {
  const params=expires_at===undefined?{}:{expires_at};
  const dry=await call("POST",path,{params,mode:"dry_run"},owner);expect(dry.ok).toBe(true);
  const created=await call("POST",path,{params,mode:"execute",confirm_token:dry.result.confirm_token},owner);expect(created.ok).toBe(true);return created.result;
}
async function open(token:string,resume_token?:string) {return call("POST","/v2/participate/link",{token,...(resume_token===undefined?{}:{resume_token})});}
async function submit(token:string,key="same-client-key",answers:unknown={Q1:4}) {return call("POST","/v2/participate/responses",{idempotency_key:key,answers},token);}
beforeAll(async()=>{
 db=await mf.getD1Database("DB");
 for(const file of ["migrations/0001_init.sql","migrations/0002_code_escrow.sql","migrations/0003_language_archive.sql","migrations/0004_pinned_instruments.sql","migrations/0007_shared_link_context.sql","seed/synthetic.sql"]){
  const sql=readFileSync(new URL("../"+file,import.meta.url),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
  await db.batch(sql.split(";\n").map(x=>x.trim()).filter(Boolean).map(x=>db.prepare(x)));
 }
 env={DB:db,SESSION_SECRET:"synthetic-shared-flow",ENVIRONMENT:"dev"};owner=await mintSession(env,"person_mara","user");viewer=await mintSession(env,"person_ion","user");
},60000);
afterAll(()=>mf.dispose());

describe("shared survey link HTTP contract",()=>{
 it("requires confirmed authorized disclosure, writes nothing in preview and persists only hashed credentials",async()=>{
  const count=async()=>Number((await db.prepare("SELECT COUNT(*) AS n FROM invitation").first<{n:number}>())?.n);
  const before=await count();const dry=await call("POST",path,{mode:"dry_run",params:{}},owner);
  expect(dry.ok).toBe(true);expect(await count()).toBe(before);expect(dry.result.link_token).toBeUndefined();
  expect((await call("POST",path,{mode:"execute",params:{}},owner)).error.code).toBe("CONFIRM_REQUIRED");
  expect((await call("POST",path,{mode:"dry_run",params:{}},viewer)).ok).toBe(false);
  expect((await call("POST",path,{mode:"dry_run",params:{}})).ok).toBe(false);
  expect((await call("POST",path,{mode:"dry_run",params:{expires_at:"2000-01-01T00:00:00Z"}},owner)).error.code).toBe("INVALID_PARAMS");
  const link=await issue();expect(link.entry_fragment).toBe('#survey='+encodeURIComponent(link.link_token));expect(link.expires_at).toBeNull();
  const row=await db.prepare("SELECT * FROM invitation WHERE id=?").bind(link.link_id).first<any>();expect(row.token_hash).toBe(await sha256(link.link_token));expect(JSON.stringify(row)).not.toContain(link.link_token);
  const durable=await db.prepare("SELECT prior_state_json FROM receipt").all();expect(JSON.stringify(durable)).not.toContain(link.link_token);
 });
 it("gives two clients independent responses with the same client key and server-derived attribution",async()=>{
  const link=await issue();const a=await open(link.link_token),b=await open(link.link_token);expect(a.ok&&b.ok).toBe(true);
  expect(a.result.participant_token).toMatch(/^pt_[A-Za-z0-9_-]{32}$/);expect(a.result.respondent_id).not.toBe(b.result.respondent_id);
  const sid=a.result.survey_id;const before=Number((await db.prepare("SELECT COUNT(*) AS n FROM response WHERE assessment_survey_id=?").bind(sid).first<{n:number}>())?.n);
  const x=await submit(a.result.participant_token),y=await submit(b.result.participant_token);expect(x.ok&&y.ok).toBe(true);expect(x.result.response_id).not.toBe(y.result.response_id);
  const status=await call("GET","/v2/assessments/assess_tavo_collect/surveys/survey_tavo",undefined,owner);expect(status.result.counts.responses).toBe(before+2);
  const rows=await db.prepare("SELECT * FROM response WHERE id IN (?,?)").bind(x.result.response_id,y.result.response_id).all<any>();
  expect(rows.results.map(r=>r.assessment_survey_id)).toEqual([sid,sid]);expect(rows.results.every(r=>r.template_id==='tpl_validation'&&r.template_version===1&&JSON.parse(r.provenance_json).link_id===link.link_id)).toBe(true);
  const resumed=await open(link.link_token,a.result.participant_token);expect(resumed.result).toMatchObject({participant_token:a.result.participant_token,respondent_id:a.result.respondent_id,resumed:true});
  const receipt=await call("GET","/v2/participate/receipt",undefined,a.result.participant_token);expect(receipt.result.response_id).toBe(x.result.response_id);expect(JSON.stringify(receipt)).not.toContain(y.result.response_id);
  expect((await submit(a.result.participant_token)).result).toMatchObject({response_id:x.result.response_id,duplicate:true});
  expect((await submit(a.result.participant_token,'same-client-key',{Q1:3})).error.code).toBe('INVALID_PARAMS');
  expect((await submit(a.result.participant_token,'other-key')).error.code).toBe('STAGE_CONFLICT');
  const other=await issue();expect((await open(other.link_token,a.result.participant_token)).ok).toBe(false);
  expect((await open(link.link_token,'pt_forged')).ok).toBe(false);
  expect((await call('GET','/v2/participate/receipt?response_id='+x.result.response_id)).ok).toBe(false);
 });
 it("preserves private receipt/retry after closure but rejects new collection, revocation and expiry",async()=>{
  const link=await issue(),a=await open(link.link_token),b=await open(link.link_token);const saved=await submit(a.result.participant_token);expect(saved.ok).toBe(true);
  await db.prepare("UPDATE assessment_survey SET collection_status='closed' WHERE id='survey_tavo'").run();
  expect((await open(link.link_token)).error.code).toBe('STAGE_CONFLICT');
  expect((await call('GET','/v2/participate/form',undefined,b.result.participant_token)).error.code).toBe('STAGE_CONFLICT');
  expect((await submit(b.result.participant_token)).error.code).toBe('STAGE_CONFLICT');
  expect((await open(link.link_token,a.result.participant_token)).ok).toBe(true);
  expect((await submit(a.result.participant_token)).result.response_id).toBe(saved.result.response_id);
  expect((await call('GET','/v2/participate/receipt',undefined,a.result.participant_token)).result.response_id).toBe(saved.result.response_id);
  await db.prepare("UPDATE assessment_survey SET collection_status='open' WHERE id='survey_tavo'").run();
  expect((await call('DELETE',path+'/'+link.link_id,{},owner)).ok).toBe(true);
  for(const r of [await open(link.link_token),await open(link.link_token,a.result.participant_token),await submit(a.result.participant_token),await call('GET','/v2/participate/receipt',undefined,a.result.participant_token)]) expect(r.ok).toBe(false);
  expect(await db.prepare('SELECT id FROM response WHERE id=?').bind(saved.result.response_id).first()).toBeTruthy();
  const exp=await issue(new Date(Date.now()+60000).toISOString()),e=await open(exp.link_token);
  expect(Date.parse(e.result.expires_at)).toBeLessThanOrEqual(Date.parse(exp.expires_at));
  await db.prepare("UPDATE invitation SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").bind(exp.link_id).run();
  expect((await open(exp.link_token,e.result.participant_token)).ok).toBe(false);expect((await call('GET','/v2/participate/receipt',undefined,e.result.participant_token)).ok).toBe(false);
 });
 it("refuses archived assessment collection and leaves assisted next unimplemented",async()=>{
  const link=await issue(),a=await open(link.link_token);
  expect((await call('POST','/v2/participate/next',{},a.result.participant_token)).error.code).toBe('STAGE_CONFLICT');
  await db.prepare("UPDATE assessment SET archived_at='2026-09-17T00:00:00Z' WHERE id='assess_tavo_collect'").run();
  expect((await open(link.link_token)).ok).toBe(false);expect((await submit(a.result.participant_token)).ok).toBe(false);
  await db.prepare("UPDATE assessment SET archived_at=NULL WHERE id='assess_tavo_collect'").run();
 });
 it("enforces source-derived required, multi-option and exclusion validation for a pinned v2 form",async()=>{
  const selected=await call('POST','/v2/assessments/assess_tavo_collect/surveys',{template_id:'tpl_validation',version:2},owner);expect(selected.ok).toBe(true);
  const linkPath='/v2/assessments/assess_tavo_collect/surveys/'+selected.result.sid+'/links';
  const dry=await call('POST',linkPath,{mode:'dry_run',params:{}},owner);
  const issued=await call('POST',linkPath,{mode:'execute',params:{},confirm_token:dry.result.confirm_token},owner);expect(issued.ok).toBe(true);
  const p=await open(issued.result.link_token);const form=await call('GET','/v2/participate/form',undefined,p.result.participant_token);expect(form.ok).toBe(true);
  expect(form.result.template).toMatchObject({id:'tpl_validation',version:2});
  // Bincy B10: the welcome's shared context comes from the assessment row setup wrote; project name only, no organisation.
  expect(typeof form.result.project).toBe('string');expect(form.result).toHaveProperty('purpose');expect(form.result).toHaveProperty('format');expect(form.result.project).toBe('Rill Project');expect(Object.keys(form.result)).not.toContain('organization');
  const items=form.result.items as any[];const answers:Record<string,unknown>={};
  for(const item of items) if(item.required) answers[item.id]=item.type==='multi'?[item.options[0].code]:item.type==='single'?item.options[0].code:'Synthetic response';
  const required=items.find(i=>i.required)!;const missing={...answers};delete missing[required.id];
  expect((await submit(p.result.participant_token,'valid',missing)).error.code).toBe('INVALID_PARAMS');
  const multi=items.find(i=>i.type==='multi'&&i.options.some((o:any)=>o.exclusive))!;expect(multi).toBeTruthy();
  expect((await submit(p.result.participant_token,'valid',{...answers,[multi.id]:['unknown-source-option']})).error.code).toBe('INVALID_PARAMS');
  const ex=multi.options.find((o:any)=>o.exclusive).code, other=multi.options.find((o:any)=>!o.exclusive).code;
  expect((await submit(p.result.participant_token,'valid',{...answers,[multi.id]:[ex,other]})).error.code).toBe('INVALID_PARAMS');
  const saved=await submit(p.result.participant_token,'valid',{...answers,[multi.id]:[ex]});expect(saved.ok).toBe(true);
  const stored=await db.prepare('SELECT template_id,template_version,answers_json FROM response WHERE id=?').bind(saved.result.response_id).first<any>();
  expect(stored).toMatchObject({template_id:'tpl_validation',template_version:2});expect(JSON.parse(stored.answers_json)[multi.id]).toEqual([ex]);
 });

 it("uses correct MCP tools on the baseline and keeps participant scope separate",async()=>{
  const mcp=async(tool:string,capability:string,params:unknown,bearer:string,extra:object={})=>{
   const res=await call('POST','/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:{capability,params,...extra}}},bearer);
   return res.result.structuredContent;
  };
  const params={aid:'assess_tavo_collect',sid:'survey_tavo'};
  expect((await mcp('write','cap.survey.issue_link',params,owner)).error.code).toBe('WRONG_TOOL_FOR_CLASS');
  const dry=await mcp('danger','cap.survey.issue_link',params,owner,{mode:'dry_run'});expect(dry.ok).toBe(true);
  const made=await mcp('danger','cap.survey.issue_link',params,owner,{mode:'execute',confirm_token:dry.result.confirm_token});expect(made.ok).toBe(true);
  const opened=await mcp('write','cap.participant.open_link',{token:made.result.link_token},owner);expect(opened.ok).toBe(true);
  const bearer=opened.result.participant_token;
  expect((await mcp('read','cap.response.form',{},bearer)).ok).toBe(true);
  const saved=await mcp('write','cap.response.submit',{idempotency_key:'mcp-key',answers:{Q1:4}},bearer);expect(saved.ok).toBe(true);
  expect((await mcp('read','cap.response.receipt',{},bearer)).result.response_id).toBe(saved.result.response_id);
  expect((await mcp('read','cap.response.receipt',{},owner)).ok).toBe(false);
 });
 it("rejects session expiry/revocation and client-supplied identity overrides",async()=>{
  const link=await issue(),p=await open(link.link_token);
  expect((await call('POST','/v2/participate/link',{token:link.link_token,respondent_id:'forged'})).error.code).toBe('INVALID_PARAMS');
  expect((await call('POST','/v2/participate/responses',{idempotency_key:'x',answers:{Q1:4},respondent_id:'forged'},p.result.participant_token)).error.code).toBe('INVALID_PARAMS');
  await db.prepare("UPDATE participant_session SET revoked_at='2026-09-17T00:00:00Z' WHERE token_hash=?").bind(await sha256(p.result.participant_token)).run();
  expect((await open(link.link_token,p.result.participant_token)).ok).toBe(false);
  expect((await call('GET','/v2/participate/form',undefined,p.result.participant_token)).ok).toBe(false);
  const other=await open(link.link_token);
  await db.prepare("UPDATE participant_session SET expires_at='2000-01-01T00:00:00Z' WHERE token_hash=?").bind(await sha256(other.result.participant_token)).run();
  expect((await open(link.link_token,other.result.participant_token)).ok).toBe(false);
  expect((await submit(other.result.participant_token)).ok).toBe(false);
 });

});
