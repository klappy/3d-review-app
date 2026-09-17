import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { B1_CAPTURE_SQL, captureForBuild, attestPackedCapture, decodePackedCapture } from '../src/report-capture';
import type { Ctx } from '../src/handlers/types';
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name:'report-capture-b1', modules:true, script:"export default {fetch(){return new Response('local synthetic fixture')}}", d1Databases:{ DB:'report-b1-fixture' } }] }));
let db:D1Database;
let aids:string[];
const ctx = (id='person_mara', kind:Ctx['principal']['kind']='user', database=db) => ({ db:database, principal:{ id, kind } });
const bytes=(s:string)=>new TextEncoder().encode(s).length;
const raw=async(aid=aids[0])=>db.prepare(B1_CAPTURE_SQL).bind('user',null,aid,'person_mara','member').first<{assessment_id:string,capture_json:string}>();
const exec=(sql:string,...args:any[])=>db.prepare(sql).bind(...args).run();
beforeAll(async()=>{
  db=await mf.getD1Database('DB');
  for(const file of ['migrations/0001_init.sql','migrations/0002_code_escrow.sql','migrations/0003_language_archive.sql','migrations/0004_pinned_instruments.sql','migrations/0006_oauth_code_redemption.sql','migrations/0007_shared_link_context.sql','seed/synthetic.sql','seed/synthetic-responses.sql']) {
    const sql=readFileSync(new URL('../'+file,import.meta.url),'utf8').split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n');
    const statements=sql.split(';\n').map(s=>s.trim()).filter(Boolean);
    for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50).map(s=>db.prepare(s)));
  }
  aids=(await db.prepare("SELECT DISTINCT assessment_id FROM assessment_survey WHERE id GLOB 'survey_syn_*' ORDER BY assessment_id").all<{assessment_id:string}>()).results.map(r=>r.assessment_id);
},60000);
afterAll(()=>mf.dispose());
describe('B1 actual local D1 complete capture',()=>{
  it('uses all five positional binds with no report table and server-owned member minimum',async()=>{
    expect((await db.prepare("SELECT name FROM sqlite_master WHERE name='synthetic_report'").all()).results).toEqual([]);
    const row=await raw();expect(row?.assessment_id).toBe(aids[0]);
    await expect(db.prepare(B1_CAPTURE_SQL).bind('user',null,aids[0],'person_mara').first()).rejects.toThrow();
    expect(await db.prepare(B1_CAPTURE_SQL).bind('user','unexpected-report',aids[0],'person_mara','member').first()).toBeNull();
    const calls:any[]=[];
    const proxy={prepare(sql:string){expect(sql).toBe(B1_CAPTURE_SQL);return{bind(...args:any[]){calls.push(args);return db.prepare(sql).bind(...args)}}}} as unknown as D1Database;
    expect((await captureForBuild(ctx('person_mara','user',proxy),aids[0])).eligible).toBe(true);
    expect(calls).toEqual([['user',null,aids[0],'person_mara','member']]);
  });
  it('captures and attests all 34 assessments/425 gold responses without filtering',async()=>{
    expect(aids).toHaveLength(34);let total=0,maxPacked=0,maxTemplate=0,maxAnswers=0,maxRawRow=0;const times:number[]=[];
    const captures:any[]=[];
    for(const aid of aids){
      const start=performance.now(),result=await captureForBuild(ctx(),aid);times.push(performance.now()-start);
      expect(result.eligible).toBe(true);if(!result.eligible)throw new Error('Gold refused');
      const c=result.capture;total+=c.rows.length;maxPacked=Math.max(maxPacked,bytes(c.packedCapture));
      maxRawRow=Math.max(maxRawRow,bytes(JSON.stringify({assessment_id:aid,capture_json:c.packedCapture})));
      expect(c.responseIds.length).toBe(c.rows.length);expect(Object.isFrozen(c)).toBe(true);expect(Object.isFrozen(c.rows)).toBe(true);
      for(const r of c.rows){maxTemplate=Math.max(maxTemplate,bytes(r.templateRaw));maxAnswers=Math.max(maxAnswers,bytes(r.answersRaw));}
      const actual=(await db.prepare('SELECT count(*) n FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id=?').bind(aid).first<{n:number}>())!.n;
      expect(c.rows.length).toBe(actual);captures.push({assessmentId:aid,responses:c.rows.length,packedBytes:bytes(c.packedCapture)});
    }
    expect(total).toBe(425);expect(maxPacked).toBeLessThanOrEqual(524288);expect(maxTemplate).toBeLessThanOrEqual(65536);
    console.log('B1_MEASUREMENTS '+JSON.stringify({assessments:aids.length,responses:total,maxPackedBytes:maxPacked,maxTemplateBytes:maxTemplate,maxAnswerBytes:maxAnswers,maxSerializedD1RowBytes:maxRawRow,queryBytes:bytes(B1_CAPTURE_SQL),binds:5,maxCaptureAndAttestationMs:Math.max(...times),medianCaptureAndAttestationMs:[...times].sort((a,b)=>a-b)[17],runtime:process.version,captures}));
  });
  it('requires exact assessment owner/member even for support; no project/workspace inheritance',async()=>{
    const held={eligible:false,reason:'HELD'};
    for(const principal of [ctx('missing'),ctx('missing','support'),ctx('person_mara','anonymous'),ctx('person_mara','participant')])expect(await captureForBuild(principal,aids[0])).toEqual(held);
    expect(await captureForBuild(ctx(),'unknown')).toEqual(held);
    await exec('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_type=? AND scope_id=?','viewer','person_mara','assessment',aids[0]);
    try{expect(await captureForBuild(ctx(),aids[0])).toEqual(held);expect(await captureForBuild(ctx('person_mara','support'),aids[0])).toEqual(held);}
    finally{await exec('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_type=? AND scope_id=?','owner','person_mara','assessment',aids[0]);}
    expect((await captureForBuild(ctx('person_mara','support'),aids[0])).eligible).toBe(true);
  });
  it('includes archived surveys but refuses archived assessment and empty capture',async()=>{
    await exec('UPDATE assessment_survey SET archived_at=? WHERE assessment_id=?','2026-09-17T00:00:00Z',aids[0]);
    try{expect((await captureForBuild(ctx(),aids[0])).eligible).toBe(true);}finally{await exec('UPDATE assessment_survey SET archived_at=NULL WHERE assessment_id=?',aids[0]);}
    await exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17T00:00:00Z',aids[0]);
    try{expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}finally{await exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aids[0]);}
    await exec("INSERT INTO assessment(id,project_id,language_id,name,purpose,period,format,stage,created_at,created_by) SELECT 'b1_empty',project_id,language_id,'Synthetic empty','fixture',period,format,stage,created_at,created_by FROM assessment WHERE id=?",aids[0]);
    await exec("INSERT INTO \"grant\"(id,principal_id,scope_type,scope_id,role,created_at) VALUES('b1_empty_grant','person_mara','assessment','b1_empty','owner','2026-09-17')");
    expect(await captureForBuild(ctx(),'b1_empty')).toEqual({eligible:false,reason:'HELD'});
  });
  it('unknown/mixed append, mutated answers and template association cannot be silently omitted',async()=>{
    const r=decodePackedCapture(aids[0],(await raw())!.capture_json)[0];
    await exec("INSERT INTO response(id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,provenance_json,source,submitted_at) SELECT 'b1_unknown',assessment_survey_id,'b1_unknown_respondent','b1_unknown_key',answers_json,template_id,template_version,provenance_json,'synthetic',submitted_at FROM response WHERE id=?",r.responseId);
    try{expect(JSON.parse((await raw())!.capture_json)[0].length).toBeGreaterThan(decodePackedCapture(aids[0],(await raw())!.capture_json).filter(x=>x.responseId!=='b1_unknown').length);expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}
    finally{await exec("DELETE FROM response WHERE id='b1_unknown'");}
    await exec('UPDATE response SET answers_json=? WHERE id=?','{}',r.responseId);
    try{expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}finally{await exec('UPDATE response SET answers_json=? WHERE id=?',r.answersRaw,r.responseId);}
    await exec('UPDATE response SET template_version=1 WHERE id=?',r.responseId);
    try{expect(await raw()).toBeNull();expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}finally{await exec('UPDATE response SET template_version=? WHERE id=?',r.responseTemplateVersion,r.responseId);}
  });
  it('global integrity refuses four orphan kinds rather than dropping unrelated rows',async()=>{
    const r=decodePackedCapture(aids[0],(await raw())!.capture_json)[0];
    const changes=[
      ['response','assessment_survey_id',r.responseId,'absent-survey',r.assessmentSurveyId],
      ['assessment_survey','assessment_id',r.assessmentSurveyId,'absent-assessment',aids[0]],
      ['response','template_version',r.responseId,999,r.responseTemplateVersion],
      ['assessment_survey','template_version',r.assessmentSurveyId,999,r.selectedTemplateVersion],
    ] as const;
    for(const [table,field,id,bad,original] of changes){
      // Corruption exists only inside this local atomic fixture batch; deferred FK
      // checking succeeds after restoration. Actual schema and query stay intact.
      const results=await db.batch([
        db.prepare('PRAGMA defer_foreign_keys=ON'),
        db.prepare(`UPDATE ${table} SET ${field}=? WHERE id=?`).bind(bad,id),
        db.prepare(B1_CAPTURE_SQL).bind('user',null,aids[1],'person_mara','member'),
        db.prepare(B1_CAPTURE_SQL.replace('integrity.valid = 1 AND ', '')).bind('user',null,aids[1],'person_mara','member'),
        db.prepare(`UPDATE ${table} SET ${field}=? WHERE id=?`).bind(original,id),
      ]);
      expect(results[2].results).toEqual([]);
      // Negative control: removing the global predicate incorrectly releases a
      // gold capture despite orphan corruption elsewhere in the same observation.
      expect(results[3].results).toHaveLength(1);
      const leaked:any=results[3].results[0];expect((await attestPackedCapture(aids[1],leaked.capture_json)).eligible).toBe(true);
    }
    expect((await captureForBuild(ctx(),aids[0])).eligible).toBe(true);
  });
  it('raw duplicate answer/item keys reach strict A without being erased',async()=>{
    const r=decodePackedCapture(aids[0],(await raw())!.capture_json)[0];
    const answers=r.answersRaw.replace(/^\{/, '{"duplicate":1,"\\u0064uplicate":2,');
    await exec('UPDATE response SET answers_json=? WHERE id=?',answers,r.responseId);
    try{const packed=(await raw())!.capture_json;expect(decodePackedCapture(aids[0],packed).find(x=>x.responseId===r.responseId)!.answersRaw).toBe(answers);expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}
    finally{await exec('UPDATE response SET answers_json=? WHERE id=?',r.answersRaw,r.responseId);}
    const original=(await db.prepare('SELECT items_json FROM survey_template WHERE id=? AND version=?').bind(r.selectedTemplateId,r.selectedTemplateVersion).first<{items_json:string}>())!.items_json;
    const changed=original.replace(/\{/, '{"duplicate":1,"\\u0064uplicate":2,');
    await exec('UPDATE survey_template SET items_json=? WHERE id=? AND version=?',changed,r.selectedTemplateId,r.selectedTemplateVersion);
    try{expect(decodePackedCapture(aids[0],(await raw())!.capture_json)[0].templateRaw).toContain('"\\u0064uplicate":2');expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}
    finally{await exec('UPDATE survey_template SET items_json=? WHERE id=? AND version=?',original,r.selectedTemplateId,r.selectedTemplateVersion);}
  });
  it('linearizes grant/archive/input changes at the single SELECT, not during later hashing',async()=>{
    const r=decodePackedCapture(aids[0],(await raw())!.capture_json)[0];
    const actions=[
      {change:()=>exec('UPDATE assessment SET archived_at=? WHERE id=?','2026-09-17',aids[0]),restore:()=>exec('UPDATE assessment SET archived_at=NULL WHERE id=?',aids[0])},
      {change:()=>exec('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_type=? AND scope_id=?','viewer','person_mara','assessment',aids[0]),restore:()=>exec('UPDATE "grant" SET role=? WHERE principal_id=? AND scope_type=? AND scope_id=?','owner','person_mara','assessment',aids[0])},
      {change:()=>exec('UPDATE response SET answers_json=? WHERE id=?','{}',r.responseId),restore:()=>exec('UPDATE response SET answers_json=? WHERE id=?',r.answersRaw,r.responseId)},
    ];
    let count=0;
    for(const action of actions){
      const wrapped=(when:'before'|'after')=>({prepare(sql:string){return{bind(...args:any[]){return{async first(){count++;if(when==='before')await action.change();const row=await db.prepare(sql).bind(...args).first();if(when==='after')await action.change();return row;}}}}}} as unknown as D1Database);
      try{expect(await captureForBuild(ctx('person_mara','user',wrapped('before')),aids[0])).toEqual({eligible:false,reason:'HELD'});}finally{await action.restore();}
      try{expect((await captureForBuild(ctx('person_mara','user',wrapped('after')),aids[0])).eligible).toBe(true);expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}finally{await action.restore();}
    }
    expect(count).toBe(6);
  });
});
describe('strict outer adapter and bounded refusal',()=>{
  it('rejects wrong shapes, extra fields, duplicate IDs/templates and byte excess',async()=>{
    const good=(await raw())!.capture_json,parsed=JSON.parse(good);
    const cases:any[]=[{},[],[[],[]],[parsed[0],parsed[1],[]],[[...parsed[0],parsed[0][0]],parsed[1]],[parsed[0],[...parsed[1],parsed[1][0]]]];
    const arity=JSON.parse(good);arity[0][0].push('extra');cases.push(arity);
    const object=JSON.parse(good);object[0][0][8]={a:1};cases.push(object);
    const wrong=JSON.parse(good);wrong[0][0][1]='another-assessment';cases.push(wrong);
    const large=JSON.parse(good);large[0][0][8]='x'.repeat(8193);cases.push(large);
    for(const c of cases)expect(await attestPackedCapture(aids[0],JSON.stringify(c))).toEqual({eligible:false,reason:'HELD'});
    for(const value of ['{',' '.repeat(524289)])expect(await attestPackedCapture(aids[0],value)).toEqual({eligible:false,reason:'HELD'});
  });
  it('SQL row bounds refuse oversized raw answers before aggregate output',async()=>{
    const r=decodePackedCapture(aids[0],(await raw())!.capture_json)[0];await exec('UPDATE response SET answers_json=? WHERE id=?',JSON.stringify({padding:'x'.repeat(8192)}),r.responseId);
    try{expect(await raw()).toBeNull();}finally{await exec('UPDATE response SET answers_json=? WHERE id=?',r.answersRaw,r.responseId);}
  });
  it('over-count refuses the complete set instead of limiting it to 425 rows',async()=>{
    const row=(await raw())!;const count=JSON.parse(row.capture_json)[0].length;const r=decodePackedCapture(aids[0],row.capture_json)[0];
    await exec("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<?) INSERT INTO response(id,assessment_survey_id,respondent_id,idempotency_key,answers_json,template_id,template_version,provenance_json,source,submitted_at) SELECT 'b1_limit_'||x,r.assessment_survey_id,'b1_limit_respondent_'||x,'b1_limit_key_'||x,r.answers_json,r.template_id,r.template_version,r.provenance_json,'synthetic',r.submitted_at FROM n CROSS JOIN response r WHERE r.id=?",426-count,r.responseId);
    try{expect(await raw()).toBeNull();expect(await captureForBuild(ctx(),aids[0])).toEqual({eligible:false,reason:'HELD'});}finally{await exec("DELETE FROM response WHERE id GLOB 'b1_limit_*'");}
  });
  it('D1 faults return bounded unavailability without error content or log calls',async()=>{
    const broken={prepare(){throw new Error('secret-ish fixture detail')}} as unknown as D1Database;
    expect(await captureForBuild(ctx('person_mara','user',broken),aids[0])).toEqual({eligible:false,reason:'UNAVAILABLE'});
  });
});
