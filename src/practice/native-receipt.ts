/** UNREGISTERED TRANSACTION PROTOTYPE: reset/removal and their native Undo only.
 * Not called by store.ts, HTTP, dispatch, mintReceipt or opsUndo. No runtime DDL.
 * Reuses the existing receipt table/IDs/tokens; shared integration still needs review.
 */
import type { Ctx } from '../handlers/types';
import type { Receipt } from '../envelope';
import { canonical, newReceiptId, newUndoToken } from '../receipt';
import { sha256Hex } from '../crypto';
import { grantApplies } from '../handlers/common';
import { CapError, isConstraintError, notVisible } from '../errors';

export const PRACTICE_NATIVE_SCHEMA = [
  `CREATE TABLE practice_native_receipt(operation_id TEXT PRIMARY KEY REFERENCES practice_operation(id), receipt_id TEXT NOT NULL UNIQUE REFERENCES receipt(id))`,
  `CREATE TRIGGER practice_native_immutable_update BEFORE UPDATE ON practice_native_receipt BEGIN SELECT RAISE(ABORT,'immutable practice native linkage'); END`,
  `CREATE TRIGGER practice_native_immutable_delete BEFORE DELETE ON practice_native_receipt BEGIN SELECT RAISE(ABORT,'immutable practice native linkage'); END`,
] as const;
interface Copy { id:string; owner_id:string; source_id:string; revision:number; generation:number; removed:number; allowed:number }
interface Operation { id:string; kind:string; body_digest:string; before_json:string; receipt_json:string }
interface NativeRow { id:string; actor:string; capability:string; scope_type:string; scope_id:string; class:string; inverse:string; undo_token:string|null; trace_id:string; at:string; prior_state_json:string }
export interface NativePracticeOutcome { operation:Record<string,unknown>; receipt:Receipt; replayed:boolean }
const conflict=(message='The practice state or inverse changed. Reload before retrying.'):never=>{throw new CapError('STAGE_CONFLICT',message);};
const fail=(message:string):never=>{throw new CapError('INVALID_PARAMS',message);};
const AUTH=`EXISTS(SELECT 1 FROM assessment a JOIN project p ON p.id=a.project_id JOIN language l ON l.id=a.language_id
 WHERE a.id=c.source_id AND a.archived_at IS NULL AND p.archived_at IS NULL AND l.archived_at IS NULL
 AND(p.workspace_id IS NULL OR EXISTS(SELECT 1 FROM workspace w WHERE w.id=p.workspace_id AND w.archived_at IS NULL))
 AND EXISTS(SELECT 1 FROM "grant" g WHERE g.principal_id=c.owner_id AND g.role IN('owner','member') AND ${grantApplies('g',"'assessment'",'a.id')}))`;
const actor=(ctx:Ctx)=>{if(ctx.principal.kind!=='user'&&ctx.principal.kind!=='support')throw notVisible('practice');return ctx.principal.id;};
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

/** Only reset/remove are prototyped. CREATE and simulation must supply their own
 * atomic domain plans before this bridge can replace the existing store commits. */
export async function nativePracticeMutation(ctx:Ctx,pid:string,kind:'reset'|'remove',expectedRevision:number,operationKey:string):Promise<NativePracticeOutcome>{
  if(!['reset','remove'].includes(kind)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!/^[A-Za-z0-9_-]{8,128}$/.test(operationKey))fail('Invalid practice operation.');
  const c=await owned(ctx,pid,kind==='remove');
  const digest=await sha256Hex(canonical({kind,expectedRevision})),capability=`cap.practice.${kind}`;
  const old=await priorOperation(ctx,pid,kind,operationKey);
  if(old)return replay(ctx,c,old,digest,capability);
  if(c.revision!==expectedRevision||c.removed)conflict();
  return commit(ctx,c,{kind,key:operationKey,digest,capability,generation:kind==='reset'?0:c.generation,removed:kind==='remove'?1:c.removed});
}

/** Internal prototype, not a new transport or a replacement for global opsUndo.
 * No caller-provided prior generation/tombstone; native token → immutable operation. */
