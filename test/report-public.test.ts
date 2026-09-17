import {readFileSync,writeFileSync} from 'node:fs';
import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import worker from '../src/worker';
import {mintSession} from '../src/auth';
import {execute} from '../src/dispatch';
import {redact} from '../src/receipt';
import {mintReportCursor} from '../src/report-cursor';
import {capabilities} from '../src/registry';
import contract from '../contract/capabilities.json';
import type {Ctx} from '../src/handlers/types';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'report-public',modules:true,script:"export default {fetch(){return new Response('fixture')}}",d1Databases:{DB:'report-public-db'},kvNamespaces:{OAUTH_KV:'report-public-kv'}}]}));
let db:D1Database,env:any,token:string,support:string,participant:string;
const aid='assess_syn_earning-trust-2026-01',other='assess_syn_earning-trust-2026-07';
const run=(sql:string,...args:any[])=>db.prepare(sql).bind(...args).run();
const ctx=(database=db,kind:Ctx['principal']['kind']='user',id='person_mara'):Ctx=>({env,db:database,principal:{kind,id},traceId:'tr_'+crypto.randomUUID(),now:()=>new Date('2026-09-17T08:00:00Z'),log:()=>{}});
const schemaSamples:any[]=[];
const ec=()=>({waitUntil(){},passThroughOnException(){},props:undefined}) as any;
async function http(path:string,body?:unknown,credential:string|undefined=token){
 const r=await worker.fetch(new Request('https://report.test'+path,{method:body===undefined?'GET':'POST',headers:{...(credential?{authorization:'Bearer '+credential}:{}),'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,ec());const bodyResult=await r.json() as any;schemaSamples.push({path:path.split('?')[0],method:body===undefined?'get':'post',status:r.status,body:bodyResult});return {status:r.status,body:bodyResult};
}
async function mcp(capability:string,params:any,opts:any={},credential=token){
 const r=await worker.fetch(new Request('https://report.test/mcp',{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:capability==='cap.report.build'?'danger':'read',arguments:{capability,params,...opts}}})}),env,ec());const b:any=await r.json();return b.result?.structuredContent??b;
}
const normalized=(b:any)=>{const c=JSON.parse(JSON.stringify(b));delete c.trace_id;if(c.receipt){delete c.receipt.id;delete c.receipt.trace_id;}return c;};
async function build(a=aid,database=db){const c=ctx(database);const preview:any=await execute(c,'cap.report.build',{aid:a},{tool:'danger',mode:'dry_run'});expect(preview.ok).toBe(true);return execute({...c,traceId:'tr_'+crypto.randomUUID()},'cap.report.build',{aid:a},{tool:'danger',mode:'execute',confirm_token:preview.result.confirm_token}) as Promise<any>;}
function intercept(fn:(sql:string,args:any[],method:string,next:()=>Promise<any>)=>Promise<any>):D1Database{
 return {prepare(sql:string){return{bind(...args:any[]){const st=db.prepare(sql).bind(...args);return Object.fromEntries(['first','all','run'].map(m=>[m,()=>fn(sql,args,m,()=> (st as any)[m]())]));}}}} as unknown as D1Database;
}
beforeAll(async()=>{
 db=await mf.getD1Database('DB');for(const f of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql']){
  const statements=readFileSync(new URL('../'+f,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
 }
 env={DB:db,SESSION_SECRET:'synthetic-public-test-secret',OAUTH_KV:await mf.getKVNamespace('OAUTH_KV'),ENVIRONMENT:'dev'};
 token=await mintSession(env,'person_mara','user');support=await mintSession(env,'person_mara','support');participant=await mintSession(env,'person_mara','participant');
},60000);
beforeEach(async()=>{
 await run('DROP TRIGGER synthetic_report_no_delete');await run('DELETE FROM synthetic_report');await run("CREATE TRIGGER synthetic_report_no_delete BEFORE DELETE ON synthetic_report BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END");
 await run('DELETE FROM receipt');await run('DELETE FROM trace');
});
afterAll(async()=>{if(process.env.REPORT_SCHEMA_EVIDENCE)writeFileSync(process.env.REPORT_SCHEMA_EVIDENCE,JSON.stringify(schemaSamples.map(sample=>{const c=JSON.parse(JSON.stringify(sample));if(c.body.result?.confirm_token)c.body.result.confirm_token='synthetic-token-omitted';return c;})));await mf.dispose();});
describe('real authenticated report transport and receipt',()=>{
 it('previews with no write, confirms, builds/reopens through HTTP and protected MCP with exact projections',async()=>{
  const path='/v2/assessments/'+aid+'/reports';const preview=await http(path,{mode:'dry_run'});expect(preview.status).toBe(200);expect(preview.body.result).toMatchObject({assessment_id:aid,suppressed:false,status:'ready',report:null,impact:{affected:[],irreversible:true,effect:'disclosure'},expires_in:300});
  expect((await db.prepare('SELECT count(*) n FROM receipt').first<any>()).n).toBe(0);expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(0);
  const built=await http(path,{mode:'execute',confirm_token:preview.body.result.confirm_token});expect(built.status).toBe(200);const id=built.body.result.report.id;expect(Object.keys(built.body.result.report).sort()).toEqual(['created_at','id','payload']);
  const got=await http('/v2/reports/'+id);expect(normalized(await mcp('cap.report.get',{id}))).toEqual(normalized(got.body));
  expect(got.body.result.report.payload.synthetic).toBe(true);expect(got.body.result.report.payload.schema_version).toBe('3d-synthetic-assessment-report-v1');
  const receipts=await db.prepare('SELECT prior_state_json,confirm_token FROM receipt').all<any>();expect(receipts.results).toHaveLength(1);expect(JSON.parse(receipts.results[0].prior_state_json)).toEqual({prior:null,params:{},result_ids:{}});expect(receipts.results[0].confirm_token).toBeNull();
  expect(JSON.stringify((await db.prepare('SELECT * FROM trace').all()).results)).not.toContain(id);
  expect(built.body.receipt).toMatchObject({inverse:'none',scope:{type:'assessment',id:aid}});expect(built.body.receipt.undo_token).toBeUndefined();
  const retry=await http(path,{mode:'execute',confirm_token:preview.body.result.confirm_token});expect(retry.body.result.report.id).toBe(id);
 });
 it('pins confirmation scope/actor/params and tools; path aid remains authoritative',async()=>{
  const c=ctx();const p:any=await execute(c,'cap.report.build',{aid},{tool:'danger',mode:'dry_run'});
  const encoded=p.result.confirm_token.slice(4).split('.')[0];const intent=JSON.parse(Buffer.from(encoded,'base64url').toString());expect(intent.scope).toBe('assessment:'+aid);
  expect((await execute(ctx(),'cap.report.build',{aid:other},{tool:'danger',mode:'execute',confirm_token:p.result.confirm_token}) as any).error.code).toBe('CONFIRM_REQUIRED');
  expect((await execute(ctx(db,'user','other-actor'),'cap.report.build',{aid},{tool:'danger',mode:'execute',confirm_token:p.result.confirm_token}) as any).error.code).toBe('CONFIRM_REQUIRED');
  expect((await execute(ctx(),'cap.report.build',{aid},{tool:'write'}) as any).error.code).toBe('WRONG_TOOL_FOR_CLASS');
  expect((await execute(ctx(),'cap.report.build',{aid},{tool:'danger',mode:'execute'}) as any).error.code).toBe('CONFIRM_REQUIRED');
  const path=await http('/v2/assessments/'+aid+'/reports',{mode:'dry_run',params:{aid:other}});expect(path.body.result.assessment_id).toBe(aid);
  expect((await http('/v2/assessments/'+aid+'/reports',{mode:'dry_run',params:{minimum:'viewer'}})).body.error.code).toBe('INVALID_PARAMS');
  expect((await http('/v2/assessments/'+aid+'/reports?limit=99')).body.error.code).toBe('INVALID_PARAMS');
 });
 it('unknown, ungranted, participant and grant-free support hide existence; granted support works',async()=>{
  const r=await build();const id=r.result.report.id;const expected={code:'NOT_FOUND_OR_NOT_VISIBLE',message:'report not found or not visible'};
  const unknown=await http('/v2/reports/unknown');expect(unknown.status).toBe(404);expect(unknown.body.error).toEqual(expected);
  const part=await http('/v2/reports/'+id,undefined,participant);expect(part.status).toBe(404);expect(part.body.error).toEqual(expected);
  expect((await http('/v2/reports/'+id,undefined,support)).status).toBe(200);
  const saved=await db.prepare('SELECT * FROM "grant" WHERE principal_id=? AND scope_type=? AND scope_id=?').bind('person_mara','assessment',aid).first<any>();
  await run('DELETE FROM "grant" WHERE id=?',saved.id);
  try{for(const cred of [token,support])expect((await http('/v2/reports/'+id,undefined,cred)).body.error).toEqual(expected);}finally{await run('INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES (?,?,?,?,?,?)',saved.id,saved.principal_id,saved.scope_type,saved.scope_id,saved.role,saved.created_at);}
  expect((await http('/v2/reports/'+id,undefined,'')).status).toBe(401);
 });
 it('both held dry-run and held execute are fixed success with no report locator',async()=>{
  const a='assess_tavo_collect';const path='/v2/assessments/'+a+'/reports';const p=await http(path,{mode:'dry_run'});expect(p.status).toBe(200);expect(p.body.result).toMatchObject({suppressed:true,status:'held',report:null,impact:{effect:'disclosure'}});
  expect((await db.prepare('SELECT count(*) n FROM receipt').first<any>()).n).toBe(0);
  const b=await http(path,{mode:'execute',confirm_token:p.body.result.confirm_token});expect(b.status).toBe(200);expect(b.body.result.suppressed).toBe(true);expect(Object.keys(b.body.result)).not.toContain('count');expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(0);
  expect(JSON.parse((await db.prepare('SELECT prior_state_json FROM receipt').first<any>()).prior_state_json)).toEqual({prior:null,params:{},result_ids:{}});
  const list=await http(path);expect(list.body.result).toMatchObject({suppressed:true,reports:[]});expect(normalized(await mcp('cap.report.list',{aid:a}))).toEqual(normalized(list.body));
 });
 it('one grant-bearing observation for each read/preview and no standalone policy grant query',async()=>{
  const built=await build();for(const [cap,p,opts] of [['cap.report.build',{aid},{tool:'danger',mode:'dry_run'}],['cap.report.get',{id:built.result.report.id},{tool:'read'}],['cap.report.list',{aid},{tool:'read'}]] as const){
   const seen:string[]=[];const database=intercept(async(sql,_args,_m,next)=>{seen.push(sql);return next();});expect((await execute(ctx(database),cap,p,opts)).ok).toBe(true);
   expect(seen.filter(s=>s.includes('WITH target AS'))).toHaveLength(1);expect(seen.some(s=>s.startsWith('SELECT role FROM grant'))).toBe(false);
  }
 });
 it('neutral preview/read errors and uncertain execute errors do not expose internal discriminants',async()=>{
  const broken=intercept(async(sql,_a,_m,next)=>{if(sql.includes('WITH target AS'))throw new Error('synthetic injected outage');return next();});
  for(const [cap,p,opts] of [['cap.report.build',{aid},{tool:'danger',mode:'dry_run'}],['cap.report.get',{id:'hidden'},{tool:'read'}],['cap.report.list',{aid},{tool:'read'}]] as const){
   const b:any=await execute(ctx(broken),cap,p,opts);expect(b.error).toEqual({code:'STAGE_CONFLICT',message:'The report request could not be completed.'});
  }
  const c=ctx(),p:any=await execute(c,'cap.report.build',{aid},{tool:'danger',mode:'dry_run'});
  const b:any=await execute(ctx(broken),'cap.report.build',{aid},{tool:'danger',mode:'execute',confirm_token:p.result.confirm_token});expect(b.error).toEqual({code:'STAGE_CONFLICT',message:'The report build outcome could not be confirmed. Recheck reports before choosing to retry.'});
 });
 it('preserves uncertainty after actual insert and same-capture retry convergence',async()=>{
  let fired=false;const uncertain=intercept(async(sql,_a,method,next)=>{const r=await next();if(sql.includes('INSERT INTO synthetic_report')&&method==='run'&&!fired){fired=true;throw Error('transport lost after commit');}return r;});
  const b:any=await build(aid,uncertain);expect(b.error.code).toBe('STAGE_CONFLICT');const row=await db.prepare('SELECT id FROM synthetic_report').first<any>();expect(row).toBeTruthy();const retry=await build();expect(retry.result.report.id).toBe(row.id);
 });
 it('rejects unknown params and never accepts caller-controlled renderer/role/page size',async()=>{
  for(const p of [{aid,renderer:{}},{aid,pageSize:999},{aid,minimum:'viewer'},{aid,payload:{}},{aid,cursor:null}])expect((await execute(ctx(),'cap.report.list',p,{tool:'read'}) as any).error.code).toBe('INVALID_PARAMS');
 });
 it('maintains only three activated rows and private class/role counts; five neighbors remain501',async()=>{
  expect(capabilities).toHaveLength(83);expect(contract.counts).toMatchObject({'v2.0-bcs':78,'v2.1-oct':5,'write.effect':8,'write.reversible':39});
  for(const c of capabilities.filter(c=>c.id.startsWith('cap.report.')))expect(c.public).toBe(false);
  const rest=capabilities.filter(c=>c.slice==='v2.1-oct');expect(rest).toHaveLength(5);for(const c of rest)expect((await execute(ctx(),c.id,{},{} ) as any).error.code).toBe('RESERVED_NOT_BUILT');
 });
 it('redacts cursor and afterId even if an unrelated caller logs them',()=>{expect(redact({cursor:'secret',next_cursor:'secret',afterId:'id'})).toEqual({cursor:'[redacted]',next_cursor:'[redacted]',afterId:'[redacted]'});});

 it('walks a six-report page, rechecks revoked authority, and suppresses a corrupt lookahead without leaking cursor',async()=>{
  const saved=(await db.prepare('SELECT r.* FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=? ORDER BY r.id').bind(aid).all<any>()).results;
  const removed:any[]=[];
  try{
   for(let i=0;i<6;i++){expect((await build()).ok).toBe(true);if(i<5){const row=saved[i];await run('DELETE FROM response WHERE id=?',row.id);removed.push(row);}}
   const path='/v2/assessments/'+aid+'/reports';const first=await http(path);expect(first.body.result.reports).toHaveLength(5);const cursor=first.body.result.next_cursor;expect(cursor).toMatch(/^cur1_/);
   const second=await http(path+'?cursor='+encodeURIComponent(cursor));expect(second.body.result.reports).toHaveLength(1);expect(second.body.result.next_cursor).toBeNull();
   const ids=[...first.body.result.reports,...second.body.result.reports].map((r:any)=>r.id);expect(new Set(ids).size).toBe(6);expect(ids).toEqual([...ids].sort());
   const grant=await db.prepare('SELECT * FROM "grant" WHERE principal_id=? AND scope_type=? AND scope_id=?').bind('person_mara','assessment',aid).first<any>();
   await run('DELETE FROM "grant" WHERE id=?',grant.id);
   try{expect((await http(path+'?cursor='+encodeURIComponent(cursor))).body.error.code).toBe('NOT_FOUND_OR_NOT_VISIBLE');}finally{await run('INSERT INTO "grant" (id,principal_id,scope_type,scope_id,role,created_at) VALUES (?,?,?,?,?,?)',grant.id,grant.principal_id,grant.scope_type,grant.scope_id,grant.role,grant.created_at);}
   await run('DROP TRIGGER synthetic_report_no_update');try{await run('UPDATE synthetic_report SET payload_json=? WHERE id=?','{}',ids[5]);}finally{await run("CREATE TRIGGER synthetic_report_no_update BEFORE UPDATE ON synthetic_report BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END");}
   const corrupt=await http(path);expect(corrupt.body.result).toMatchObject({suppressed:true,reports:[]});expect(corrupt.body.result.next_cursor).toBeUndefined();for(const id of ids)expect(JSON.stringify(corrupt.body)).not.toContain(id);
   const persisted=JSON.stringify((await db.prepare('SELECT * FROM trace').all()).results);expect(persisted).not.toContain(cursor);for(const id of ids)expect(persisted).not.toContain(id);
  }finally{for(const r of removed){const keys=Object.keys(r);await run('INSERT INTO response ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')',...keys.map(k=>r[k]));}}
 });
 it('changed capture after uncertain commit has a new key rather than promised original recovery',async()=>{
  let fired=false;const uncertain=intercept(async(sql,_a,m,next)=>{const r=await next();if(sql.includes('INSERT INTO synthetic_report')&&m==='run'&&!fired){fired=true;throw Error('lost after commit');}return r;});
  expect((await build(aid,uncertain)).error.code).toBe('STAGE_CONFLICT');const original=await db.prepare('SELECT id FROM synthetic_report').first<any>();
  const row=await db.prepare('SELECT r.* FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=? ORDER BY r.id LIMIT 1').bind(aid).first<any>();await run('DELETE FROM response WHERE id=?',row.id);
  try{const retry=await build();expect(retry.result.report.id).not.toBe(original.id);expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(2);}finally{const keys=Object.keys(row);await run('INSERT INTO response ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')',...keys.map(k=>row[k]));}
 });
 it('viewer can read but cannot preview/build; archive is hidden',async()=>{
  const b=await build();await run('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_id=?','viewer','person_mara',aid);
  try{expect((await http('/v2/reports/'+b.result.report.id)).status).toBe(200);expect((await http('/v2/assessments/'+aid+'/reports',{mode:'dry_run'})).status).toBe(404);}finally{await run('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_id=?','owner','person_mara',aid);}
  await run('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17T08:00:00Z',aid);try{expect((await http('/v2/reports/'+b.result.report.id)).status).toBe(404);}finally{await run('UPDATE assessment SET archived_at=NULL WHERE id=?',aid);}
 });
 it('all34 attested contexts cross the real public handler and preserve accepted payload shape',async()=>{
  const aids=(await db.prepare("SELECT id FROM assessment WHERE id LIKE 'assess_syn_%' ORDER BY id").all<{id:string}>()).results;expect(aids).toHaveLength(34);
  for(const a of aids){const b=await build(a.id);expect(b.ok).toBe(true);const got=await http('/v2/reports/'+b.result.report.id);expect(got.status).toBe(200);expect(got.body.result.report.payload).toEqual(b.result.report.payload);}
 },60000);

 it('HTTP and protected MCP operational failure envelopes match after trace normalization',async()=>{
  const original=env.DB;env.DB=intercept(async(sql,_a,_m,next)=>{if(sql.includes('WITH target AS'))throw Error('injected unavailable');return next();});
  try{const h=await http('/v2/assessments/'+aid+'/reports');expect(h.status).toBe(409);expect(normalized(await mcp('cap.report.list',{aid}))).toEqual(normalized(h.body));}finally{env.DB=original;}
 });
});
