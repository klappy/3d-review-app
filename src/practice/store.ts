/** Isolated, unregistered practice lifecycle. Schema exported for disposable local D1 tests only.
 * No runtime DDL, ordinary domain writes, participant credentials, report admission or public links.
 */
import type { Ctx } from '../handlers/types';
import { grantApplies, loadAssessment } from '../handlers/common';
import { CapError, isConstraintError, notVisible } from '../errors';
import { sha256Hex } from '../crypto';
import { generate, GENERATOR_VERSION, type PracticeSetup } from './generator';

export const PRACTICE_SCHEMA = [
 `CREATE TABLE practice_copy(id TEXT PRIMARY KEY CHECK(id GLOB 'practice_*'), owner_id TEXT NOT NULL,
 source_id TEXT NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), snapshot_digest TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0), generation INTEGER NOT NULL DEFAULT 0 CHECK(generation>=0),
 removed INTEGER NOT NULL DEFAULT 0 CHECK(removed IN(0,1)), created_at TEXT NOT NULL)`,
 `CREATE TABLE practice_generation(practice_id TEXT NOT NULL REFERENCES practice_copy(id), generation INTEGER NOT NULL,
 scenario_id TEXT, generator_version TEXT NOT NULL, answers_json TEXT NOT NULL CHECK(json_valid(answers_json)),
 PRIMARY KEY(practice_id,generation))`,
 `CREATE TABLE practice_operation(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, scope_id TEXT NOT NULL,
 practice_id TEXT NOT NULL REFERENCES practice_copy(id), kind TEXT NOT NULL CHECK(kind IN('create','simulate','reset','remove','undo')),
 operation_key TEXT NOT NULL, body_digest TEXT NOT NULL, before_json TEXT NOT NULL CHECK(json_valid(before_json)),
 receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json)), UNIQUE(owner_id,scope_id,kind,operation_key))`,
 `CREATE TRIGGER practice_generation_immutable_update BEFORE UPDATE ON practice_generation BEGIN SELECT RAISE(ABORT,'immutable practice generation'); END`,
 `CREATE TRIGGER practice_generation_immutable_delete BEFORE DELETE ON practice_generation BEGIN SELECT RAISE(ABORT,'immutable practice generation'); END`,
 `CREATE TRIGGER practice_operation_immutable_update BEFORE UPDATE ON practice_operation BEGIN SELECT RAISE(ABORT,'immutable practice operation'); END`,
 `CREATE TRIGGER practice_operation_immutable_delete BEFORE DELETE ON practice_operation BEGIN SELECT RAISE(ABORT,'immutable practice operation'); END`,
] as const;
interface Copy { id:string; owner_id:string; source_id:string; snapshot_json:string; snapshot_digest:string; revision:number; generation:number; removed:number; created_at:string }
interface Op { id:string; body_digest:string; before_json:string; receipt_json:string }
export interface PracticeReceipt { practice_id:string; revision:number; generation:number; removed:boolean; operation_id:string; count:number; practice:true; undo_available?:boolean }
const conflict = (message='The practice copy changed. Reload before trying again.'):never => { throw new CapError('STAGE_CONFLICT',message); };
const invalid = (message:string):never => { throw new CapError('INVALID_PARAMS',message); };
function principal(ctx:Ctx):string { if (ctx.principal.kind !== 'user' && ctx.principal.kind !== 'support') throw notVisible('practice'); return ctx.principal.id; }
function key(value:unknown):string { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) return invalid('Use an operation key of 8–128 letters, numbers, underscores or hyphens.'); return value; }
function revision(value:unknown):number { if (!Number.isSafeInteger(value) || Number(value)<0) return invalid('expected_revision must be a non-negative integer.'); return Number(value); }
const id = (prefix:string) => prefix+crypto.randomUUID();
const SNAPSHOT = `json_object('format',a.format,'language',l.code,'surveys',json((SELECT json_group_array(json_object(
 'templateId',q.template_id,'version',q.template_version,'name',q.name,'perspective',q.perspective,'items',json(q.items_json))) FROM (
 SELECT s.template_id,s.template_version,t.name,t.perspective,t.items_json FROM assessment_survey s
 JOIN survey_template t ON t.id=s.template_id AND t.version=s.template_version
 WHERE s.assessment_id=a.id AND s.state='selected' AND t.published_at IS NOT NULL ORDER BY s.template_id,s.template_version) q)))`;