export async function nativePracticeUndo(ctx:Ctx,token:string):Promise<NativePracticeOutcome>{
  actor(ctx);
  const r=await ctx.db.prepare("SELECT * FROM receipt WHERE undo_token=? AND actor=? AND scope_type='practice'")
    .bind(token,ctx.principal.id).first<NativeRow>();
  if(!r||!['cap.practice.reset','cap.practice.remove'].includes(r.capability)||r.inverse!=='self:practice-operation')throw notVisible('practice inverse');
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

interface Intent { kind:'reset'|'remove'|'undo'; key:string; digest:string; capability:string; generation:number; removed:number; consume?:NativeRow }
async function commit(ctx:Ctx,c:Copy,i:Intent):Promise<NativePracticeOutcome>{
  const who=actor(ctx),op='practice_op_'+crypto.randomUUID(),receiptId=newReceiptId(),at=ctx.now().toISOString();
  const history=Number(await ctx.db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(c.id).first('n'));
  const undoEligible=i.kind!=='undo'&&history<126;
  const token=undoEligible?newUndoToken():null;
  const count=Number(await ctx.db.prepare('SELECT json_array_length(answers_json) AS n FROM practice_generation WHERE practice_id=? AND generation=?')
    .bind(c.id,i.generation).first('n'));
  const result={practice_id:c.id,operation_id:op,revision:c.revision+1,generation:i.generation,removed:!!i.removed,count,practice:true,undo_available:undoEligible};
  const r:Receipt={id:receiptId,actor:who,scope:{type:'practice',id:c.id},class:'write.reversible',inverse:token?'self:practice-operation':'none',trace_id:ctx.traceId,at,...(token?{undo_token:token}:{})};
  const prior=JSON.stringify({prior:{practice_operation_id:op,practice_expected_revision:c.revision+1},params:{id:c.id},result_ids:{practice_id:c.id,operation_id:op}});
  const source=i.kind==='remove'?'1':AUTH;
  const activate=i.kind==='undo'&&c.removed&&!i.removed?`AND(SELECT count(*) FROM practice_copy WHERE owner_id=c.owner_id AND removed=0)<10`:'';
  const consumeGuard=i.consume?`AND EXISTS(SELECT 1 FROM receipt WHERE id=?10 AND actor=?8 AND undo_token=?11 AND scope_type='practice' AND scope_id=c.id)`:'';
  const insert=ctx.db.prepare(`INSERT INTO practice_operation SELECT ?1,owner_id,id,id,?2,?3,?4,?5,?6 FROM practice_copy c
   WHERE c.id=?7 AND c.owner_id=?8 AND c.revision=?9 AND ${source} ${activate}
   AND(c.removed=0 OR ?2='undo') AND(SELECT count(*) FROM practice_operation WHERE practice_id=c.id)<${i.kind==='remove'?128:127}
   AND EXISTS(SELECT 1 FROM practice_generation g WHERE g.practice_id=c.id AND g.generation=${i.generation}) ${consumeGuard}`);
  const values:unknown[]=[op,i.kind,i.key,i.digest,JSON.stringify({generation:c.generation,removed:c.removed}),JSON.stringify(result),c.id,who,c.revision];
  if(i.consume)values.push(i.consume.id,i.consume.undo_token);
  const batch=[insert.bind(...values),ctx.db.prepare(`UPDATE practice_copy SET revision=?,generation=?,removed=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM practice_operation WHERE id=?)`)
   .bind(c.revision+1,i.generation,i.removed,c.id,c.revision,op),
   ctx.db.prepare(`INSERT INTO receipt(id,actor,capability,scope_type,scope_id,class,inverse,undo_token,confirm_token,trace_id,prior_state_json,at)
    SELECT ?1,?2,?3,'practice',?4,'write.reversible',?5,?6,NULL,?7,?8,?9 WHERE EXISTS(SELECT 1 FROM practice_operation WHERE id=?10)`)
    .bind(receiptId,who,i.capability,c.id,r.inverse,token,ctx.traceId,prior,at,op),
   ctx.db.prepare(`INSERT INTO practice_native_receipt SELECT id,?1 FROM practice_operation WHERE id=?2`).bind(receiptId,op)];
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
  return {operation:result,receipt:r,replayed:false};
}
