/** UNREGISTERED TRANSACTION PROTOTYPE: create/simulate/reset/removal and native Undo.
 * Not called by store.ts, HTTP, dispatch, mintReceipt or opsUndo. No runtime DDL.
 * Reuses the existing receipt table/IDs/tokens; shared integration still needs review.
 */
import type { Ctx } from '../handlers/types';
import type { Receipt } from '../envelope';
import { canonical, newReceiptId, newUndoToken } from '../receipt';
import { sha256Hex } from '../crypto';
import { practiceActor, readPracticeSource, practiceSourceAllowed, practiceSourceJoin,
  practiceSnapshotSql, practiceLiveSource, practiceGrantSql } from './store';
import { generate, GENERATOR_VERSION, type PracticeAnswer } from './generator';
import { CapError, isConstraintError, notVisible } from '../errors';

export const PRACTICE_NATIVE_SCHEMA = [
  `CREATE TABLE practice_native_receipt(operation_id TEXT PRIMARY KEY REFERENCES practice_operation(id), receipt_id TEXT NOT NULL UNIQUE REFERENCES receipt(id))`,
  `CREATE TRIGGER practice_native_immutable_update BEFORE UPDATE ON practice_native_receipt BEGIN SELECT RAISE(ABORT,'immutable practice native linkage'); END`,
  `CREATE TRIGGER practice_native_immutable_delete BEFORE DELETE ON practice_native_receipt BEGIN SELECT RAISE(ABORT,'immutable practice native linkage'); END`,
] as const;
interface Copy { id:string; owner_id:string; source_id:string; revision:number; generation:number; removed:number; allowed:number; snapshot_json:string }
interface Operation { id:string; kind:string; body_digest:string; before_json:string; receipt_json:string }
interface NativeRow { id:string; actor:string; capability:string; scope_type:string; scope_id:string; class:string; inverse:string; undo_token:string|null; trace_id:string; at:string; prior_state_json:string }
export interface NativePracticeOutcome { operation:Record<string,unknown>; receipt:Receipt; replayed:boolean }
const conflict=(message='The practice state or inverse changed. Reload before retrying.'):never=>{throw new CapError('STAGE_CONFLICT',message);};
const fail=(message:string):never=>{throw new CapError('INVALID_PARAMS',message);};
const AUTH=practiceSourceAllowed;
const actor=practiceActor;
function validIntent(revision:number,key:string){
  if(!Number.isSafeInteger(revision)||revision<0||typeof key!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(key))fail('Invalid practice operation.');
}
async function owned(ctx:Ctx,pid:string,cleanup=false):Promise<Copy>{
  const who=actor(ctx);
  const c=await ctx.db.prepare(`SELECT c.*,CASE WHEN ${AUTH} THEN 1 ELSE 0 END AS allowed FROM practice_copy c WHERE c.id=? AND c.owner_id=?`)
    .bind(pid,who).first<Copy>();
  if(!c||(!cleanup&&!c.allowed))throw notVisible('practice');return c;
}
function native(r:NativeRow):Receipt{
  return {id:r.id,actor:r.actor,scope:{type:r.scope_type,id:r.scope_id},class:r.class,inverse:r.inverse,trace_id:r.trace_id,at:r.at,
    ...(r.undo_token?{undo_token:r.undo_token}:{})};
}
async function priorOperation(ctx:Ctx,pid:string,kind:string,key:string):Promise<Operation|null>{
  return ctx.db.prepare('SELECT id,kind,body_digest,before_json,receipt_json FROM practice_operation WHERE owner_id=? AND scope_id=? AND kind=? AND operation_key=?')
    .bind(actor(ctx),pid,kind,key).first<Operation>();
}
async function replay(ctx:Ctx,c:Copy,op:Operation,digest:string,capability:string):Promise<NativePracticeOutcome>{
  if(op.body_digest!==digest)conflict('Operation key was used with different input.');
  if(c.removed&&op.kind!=='remove')throw notVisible('practice');
  const r=await ctx.db.prepare(`SELECT r.* FROM practice_native_receipt n JOIN receipt r ON r.id=n.receipt_id
   WHERE n.operation_id=? AND r.actor=? AND r.capability=? AND r.scope_type='practice' AND r.scope_id=?`)
    .bind(op.id,actor(ctx),capability,c.id).first<NativeRow>();
  if(!r)conflict('The operation has no verified native receipt linkage. Do not mint a replacement.');
  return {operation:JSON.parse(op.receipt_json),receipt:native(r!),replayed:true};
}

