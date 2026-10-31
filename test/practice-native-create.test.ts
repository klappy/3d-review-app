import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { Ctx } from '../src/handlers/types';
import { PRACTICE_SCHEMA, getPractice, listPractice, readPracticeSource } from '../src/practice/store';
import { PRACTICE_NATIVE_SCHEMA, nativePracticeCreate, nativePracticeSimulation, nativePracticeMutation, nativePracticeUndo } from '../src/practice/native-receipt';
import { sha256Hex } from '../src/crypto';

const instances:Miniflare[]=[];let serial=0;
afterAll(()=>Promise.all(instances.map(m=>m.dispose())));
async function fixture(){
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'w',modules:true,script:'export default {fetch(){return new Response("synthetic")}}',d1Databases:{DB:'native-create-'+(++serial)}}]}));instances.push(mf);
 const db=await mf.getD1Database('DB');
 const sql=readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
 await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 await db.prepare('ALTER TABLE language ADD COLUMN archived_at TEXT').run();
 await db.batch(readFileSync(new URL('../migrations/0004_pinned_instruments.sql',import.meta.url),'utf8').split('\n').filter(l=>l.startsWith('INSERT')).map(s=>db.prepare(s)));
 await db.batch([...PRACTICE_SCHEMA,...PRACTICE_NATIVE_SCHEMA].map(s=>db.prepare(s)));
 for(const who of ['owner','member','viewer','outside'])await db.prepare('INSERT INTO principal(id,email_hash,created_at) VALUES(?,?,?)').bind(who,who,'2026-10-31').run();
 await db.prepare("INSERT INTO workspace(id,name,created_at) VALUES('ws','PRIVATE WORKSPACE','2026-10-31')").run();
 await db.prepare("INSERT INTO project(id,workspace_id,name,created_at) VALUES('p','ws','PRIVATE PROJECT','2026-10-31')").run();
 await db.prepare("INSERT INTO language(id,project_id,code,name,created_at) VALUES('l','p','en','PRIVATE LANGUAGE','2026-10-31')").run();
 await db.prepare("INSERT INTO assessment(id,project_id,language_id,name,purpose,notes_reflection,format,stage,created_at) VALUES('a','p','l','PRIVATE SOURCE','PRIVATE PURPOSE','PRIVATE NOTES','written','prepare','2026-10-31')").run();
 await db.prepare("INSERT INTO assessment_survey(id,assessment_id,template_id,template_version,created_at) VALUES('sa','a','tpl_validation',2,'2026-10-31')").run();
 await db.prepare("INSERT INTO response(id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,submitted_at) VALUES('real','sa','PRIVATE RESPONDENT','real','{\"private\":\"PRIVATE REAL ANSWER\"}','tpl_validation',2,'2026-10-31')").run();
 for(const [who,role] of [['owner','owner'],['member','member'],['viewer','viewer']])await db.prepare("INSERT INTO \"grant\" VALUES(?,?,'workspace','ws',?,'2026-10-31')").bind('g'+who,who,role).run();
 let trace=0;
 const ctx=(id='owner',kind='user'):Ctx=>({db,env:{DB:db,SESSION_SECRET:'synthetic-local-only'} as any,principal:{id,kind,provisioned:true} as any,traceId:'tr_create_'+(++trace),now:()=>new Date('2026-10-31T06:00:00Z'),log:()=>{}});
 const count=async()=>{const result:Record<string,unknown>={};for(const t of ['practice_copy','practice_generation','practice_operation','receipt','practice_native_receipt'])result[t]=await db.prepare(`SELECT count(*) AS n FROM ${t}`).first('n');return result;};
 const realHash=async()=>sha256Hex(JSON.stringify(await Promise.all(['principal','workspace','project','language','assessment','assessment_survey','grant','response','survey_template'].map(async t=>(await db.prepare(`SELECT * FROM "${t}" ORDER BY 1,2`).all()).results))));
 return {db,ctx,count,realHash};
}

