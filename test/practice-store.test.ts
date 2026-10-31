import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { PRACTICE_SCHEMA, createPractice, getPractice, listPractice, mutatePractice } from '../src/practice/store';
import { GENERATOR_VERSION, generate } from '../src/practice/generator';
import type { Ctx } from '../src/handlers/types';

const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'w',modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:{DB:'practice-local'}}]}));
afterAll(()=>mf.dispose());
async function fixture(){
 const db=await mf.getD1Database('DB');
 const base=readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
 await db.batch(base.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 await db.prepare('ALTER TABLE language ADD COLUMN archived_at TEXT').run();
 const templates=readFileSync(new URL('../migrations/0004_pinned_instruments.sql',import.meta.url),'utf8').split('\n').filter(l=>l.startsWith('INSERT'));
 await db.batch(templates.map(s=>db.prepare(s)));
 await db.batch(PRACTICE_SCHEMA.map(s=>db.prepare(s)));
 for(const id of ['owner','member','viewer','outside'])await db.prepare('INSERT INTO principal(id,email_hash,created_at) VALUES(?,?,?)').bind(id,id+'-synthetic','2026-10-30').run();
 await db.prepare("INSERT INTO workspace(id,name,created_at) VALUES('ws','Synthetic','2026-10-30')").run();
 await db.prepare("INSERT INTO project(id,workspace_id,name,created_at) VALUES('p','ws','Synthetic','2026-10-30')").run();
 await db.prepare("INSERT INTO language(id,project_id,code,name,created_at) VALUES('l','p','en','Synthetic','2026-10-30')").run();
 for(const aid of ['a','b']){
  await db.prepare("INSERT INTO assessment(id,project_id,language_id,name,format,stage,notes_reflection,created_at) VALUES(?,'p','l','PRIVATE SOURCE','written','prepare','PRIVATE NOTE','2026-10-30')").bind(aid).run();
  await db.prepare("INSERT INTO assessment_survey(id,assessment_id,template_id,template_version,created_at) VALUES(?,?,'tpl_validation',2,'2026-10-30')").bind('s'+aid,aid).run();
 }
 for(const [who,role] of [['owner','owner'],['member','member'],['viewer','viewer']])await db.prepare('INSERT INTO "grant"(id,principal_id,scope_type,scope_id,role,created_at) VALUES(?,?,\'workspace\',\'ws\',?,\'2026-10-30\')').bind('g'+who,who,role).run();
 // Real-domain sentinel: no practice API may mutate it.
 await db.prepare("INSERT INTO response(id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,submitted_at) VALUES('real','sa','real','real','{}','tpl_validation',2,'2026-10-30')").run();
 const ctx=(who='owner',kind='user'):Ctx=>({db,env:{DB:db,SESSION_SECRET:'local-synthetic'} as any,principal:{id:who,kind} as any,traceId:'synthetic',now:()=>new Date('2026-10-30T23:00:00Z'),log:()=>{}});
 return {db,ctx};
}

describe('unregistered private practice lifecycle on actual disposable D1',()=>{
 it('atomic create, inherited authority, durable readback, simulation/reset/undo/removal and real-data isolation',async()=>{
  const {db,ctx}=await fixture(),c=ctx();
  const tables=['assessment','assessment_survey','response','grant','project'];
  const capture=async()=>Promise.all(tables.map(async t=>(await db.prepare(`SELECT * FROM "${t}" ORDER BY id`).all()).results));
  const before=JSON.stringify(await capture());
  // Workspace role is sufficient: no direct assessment grant is present.
  expect(await db.prepare("SELECT count(*) AS n FROM \"grant\" WHERE scope_type='assessment'").first('n')).toBe(0);
  const creates=await Promise.all(Array.from({length:4},()=>createPractice(c,'a','same_create_key')));
  expect(new Set(creates.map(r=>r.practice_id)).size).toBe(1);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_copy').first('n')).toBe(1);
  expect(await db.prepare("SELECT count(*) AS n FROM practice_operation WHERE kind='create'").first('n')).toBe(1);
  const pid=creates[0].practice_id;
  const fresh=await getPractice(ctx(),pid);
  expect(fresh.count).toBe(0);expect(JSON.stringify(fresh)).not.toContain('PRIVATE');
  expect(fresh.results.status).toBe('held');
  for(const denied of [ctx('member'),ctx('viewer'),ctx('outside'),ctx('owner','participant'),ctx('outside','support'),ctx('owner','anonymous')]){
   await expect(getPractice(denied,pid)).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
   await expect(mutatePractice(denied,pid,'remove',0,'deny_remove_key')).rejects.toBeTruthy();
  }
  await expect(createPractice(ctx('viewer'),'a','deny_create_key')).rejects.toBeTruthy();
  await expect(createPractice(ctx('outside','support'),'a','deny_support_key')).rejects.toBeTruthy();
  // Support mode does not erase an existing effective grant or private ownership, nor add one.
  expect((await getPractice(ctx('owner','support'),pid)).practice_id).toBe(pid);
  // A member may make a separate private copy without sharing another creator's authority.
  const m=await createPractice(ctx('member'),'a','member_create_key');
  await expect(getPractice(c,m.practice_id)).rejects.toBeTruthy();
  expect((await listPractice(c)).practices.map(r=>r.id)).toEqual([pid]);
  expect((await listPractice(ctx('member'))).practices.map(r=>r.id)).toEqual([m.practice_id]);
  expect((await listPractice(ctx('outside'))).practices).toEqual([]);
  const simulations=await Promise.all(Array.from({length:4},()=>mutatePractice(c,pid,'simulate',0,'simulate_key','earning-trust')));
  const first=simulations[0];for(const retry of simulations)expect(retry).toEqual(first);
  expect(first.count).toBeGreaterThan(0);
  expect(await mutatePractice(c,pid,'simulate',0,'simulate_key','earning-trust')).toEqual(first);
  await expect(mutatePractice(c,pid,'simulate',0,'simulate_key','struggling-project')).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  expect((await getPractice(ctx(),pid)).revision).toBe(1);
  await expect(mutatePractice(c,pid,'reset',0,'stale_reset_key')).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  const reset=await mutatePractice(c,pid,'reset',1,'reset_key');expect(reset.count).toBe(0);
  const undo=await mutatePractice(c,pid,'undo',2,'undo_reset_key',reset.operation_id);expect(undo.count).toBe(first.count);
  await expect(mutatePractice(c,pid,'undo',3,'forged_undo_key','fake_operation')).rejects.toBeTruthy();
  const outcomes=await Promise.allSettled([mutatePractice(c,pid,'reset',3,'race_reset_one'),mutatePractice(c,pid,'reset',3,'race_reset_two')]);
  expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  // Current source selection edits do not change pinned practice setup.
  await db.prepare("UPDATE assessment_survey SET state='archived' WHERE id='sa'").run();
  expect((await getPractice(c,pid)).setup).toEqual(fresh.setup);
  expect((await createPractice(c,'a','same_create_key')).practice_id).toBe(pid);
  await db.prepare("UPDATE assessment_survey SET state='selected' WHERE id='sa'").run();
  // Revocation is checked before idempotent replay and on every read; removal stays owner-only.
  await db.prepare("DELETE FROM \"grant\" WHERE id='gowner'").run();
  await expect(getPractice(c,pid)).rejects.toBeTruthy();
  expect((await listPractice(c)).practices).toEqual([]);
  await expect(createPractice(c,'a','same_create_key')).rejects.toBeTruthy();
  const removed=await mutatePractice(c,pid,'remove',4,'remove_key');expect(removed.removed).toBe(true);
  await expect(mutatePractice(c,pid,'undo',5,'denied_undo_key',removed.operation_id)).rejects.toBeTruthy();
  await db.prepare("INSERT INTO \"grant\" VALUES('gowner','owner','workspace','ws','owner','2026-10-30')").run();
  await expect(getPractice(c,pid)).rejects.toBeTruthy();
  await mutatePractice(c,pid,'undo',5,'undo_remove_key',removed.operation_id);
  expect((await getPractice(c,pid)).removed).toBe(false);
  // Atomic create quota races: only remaining slots may win, with no orphan generations/operations.
  const quota=await Promise.allSettled(Array.from({length:14},(_,i)=>createPractice(c,'b',`quota_create_${i}`)));
  expect(quota.filter(x=>x.status==='fulfilled')).toHaveLength(9);
  expect(await db.prepare("SELECT count(*) AS n FROM practice_copy WHERE owner_id='owner' AND removed=0").first('n')).toBe(10);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_copy c LEFT JOIN practice_generation g ON g.practice_id=c.id AND g.generation=0 WHERE g.practice_id IS NULL').first('n')).toBe(0);
  // Restore source fixture selection/grants; all ordinary domain bytes still match.
  expect(JSON.stringify(await capture())).toBe(before);
  expect(await db.prepare("SELECT count(*) AS n FROM response").first('n')).toBe(1);
  // Actual D1 batch failure must roll back the copy when operation insertion fails.
  await db.prepare("CREATE TRIGGER reject_create BEFORE INSERT ON practice_operation WHEN NEW.kind='create' BEGIN SELECT RAISE(ABORT,'injected fault'); END").run();
  const count=await db.prepare('SELECT count(*) AS n FROM practice_copy').first('n');
  await expect(createPractice(ctx('member'),'b','injected_create_key')).rejects.toBeTruthy();
  expect(await db.prepare('SELECT count(*) AS n FROM practice_copy').first('n')).toBe(count);
  await db.prepare('DROP TRIGGER reject_create').run();
  for(let i=0;i<8;i++) await createPractice(ctx('member'),'b',`member_quota_${i}`);
  const edge=await Promise.all(Array.from({length:4},()=>createPractice(ctx('member'),'b','member_edge_key')));
  expect(new Set(edge.map(r=>r.practice_id)).size).toBe(1);
  expect(await db.prepare("SELECT count(*) AS n FROM practice_copy WHERE owner_id='member' AND removed=0").first('n')).toBe(10);
  // Undo removal is a new activation, so it must compete with CREATE for the same quota.
  const remAtQuota=await mutatePractice(c,pid,'remove',6,'quota_remove_key');
  const replacement=await createPractice(c,'b','quota_replacement_key');
  await expect(mutatePractice(c,pid,'undo',7,'quota_undo_key',remAtQuota.operation_id)).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  expect(await db.prepare("SELECT count(*) AS n FROM practice_copy WHERE owner_id='owner' AND removed=0").first('n')).toBe(10);
  await mutatePractice(c,replacement.practice_id,'remove',0,'remove_replacement_key');
  await mutatePractice(c,pid,'undo',7,'quota_undo_after_slot',remAtQuota.operation_id);
  expect((await getPractice(c,pid)).revision).toBe(8);
  // Authorization and source setup are checked again inside the actual commit, not just the pre-read.
  const revokeAtCommit={...ctx('member'),db:{prepare:db.prepare.bind(db),batch:async(stmts:any)=>{
    await db.prepare("DELETE FROM \"grant\" WHERE id='gmember'").run();return db.batch(stmts);
  }}} as unknown as Ctx;
  const rowCount=await db.prepare('SELECT count(*) AS n FROM practice_copy').first('n');
  // Remove a spare member copy to make quota available, so this is an auth race rather than quota refusal.
  await mutatePractice(ctx('member'),edge[0].practice_id,'remove',0,'spare_remove_key');
  await expect(createPractice(revokeAtCommit,'b','revoke_at_commit_key')).rejects.toBeTruthy();
  expect(await db.prepare('SELECT count(*) AS n FROM practice_copy').first('n')).toBe(rowCount);
  await db.prepare("INSERT INTO \"grant\" VALUES('gmember','member','workspace','ws','member','2026-10-30')").run();
  const changeAtCommit={...ctx('member'),db:{prepare:db.prepare.bind(db),batch:async(stmts:any)=>{
    await db.prepare("UPDATE assessment SET format='oral' WHERE id='b'").run();return db.batch(stmts);
  }}} as unknown as Ctx;
  await expect(createPractice(changeAtCommit,'b','source_changed_commit_key')).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  expect(await db.prepare('SELECT count(*) AS n FROM practice_copy').first('n')).toBe(rowCount);
  await db.prepare("UPDATE assessment SET format='written' WHERE id='b'").run();
  await db.prepare("UPDATE assessment SET archived_at='2026-10-30' WHERE id='a'").run();
  await expect(getPractice(c,pid)).rejects.toBeTruthy();
  expect((await listPractice(c)).practices.map(r=>r.id)).not.toContain(pid);
  await db.prepare("UPDATE assessment SET archived_at=NULL WHERE id='a'").run();
  // The bounded operation ledger reserves a cleanup slot even after source revocation.
  for(let i=0;i<126;i++)await mutatePractice(ctx('member'),m.practice_id,'reset',i,`history_reset_${i}`);
  await expect(mutatePractice(ctx('member'),m.practice_id,'reset',126,'history_overflow_key')).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  await db.prepare("DELETE FROM \"grant\" WHERE id='gmember'").run();
  const cleanup=await mutatePractice(ctx('member'),m.practice_id,'remove',126,'cleanup_at_limit');
  expect(cleanup.removed).toBe(true);expect(cleanup.undo_available).toBe(false);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(m.practice_id).first('n')).toBe(128);
  await db.prepare("INSERT INTO \"grant\" VALUES('gmember','member','workspace','ws','member','2026-10-30')").run();
  // Immutable generations cannot be rewritten or purged by lifecycle paths.
  await expect(db.prepare('DELETE FROM practice_generation WHERE practice_id=?').bind(pid).run()).rejects.toBeTruthy();
  expect(GENERATOR_VERSION).toBe('practice-source-fixtures-v1');
  expect(generate(fresh.setup,'earning-trust')).toEqual(generate(fresh.setup,'earning-trust'));
  expect(()=>generate(fresh.setup,'unreviewed')).toThrow();
  expect(()=>generate({...fresh.setup,surveys:fresh.setup.surveys.map(s=>({...s,items:s.items.slice(1)}))},'earning-trust')).toThrow();
 },90000);
});