/** Private builders only: not yet wired into store handlers or shared registration. */
export async function nativePracticeMutation(ctx:Ctx,pid:string,kind:'reset'|'remove',expectedRevision:number,operationKey:string):Promise<NativePracticeOutcome>{
  if(!['reset','remove'].includes(kind))fail('Invalid practice operation.');
  validIntent(expectedRevision,operationKey);
  const c=await owned(ctx,pid,kind==='remove');
  const digest=await sha256Hex(canonical({kind,expectedRevision})),capability=`cap.practice.${kind}`;
  const old=await priorOperation(ctx,pid,kind,operationKey);
  if(old)return replay(ctx,c,old,digest,capability);
  if(c.revision!==expectedRevision||c.removed)conflict();
  return commit(ctx,c,{kind,key:operationKey,digest,capability,generation:kind==='reset'?0:c.generation,removed:kind==='remove'?1:c.removed});
}

interface CreateGuard { expectedSnapshotDigest?:string }
export async function nativePracticeCreate(ctx:Ctx,sourceId:string,operationKey:string,guard:CreateGuard={}):Promise<NativePracticeOutcome>{
  validIntent(0,operationKey);
  if(typeof sourceId!=='string'||!sourceId||sourceId.length>256||!guard||typeof guard!=='object'||Array.isArray(guard)
    ||Object.keys(guard).some(k=>k!=='expectedSnapshotDigest')
    ||(guard.expectedSnapshotDigest!==undefined&&(typeof guard.expectedSnapshotDigest!=='string'||!/^[a-f0-9]{64}$/.test(guard.expectedSnapshotDigest))))fail('Invalid practice creation intent.');
  const who=actor(ctx);await readPracticeSource(ctx,sourceId,false);
  const digest=await sha256Hex(canonical({sourceId,expectedSnapshotDigest:guard.expectedSnapshotDigest??null}));
  const capability='cap.practice.create';
  const replayCreate=async(op:Operation)=>{
    const pid=JSON.parse(op.receipt_json).practice_id;
    return replay(ctx,await owned(ctx,pid),op,digest,capability);
  };
  const previous=await priorOperation(ctx,sourceId,'create',operationKey);if(previous)return replayCreate(previous);
  const snapshot=await readPracticeSource(ctx,sourceId),snapshotDigest=await sha256Hex(snapshot);
  if(guard.expectedSnapshotDigest!==undefined&&guard.expectedSnapshotDigest!==snapshotDigest)conflict('The selected source setup changed. Reload before creating a copy.');
  const pid='practice_'+crypto.randomUUID(),op='practice_op_'+crypto.randomUUID(),receiptId=newReceiptId(),at=ctx.now().toISOString();
  const result={practice_id:pid,operation_id:op,revision:0,generation:0,removed:false,count:0,practice:true,undo_available:false};
  const prepared=receiptBatch(ctx,{pid,op,receiptId,at,capability,token:null,revision:0});
  const batch=[
    ctx.db.prepare(`INSERT INTO practice_copy SELECT ?1,?2,?3,?4,?5,0,0,0,?6 FROM ${practiceSourceJoin}
      WHERE a.id=?3 AND ${practiceLiveSource} AND ${practiceGrantSql('?2')} AND ${practiceSnapshotSql}=?4
      AND(SELECT count(*) FROM practice_copy WHERE owner_id=?2 AND removed=0)<10
      AND(SELECT count(*) FROM practice_copy WHERE owner_id=?2)<50`).bind(pid,who,sourceId,snapshot,snapshotDigest,at),
    ctx.db.prepare(`INSERT INTO practice_generation SELECT id,0,NULL,?2,'[]' FROM practice_copy WHERE id=?1`).bind(pid,GENERATOR_VERSION),
    ctx.db.prepare(`INSERT INTO practice_operation SELECT ?1,owner_id,source_id,id,'create',?2,?3,'{}',?4 FROM practice_copy WHERE id=?5`)
      .bind(op,operationKey,digest,JSON.stringify(result),pid),...prepared.statements];
  try{await ctx.db.batch(batch);}catch(error){
    if(!isConstraintError(error))throw error;
    await readPracticeSource(ctx,sourceId,false);
    const won=await priorOperation(ctx,sourceId,'create',operationKey);if(!won)throw error;return replayCreate(won);
  }
  const linked=await ctx.db.prepare('SELECT operation_id FROM practice_native_receipt WHERE operation_id=?').bind(op).first();
  await readPracticeSource(ctx,sourceId,false);
  if(!linked){const won=await priorOperation(ctx,sourceId,'create',operationKey);if(won)return replayCreate(won);conflict('Practice quota or setup changed. Reload before retrying.');}
  const fresh=await owned(ctx,pid);if(fresh.removed)throw notVisible('practice');
  return {operation:result,receipt:prepared.receipt,replayed:false};
}