describe('private native CREATE and simulation transactions',()=>{
 it('CREATE receipt failure rolls back copy/setup/generation/op/link; concurrent same intent returns original copy and native receipt',async()=>{
  const {db,ctx,count,realHash}=await fixture(),before=await count(),ordinary=await realHash();
  const digest=await sha256Hex(await readPracticeSource(ctx(),'a'));
  await db.prepare("CREATE TRIGGER create_receipt_fault BEFORE INSERT ON receipt WHEN NEW.capability='cap.practice.create' BEGIN SELECT RAISE(ABORT,'injected create native receipt fault'); END").run();
  await expect(nativePracticeCreate(ctx(),'a','atomic_create_key',{expectedSnapshotDigest:digest})).rejects.toBeTruthy();
  expect(await count()).toEqual(before);expect(await realHash()).toBe(ordinary);
  await db.prepare('DROP TRIGGER create_receipt_fault').run();
  const all=await Promise.all(Array.from({length:4},()=>nativePracticeCreate(ctx(),'a','atomic_create_key',{expectedSnapshotDigest:digest})));
  expect(new Set(all.map(r=>r.operation.practice_id)).size).toBe(1);expect(new Set(all.map(r=>r.receipt.id)).size).toBe(1);
  expect(all.filter(r=>!r.replayed)).toHaveLength(1);
  expect(await count()).toEqual({practice_copy:1,practice_generation:1,practice_operation:1,receipt:1,practice_native_receipt:1});
  const first=all[0],pid=String(first.operation.practice_id);
  expect(first.receipt.inverse).toBe('none');expect(first.receipt.undo_token).toBeUndefined();expect(first.receipt.scope).toEqual({type:'practice',id:pid});
  const setup=await getPractice(ctx(),pid);expect(setup.snapshot_digest).toBe(digest);expect(JSON.stringify(setup)).not.toContain('PRIVATE');
  await expect(nativePracticeCreate(ctx(),'a','atomic_create_key',{expectedSnapshotDigest:'0'.repeat(64)})).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  await expect(nativePracticeCreate(ctx(),'a','unknown_guard_key',{owner_id:'member'} as any)).rejects.toMatchObject({code:'INVALID_PARAMS'});
  await expect(nativePracticeCreate(ctx(),'a',undefined as any)).rejects.toMatchObject({code:'INVALID_PARAMS'});
  await nativePracticeSimulation(ctx(),pid,0,'first_simulation_key','earning-trust');
  const replay=await nativePracticeCreate(ctx(),'a','atomic_create_key',{expectedSnapshotDigest:digest});
  expect(replay.receipt).toEqual(first.receipt);expect(replay.operation).toEqual(first.operation);expect((await getPractice(ctx(),pid)).revision).toBe(1);
  expect(await realHash()).toBe(ordinary);
  const changedBodies=await Promise.allSettled([
   nativePracticeCreate(ctx(),'a','concurrent_create_body'),
   nativePracticeCreate(ctx(),'a','concurrent_create_body',{expectedSnapshotDigest:digest}),
  ]);
  expect(changedBodies.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect(changedBodies.find(x=>x.status==='rejected')).toMatchObject({reason:{code:'STAGE_CONFLICT'}});
  expect((await count()).practice_copy).toBe(2);
 });

 it('CREATE enforces concurrent active quota, same-key replay at the last slot, private ownership and inherited membership',async()=>{
  const {db,ctx,count}=await fixture();
  for(let i=0;i<9;i++)await nativePracticeCreate(ctx(),'a',`fill_native_${i}`);
  const edge=await Promise.all(Array.from({length:4},()=>nativePracticeCreate(ctx(),'a','same_edge_native_key')));
  expect(new Set(edge.map(x=>x.receipt.id)).size).toBe(1);expect(new Set(edge.map(x=>x.operation.practice_id)).size).toBe(1);
  const full=await count();expect(full.practice_copy).toBe(10);expect(full.receipt).toBe(10);
  const excess=await Promise.allSettled(Array.from({length:4},(_,i)=>nativePracticeCreate(ctx(),'a',`excess_native_${i}`)));
  expect(excess.every(r=>r.status==='rejected')).toBe(true);expect(await count()).toEqual(full);
  await nativePracticeMutation(ctx(),String(edge[0].operation.practice_id),'remove',0,'remove_for_race_key');
  const race=await Promise.allSettled(Array.from({length:4},(_,i)=>nativePracticeCreate(ctx(),'a',`compete_native_${i}`)));
  expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_copy WHERE removed=0 AND owner_id=\'owner\'').first('n')).toBe(10);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_copy c LEFT JOIN practice_generation g ON c.id=g.practice_id AND g.generation=0 WHERE g.practice_id IS NULL').first('n')).toBe(0);
  expect(await db.prepare("SELECT count(*) AS n FROM practice_operation o LEFT JOIN practice_native_receipt n ON n.operation_id=o.id WHERE o.kind='create' AND n.operation_id IS NULL").first('n')).toBe(0);
  const member=await nativePracticeCreate(ctx('member'),'a','same_edge_native_key');
  expect(member.operation.practice_id).not.toBe(edge[0].operation.practice_id);
  await expect(nativePracticeSimulation(ctx('owner'),String(member.operation.practice_id),0,'wrong_owner_sim_key','earning-trust')).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
  for(const denied of [ctx('viewer'),ctx('outside','support'),ctx('owner','participant'),ctx('owner','anonymous')])await expect(nativePracticeCreate(denied,'a','denied_native_key')).rejects.toBeTruthy();
 });

 it('source revocation/setup changes between read and write refuse atomically; source/grants are not copied',async()=>{
  const {db,ctx,count,realHash}=await fixture(),ordinary=await realHash();
  const revoke=(c:Ctx):Ctx=>({...c,db:{prepare:db.prepare.bind(db),batch:async(stmts:any)=>{await db.prepare("DELETE FROM \"grant\" WHERE id='gowner'").run();return db.batch(stmts);}}} as unknown as Ctx);
  const restore=()=>db.prepare("INSERT INTO \"grant\" VALUES('gowner','owner','workspace','ws','owner','2026-10-31')").run();
  const before=await count();
  await expect(nativePracticeCreate(revoke(ctx()),'a','revoke_create_key')).rejects.toBeTruthy();expect(await count()).toEqual(before);await restore();
  const changed={...ctx(),db:{prepare:db.prepare.bind(db),batch:async(stmts:any)=>{await db.prepare("UPDATE assessment SET format='oral' WHERE id='a'").run();return db.batch(stmts);}}} as unknown as Ctx;
  await expect(nativePracticeCreate(changed,'a','changed_setup_key')).rejects.toMatchObject({code:'STAGE_CONFLICT'});expect(await count()).toEqual(before);
  await db.prepare("UPDATE assessment SET format='written' WHERE id='a'").run();
  const created=await nativePracticeCreate(ctx(),'a','authorized_create_key'),pid=String(created.operation.practice_id),saved=await count();
  await expect(nativePracticeSimulation(revoke(ctx()),pid,0,'revoke_sim_key','earning-trust')).rejects.toBeTruthy();expect(await count()).toEqual(saved);
  await expect(nativePracticeCreate(ctx(),'a','authorized_create_key')).rejects.toBeTruthy();
  expect((await listPractice(ctx())).practices).toEqual([]); // No opaque-cleanup discovery exception added.
  await restore();await nativePracticeSimulation(ctx(),pid,0,'revoke_sim_key','earning-trust');
  expect((await getPractice(ctx(),pid)).revision).toBe(1);expect(await realHash()).toBe(ordinary);
 });

 it('simulation receipt faults roll back generation/CAS; duplicate and changed-body intents preserve original native receipts after later revisions',async()=>{
  const {db,ctx,count,realHash}=await fixture(),ordinary=await realHash();
  const c=await nativePracticeCreate(ctx(),'a','create_for_simulation'),pid=String(c.operation.practice_id),before=await count();
  await db.prepare("CREATE TRIGGER sim_receipt_fault BEFORE INSERT ON receipt WHEN NEW.capability='cap.practice.simulate' BEGIN SELECT RAISE(ABORT,'injected simulation receipt fault'); END").run();
  await expect(nativePracticeSimulation(ctx(),pid,0,'atomic_sim_key','earning-trust')).rejects.toBeTruthy();
  expect(await count()).toEqual(before);expect((await getPractice(ctx(),pid)).revision).toBe(0);expect((await getPractice(ctx(),pid)).count).toBe(0);
  await db.prepare('DROP TRIGGER sim_receipt_fault').run();
  const all=await Promise.all(Array.from({length:4},()=>nativePracticeSimulation(ctx(),pid,0,'atomic_sim_key','earning-trust')));
  expect(new Set(all.map(x=>x.receipt.id)).size).toBe(1);expect(all.filter(x=>!x.replayed)).toHaveLength(1);
  const first=all[0];expect(Number(first.operation.count)).toBeGreaterThan(0);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_generation').first('n')).toBe(2);
  const bodies=await Promise.allSettled([nativePracticeSimulation(ctx(),pid,1,'different_body_key','earning-trust'),nativePracticeSimulation(ctx(),pid,2,'different_body_key','earning-trust')]);
  expect(bodies.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  await nativePracticeMutation(ctx(),pid,'reset',2,'later_reset_key');
  const replay=await nativePracticeSimulation(ctx(),pid,0,'atomic_sim_key','earning-trust');
  expect(replay.replayed).toBe(true);expect(replay.receipt.id).toBe(first.receipt.id);expect(replay.operation).toEqual(first.operation);
  expect((await getPractice(ctx(),pid)).revision).toBe(3);expect((await getPractice(ctx(),pid)).count).toBe(0);
  await expect(nativePracticeSimulation(ctx(),pid,0,'atomic_sim_key','struggling-project')).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  await expect(nativePracticeSimulation(ctx(),pid,3,'unsupported_sim_key','struggling-project')).rejects.toMatchObject({code:'INVALID_PARAMS'});
  const generated=await db.prepare('SELECT answers_json FROM practice_generation WHERE generation>0').all<{answers_json:string}>();
  expect(generated.results.length).toBe(2);
  for(const row of generated.results){expect(row.answers_json).not.toContain('PRIVATE');expect(row.answers_json).not.toMatch(/trusted|attestation|respondent_id/);}
  expect(await realHash()).toBe(ordinary);
 });

 it('simulation Undo faults preserve token/state, and history/generation limits remain unchanged',async()=>{
  const {db,ctx,count}=await fixture();
  const c=await nativePracticeCreate(ctx(),'a','create_for_sim_undo'),pid=String(c.operation.practice_id);
  const sim=await nativePracticeSimulation(ctx(),pid,0,'simulation_undo_key','earning-trust'),before=await count();
  await db.prepare("CREATE TRIGGER inverse_fault BEFORE INSERT ON receipt WHEN NEW.capability='cap.ops.undo' AND NEW.scope_type='practice' BEGIN SELECT RAISE(ABORT,'injected inverse receipt failure'); END").run();
  await expect(nativePracticeUndo(ctx(),sim.receipt.undo_token!)).rejects.toBeTruthy();expect(await count()).toEqual(before);
  expect(await db.prepare('SELECT undo_token FROM receipt WHERE id=?').bind(sim.receipt.id).first('undo_token')).toBe(sim.receipt.undo_token);
  expect((await getPractice(ctx(),pid)).generation).toBe(1);await db.prepare('DROP TRIGGER inverse_fault').run();
  await nativePracticeUndo(ctx(),sim.receipt.undo_token!);expect((await getPractice(ctx(),pid)).generation).toBe(0);
  const history=Number(await db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(pid).first('n'));
  await db.batch(Array.from({length:127-history},(_,i)=>db.prepare("INSERT INTO practice_operation VALUES(?, 'owner', ?, ?, 'reset', ?, ?, '{}', '{}')").bind('history_cap_'+i,pid,pid,'history_cap_key_'+i,'0'.repeat(64))));
  const capped=await count();await expect(nativePracticeSimulation(ctx(),pid,2,'history_limit_sim','earning-trust')).rejects.toMatchObject({code:'STAGE_CONFLICT'});expect(await count()).toEqual(capped);
  const removed=await nativePracticeMutation(ctx(),pid,'remove',2,'history_limit_remove');
  expect(removed.receipt.undo_token).toBeUndefined();expect(removed.operation.undo_available).toBe(false);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(pid).first('n')).toBe(128);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_generation WHERE practice_id=?').bind(pid).first('n')).toBe(2);
  const other=await nativePracticeCreate(ctx('member'),'a','generation_limit_create'),otherId=String(other.operation.practice_id);
  await db.batch(Array.from({length:16},(_,i)=>db.prepare("INSERT INTO practice_generation VALUES(?,?,'earning-trust','fixture-only','[]')").bind(otherId,i+1)));
  const genCap=await count();await expect(nativePracticeSimulation(ctx('member'),otherId,0,'generation_limit_sim','earning-trust')).rejects.toMatchObject({code:'INVALID_PARAMS'});expect(await count()).toEqual(genCap);
 });
});
