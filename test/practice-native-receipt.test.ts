import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { PRACTICE_SCHEMA, createPractice, getPractice, mutatePractice } from '../src/practice/store';
import { PRACTICE_NATIVE_SCHEMA, nativePracticeMutation, nativePracticeUndo } from '../src/practice/native-receipt';
import { execute } from '../src/dispatch';
import type { Ctx } from '../src/handlers/types';

const instances:Miniflare[]=[];let serial=0;
afterAll(()=>Promise.all(instances.map(m=>m.dispose())));
async function fixture(){
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'w',modules:true,script:'export default {fetch(){return new Response("synthetic")}}',d1Databases:{DB:'native-'+(++serial)}}]}));instances.push(mf);
 const db=await mf.getD1Database('DB');
 const sql=readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
 await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 await db.prepare('ALTER TABLE language ADD COLUMN archived_at TEXT').run();
 const template=readFileSync(new URL('../migrations/0004_pinned_instruments.sql',import.meta.url),'utf8').split('\n').filter(l=>l.startsWith('INSERT'));
 await db.batch(template.map(s=>db.prepare(s)));
 const receiptSchema=(await db.prepare('PRAGMA table_info(receipt)').all()).results;
 await db.batch([...PRACTICE_SCHEMA,...PRACTICE_NATIVE_SCHEMA].map(s=>db.prepare(s)));
 for(const id of ['owner','other'])await db.prepare('INSERT INTO principal(id,email_hash,created_at) VALUES(?,?,?)').bind(id,id,'2026-10-31').run();
 await db.prepare("INSERT INTO workspace(id,name,created_at) VALUES('ws','Synthetic','2026-10-31')").run();
 await db.prepare("INSERT INTO project(id,workspace_id,name,created_at) VALUES('p','ws','Synthetic','2026-10-31')").run();
 await db.prepare("INSERT INTO language(id,project_id,code,name,created_at) VALUES('l','p','en','Synthetic','2026-10-31')").run();
 await db.prepare("INSERT INTO assessment(id,project_id,language_id,name,format,stage,notes_reflection,created_at) VALUES('a','p','l','Synthetic','written','prepare','old synthetic note','2026-10-31')").run();
 await db.prepare("INSERT INTO assessment_survey(id,assessment_id,template_id,template_version,created_at) VALUES('sa','a','tpl_validation',2,'2026-10-31')").run();
 await db.prepare("INSERT INTO \"grant\" VALUES('go','owner','workspace','ws','owner','2026-10-31')").run();
 let trace=0;
 const ctx=(id='owner',kind='user'):Ctx=>({db,env:{DB:db,SESSION_SECRET:'synthetic-local-only'} as any,principal:{id,kind,provisioned:true} as any,traceId:'tr_native_'+(++trace),now:()=>new Date('2026-10-31T05:00:00Z'),log:()=>{}});
 const c=ctx(),created=await createPractice(c,'a','initial_create_key'),pid=created.practice_id;
 const counts=async()=>({copies:await db.prepare('SELECT count(*) AS n FROM practice_copy').first('n'),ops:await db.prepare('SELECT count(*) AS n FROM practice_operation').first('n'),receipts:await db.prepare('SELECT count(*) AS n FROM receipt').first('n'),links:await db.prepare('SELECT count(*) AS n FROM practice_native_receipt').first('n')});
 return {db,ctx,c,pid,counts,receiptSchema};
}

