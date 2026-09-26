import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { LEGACY_MID_LEVEL_V1 } from "../src/legacy-templates";

const mf = new Miniflare(convertV4MiniflareOptions({workers:[{name:"legacy-tpl",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"legacy-tpl"}}]}));
let db: D1Database, dev:any, prod:any, owner:string;
async function call(env:any,method:string,url:string,body?:unknown,bearer?:string) {
  const r=await app.fetch(new Request("https://local.invalid"+url,{method,headers:{"content-type":"application/json",...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);
  return {status:r.status,...await r.json() as any};
}
beforeAll(async()=>{
 db=await mf.getD1Database("DB");
 for(const file of ["migrations/0001_init.sql","migrations/0002_code_escrow.sql","migrations/0003_language_archive.sql","migrations/0004_pinned_instruments.sql","migrations/0007_shared_link_context.sql","seed/synthetic.sql"]){
  const sql=readFileSync(new URL("../"+file,import.meta.url),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
  await db.batch(sql.split(";\n").map(x=>x.trim()).filter(Boolean).map(x=>db.prepare(x)));
 }
 prod={DB:db,SESSION_SECRET:"synthetic-legacy",ENVIRONMENT:"production"};
 dev={DB:db,SESSION_SECRET:"synthetic-legacy",ENVIRONMENT:"dev"};
 owner=await mintSession(dev,"person_mara","user");
},60000);
afterAll(()=>mf.dispose());

describe("legacy Lovable mid-level v1 template (DEV only)",()=>{
 it("carries the old ML1-ML12 questions verbatim, unscored",()=>{
  const ids=LEGACY_MID_LEVEL_V1.items.map(i=>i.id);
  for(let n=1;n<=12;n++) expect(ids).toContain("ML"+n);
  expect(ids).toContain("ML8_other");
  const ml2=LEGACY_MID_LEVEL_V1.items.find(i=>i.id==="ML2")!;
  expect(ml2.type).toBe("multi");
  expect((ml2 as any).options.map((o:any)=>o.text)).toEqual(["Translation handbooks (UBS/SIL)","Commentaries","Original-language tools (interlinear, lexicons)","Multiple gateway translations","Consultant or trainer guidance","Other (please describe):"]);
 });
 it("is never seeded outside DEV",async()=>{
  const prodOwner=await mintSession(prod,"person_mara","user");
  const r=await call(prod,"GET","/v2/templates",undefined,prodOwner);
  expect(r.ok).toBe(true);
  expect(r.result.templates.some((t:any)=>t.id===LEGACY_MID_LEVEL_V1.id)).toBe(false);
  expect(await db.prepare("SELECT id FROM survey_template WHERE id=?").bind(LEGACY_MID_LEVEL_V1.id).first()).toBeNull();
 });
 it("is not offered in the DEV template list (B42: Mid-Level once per group), yet stays reachable by id and accepts a legacy response as answered",async()=>{
  for(let i=0;i<2;i++){const r=await call(dev,"GET","/v2/templates",undefined,owner);expect(r.result.templates.some((t:any)=>t.id===LEGACY_MID_LEVEL_V1.id)).toBe(false);expect(new Set(r.result.templates.filter((t:any)=>t.perspective==="Translation Team"&&/mid-level/i.test(t.name)).map((t:any)=>t.id))).toEqual(new Set(["tpl_mid_level"]));}
  const got=await call(dev,"GET","/v2/templates/"+LEGACY_MID_LEVEL_V1.id+"@1",undefined,owner);
  expect(got.result.template.items).toHaveLength(LEGACY_MID_LEVEL_V1.items.length);
  const path="/v2/assessments/assess_tavo_collect/surveys";
  const sel=await call(dev,"POST",path,{params:{template_id:LEGACY_MID_LEVEL_V1.id}},owner);
  expect(sel.ok).toBe(true);
  const sid=sel.result.sid;
  const dry=await call(dev,"POST",`${path}/${sid}/links`,{params:{},mode:"dry_run"},owner);expect(dry.ok).toBe(true);
  const link=await call(dev,"POST",`${path}/${sid}/links`,{params:{},mode:"execute",confirm_token:dry.result.confirm_token},owner);expect(link.ok).toBe(true);
  const open=await call(dev,"POST","/v2/participate/link",{token:link.result.link_token});expect(open.ok).toBe(true);
  const answers={ML1:"o2",ML2:["o1","o2","o4"],ML3:"o2",ML4:"o2",ML5:"o2",ML6:"o1",ML7:"o1",ML8:"other",ML8_other:"free text",ML9:"o1",ML10:"o2",ML11:"a strength",ML12:"an improvement"};
  const sub=await call(dev,"POST","/v2/participate/responses",{idempotency_key:"legacy:test-1",answers},open.result.participant_token);
  expect(sub.ok).toBe(true);
  const row=await db.prepare("SELECT answers_json, template_id FROM response WHERE id=?").bind(sub.result.response_id).first<any>();
  expect(row.template_id).toBe(LEGACY_MID_LEVEL_V1.id);
  expect(JSON.parse(row.answers_json)).toMatchObject(answers);
 });
});