const LIVE_SOURCE = `a.archived_at IS NULL AND p.archived_at IS NULL AND l.archived_at IS NULL
 AND (p.workspace_id IS NULL OR EXISTS(SELECT 1 FROM workspace w WHERE w.id=p.workspace_id AND w.archived_at IS NULL))`;
const SOURCE_JOIN = `assessment a JOIN project p ON p.id=a.project_id JOIN language l ON l.id=a.language_id`;
// Same effective inheritance predicate as common.effectiveRoleAt, also enforced inside atomic writes.
const AUTH = (actor:string) => `EXISTS(SELECT 1 FROM "grant" g WHERE g.principal_id=${actor} AND g.role IN('owner','member') AND ${grantApplies('g',"'assessment'",'a.id')})`;
const SOURCE_ALLOWED = `EXISTS(SELECT 1 FROM ${SOURCE_JOIN} WHERE a.id=c.source_id AND ${LIVE_SOURCE} AND ${AUTH('c.owner_id')})`;

async function source(ctx:Ctx, sourceId:string, validateSetup=true):Promise<string> {
  principal(ctx);
  await loadAssessment(ctx,sourceId,'member');
  const r=await ctx.db.prepare(`SELECT ${validateSetup?SNAPSHOT:'a.id'} AS snapshot FROM ${SOURCE_JOIN} WHERE a.id=?1 AND ${LIVE_SOURCE} AND ${AUTH('?2')}`)
    .bind(sourceId,ctx.principal.id).first<{snapshot:string}>();
  if(!r) throw notVisible('source review');
  if(!validateSetup) return '';
  const setup=JSON.parse(r.snapshot) as PracticeSetup;
  if(validateSetup && (!setup.surveys.length || setup.surveys.length>8 || new TextEncoder().encode(r.snapshot).length>524288)) invalid('Select between one and eight published surveys within the practice size limit.');
  return r.snapshot;
}
// Practice-internal transaction builders share the same source/actor checks and SQL;
// these exports add no handler, transport or public capability.
export { principal as practiceActor, source as readPracticeSource, SOURCE_ALLOWED as practiceSourceAllowed,
 SOURCE_JOIN as practiceSourceJoin, SNAPSHOT as practiceSnapshotSql, LIVE_SOURCE as practiceLiveSource, AUTH as practiceGrantSql };
