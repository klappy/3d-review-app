import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { archive, get, set_stage } from '../src/handlers/assessment';
import { loadProject } from '../src/handlers/common';
import { execute } from '../src/dispatch';
import type { Ctx } from '../src/handlers/types';

// Isolated handler/D1 fixtures, not browser personas or authenticated HTTP sessions.
// No sign-in, session minting, email, external request or production store is used.
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'lifecycle-authority',modules:true,script:"export default {fetch(){return new Response('fixture')}}",d1Databases:{DB:'lifecycle-authority'}}]}));
let db:D1Database;let trace=0;
const at='2026-10-31T03:00:00.000Z';
const context=(id:string,kind:'user'|'support'|'participant'='user'):Ctx=>({db,env:{DB:db,SESSION_SECRET:'isolated-confirmation-fixture',ENVIRONMENT:'dev'} as any,principal:{id,kind,provisioned:true} as any,traceId:`lifecycle_${++trace}`,now:()=>new Date(at),log:()=>{}});
const run=(sql:string,...values:any[])=>db.prepare(sql).bind(...values).run();
beforeAll(async()=>{
 db=await mf.getD1Database('DB');
 for(const file of ['migrations/0001_init.sql','migrations/0011_context.sql']) {
  const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
 }
 const people=['assessment_only','both','workspace_direct','inherited','viewer','project_viewer','project_only','outside','support'];
 for(const id of people)await run('INSERT INTO principal(id,email_hash,provisioned,support,created_at) VALUES(?,?,1,?,?)',id,'fixture-'+id,id==='support'?1:0,at);
 await run("INSERT INTO workspace(id,name,created_at) VALUES('ws','SAMPLE workspace',?)",at);
 await run("INSERT INTO project(id,workspace_id,name,created_at) VALUES('p','ws','SAMPLE project',?)",at);
 await run("INSERT INTO language(id,project_id,name,created_at) VALUES('l','p','SAMPLE language',?)",at);
 await run("INSERT INTO assessment(id,project_id,language_id,name,stage,created_at) VALUES('a','p','l','SAMPLE review','prepare',?)",at);
 const grants=[
  ['aonly','assessment_only','assessment','a','owner'],['both-a','both','assessment','a','member'],['both-p','both','project','p','member'],
  ['wd-a','workspace_direct','assessment','a','member'],['wd-w','workspace_direct','workspace','ws','member'],['in-w','inherited','workspace','ws','owner'],
  ['view-a','viewer','assessment','a','viewer'],['view-p','viewer','project','p','owner'],['pv-a','project_viewer','assessment','a','member'],['pv-p','project_viewer','project','p','viewer'],
  ['po-p','project_only','project','p','owner']
 ];
 for(const [id,principal,scopeType,scopeId,role] of grants)await run('INSERT INTO "grant"(id,principal_id,scope_type,scope_id,role,created_at) VALUES(?,?,?,?,?,?)',id,principal,scopeType,scopeId,role,at);
},30000);
afterAll(()=>mf.dispose());
afterEach(async()=>{
 if(await db.prepare("SELECT id FROM assessment WHERE id='a'").first()){
  await run("UPDATE assessment SET archived_at=NULL, stage='prepare' WHERE id='a'");
  await run('INSERT OR IGNORE INTO "grant"(id,principal_id,scope_type,scope_id,role,created_at) VALUES(?,?,?,?,?,?)','both-p','both','project','p','member',at);
 }
});

describe('archive eligibility is the existing intersection of direct review and effective project authority',()=>{
 it.each([
  ['assessment_only',false],['both',true],['workspace_direct',true],['inherited',false],['viewer',false],['project_viewer',false],['support',false]
 ])('%s receives truthful archive eligibility without a broader grant',(id,allowed)=>{
  return get(context(id as string,id==='support'?'support':'user'),{id:'a'}).then(result=>{
   expect(result.result.assessment.can_archive).toBe(allowed);
   expect(result.result.assessment.id).toBe('a');
  });
 });
 it('no project grant, participant context or outside identity opens an assessment by implication',async()=>{
  for(const [id,kind] of [['project_only','user'],['outside','user'],['assessment_only','participant']] as const)
   await expect(get(context(id,kind),{id:'a'})).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
 });
 it('archive and persisted readback agree, and revoking project membership removes eligibility without writing',async()=>{
  await archive(context('both'),{id:'a'});
  expect((await get(context('both'),{id:'a'})).result.assessment).toMatchObject({can_archive:true,archived_at:at});
  expect((await db.prepare("SELECT archived_at FROM assessment WHERE id='a'").first<any>()).archived_at).toBe(at);
  await run("UPDATE assessment SET archived_at=NULL WHERE id='a'");
  await run("DELETE FROM \"grant\" WHERE id='both-p'");
  expect((await get(context('both'),{id:'a'})).result.assessment.can_archive).toBe(false);
  await expect(archive(context('both'),{id:'a'})).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
  expect((await db.prepare("SELECT archived_at FROM assessment WHERE id='a'").first<any>()).archived_at).toBeNull();
 });
 it('inherited review ownership and assessment-only ownership do not bypass the existing archive guard',async()=>{
  for(const [id,code] of [['inherited','NOT_AUTHORIZED_AT_SCOPE'],['assessment_only','NOT_FOUND_OR_NOT_VISIBLE']])
   await expect(archive(context(id),{id:'a'})).rejects.toMatchObject({code});
  expect((await db.prepare("SELECT archived_at FROM assessment WHERE id='a'").first<any>()).archived_at).toBeNull();
 });
});

it('adjacent stage writes persist and a nonadjacent refusal leaves the row unchanged',async()=>{
 for(const stage of ['collect','understand','improve','understand','collect','prepare']){
  await set_stage(context('assessment_only'),{id:'a',stage});
  expect((await db.prepare("SELECT stage FROM assessment WHERE id='a'").first<any>()).stage).toBe(stage);
 }
 await expect(set_stage(context('assessment_only'),{id:'a',stage:'improve'})).rejects.toMatchObject({code:'STAGE_CONFLICT'});
 expect((await db.prepare("SELECT stage FROM assessment WHERE id='a'").first<any>()).stage).toBe('prepare');
});

it('assessment-only direct owner confirms and deletes an empty review despite an inaccessible parent',async()=>{
 await expect(loadProject(context('assessment_only'),'p')).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
 const dry:any=await execute(context('assessment_only'),'cap.assessment.delete',{id:'a'},{tool:'danger',mode:'dry_run'});
 expect(dry.ok).toBe(true);
 const done:any=await execute(context('assessment_only'),'cap.assessment.delete',{id:'a'},{tool:'danger',mode:'execute',confirm_token:dry.result.confirm_token});
 expect(done).toMatchObject({ok:true,result:{deleted:true,id:'a'}});
 expect(await db.prepare("SELECT id FROM assessment WHERE id='a'").first()).toBeNull();
 await expect(get(context('assessment_only'),{id:'a'})).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
});
