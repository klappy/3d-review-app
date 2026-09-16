import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { form, submit } from "../src/handlers/response";
import { renderItems, type TemplateItem } from "../src/handlers/common";
import type { Ctx } from "../src/handlers/types";

const SOURCE="f042cde553761a6a7f24132cef7802f956378ee0";
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"pinned",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"pinned-instruments-test"}}]}));
afterAll(()=>mf.dispose());
function statements(db:D1Database,path:string) {
  const sql=readFileSync(new URL(path,import.meta.url),"utf8");
  if(path.endsWith("0004_pinned_instruments.sql"))
    return sql.split("\n").filter(line=>line.startsWith("INSERT INTO survey_template ")).map(line=>db.prepare(line));
  return sql.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n").split(";").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s));
}

describe("pinned source instruments as immutable v2",()=>{
  it("preserves v1 evidence, imports exact source counts, and validates multi/optional answers",async()=>{
    const db=await mf.getD1Database("DB");
    for(const path of ["../migrations/0001_init.sql","../migrations/0002_code_escrow.sql","../migrations/0003_language_archive.sql","../seed/synthetic.sql","../migrations/0004_pinned_instruments.sql"])
      await db.batch(statements(db,path));
    const {results:rows}=await db.prepare("SELECT id,version,name,perspective,source_ref,items_json,scoring_json FROM survey_template ORDER BY id,version").all<{id:string;version:number;name:string;perspective:string;source_ref:string;items_json:string;scoring_json:string}>();
    const v1=rows.filter(r=>r.version===1),v2=rows.filter(r=>r.version===2);
    expect(v1).toHaveLength(9); expect(v2).toHaveLength(9);
    expect(v1.every(r=>JSON.parse(r.items_json).length===1)).toBe(true);
    const prior=await db.prepare("SELECT r.answers_json,s.template_version FROM response r JOIN assessment_survey s ON s.id=r.assessment_survey_id WHERE r.id='resp_synth_1'").first<{answers_json:string;template_version:number}>();
    expect(prior).toEqual({answers_json:'{"Q1":4}',template_version:1});
    const items=v2.flatMap(r=>JSON.parse(r.items_json) as TemplateItem[]);
    expect(items).toHaveLength(111);
    const optionCount=items.reduce((sum,item)=>sum+(item.options?.length??(item.type==="text"?1:0)),0);
    expect(optionCount).toBe(498);
    expect(new Set(items.map(item=>item.id)).size).toBe(111);
    expect(v2.every(r=>r.source_ref.includes(SOURCE)&&JSON.parse(r.scoring_json).status==="held")).toBe(true);
    expect(items.every(item=>["single","multi","text"].includes(item.type))).toBe(true);
    expect(items.every(item=>item.type==="text"||!!item.options?.length)).toBe(true);
    expect(items.filter(item=>item.required===false)).toHaveLength(12); // 9 open-text + 3 conditional problem follow-ups
    for(const row of v2) {
      const rendered=renderItems(JSON.parse(row.items_json),"Synthetic language");
      expect(rendered.every(item=>typeof item.required==="boolean"&&["single","multi","text"].includes(item.type as string))).toBe(true);
      expect(rendered.every(item=>item.type==="text"||Array.isArray(item.options))).toBe(true);
      expect(JSON.stringify(rendered)).not.toContain("source_score");
    }
    await db.prepare("INSERT INTO assessment_survey (id,assessment_id,template_id,template_version,state,collection_status,created_at) VALUES ('survey_pinned_test','assess_tavo_collect','tpl_written',2,'selected','open','2026-09-16T20:00:00Z')").run();
    const ctx:Ctx={env:{DB:db,SESSION_SECRET:"test"},db,principal:{kind:"participant",id:"respondent_pinned",participantSurveyId:"survey_pinned_test",respondentId:"respondent_pinned"},traceId:"tr_pinned",now:()=>new Date("2026-09-16T20:00:00Z"),log:()=>{}};
    const presented=await form(ctx,{});
    const formItems=presented.result.items as Array<{id:string;type:string;required:boolean;options?:Array<{code:string}>}>;
    expect(formItems).toHaveLength(13);
    const answers:Record<string,unknown>={};
    for(const item of formItems) {
      if(!item.required) continue;
      answers[item.id]=item.type==="multi"?[item.options![0].code]:item.type==="single"?item.options![0].code:"Sample text";
    }
    const required=formItems.find(item=>item.required)!;
    const missing={...answers}; delete missing[required.id];
    await expect(submit(ctx,{idempotency_key:"missing",answers:missing})).rejects.toMatchObject({code:"INVALID_PARAMS"});
    const multi=formItems.find(item=>item.type==="multi")!;
    await expect(submit(ctx,{idempotency_key:"bad-multi",answers:{...answers,[multi.id]:"not-array"}})).rejects.toMatchObject({code:"INVALID_PARAMS"});
    await expect(submit(ctx,{idempotency_key:"bad-option",answers:{...answers,[multi.id]:["not-a-source-option"]}})).rejects.toMatchObject({code:"INVALID_PARAMS"});
    const saved=await submit(ctx,{idempotency_key:"valid-pinned",answers});
    expect(saved.result.duplicate).toBe(false);
    const stored=await db.prepare("SELECT answers_json,template_id,template_version FROM response WHERE id = ?").bind(saved.result.response_id).first<{answers_json:string;template_id:string;template_version:number}>();
    const normalized=JSON.parse(stored!.answers_json);
    expect(stored).toMatchObject({template_id:"tpl_written",template_version:2});
    expect(normalized["CW-Q2"]).toBeNull();
    expect(normalized["CW-Q6"]).toBeNull();
    expect(normalized[multi.id]).toEqual(multi.required?answers[multi.id]:null);
    const secondCtx:Ctx={...ctx,principal:{...ctx.principal,id:"respondent_pinned_multi",respondentId:"respondent_pinned_multi"},traceId:"tr_pinned_multi"};
    const withMulti={...answers,[multi.id]:[multi.options![0].code]};
    const second=await submit(secondCtx,{idempotency_key:"valid-pinned-multi",answers:withMulti});
    const secondRow=await db.prepare("SELECT answers_json FROM response WHERE id = ?").bind(second.result.response_id).first<{answers_json:string}>();
    expect(JSON.parse(secondRow!.answers_json)[multi.id]).toEqual(withMulti[multi.id]);
  },30000);
});