async function copy(ctx:Ctx,pid:string, removal=false):Promise<Copy> {
  const owner=principal(ctx);
  if(!/^practice_[a-f0-9-]{36}$/.test(pid)) throw notVisible('practice');
  const c=await ctx.db.prepare('SELECT * FROM practice_copy WHERE id=? AND owner_id=?').bind(pid,owner).first<Copy>();
  if(!c) throw notVisible('practice');
  if(!removal) await source(ctx,c.source_id,false);
  return c;
}
async function operation(ctx:Ctx,scope:string,kind:string,k:string):Promise<Op|null> {
  return ctx.db.prepare('SELECT id,body_digest,before_json,receipt_json FROM practice_operation WHERE owner_id=? AND scope_id=? AND kind=? AND operation_key=?')
    .bind(principal(ctx),scope,kind,k).first<Op>();
}
function replay(op:Op,digest:string):PracticeReceipt { if(op.body_digest!==digest) conflict('This operation key was already used with different input.'); return JSON.parse(op.receipt_json) as PracticeReceipt; }
const makeReceipt=(c:Copy, op:string, count:number):PracticeReceipt=>({practice_id:c.id,revision:c.revision,generation:c.generation,removed:!!c.removed,operation_id:op,count,practice:true});
async function currentCount(ctx:Ctx,c:Copy):Promise<number> {
  const g=await ctx.db.prepare('SELECT answers_json FROM practice_generation WHERE practice_id=? AND generation=?').bind(c.id,c.generation).first<{answers_json:string}>();
  return g?JSON.parse(g.answers_json).length:0;
}
export async function getPractice(ctx:Ctx,pid:string) {
  const c=await copy(ctx,pid);if(c.removed) throw notVisible('practice');
  return { ...makeReceipt(c,'',await currentCount(ctx,c)), setup:JSON.parse(c.snapshot_json) as PracticeSetup,
    snapshot_digest:c.snapshot_digest, results:{status:'held',reason:'Practice reporting adapter has not been approved.'},label:'Simulated — practice only' };
}
export async function listPractice(ctx:Ctx,cursor?:string) {
  const owner=principal(ctx);
  if(cursor!==undefined && !/^practice_[a-f0-9-]{36}$/.test(cursor)) invalid('Invalid practice list cursor.');
  const {results}=await ctx.db.prepare(`SELECT c.id,c.revision,c.generation,c.created_at,json_array_length(g.answers_json) AS count
    FROM practice_copy c JOIN practice_generation g ON g.practice_id=c.id AND g.generation=c.generation
    WHERE c.owner_id=?1 AND c.removed=0 AND c.id>?2 AND ${SOURCE_ALLOWED} ORDER BY c.id LIMIT 21`)
    .bind(owner,cursor??'').all<{id:string;revision:number;generation:number;created_at:string;count:number}>();
  const rows=results??[];
  return {practices:rows.slice(0,20).map(r=>({...r,practice:true,label:'Practice review'})),next_cursor:rows.length>20?rows[19].id:null};
}
export async function createPractice(ctx:Ctx,sourceId:string,operationKey:unknown):Promise<PracticeReceipt> {
  const owner=principal(ctx),k=key(operationKey);
  await source(ctx,sourceId,false);
  const digest=await sha256Hex(JSON.stringify({sourceId}));
  const previous=await operation(ctx,sourceId,'create',k);
  if(previous){const r=replay(previous,digest);await getPractice(ctx,r.practice_id);return r;}
  const snapshot=await source(ctx,sourceId);
  const pid=id('practice_'),op=id('practice_op_'),at=ctx.now().toISOString();
  const c:Copy={id:pid,owner_id:owner,source_id:sourceId,snapshot_json:snapshot,snapshot_digest:await sha256Hex(snapshot),revision:0,generation:0,removed:0,created_at:at};
  const receipt=makeReceipt(c,op,0);
  try {
    await ctx.db.batch([
      ctx.db.prepare(`INSERT INTO practice_copy SELECT ?1,?2,?3,?4,?5,0,0,0,?6 FROM ${SOURCE_JOIN}
       WHERE a.id=?3 AND ${LIVE_SOURCE} AND ${AUTH('?2')} AND ${SNAPSHOT}=?4
       AND (SELECT count(*) FROM practice_copy WHERE owner_id=?2 AND removed=0)<10
       AND (SELECT count(*) FROM practice_copy WHERE owner_id=?2)<50`).bind(pid,owner,sourceId,snapshot,c.snapshot_digest,at),
      ctx.db.prepare(`INSERT INTO practice_generation SELECT id,0,NULL,?2,'[]' FROM practice_copy WHERE id=?1`).bind(pid,GENERATOR_VERSION),
      ctx.db.prepare(`INSERT INTO practice_operation SELECT ?1,owner_id,source_id,id,'create',?2,?3,'{}',?4 FROM practice_copy WHERE id=?5`)
        .bind(op,k,digest,JSON.stringify(receipt),pid),
    ]);
  } catch(e) { if(!isConstraintError(e)) throw e; const won=await operation(ctx,sourceId,'create',k);if(!won) throw e;await source(ctx,sourceId,false);const r=replay(won,digest);await getPractice(ctx,r.practice_id);return r; }
  const stored=await ctx.db.prepare('SELECT id FROM practice_operation WHERE id=?').bind(op).first();
  if(!stored) {
    await source(ctx,sourceId,false);
    const won=await operation(ctx,sourceId,'create',k);
    if(won){const r=replay(won,digest);await getPractice(ctx,r.practice_id);return r;}
    conflict('Practice limit reached or setup changed. Reload before retrying.');
  }
  await getPractice(ctx,pid);return receipt;
}