export async function nativePracticeSimulation(ctx:Ctx,pid:string,expectedRevision:number,operationKey:string,scenarioId:string):Promise<NativePracticeOutcome>{
  validIntent(expectedRevision,operationKey);if(typeof scenarioId!=='string')fail('Invalid practice scenario.');
  const c=await owned(ctx,pid),capability='cap.practice.simulate';
  const digest=await sha256Hex(canonical({kind:'simulate',expectedRevision,scenarioId}));
  const old=await priorOperation(ctx,pid,'simulate',operationKey);if(old)return replay(ctx,c,old,digest,capability);
  if(c.revision!==expectedRevision||c.removed)conflict();
  const answers=generate(JSON.parse(c.snapshot_json),scenarioId);
  const row=await ctx.db.prepare('SELECT max(generation) AS n,count(*) AS total FROM practice_generation WHERE practice_id=?').bind(pid).first<{n:number;total:number}>();
  if(!row||row.total>=17)fail('This practice copy has reached its simulation limit.');
  return commit(ctx,c,{kind:'simulate',key:operationKey,digest,capability,generation:row!.n+1,removed:0,newGeneration:{scenarioId,answers}});
}

/** Internal prototype, not a new transport or a replacement for global opsUndo.
 * No caller-provided prior generation/tombstone; native token → immutable operation. */
export async function nativePracticeUndo(ctx:Ctx,token:string):Promise<NativePracticeOutcome>{
  actor(ctx);
  const r=await ctx.db.prepare("SELECT * FROM receipt WHERE undo_token=? AND actor=? AND scope_type='practice'")
    .bind(token,ctx.principal.id).first<NativeRow>();
  if(!r||!['cap.practice.simulate','cap.practice.reset','cap.practice.remove'].includes(r.capability)||r.inverse!=='self:practice-operation')throw notVisible('practice inverse');
  const c=await owned(ctx,r.scope_id);
  const linked=await ctx.db.prepare(`SELECT o.id,o.kind,o.body_digest,o.before_json,o.receipt_json FROM practice_native_receipt n
    JOIN practice_operation o ON o.id=n.operation_id WHERE n.receipt_id=? AND o.owner_id=? AND o.practice_id=?`)
    .bind(r.id,c.owner_id,c.id).first<Operation>();
  if(!linked||r.capability!==`cap.practice.${linked.kind}`)throw notVisible('practice inverse');
  const prior=JSON.parse(r.prior_state_json)?.prior;
  if(prior?.practice_operation_id!==linked.id||prior?.practice_expected_revision!==JSON.parse(linked.receipt_json).revision)throw notVisible('practice inverse');
  const key='undo_'+r.id,digest=await sha256Hex(canonical({kind:'undo',receipt_id:r.id,revision:prior.practice_expected_revision}));
  const old=await priorOperation(ctx,c.id,'undo',key);
  if(old)return replay(ctx,c,old,digest,'cap.ops.undo');
  if(c.revision!==prior.practice_expected_revision)conflict();
  const before=JSON.parse(linked.before_json);
  if(!Number.isSafeInteger(before.generation)||![0,1].includes(before.removed))throw notVisible('practice inverse');
  return commit(ctx,c,{kind:'undo',key,digest,capability:'cap.ops.undo',generation:before.generation,removed:before.removed,consume:r});
}

