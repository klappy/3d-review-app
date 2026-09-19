import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { capabilities } from "../src/registry";

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{ name: "fb-mcp", modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: { DB: "fb-mcp-db" } }],
}));
afterAll(() => mf.dispose());

function statements(db: D1Database, path: string) {
  const sql = readFileSync(new URL(path, import.meta.url), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s));
}

import { APP_VERSION, APP_COMMIT, APP_STAMP, BUILD_UUID, RELEASE_SOURCE } from "../src/version";
import contract from "../contract/capabilities.json";
let db: D1Database; let env:any; let supportToken:string; let userToken:string;
beforeAll(async()=>{
 db=await mf.getD1Database('DB');for(const m of ['0001_init.sql','0002_code_escrow.sql','0003_language_archive.sql','0004_pinned_instruments.sql'])await db.batch(statements(db,`../migrations/${m}`));
 await db.batch(statements(db,'../seed/synthetic.sql'));
 env={DB:db,SESSION_SECRET:'synthetic-provenance',ENVIRONMENT:'dev'};
 await db.prepare("INSERT OR IGNORE INTO principal (id,email_hash,provisioned,support,created_at) VALUES (?,?,?,?,?)").bind('person_support','synthetic_hash_support',1,1,'2026-09-18T00:00:00.000Z').run();
 supportToken=await mintSession(env,'person_support','support');userToken=await mintSession(env,'person_mara','user');
},60000);
async function call(face:string,op:'write'|'read',params:any,bearer?:string){
 const headers={'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})};
 const req=face==='http'?new Request(`https://t.invalid/v2/${op==='write'?'feedback':'ops/feedback/'+encodeURIComponent(params.id)}`,{method:op==='write'?'POST':'GET',headers,...(op==='write'?{body:JSON.stringify(params)}:{})}):new Request('https://t.invalid/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:op,arguments:{capability:op==='write'?'cap.ops.feedback':'cap.ops.feedback_get',params}}})});
 const res=await app.fetch(req,env);const j:any=await res.json();return face==='http'?j:j.result.structuredContent;
}
const count=()=>db.prepare('SELECT count(*) n FROM feedback').first();
const experience={context:{page:'assessment',component:'app_feedback'},occurred_at:'2026-09-17T10:11:12.000Z',surface:'mcp_panel',host:'chatgpt',client_release:{version:'0.8.0',commit:'a'.repeat(40)},api_release:{version:'0.9.0',commit:'b'.repeat(40),environment:'production',build_uuid:null}};
for(const face of ['http','mcp'])describe(`${face}: provenance local Request+D1 fixture`,()=>{
 it('server metadata cannot be changed by misleading caller context; public omission stays valid',async()=>{
  const w=await call(face,'write',{context:{version:'99.0.0',environment:'production'},note:'synthetic note'});expect(w.ok).toBe(true);expect(Object.keys(w.result).sort()).toEqual(['feedback_id','recorded','stripped']);
  const r=await call(face,'read',{id:w.result.feedback_id},supportToken);expect(r.ok).toBe(true);expect(r.result.provenance).toEqual({submission:{source:'server',submitted_at:r.result.created_at,version:APP_VERSION,commit:APP_COMMIT,build:APP_STAMP,build_uuid:BUILD_UUID,release_source:RELEASE_SOURCE,environment:'dev'},experience:null});expect(r.result.actor).toBe('anon');expect(r.result.body).not.toHaveProperty('_feedback_provenance');
 });
 it('older experienced client and relevant API remain separate, explicitly client-reported',async()=>{
  const w=await call(face,'write',{note:'synthetic',experience,require_authenticated:true},userToken);expect(w.ok).toBe(true);
  const r=await call(face,'read',{id:w.result.feedback_id},supportToken);expect(r.result.provenance.experience).toEqual({source:'client_reported',...experience});expect(r.result.provenance.submission.version).toBe(APP_VERSION);expect(r.result.actor).toBe('person_mara');expect(r.result.body).not.toHaveProperty('experience');expect(r.result.body).not.toHaveProperty('require_authenticated');
 });
 it('caller submission and trust-label spoofing is refused before insert',async()=>{
  const before=await count();for(const params of [{submission:{version:'99.0.0'}},{provenance:{submission:{}}},{_feedback_provenance:{submission:{}}},{experience:{source:'server',surface:'web'}},{experience:{client_release:{submitted_at:'2026-09-17T00:00:00.000Z'}}}]){const w=await call(face,'write',params);expect(w.ok).toBe(false);expect(w.error.code).toBe('INVALID_PARAMS');}expect(await count()).toEqual(before);
 });
 it('strict nested allowlist/types/time/size refuse private arbitrary payloads without echo or insertion',async()=>{
  const before=await count();for(const exp of [[],{},null,{host:'https://private.example'},{surface:'answers'},{occurred_at:'2026-02-30T00:00:00.000Z'},{occurred_at:'yesterday'},{client_release:{}},{client_release:{commit:'secret'}},{client_release:{version:'token'}},{api_release:{build_uuid:'secret'}},{api_release:{environment:'secret'}},{client_release:{url:'secret'}},{host:'x'.repeat(1600)}]){const w=await call(face,'write',{experience:exp});expect(w.ok).toBe(false);expect(w.error.code).toBe('INVALID_PARAMS');expect(JSON.stringify(w)).not.toContain('private.example');expect(JSON.stringify(w)).not.toContain('secret');}expect(await count()).toEqual(before);
 });
 it('legacy rows retain unknown provenance; reading does not backfill current release',async()=>{
  const id='fb_legacy_'+face;await db.prepare('INSERT INTO feedback(id,actor,scope_type,scope_id,body,created_at) VALUES(?,?,?,?,?,?)').bind(id,'anon','platform','-',JSON.stringify({text:'legacy'}),'2025-01-01T00:00:00.000Z').run();
  const r=await call(face,'read',{id},supportToken);expect(r.result.provenance).toBeNull();expect(r.result.created_at).toBe('2025-01-01T00:00:00.000Z');expect(r.result.body.note).toBe('legacy');expect((await db.prepare('SELECT body FROM feedback WHERE id=?').bind(id).first<any>()).body).toBe(JSON.stringify({text:'legacy'}));
 });
 it('malformed stored provenance is hidden rather than assigned a current identity',async()=>{
  const id='fb_broken_'+face;await db.prepare('INSERT INTO feedback(id,actor,body,created_at) VALUES(?,?,?,?)').bind(id,'anon',JSON.stringify({_feedback_provenance:{submission:{source:'server'}}}),'2025-01-01T00:00:00.000Z').run();
  expect((await call(face,'read',{id},supportToken)).error.code).toBe('NOT_FOUND_OR_NOT_VISIBLE');
 });
 it('explicit false preserves public writes; required authentication refuses before stamp/insert',async()=>{
  expect((await call(face,'write',{require_authenticated:false})).ok).toBe(true);const before=await count();expect((await call(face,'write',{experience,require_authenticated:true})).error.code).toBe('NOT_AUTHENTICATED');expect(await count()).toEqual(before);
 });
 it('support authorization still protects metadata and feedback contents',async()=>{
  const w=await call(face,'write',{experience},userToken);for(const token of [undefined,userToken]){const r=await call(face,'read',{id:w.result.feedback_id},token);expect(r.ok).toBe(false);expect(r.result).toBeUndefined();}expect((await call(face,'read',{id:w.result.feedback_id},supportToken)).ok).toBe(true);
  await db.prepare('UPDATE feedback SET created_at=? WHERE id=?').bind('2020-01-01T00:00:00.000Z',w.result.feedback_id).run();expect((await call(face,'read',{id:w.result.feedback_id},supportToken)).error.code).toBe('NOT_FOUND_OR_NOT_VISIBLE');
 });
 it('write envelope and persisted traces contain no experience/body identity',async()=>{
  const w=await call(face,'write',{experience,note:'PRIVATE-SYNTHETIC-NOTE'},userToken);expect(JSON.stringify(w)).not.toContain('client_reported');expect(JSON.stringify(w)).not.toContain('PRIVATE-SYNTHETIC-NOTE');
  const traces=await db.prepare('SELECT * FROM trace WHERE trace_id=?').bind(w.trace_id).all();const trace=JSON.stringify(traces);expect(trace).not.toContain('PRIVATE-SYNTHETIC-NOTE');expect(trace).not.toContain('a'.repeat(40));
 });
});
it('contract projects the same optional input and immutable amendment provenance on both faces',()=>{
 const c:any=contract.capabilities.find(c=>c.id==='cap.ops.feedback');const e=c.params_schema.properties.experience;
 const raw=readFileSync(new URL('../contract/openapi.yaml',import.meta.url),'utf8');const line=raw.split('\n').find(l=>l.startsWith('    FeedbackExperience: '))!;
 expect(JSON.parse(line.slice('    FeedbackExperience: '.length))).toEqual(e);expect(e['x-cookbook-source']).toContain('f5d925f');expect(c.params_schema.required??[]).not.toContain('experience');expect(contract.capabilities.filter(c=>c.id.startsWith('cap.ops.feedback')).map(c=>c.id)).toEqual(['cap.ops.feedback','cap.ops.feedback_get']);
});

describe('registered feedback page context',()=>{
 it('accepts only shared page/component enums and rejects URLs, IDs and extra context',async()=>{
  const {feedbackExperience,feedbackProvenance,projectFeedbackProvenance}=await import('../src/handlers/feedback-provenance');
  const experience={surface:'web',context:{page:'survey',component:'app_feedback'}};
  expect(feedbackExperience(experience)).toEqual(experience);
  expect(projectFeedbackProvenance(feedbackProvenance('dev','2026-09-18T00:00:00.000Z',experience))?.experience).toEqual({source:'client_reported',...experience});
  for(const context of [{page:'survey',component:'app_feedback',id:'private'},{page:'/assessment/private',component:'app_feedback'},{page:'survey',component:'answer_input'},{page:'survey'}])expect(()=>feedbackExperience({context})).toThrow();
  const cap=(contract as any).capabilities.find((c:any)=>c.id==='cap.ops.feedback');
  expect(JSON.stringify(cap)).toContain('app_feedback');
 });
});
