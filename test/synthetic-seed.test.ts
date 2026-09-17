import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"synseed",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"synseed-test-db"}}]}));
afterAll(()=>mf.dispose());
function statements(db:D1Database,path:string) {
  const sql=readFileSync(new URL(path,import.meta.url),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
  return sql.split(";\n").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s));
}

describe("synthetic answer sets (Steve Watters' persona generator @ f042cde) load against the pinned v2 instruments",()=>{
  let db:D1Database;
  const load=async(path:string)=>{ const stmts=statements(db,path); for(let i=0;i<stmts.length;i+=100) await db.batch(stmts.slice(i,i+100)); };
  beforeAll(async()=>{
    db=await mf.getD1Database("DB");
    for(const m of ["0001_init.sql","0002_code_escrow.sql","0003_language_archive.sql","0004_pinned_instruments.sql"]) await db.batch(statements(db,`../migrations/${m}`));
    await db.batch(statements(db,"../seed/synthetic.sql"));
  },60_000);
  it("425 named-persona submissions load; every PRESENT answer is a real option code of its template item",async()=>{
    await load("../seed/synthetic-responses.sql");
    const n=async(sql:string)=>(await db.prepare(sql).first<{n:number}>())!.n;
    expect(await n("SELECT COUNT(*) AS n FROM response WHERE source='synthetic' AND id NOT IN (SELECT r.id FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id LIKE 'assess_syn_org%')")).toBe(425);
    expect(await n("SELECT COUNT(*) AS n FROM assessment WHERE id LIKE 'assess_syn_%'")).toBe(34);
    expect(await n("SELECT COUNT(*) AS n FROM project WHERE id LIKE 'proj_syn_%'")).toBe(10);
    // referential + template integrity: every response's survey exists and points at the same v2 template
    expect(await n("SELECT COUNT(*) AS n FROM response r LEFT JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.id IS NULL OR s.template_id<>r.template_id OR s.template_version<>r.template_version")).toBe(0);
    // answers validate against template items: single → option code, multi → array of codes, text → string; no unknown item ids
    const tpls=(await db.prepare("SELECT id, items_json FROM survey_template WHERE version=2").all<{id:string;items_json:string}>()).results;
    const items=new Map(tpls.map(t=>[t.id,JSON.parse(t.items_json) as any[]]));
    const rows=(await db.prepare("SELECT template_id, answers_json FROM response WHERE source='synthetic'").all<{template_id:string;answers_json:string}>()).results;
    let checked=0;
    for(const row of rows){
      const its=items.get(row.template_id)!; const byId=new Map(its.map(i=>[i.id,i]));
      for(const [k,v] of Object.entries(JSON.parse(row.answers_json))){
        const it=byId.get(k); expect(it,`unknown item ${k}`).toBeDefined();
        if(v===null){ expect(it.required).toBe(false); continue; }
        if(it.type==="single") expect(it.options.some((o:any)=>o.code===v),`${k}=${v}`).toBe(true);
        else if(it.type==="multi") { expect(Array.isArray(v)).toBe(true); for(const c of v as string[]) expect(it.options.some((o:any)=>o.code===c),`${k}∋${c}`).toBe(true); }
        else expect(typeof v).toBe("string");
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(4000);
    // the demo owner can see every synthetic assessment through explicit grants (no inheritance)
    expect(await n("SELECT COUNT(*) AS n FROM assessment a LEFT JOIN \"grant\" g ON g.scope_type='assessment' AND g.scope_id=a.id AND g.principal_id='person_mara' WHERE a.id LIKE 'assess_syn_%' AND g.id IS NULL")).toBe(0);
  },60_000);
  it("org-comparison cohort (seeded source generator) adds Audio / Video-Sign / Community-Pastor; gaps and blanks are NAMED, not hidden",async()=>{
    await load("../seed/synthetic-responses.sql"); await load("../seed/synthetic-responses-org.sql"); // idempotent — this test stands alone
    const n=async(sql:string)=>(await db.prepare(sql).first<{n:number}>())!.n;
    // additive: the 425 named-persona rows are untouched, 525 new rows arrive
    expect(await n("SELECT COUNT(*) AS n FROM response WHERE source='synthetic'")).toBe(425+525);
    expect(await n("SELECT COUNT(*) AS n FROM project WHERE id LIKE 'proj_syn_org%'")).toBe(9);
    expect(await n("SELECT COUNT(*) AS n FROM assessment WHERE id LIKE 'assess_syn_org%'")).toBe(45);
    // every language hangs off its own project (reference relation, not id substitution)
    expect(await n("SELECT COUNT(*) AS n FROM assessment a JOIN language l ON l.id=a.language_id WHERE a.id LIKE 'assess_syn_%' AND l.project_id<>a.project_id")).toBe(0);
    const byTpl=(await db.prepare("SELECT template_id AS t, COUNT(*) AS n FROM response WHERE source='synthetic' GROUP BY template_id").all<{t:string;n:number}>()).results;
    expect(byTpl.length).toBe(7); // 7 of 9 forms have synthetic responses
    // every org-cohort answer is a real option code of its template item
    const tpls=(await db.prepare("SELECT id, items_json FROM survey_template WHERE version=2").all<{id:string;items_json:string}>()).results;
    const items=new Map(tpls.map(t=>[t.id,new Map((JSON.parse(t.items_json) as any[]).map(i=>[i.id,i]))]));
    const rows=(await db.prepare("SELECT template_id, answers_json FROM response WHERE id IN (SELECT r.id FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE s.assessment_id LIKE 'assess_syn_org%')").all<{template_id:string;answers_json:string}>()).results;
    expect(rows.length).toBe(525);
    for(const row of rows) for(const [k,v] of Object.entries(JSON.parse(row.answers_json))){
      const it:any=items.get(row.template_id)!.get(k); expect(it,`unknown item ${k}`).toBeDefined();
      if(v===null){ expect(it.required,`${k} null but required`).toBe(false); continue; }
      if(it.type==="single") expect(it.options.some((o:any)=>o.code===v),`${k}=${v}`).toBe(true);
      else if(it.type==="multi"){ expect(Array.isArray(v)).toBe(true); for(const c of v as string[]) expect(it.options.some((o:any)=>o.code===c),`${k}∋${c}`).toBe(true); }
      else expect(typeof v).toBe("string");
    }
    const man=JSON.parse(readFileSync(new URL("../seed/synthetic/manifest.json",import.meta.url),"utf8"));
    expect(man.form_coverage.forms_without_synthetic_submissions).toEqual(["Denom-Leader","Mid-Level"]);
    expect(man.datasets["org-comparison"].reads_real_exports).toBe(false);
    expect(man.sha256["answer-sets.json"]).toBe("efc50c5ff9139d9235e4323233d27c54059527f92c54099e2f9dbf0cd71df1b5"); // historical rows not regenerated
    // committed cargo matches its manifest (review #14-5)
    const sha=(rel:string)=>createHash("sha256").update(readFileSync(new URL(rel,import.meta.url))).digest("hex");
    expect(sha("../seed/synthetic/answer-sets-org-comparison.json")).toBe(man.datasets["org-comparison"].sha256);
    expect(sha("../seed/synthetic-responses-org.sql")).toBe(man.sql["org-comparison"].sha256);
    expect(sha("../seed/synthetic-responses.sql")).toBe(man.sql["named-personas"].sha256);
    expect(await n("SELECT COUNT(*) AS n FROM assessment_survey WHERE assessment_id LIKE 'assess_syn_org%'")).toBe(man.sql["org-comparison"].surveys);
    expect(await n("SELECT COUNT(*) AS n FROM \"grant\" WHERE id LIKE 'grant_syn_%org%'")).toBe(man.sql["org-comparison"].grants);
    expect(await n("SELECT COUNT(*) AS n FROM assessment a LEFT JOIN \"grant\" g ON g.scope_type='assessment' AND g.scope_id=a.id AND g.principal_id='person_mara' WHERE a.id LIKE 'assess_syn_org%' AND g.id IS NULL")).toBe(0);
    // Audio / Video-Sign cycles are not labelled 'written' (review #14-3)
    expect(await n("SELECT COUNT(*) AS n FROM assessment a JOIN assessment_survey s ON s.assessment_id=a.id WHERE s.template_id='tpl_audio' AND a.format<>'audio'")).toBe(0);
    expect(await n("SELECT COUNT(*) AS n FROM assessment a JOIN assessment_survey s ON s.assessment_id=a.id WHERE s.template_id='tpl_video_sign' AND a.format<>'video-sign'")).toBe(0);
    // HONEST LIMIT (review #14-1): Steve's generator leaves required items blank at its personas' missing_rate. These rows are
    // import-shaped — cap.response.submit would refuse them. The count is recorded, asserted, and must not be read as "valid submissions".
    const all=(await db.prepare("SELECT r.template_id, r.answers_json, s.assessment_id FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE r.source='synthetic'").all<{template_id:string;answers_json:string;assessment_id:string}>()).results;
    const blank=(org:boolean)=>all.filter(r=>r.assessment_id.startsWith("assess_syn_org")===org).filter(r=>{ const a=JSON.parse(r.answers_json); return [...items.get(r.template_id)!.values()].some((it:any)=>it.required&&(a[it.id]===undefined||a[it.id]===null||(Array.isArray(a[it.id])&&!a[it.id].length))); }).length;
    expect(blank(true)).toBe(man.sql["org-comparison"].submissions_with_blank_required_items);
    expect(blank(false)).toBe(man.sql["named-personas"].submissions_with_blank_required_items);
  },120_000);
});