describe('unregistered native practice receipt transaction prototype',()=>{
 it('native receipt failure rolls back state/operation/link; replay returns the original native receipt',async()=>{
  const {db,c,ctx,pid,counts}=await fixture();
  await mutatePractice(c,pid,'simulate',0,'simulate_setup_key','earning-trust');
  const before=await counts();
  await db.prepare("CREATE TRIGGER native_fault BEFORE INSERT ON receipt WHEN NEW.scope_type='practice' BEGIN SELECT RAISE(ABORT,'injected native receipt failure'); END").run();
  await expect(nativePracticeMutation(c,pid,'reset',1,'native_reset_key')).rejects.toBeTruthy();
  expect(await counts()).toEqual(before);expect((await getPractice(ctx(),pid)).revision).toBe(1);
  await db.prepare('DROP TRIGGER native_fault').run();
  const first=await nativePracticeMutation(c,pid,'reset',1,'native_reset_key');
  expect(first.replayed).toBe(false);expect(first.receipt.scope).toEqual({type:'practice',id:pid});
  expect(first.receipt.undo_token).toBeTruthy();expect((await getPractice(ctx(),pid)).count).toBe(0);
  const replay=await nativePracticeMutation(ctx(),pid,'reset',1,'native_reset_key');
  expect(replay.replayed).toBe(true);expect(replay.receipt).toEqual(first.receipt);expect(replay.operation).toEqual(first.operation);
  expect(await db.prepare('SELECT count(*) AS n FROM receipt').first('n')).toBe(1);
  const prior=String(await db.prepare('SELECT prior_state_json FROM receipt WHERE id=?').bind(first.receipt.id).first('prior_state_json'));
  expect(prior).not.toMatch(/answers|snapshot|notes|source_id|undo_token/);
  await expect(nativePracticeMutation(ctx(),pid,'reset',2,'native_reset_key')).rejects.toMatchObject({code:'STAGE_CONFLICT'});
 });

 it('inverse receipt/consumption faults retain original token and state; only the creator can undo',async()=>{
  const {db,c,ctx,pid,counts}=await fixture();
  const filled=await mutatePractice(c,pid,'simulate',0,'simulate_setup_key','earning-trust');
  const reset=await nativePracticeMutation(c,pid,'reset',1,'native_reset_key'),token=reset.receipt.undo_token!;
  const before=await counts();
  await db.prepare("CREATE TRIGGER inverse_receipt_fault BEFORE INSERT ON receipt WHEN NEW.scope_type='practice' AND NEW.capability='cap.ops.undo' BEGIN SELECT RAISE(ABORT,'injected inverse receipt failure'); END").run();
  await expect(nativePracticeUndo(ctx(),token)).rejects.toBeTruthy();
  expect(await counts()).toEqual(before);expect((await getPractice(ctx(),pid)).revision).toBe(2);
  expect(await db.prepare('SELECT undo_token FROM receipt WHERE id=?').bind(reset.receipt.id).first('undo_token')).toBe(token);
  await db.prepare('DROP TRIGGER inverse_receipt_fault').run();
  await db.prepare("CREATE TRIGGER consume_fault BEFORE UPDATE OF undo_token ON receipt WHEN OLD.scope_type='practice' AND OLD.undo_token IS NOT NULL AND NEW.undo_token IS NULL BEGIN SELECT RAISE(ABORT,'injected consumption failure'); END").run();
  await expect(nativePracticeUndo(ctx(),token)).rejects.toBeTruthy();
  expect(await counts()).toEqual(before);expect((await getPractice(ctx(),pid)).count).toBe(0);
  expect(await db.prepare('SELECT undo_token FROM receipt WHERE id=?').bind(reset.receipt.id).first('undo_token')).toBe(token);
  await db.prepare('DROP TRIGGER consume_fault').run();
  for(const denied of [ctx('other'),ctx('other','support'),ctx('owner','participant'),ctx('owner','anonymous')])await expect(nativePracticeUndo(denied,token)).rejects.toMatchObject({code:'NOT_FOUND_OR_NOT_VISIBLE'});
  await db.prepare("DELETE FROM \"grant\" WHERE id='go'").run();
  await expect(nativePracticeUndo(ctx(),token)).rejects.toBeTruthy();
  expect(await db.prepare('SELECT undo_token FROM receipt WHERE id=?').bind(reset.receipt.id).first('undo_token')).toBe(token);
  await db.prepare("INSERT INTO \"grant\" VALUES('go','owner','workspace','ws','owner','2026-10-31')").run();
  const restored=await nativePracticeUndo(ctx(),token);
  expect(restored.receipt.inverse).toBe('none');expect(restored.receipt.undo_token).toBeUndefined();
  expect(restored.operation.count).toBe(filled.count);expect((await getPractice(ctx(),pid)).revision).toBe(3);
  expect(await db.prepare('SELECT undo_token FROM receipt WHERE id=?').bind(reset.receipt.id).first('undo_token')).toBeNull();
  await expect(nativePracticeUndo(ctx(),token)).rejects.toBeTruthy();
 });

 it('concurrent identical mutations and same-token inverses produce one native operation each',async()=>{
  const {db,ctx,pid}=await fixture();
  const all=await Promise.all(Array.from({length:4},()=>nativePracticeMutation(ctx(),pid,'reset',0,'same_native_key')));
  expect(new Set(all.map(x=>x.receipt.id)).size).toBe(1);expect(all.filter(x=>!x.replayed)).toHaveLength(1);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_native_receipt').first('n')).toBe(1);
  const undo=await Promise.allSettled(Array.from({length:4},()=>nativePracticeUndo(ctx(),all[0].receipt.undo_token!)));
  expect(undo.some(x=>x.status==='fulfilled')).toBe(true);
  expect(await db.prepare("SELECT count(*) AS n FROM practice_operation WHERE kind='undo'").first('n')).toBe(1);
  expect(await db.prepare("SELECT count(*) AS n FROM receipt WHERE capability='cap.ops.undo'").first('n')).toBe(1);
  expect((await getPractice(ctx(),pid)).revision).toBe(2);
 });

 it('undo activation obeys quota; ceiling cleanup is fail-closed and retains tombstones without promising Undo',async()=>{
  const {db,c,ctx,pid}=await fixture();
  const removal=await nativePracticeMutation(c,pid,'remove',0,'native_remove_key');
  for(let i=0;i<10;i++)await createPractice(ctx(),'a',`replacement_${i}`);
  await expect(nativePracticeUndo(ctx(),removal.receipt.undo_token!)).rejects.toMatchObject({code:'STAGE_CONFLICT'});
  expect(await db.prepare('SELECT undo_token FROM receipt WHERE id=?').bind(removal.receipt.id).first('undo_token')).toBe(removal.receipt.undo_token);
  expect(await db.prepare('SELECT removed FROM practice_copy WHERE id=?').bind(pid).first('removed')).toBe(1);
  const spare=String(await db.prepare('SELECT id FROM practice_copy WHERE removed=0 LIMIT 1').first('id'));
  // Seed only historical fixture rows; this is not a claim of126 executed UI/API operations.
  const existing=Number(await db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(spare).first('n'));
  await db.batch(Array.from({length:127-existing},(_,i)=>db.prepare("INSERT INTO practice_operation VALUES(?, 'owner', ?, ?, 'reset', ?, ?, '{}', '{}')").bind('history_'+i,spare,spare,'history_key_'+i,'0'.repeat(64))));
  await db.prepare("DELETE FROM \"grant\" WHERE id='go'").run();
  const cleanup=await nativePracticeMutation(ctx(),spare,'remove',0,'cleanup_limit_key');
  expect(cleanup.operation.undo_available).toBe(false);expect(cleanup.receipt.inverse).toBe('none');expect(cleanup.receipt.undo_token).toBeUndefined();
  expect(await db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(spare).first('n')).toBe(128);
  expect(await db.prepare('SELECT removed FROM practice_copy WHERE id=?').bind(spare).first('removed')).toBe(1);
  expect(await db.prepare('SELECT count(*) AS n FROM practice_generation WHERE practice_id=?').bind(spare).first('n')).toBe(1);
  await expect(nativePracticeUndo(ctx(),'not_a_token')).rejects.toBeTruthy();
 });

 it('existing real-assessment receipt/Undo and receipt schema remain unchanged',async()=>{
  const {db,ctx,receiptSchema}=await fixture();
  expect((await db.prepare('PRAGMA table_info(receipt)').all()).results).toEqual(receiptSchema);
  const saved:any=await execute(ctx(),'cap.assessment.notes.update',{id:'a',notes_reflection:'changed synthetic note'},{tool:'write'});
  expect(saved.ok).toBe(true);expect(saved.receipt.scope).toEqual({type:'assessment',id:'a'});expect(saved.receipt.inverse).toBe('self:restore-prior');
  expect(saved.receipt.undo_token).toBeTruthy();
  const undone:any=await execute(ctx(),'cap.ops.undo',{token:saved.receipt.undo_token},{tool:'write'});
  expect(undone.ok).toBe(true);expect(undone.receipt.scope).toEqual({type:'assessment',id:'a'});
  expect(await db.prepare("SELECT notes_reflection FROM assessment WHERE id='a'").first('notes_reflection')).toBe('old synthetic note');
  expect(await db.prepare('SELECT undo_token FROM receipt WHERE id=?').bind(saved.receipt.id).first('undo_token')).toBeNull();
  expect(await db.prepare('SELECT count(*) AS n FROM practice_native_receipt').first('n')).toBe(0);
 });
});