export async function mutatePractice(ctx:Ctx,pid:string,kind:'simulate'|'reset'|'remove'|'undo',expectedRevision:unknown,operationKey:unknown,arg?:string):Promise<PracticeReceipt> {
  const c=await copy(ctx,pid,kind==='remove'),owner=principal(ctx),k=key(operationKey),rev=revision(expectedRevision);
  const digest=await sha256Hex(JSON.stringify({kind,revision:rev,arg:arg??null}));
  const old=await operation(ctx,pid,kind,k);
  if(old){ if(c.removed && kind!=='remove') throw notVisible('practice');return replay(old,digest); }
  if(c.revision!==rev || (c.removed && kind!=='undo')) conflict();
  let gen=c.generation,removed=c.removed,answers:ReturnType<typeof generate>|null=null;
  if(kind==='simulate') {
    answers=generate(JSON.parse(c.snapshot_json),arg??'');
    const n=await ctx.db.prepare('SELECT max(generation) AS n,count(*) AS total FROM practice_generation WHERE practice_id=?').bind(pid).first<{n:number;total:number}>();
    if(!n) throw new CapError('STAGE_CONFLICT','Practice generation unavailable.');
    if(n.total>=17) invalid('This practice copy has reached its simulation limit. Remove it and create another.');
    gen=n.n+1;
  }
  if(kind==='reset') gen=0;
  if(kind==='remove') removed=1;
  if(kind==='undo') {
    if(!arg) invalid('Choose the operation to undo.');
    const target=await ctx.db.prepare(`SELECT before_json,receipt_json FROM practice_operation WHERE id=? AND owner_id=? AND practice_id=? AND kind IN('simulate','reset','remove')`)
      .bind(arg,owner,pid).first<{before_json:string;receipt_json:string}>();
    if(!target) throw notVisible('practice operation');
    if(JSON.parse(target.receipt_json).revision!==rev) conflict('This operation can no longer be undone.');
    const before=JSON.parse(target.before_json);gen=before.generation;removed=before.removed;
  }
  const next={...c,revision:rev+1,generation:gen,removed};
  const count=answers?answers.length:await currentCount(ctx,next),op=id('practice_op_'),receipt=makeReceipt(next,op,count);
  const history=Number(await ctx.db.prepare('SELECT count(*) AS n FROM practice_operation WHERE practice_id=?').bind(pid).first('n'));
  // Reserve the last operation for cleanup, including after source revocation. At the
  // bounded history limit the UI must not promise Undo; retained generations are not purged.
  receipt.undo_available=kind!=='undo' && history<126;
  const allowed=kind==='remove'?'1':SOURCE_ALLOWED;
  const quotaGuard=kind==='undo' && !removed && c.removed
    ? 'AND (SELECT count(*) FROM practice_copy WHERE owner_id=c.owner_id AND removed=0)<10' : '';
  const sql=`INSERT INTO practice_operation SELECT ?1,owner_id,id,id,?2,?3,?4,?5,?6 FROM practice_copy c
    WHERE c.id=?7 AND c.owner_id=?8 AND c.revision=?9 AND ${allowed}
    AND (SELECT count(*) FROM practice_operation WHERE practice_id=c.id)<${kind==='remove'?128:127} ${quotaGuard}`;
  const statements=[ctx.db.prepare(sql).bind(op,kind,k,digest,JSON.stringify({generation:c.generation,removed:c.removed}),JSON.stringify(receipt),pid,owner,rev)];
  if(answers) statements.push(ctx.db.prepare(`INSERT INTO practice_generation SELECT practice_id,?1,?2,?3,?4 FROM practice_operation WHERE id=?5`)
    .bind(gen,arg!,GENERATOR_VERSION,JSON.stringify(answers),op));
  statements.push(ctx.db.prepare(`UPDATE practice_copy SET revision=?1,generation=?2,removed=?3 WHERE id=?4 AND revision=?5
    AND EXISTS(SELECT 1 FROM practice_operation WHERE id=?6)` ).bind(rev+1,gen,removed,pid,rev,op));
  try {await ctx.db.batch(statements);}
  catch(e){if(!isConstraintError(e)) throw e;const won=await operation(ctx,pid,kind,k);if(!won)throw e;
    const fresh=await copy(ctx,pid,kind==='remove');if(fresh.removed && kind!=='remove')throw notVisible('practice');return replay(won,digest);}
  if(!await ctx.db.prepare('SELECT id FROM practice_operation WHERE id=?').bind(op).first()) {
    const fresh=await copy(ctx,pid,kind==='remove');
    const won=await operation(ctx,pid,kind,k);
    if(won){if(fresh.removed && kind!=='remove')throw notVisible('practice');return replay(won,digest);}
    conflict();
  }
  await copy(ctx,pid,kind==='remove');return receipt;
}
