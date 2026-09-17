import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import * as production from '../src/synthetic-report-store';
import { B1_CAPTURE_SQL, REPORT_CAPTURE_CTE, captureForBuild } from '../src/report-capture';
import type { Ctx } from '../src/handlers/types';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'report-materialization-b2',modules:true,script:"export default {fetch(){return new Response('synthetic fixture only')}}",d1Databases:{DB:'report-b2-fixture'}}]}));
let db:D1Database,marker:typeof production,variant:typeof production;
const temporary=mkdtempSync(join(tmpdir(),'b2-marker-'));
const aid='assess_syn_earning-trust-2026-01';
const context=(database=db,id='person_mara',kind:Ctx['principal']['kind']='user')=>({db:database,principal:{id,kind},now:()=>new Date('2026-09-17T07:00:00.000Z')});
const exec=(sql:string,...args:any[])=>db.prepare(sql).bind(...args).run();
const noUpdate="CREATE TRIGGER synthetic_report_no_update BEFORE UPDATE ON synthetic_report BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END";
const noDelete="CREATE TRIGGER synthetic_report_no_delete BEFORE DELETE ON synthetic_report BEGIN SELECT RAISE(ABORT,'synthetic reports are immutable'); END";
const held={ok:false,reason:'HELD',marker:{assessment_id:aid,eligible:false,policy_version:'synthetic-current-assessment-asof-query-v1'}};
const invisible={ok:false,reason:'NOT_VISIBLE'};
const source=readFileSync(new URL('../src/synthetic-report-store.ts',import.meta.url),'utf8');
const seam='const APPROVED_RENDERER: RendererDescriptor = REAL_RENDERER;';
const tuple={sourcePin:'f042cde553761a6a7f24132cef7802f956378ee0',indexRoot:'d964f81639e0929ce5f53156b28e3902732b98d2394c6d8dc31c9d14a22fb7dd',scorerVersion:'test-marker-scorer-v1',narrativeVersion:'test-marker-narrative-v1',policyVersion:'test-marker-policy-v1',outputSchemaVersion:'test-marker-output-v1'};
/** Exactly one private constant replacement. All SQL/store/validation code stays original. */
async function testBundle(scorerVersion='test-marker-scorer-v1',rejectValidation=false){
  expect(source.split(seam)).toHaveLength(2);
  const descriptor=`const APPROVED_RENDERER: RendererDescriptor = {
    tuple:${JSON.stringify({...tuple,scorerVersion})},
    render:c=>({schema:'test-marker-output-v1',assessmentId:c.assessmentId,captureDigest:c.captureDigest,responseIds:[...c.responseIds]}),
    validate:async(p,c)=>{
      await Promise.resolve();if(${rejectValidation})return false;
      if(!p||typeof p!=='object'||Array.isArray(p))return false;
      if(Object.keys(p).sort().join(',')!=='assessmentId,captureDigest,responseIds,schema')return false;
      if(p.schema!=='test-marker-output-v1'||p.assessmentId!==c.assessmentId||p.captureDigest!==c.captureDigest||!Array.isArray(p.responseIds)||p.responseIds.length<1||p.responseIds.length>425)return false;
      return p.responseIds.length===c.responseIds.length&&p.responseIds.every((id,i)=>typeof id==='string'&&id.length>0&&new TextEncoder().encode(id).length<=256&&id===c.responseIds[i]);
    }
  };`;
  const transformed=source.replace(seam,descriptor);
  expect(transformed.replace(descriptor,seam)).toBe(source);
  const output=join(temporary,scorerVersion+(rejectValidation?'-refuse':'')+'.mjs');
  await build({stdin:{contents:transformed,resolveDir:new URL('../src',import.meta.url).pathname,sourcefile:'synthetic-report-store.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:output});
  const proof={scorerVersion,originalSha256:createHash('sha256').update(source).digest('hex'),transformedSha256:createHash('sha256').update(transformed).digest('hex'),descriptorSha256:createHash('sha256').update(descriptor).digest('hex'),replacementCount:1,onlyPrivateDeclarationChanged:transformed.replace(descriptor,seam)===source};
  writeFileSync(join(temporary,scorerVersion+'-transform.json'),JSON.stringify(proof));
  console.log('B2_MARKER_PROOF '+JSON.stringify(proof));
  return import(/* @vite-ignore */ pathToFileURL(output).href) as Promise<typeof production>;
}
beforeAll(async()=>{
  db=await mf.getD1Database('DB');
  for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','migrations/0008_synthetic_report.sql','seed/synthetic.sql','seed/synthetic-responses.sql']){
    const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
    const statements=sql.split(';\n').map(s=>s.trim()).filter(Boolean);for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
  }
  marker=await testBundle();variant=await testBundle('test-marker-scorer-v2');
},60000);
beforeEach(async()=>{
  // Fixture isolation only; no production delete/update API exists.
  await exec('DROP TRIGGER synthetic_report_no_delete');await exec('DELETE FROM synthetic_report');await exec(noDelete);
});
afterAll(async()=>{await mf.dispose();rmSync(temporary,{recursive:true,force:true});});
async function report(){const r=await marker.buildMaterialized(context(),aid);expect(r.ok).toBe(true);if(!r.ok)throw new Error('fixture build refused');return r.value;}
async function captured(){const r=await captureForBuild(context(),aid);expect(r.eligible).toBe(true);if(!r.eligible)throw new Error('fixture capture refused');return r.capture;}
async function alterReport(id:string,values:Record<string,unknown>){
  await exec('DROP TRIGGER synthetic_report_no_update');
  try{await exec('UPDATE synthetic_report SET '+Object.keys(values).map(k=>k+'=?').join(',')+' WHERE id=?',...Object.values(values),id);}finally{await exec(noUpdate);}
}
function intercept(fn:(sql:string,args:unknown[],method:string,next:()=>Promise<any>)=>Promise<any>):D1Database{
  return {prepare(sql:string){return{bind(...args:unknown[]){const stmt=db.prepare(sql).bind(...args);return Object.fromEntries(['first','all','run'].map(method=>[method,()=>fn(sql,args,method,()=> (stmt as any)[method]())]));}}}} as unknown as D1Database;
}
describe('private marker isolation and exact D1 commands',()=>{
  it('compiled renderer has no caller registry and cannot turn missing DB authority into a marker',async()=>{
    const noDb={prepare(){throw new Error('must not authorize')}} as unknown as D1Database;const ctx=context(noDb);
    for(const r of [await production.buildMaterialized(ctx,aid),await production.commitMaterialized(ctx,aid,{packedCapture:'{}'} as any),await production.readMaterialized(ctx,'anything'),await production.listMaterialized(ctx,aid)])expect(r).toEqual({ok:false,reason:'UNAVAILABLE'});
    expect(Object.keys(production).some(k=>/factory|setRenderer|register|configure/i.test(k))).toBe(false);
    expect(source.split(seam)).toHaveLength(2);
  });
  it('executes exact five/eighteen/five/six/seven bindings and a guarded insert/read roundtrip',async()=>{
    const calls:{sql:string,args:unknown[],method:string}[]=[];
    const traced=intercept(async(sql,args,method,next)=>{calls.push({sql,args,method});return next();});
    const created=await marker.buildMaterialized(context(traced),aid);expect(created.ok).toBe(true);if(!created.ok)return;
    expect((await marker.readMaterialized(context(traced),created.value.id)).ok).toBe(true);
    expect((await marker.listMaterialized(context(traced),aid)).ok).toBe(true);
    const expected=new Map([[marker.REPORT_OBSERVE_SQL,5],[marker.REPORT_COMMIT_SQL,18],[marker.REPORT_GET_SQL,5],[marker.REPORT_BUILD_RESULT_SQL,6],[marker.REPORT_LIST_SQL,7]]);
    for(const [sql,n] of expected){const call=calls.find(c=>c.sql===sql);expect(call).toBeDefined();expect(call!.args).toHaveLength(n);await expect(db.prepare(sql).bind(...call!.args.slice(0,-1)).all()).rejects.toThrow();}
    const row=await db.prepare('SELECT * FROM synthetic_report').first<any>();expect(row.id).toBe(created.value.id);
    // Independently frozen Python hashlib vector over explicit accepted preimage.
    expect(created.value.captureDigest).toBe('e8d986173aae61cf158e57d4d881a3f35ecc9d885769953f455f728993bce933');
    expect(created.value.reportKey).toBe('6da8672ed391975ded7fcdf82ed609a18158059f3af7214a32aa347480fa8858');
    expect(createHash('sha256').update(row.payload_json).digest('hex')).toBe(row.payload_sha256);
    console.log('B2_BIND_PROOF '+JSON.stringify(calls.map(c=>({binds:c.args.length,method:c.method,sqlBytes:Buffer.byteLength(c.sql)}))));
  });
  it('awaits an asynchronous false validator for build, read and every list row',async()=>{
    const r=await report();const refusing=await testBundle('test-marker-scorer-v1',true);
    expect(await refusing.readMaterialized(context(),r.id)).toEqual(held);
    expect(await refusing.listMaterialized(context(),aid)).toEqual(held);
    expect(await refusing.buildMaterialized(context(),aid)).toEqual({ok:false,reason:'UNAVAILABLE'});
    expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);
  });
  it('preserves the exact reviewed common CTE predicates through the shared producer',()=>{
    const normalized=REPORT_CAPTURE_CTE.split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n').trim();
    expect(createHash('sha256').update(normalized).digest('hex')).toBe('5acc824832e18930f941d77ca7dda40123f49300879fa3908e0c69f6f4873c69');
    expect(createHash('sha256').update(B1_CAPTURE_SQL).digest('hex')).toBe('8e3f51e2f5cb7350c2a7824e5a78c91c64fb17a1966d79b9fe3f064c711598c6');
  });
  it('keeps reports immutable under actual D1 triggers and surfaces a forced constraint failure',async()=>{
    const r=await report();
    await expect(exec('UPDATE synthetic_report SET created_at=? WHERE id=?','changed',r.id)).rejects.toThrow('immutable');
    await expect(exec('DELETE FROM synthetic_report WHERE id=?',r.id)).rejects.toThrow('immutable');
    await exec("CREATE TRIGGER b2_forced_failure BEFORE INSERT ON synthetic_report BEGIN SELECT RAISE(ABORT,'fixture constraint'); END");
    try{expect(await marker.buildMaterialized(context(),'assess_syn_earning-trust-2026-07')).toEqual({ok:false,reason:'UNAVAILABLE'});expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);}finally{await exec('DROP TRIGGER b2_forced_failure');}
  });
});
describe('guarded identity and immutable content',()=>{
  it('concurrent same-identity builds converge on one row and exact payload',async()=>{
    const results=await Promise.all(Array.from({length:6},()=>marker.buildMaterialized(context(),aid)));
    expect(results.every(r=>r.ok)).toBe(true);const ok=results.filter(r=>r.ok) as {ok:true,value:production.Report}[];
    expect(new Set(ok.map(r=>r.value.id)).size).toBe(1);expect(new Set(ok.map(r=>JSON.stringify(r.value.payload))).size).toBe(1);
    expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);
  });
  it('different approved version produces a different key; unknown old tuple refuses',async()=>{
    const original=await report();const changed=await variant.buildMaterialized(context(),aid);expect(changed.ok).toBe(true);
    if(changed.ok)expect(changed.value.reportKey).not.toBe(original.reportKey);
    expect(await variant.readMaterialized(context(),original.id)).toEqual(held);
    expect(await marker.listMaterialized(context(),aid)).toEqual(held);
  });
  it('same identity with different exact payload bytes is determinism failure, never reuse',async()=>{
    const r=await report();const row=await db.prepare('SELECT payload_json FROM synthetic_report WHERE id=?').bind(r.id).first<any>();
    const changed=' '+row.payload_json;await alterReport(r.id,{payload_json:changed,payload_sha256:createHash('sha256').update(changed).digest('hex')});
    expect(await marker.buildMaterialized(context(),aid)).toEqual({ok:false,reason:'DETERMINISM'});
    expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);
  });
  it('known append retains old payload while a newly captured identity gets its own row',async()=>{
    const c=await captured();const chosen=c.rows[0];const saved=await db.prepare('SELECT * FROM response WHERE id=?').bind(chosen.responseId).first<any>();
    await exec('DELETE FROM response WHERE id=?',chosen.responseId);
    let old:production.Report,oldCapture:Awaited<ReturnType<typeof captured>>;
    try{oldCapture=await captured();old=await report();}finally{await exec('INSERT INTO response ('+Object.keys(saved).join(',')+') VALUES ('+Object.keys(saved).map(()=>'?').join(',')+')',...Object.values(saved));}
    const reread=await marker.readMaterialized(context(),old!.id);expect(reread.ok).toBe(true);if(reread.ok)expect(reread.value.payload).toEqual(old!.payload);
    const replay=await marker.commitMaterialized(context(),aid,oldCapture!);expect(replay.ok).toBe(true);if(replay.ok)expect(replay.value.id).toBe(old!.id);
    const now=await report();expect(now.reportKey).not.toBe(old!.reportKey);
    const list=await marker.listMaterialized(context(),aid);expect(list.ok).toBe(true);if(list.ok)expect(list.value.reports).toHaveLength(2);
  });
  it('grant loss, archive and changed input before INSERT prevent new rows',async()=>{
    const c=await captured(),r=c.rows[0];const actions=[
      {change:()=>exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aid),restore:()=>exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aid)},
      {change:()=>exec('UPDATE "grant" SET role=? WHERE scope_type=? AND scope_id=? AND principal_id=?','viewer','assessment',aid,'person_mara'),restore:()=>exec('UPDATE "grant" SET role=? WHERE scope_type=? AND scope_id=? AND principal_id=?','owner','assessment',aid,'person_mara')},
      {change:()=>exec('UPDATE response SET answers_json=? WHERE id=?','{}',r.responseId),restore:()=>exec('UPDATE response SET answers_json=? WHERE id=?',r.answersRaw,r.responseId)},
    ];
    for(const action of actions){const raced=intercept(async(sql,args,method,next)=>{if(sql===marker.REPORT_COMMIT_SQL)await action.change();return next();});try{expect((await marker.commitMaterialized(context(raced),aid,c)).ok).toBe(false);expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(0);}finally{await action.restore();}}
  });
  it('losing authority after insertion withholds result without claiming no write',async()=>{
    const raced=intercept(async(sql,args,method,next)=>{const result=await next();if(sql===marker.REPORT_COMMIT_SQL)await exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aid);return result;});
    try{expect((await marker.buildMaterialized(context(raced),aid)).ok).toBe(false);expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);}finally{await exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aid);}
  });
});
describe('single-observation disclosure and page suppression',()=>{
  it('unknown/ungranted/support without grant uniformly stay invisible and viewer cannot build',async()=>{
    const r=await report();for(const ctx of [context(db,'absent'),context(db,'absent','support'),context(db,'person_mara','participant')]){expect(await marker.readMaterialized(ctx,r.id)).toEqual(invisible);expect(await marker.listMaterialized(ctx,aid)).toEqual(invisible);}
    expect(await marker.readMaterialized(context(),'unknown')).toEqual(invisible);
    await exec('UPDATE "grant" SET role=? WHERE scope_type=? AND scope_id=? AND principal_id=?','viewer','assessment',aid,'person_mara');
    try{expect((await marker.readMaterialized(context(),r.id)).ok).toBe(true);expect(await marker.buildMaterialized(context(),aid)).toEqual(invisible);}finally{await exec('UPDATE "grant" SET role=? WHERE scope_type=? AND scope_id=? AND principal_id=?','owner','assessment',aid,'person_mara');}
  });
  it('authorized empty page keeps assessment identity and still attests current input',async()=>{
    expect(await marker.listMaterialized(context(),aid)).toEqual({ok:true,value:{reports:[],afterId:null}});
    const c=await captured(),r=c.rows[0];await exec('UPDATE response SET answers_json=? WHERE id=?','{}',r.responseId);
    try{expect(await marker.listMaterialized(context(),aid)).toEqual(held);}finally{await exec('UPDATE response SET answers_json=? WHERE id=?',r.answersRaw,r.responseId);}
  });
  it('mixed append holds build/get/list without leaking stored ID or counts',async()=>{
    const reportValue=await report(),c=await captured(),r=c.rows[0];await exec("INSERT INTO response(id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,provenance_json,source,submitted_at) SELECT 'b2_unknown',assessment_survey_id,'b2_unknown','b2_unknown',answers_json,template_id,template_version,provenance_json,'synthetic',submitted_at FROM response WHERE id=?",r.responseId);
    try{for(const result of [await marker.buildMaterialized(context(),aid),await marker.readMaterialized(context(),reportValue.id),await marker.listMaterialized(context(),aid)])expect(result).toEqual(held);}finally{await exec("DELETE FROM response WHERE id='b2_unknown'");}
  });
  it('corrupt identity/payload/original capture suppresses complete page and get',async()=>{
    const r=await report(),original=await db.prepare('SELECT * FROM synthetic_report WHERE id=?').bind(r.id).first<any>();
    const corruptions={report_key:'0'.repeat(64),capture_digest:'0'.repeat(64),index_root:'0'.repeat(64),source_pin:'wrong',scorer_version:'wrong',narrative_version:'wrong',policy_version:'wrong',output_schema_version:'wrong',stored_capture:'[]',payload_sha256:'0'.repeat(64),payload_json:'{}'};
    for(const [field,value] of Object.entries(corruptions)){const column=field==='stored_capture'?'capture_json':field;await alterReport(r.id,{[column]:value});try{expect(await marker.readMaterialized(context(),r.id)).toEqual(held);expect(await marker.listMaterialized(context(),aid)).toEqual(held);}finally{await alterReport(r.id,{[column]:original[column]});}}
  });
  it('recomputed payload self-hashes cannot bypass schema and capture identity checks',async()=>{
    const r=await report(),original=await db.prepare('SELECT payload_json,payload_sha256 FROM synthetic_report WHERE id=?').bind(r.id).first<any>();
    const payload=JSON.parse(original.payload_json);
    const forged=[JSON.stringify({...payload,projectLabel:'mutable unapproved label'}),JSON.stringify({...payload,captureDigest:'0'.repeat(64)}),JSON.stringify({...payload,responseIds:payload.responseIds.slice(1)}),'{"schema":"wrong",'+original.payload_json.slice(1)];
    for(const raw of forged){await alterReport(r.id,{payload_json:raw,payload_sha256:createHash('sha256').update(raw).digest('hex')});expect(await marker.readMaterialized(context(),r.id)).toEqual(held);expect(await marker.listMaterialized(context(),aid)).toEqual(held);}
    await alterReport(r.id,original);expect((await marker.readMaterialized(context(),r.id)).ok).toBe(true);
  });
  it('read/list authorizes as of one SELECT for archive, grant loss and input mutation',async()=>{
    const r=await report(),c=await captured(),response=c.rows[0];
    const grant=(await db.prepare('SELECT id FROM "grant" WHERE principal_id=? AND scope_type=? AND scope_id=?').bind('person_mara','assessment',aid).first<any>()).id;
    const actions=[
      {change:()=>exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aid),restore:()=>exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aid)},
      {change:()=>exec('UPDATE "grant" SET scope_id=? WHERE id=?','b2_other_scope',grant),restore:()=>exec('UPDATE "grant" SET scope_id=? WHERE id=?',aid,grant)},
      {change:()=>exec('UPDATE response SET answers_json=? WHERE id=?','{}',response.responseId),restore:()=>exec('UPDATE response SET answers_json=? WHERE id=?',response.answersRaw,response.responseId)},
    ];
    for(const action of actions)for(const query of [marker.REPORT_GET_SQL,marker.REPORT_LIST_SQL])for(const when of ['before','after']){
      let calls=0;const raced=intercept(async(sql,args,method,next)=>{calls++;if(sql===query&&when==='before')await action.change();const result=await next();if(sql===query&&when==='after')await action.change();return result;});
      try{const result=query===marker.REPORT_GET_SQL?await marker.readMaterialized(context(raced),r.id):await marker.listMaterialized(context(raced),aid);expect(result.ok).toBe(when==='after');expect(calls).toBe(1);}finally{await action.restore();}
    }
  });
  it('validates the whole page plus lookahead, has no totals/payload leakage and rechecks each page',async()=>{
    const c=await captured(),removed:any[]=[];
    try{
      await report();
      for(const r of c.rows.slice(0,6)){
        removed.push(await db.prepare('SELECT * FROM response WHERE id=?').bind(r.responseId).first());
        await exec('DELETE FROM response WHERE id=?',r.responseId);await report();
      }
    }finally{for(const row of removed)await exec('INSERT INTO response ('+Object.keys(row).join(',')+') VALUES ('+Object.keys(row).map(()=>'?').join(',')+')',...Object.values(row));}
    const measurementStart=performance.now();
    const measured=await db.prepare(marker.REPORT_LIST_SQL).bind('user',null,aid,'person_mara','viewer',null,6).all<any>();
    console.log('B2_PAGE_MEASUREMENTS '+JSON.stringify({rows:measured.results.length,queryBytes:Buffer.byteLength(marker.REPORT_LIST_SQL),binds:7,serializedPageBytes:Buffer.byteLength(JSON.stringify(measured.results)),maxSerializedRowBytes:Math.max(...measured.results.map(r=>Buffer.byteLength(JSON.stringify(r)))),d1Meta:measured.meta,localQueryWallMs:performance.now()-measurementStart,nodeMemorySample:process.memoryUsage(),runtime:process.version}));
    const first=await marker.listMaterialized(context(),aid,null,5);expect(first.ok).toBe(true);if(!first.ok)return;
    expect(first.value.reports).toHaveLength(5);expect(first.value.afterId).not.toBeNull();expect(Object.keys(first.value).sort()).toEqual(['afterId','reports']);
    expect(first.value.reports.every(r=>!Object.hasOwn(r,'payload'))).toBe(true);
    const second=await marker.listMaterialized(context(),aid,first.value.afterId,5);expect(second.ok).toBe(true);if(second.ok){expect(second.value.reports).toHaveLength(2);expect(second.value.afterId).toBeNull();}
    expect(await marker.listMaterialized(context(db,'absent'),aid,first.value.afterId,5)).toEqual(invisible);
    const sixth=(await db.prepare('SELECT id,payload_sha256 FROM synthetic_report WHERE assessment_id=? ORDER BY id LIMIT 1 OFFSET 5').bind(aid).first<any>());
    await alterReport(sixth.id,{payload_sha256:'0'.repeat(64)});
    try{expect(await marker.listMaterialized(context(),aid,null,5)).toEqual(held);}finally{await alterReport(sixth.id,{payload_sha256:sixth.payload_sha256});}
    for(const size of [0,6,1.5])expect(await marker.listMaterialized(context(),aid,null,size)).toEqual(invisible);
    expect(await marker.listMaterialized(context(),aid,'x'.repeat(257))).toEqual(invisible);
  });
  it('guard and fresh-read negative controls fail the same safety oracles',async()=>{
    const original=await captured(),chosen=original.rows[0];const saved=await db.prepare('SELECT * FROM response WHERE id=?').bind(chosen.responseId).first<any>();
    await exec('DELETE FROM response WHERE id=?',chosen.responseId);let old:Awaited<ReturnType<typeof captured>>;
    try{old=await captured();}finally{await exec('INSERT INTO response ('+Object.keys(saved).join(',')+') VALUES ('+Object.keys(saved).map(()=>'?').join(',')+')',...Object.values(saved));}
    expect((await marker.commitMaterialized(context(),aid,old!)).ok).toBe(false);
    expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(0);
    const unguarded=intercept(async(sql,args,method,next)=>sql===marker.REPORT_COMMIT_SQL?db.prepare(sql.replace('WHERE c.capture_json = ?18','WHERE ?18 IS NOT NULL')).bind(...args).run():next());
    expect((await marker.commitMaterialized(context(unguarded),aid,old!)).ok).toBe(false);
    // Removing equality writes an inconsistent immutable row even though validation
    // withholds the result: the zero-unintended-row oracle detects the bad algorithm.
    expect((await db.prepare('SELECT count(*) n FROM synthetic_report').first<any>()).n).toBe(1);
    const good=await report();const snapshot=await db.prepare(marker.REPORT_GET_SQL).bind('user',good.id,null,'person_mara','viewer').first<any>();
    await exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aid);
    try{
      expect(await marker.readMaterialized(context(),good.id)).toEqual(invisible);
      const stale=intercept(async(sql,args,method,next)=>sql===marker.REPORT_GET_SQL?snapshot:next());
      expect((await marker.readMaterialized(context(stale),good.id)).ok).toBe(true);
    }finally{await exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aid);}
  });
  it('enforces SQL byte ceilings and refuses largest stored malformed fields without partial output',async()=>{
    const r=await report();const huge=JSON.stringify('\\'.repeat(262143));expect(Buffer.byteLength(huge)).toBe(524288);
    await expect(alterReport(r.id,{payload_json:huge+' '})).rejects.toThrow();
    await expect(alterReport(r.id,{capture_json:huge+' '})).rejects.toThrow();
    await alterReport(r.id,{capture_json:huge,payload_json:huge,payload_sha256:createHash('sha256').update(huge).digest('hex')});
    const actual=await db.prepare(marker.REPORT_GET_SQL).bind('user',r.id,null,'person_mara','viewer').first<any>();
    expect(actual).not.toBeNull();
    const rawFieldBytes=Object.values(actual).reduce((n:number,v)=>n+(typeof v==='string'?Buffer.byteLength(v):8),0);
    console.log('B2_BOUND_MEASUREMENTS '+JSON.stringify({rawFieldBytes,serializedRowBytes:Buffer.byteLength(JSON.stringify(actual)),payloadBytes:Buffer.byteLength(huge),captureBytes:Buffer.byteLength(huge),queryBytes:Buffer.byteLength(marker.REPORT_GET_SQL)}));
    expect(rawFieldBytes).toBeLessThan(2000000);
    expect(await marker.readMaterialized(context(),r.id)).toEqual(held);expect(await marker.listMaterialized(context(),aid)).toEqual(held);
  });
  it('database exceptions and explicit unsuccessful writes cannot turn into success',async()=>{
    const r=await report();const broken=intercept(async()=>{throw new Error('fixture database detail')});
    expect(await marker.readMaterialized(context(broken),r.id)).toEqual({ok:false,reason:'UNAVAILABLE'});
    expect(await marker.listMaterialized(context(broken),aid)).toEqual({ok:false,reason:'UNAVAILABLE'});
    const unsuccessful=intercept(async(sql,args,method,next)=>sql===marker.REPORT_COMMIT_SQL?{success:false}:next());
    expect(await marker.buildMaterialized(context(unsuccessful),aid)).toEqual({ok:false,reason:'UNAVAILABLE'});
  });

});