interface Intent { kind:'simulate'|'reset'|'remove'|'undo'; key:string; digest:string; capability:string; generation:number; removed:number; consume?:NativeRow;newGeneration?:{scenarioId:string;answers:PracticeAnswer[]} }
interface ReceiptIntent {pid:string;op:string;receiptId:string;at:string;capability:string;token:string|null;revision:number}
function receiptBatch(ctx:Ctx,i:ReceiptIntent){
  const who=actor(ctx),receipt:Receipt={id:i.receiptId,actor:who,scope:{type:'practice',id:i.pid},class:'write.reversible',inverse:i.token?'self:practice-operation':'none',trace_id:ctx.traceId,at:i.at,...(i.token?{undo_token:i.token}:{})};
  const prior=JSON.stringify({prior:{practice_operation_id:i.op,practice_expected_revision:i.revision},params:{id:i.pid},result_ids:{practice_id:i.pid,operation_id:i.op}});
  const statements=[ctx.db.prepare(`INSERT INTO receipt(id,actor,capability,scope_type,scope_id,class,inverse,undo_token,confirm_token,trace_id,prior_state_json,at)
    SELECT ?1,?2,?3,'practice',?4,'write.reversible',?5,?6,NULL,?7,?8,?9 WHERE EXISTS(SELECT 1 FROM practice_operation WHERE id=?10)`)
    .bind(i.receiptId,who,i.capability,i.pid,receipt.inverse,i.token,ctx.traceId,prior,i.at,i.op),
    ctx.db.prepare(`INSERT INTO practice_native_receipt SELECT id,?1 FROM practice_operation WHERE id=?2`).bind(i.receiptId,i.op)];
  return {receipt,statements};
}
async function commit(ctx:Ctx,c:Copy,i:Intent):Promise<NativePracticeOutcome>{
  const who=actor(ctx),op='practice_op_'+crypto.randomUUID(),receiptId=newReceiptId(),at=ctx.now().toISOString();
  const history=Number(await ctx.db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(c.id).first('n'));
  const undoEligible=i.kind!=='undo'&&history<126;
  const token=undoEligible?newUndoToken():null;
  const count=i.newGeneration?i.newGeneration.answers.length:Number(await ctx.db.prepare('SELECT json_array_length(answers_json) AS n FROM practice_generation WHERE practice_id=? AND generation=?')
    .bind(c.id,i.generation).first('n'));
  const result={practice_id:c.id,operation_id:op,revision:c.revision+1,generation:i.generation,removed:!!i.removed,count,practice:true,undo_available:undoEligible};
  const prepared=receiptBatch(ctx,{pid:c.id,op,receiptId,at,capability:i.capability,token,revision:c.revision+1});
  const source=i.kind==='remove'?'1':AUTH;
  const activate=i.kind==='undo'&&c.removed&&!i.removed?`AND(SELECT count(*) FROM practice_copy WHERE owner_id=c.owner_id AND removed=0)<10`:'';
  const consumeGuard=i.consume?`AND EXISTS(SELECT 1 FROM receipt WHERE id=?11 AND actor=?8 AND undo_token=?12 AND scope_type='practice' AND scope_id=c.id)`:'';
  const generationGuard=i.newGeneration?`AND(SELECT count(*) FROM practice_generation WHERE practice_id=c.id)<17 AND NOT EXISTS(SELECT 1 FROM practice_generation WHERE practice_id=c.id AND generation=?10)`
    :`AND EXISTS(SELECT 1 FROM practice_generation WHERE practice_id=c.id AND generation=?10)`;
  const insert=ctx.db.prepare(`INSERT INTO practice_operation SELECT ?1,owner_id,id,id,?2,?3,?4,?5,?6 FROM practice_copy c
   WHERE c.id=?7 AND c.owner_id=?8 AND c.revision=?9 AND ${source} ${activate}
   AND(c.removed=0 OR ?2='undo') AND(SELECT count(*) FROM practice_operation WHERE practice_id=c.id)<${i.kind==='remove'?128:127}
   ${generationGuard} ${consumeGuard}`);
  const values:unknown[]=[op,i.kind,i.key,i.digest,JSON.stringify({generation:c.generation,removed:c.removed}),JSON.stringify(result),c.id,who,c.revision,i.generation];
  if(i.consume)values.push(i.consume.id,i.consume.undo_token);
  const batch=[insert.bind(...values)];
  if(i.newGeneration)batch.push(ctx.db.prepare(`INSERT INTO practice_generation SELECT practice_id,?1,?2,?3,?4 FROM practice_operation WHERE id=?5`)
    .bind(i.generation,i.newGeneration.scenarioId,GENERATOR_VERSION,JSON.stringify(i.newGeneration.answers),op));
  batch.push(ctx.db.prepare(`UPDATE practice_copy SET revision=?,generation=?,removed=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM practice_operation WHERE id=?)`)
   .bind(c.revision+1,i.generation,i.removed,c.id,c.revision,op),...prepared.statements);
  if(i.consume)batch.push(ctx.db.prepare(`UPDATE receipt SET undo_token=NULL WHERE id=? AND actor=? AND undo_token=? AND EXISTS(SELECT 1 FROM practice_operation WHERE id=?)`)
   .bind(i.consume.id,who,i.consume.undo_token,op));
  try{await ctx.db.batch(batch);}catch(error){
    if(!isConstraintError(error))throw error;
    const won=await priorOperation(ctx,c.id,i.kind,i.key);if(!won)throw error;
    return replay(ctx,await owned(ctx,c.id,i.kind==='remove'),won,i.digest,i.capability);
  }
  const linked=await ctx.db.prepare('SELECT operation_id FROM practice_native_receipt WHERE operation_id=?').bind(op).first();
  const fresh=await owned(ctx,c.id,i.kind==='remove');
  if(!linked){const won=await priorOperation(ctx,c.id,i.kind,i.key);if(won)return replay(ctx,fresh,won,i.digest,i.capability);conflict();}
  if(fresh.removed&&i.kind!=='remove')throw notVisible('practice');
  return {operation:result,receipt:prepared.receipt,replayed:false};
}
