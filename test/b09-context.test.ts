// B09 demographics (Bincy F06, ASK F06 option 2): optional respondent context + facilitator group context, no names.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { GROUP_FIELDS, RESPONDENT_FIELDS } from "../src/context-fields";
import * as ui from "../ui/v3/components/context-fields.js";

const mf = new Miniflare(convertV4MiniflareOptions({workers:[{name:"b09",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"b09"}}]}));
let db: D1Database, env:any, owner:string;
const aid="assess_tavo_collect", path=`/v2/assessments/${aid}/surveys/survey_tavo/links`;
async function call(method:string,url:string,body?:unknown,bearer?:string) {
  const r=await app.fetch(new Request("https://local.invalid"+url,{method,headers:{"content-type":"application/json",...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:body===undefined?undefined:JSON.stringify(body)}),env);
  return {status:r.status,...await r.json() as any};
}
async function participant() {
  const dry=await call("POST",path,{params:{},mode:"dry_run"},owner);
  const link=(await call("POST",path,{params:{},mode:"execute",confirm_token:dry.result.confirm_token},owner)).result;
  return (await call("POST","/v2/participate/link",{token:link.link_token})).result.participant_token as string;
}
const submit=(t:string,body:Record<string,unknown>)=>call("POST","/v2/participate/responses",{idempotency_key:"k-"+Math.random(),answers:{Q1:4},...body},t);
beforeAll(async()=>{
 db=await mf.getD1Database("DB");
 for(const file of ["migrations/0001_init.sql","migrations/0002_code_escrow.sql","migrations/0003_language_archive.sql","migrations/0004_pinned_instruments.sql","migrations/0007_shared_link_context.sql","seed/synthetic.sql","migrations/0011_context.sql"]){
  const sql=readFileSync(new URL("../"+file,import.meta.url),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
  await db.batch(sql.split(";\n").map(x=>x.trim()).filter(Boolean).map(x=>db.prepare(x)));
 }
 env={DB:db,SESSION_SECRET:"synthetic-b09",ENVIRONMENT:"dev"};owner=await mintSession(env,"person_mara","user");
},60000);
afterAll(()=>mf.dispose());

describe("B09 context",()=>{
 it("server and browser field lists are identical and carry no name field",()=>{
  expect(ui.RESPONDENT_FIELDS).toEqual(RESPONDENT_FIELDS);expect(ui.GROUP_FIELDS).toEqual(GROUP_FIELDS);
  const keys=[...RESPONDENT_FIELDS,...Object.values(GROUP_FIELDS).flat()].map(f=>f.key);
  expect(keys.filter(k=>/name|team_members_present/.test(k))).toEqual([]);
  expect(RESPONDENT_FIELDS.every(f=>f.options!.some(o=>o.code==="prefer_not"))).toBe(true);
 });
 it("form lists the optional About you fields; submit stores given context and refuses unknown keys",async()=>{
  const t=await participant();
  const form=await call("GET","/v2/participate/form",undefined,t);expect(form.ok).toBe(true);
  expect(form.result.context_fields.map((f:any)=>f.key)).toEqual(["age_range","gender"]);
  expect((await submit(t,{context:{name:"Ana"}})).error.code).toBe("INVALID_PARAMS");
  expect((await submit(t,{context:{age_range:"12"}})).error.code).toBe("INVALID_PARAMS");
  const ok=await submit(t,{context:{age_range:"25_34",gender:"prefer_not"}});expect(ok.ok).toBe(true);
  const row=await db.prepare("SELECT context_json FROM response WHERE id=?").bind(ok.result.response_id).first<any>();
  expect(JSON.parse(row.context_json)).toEqual({age_range:"25_34",gender:"prefer_not"});
 });
 it("a same-key retry after reload (About you not restored) returns the original receipt",async()=>{
  const t=await participant(),key="retry-key";
  const first=await call("POST","/v2/participate/responses",{idempotency_key:key,answers:{Q1:4},context:{gender:"female"}},t);expect(first.ok).toBe(true);
  const again=await call("POST","/v2/participate/responses",{idempotency_key:key,answers:{Q1:4}},t);
  expect(again.ok).toBe(true);expect(again.result).toMatchObject({response_id:first.result.response_id,duplicate:true});
  const changed=await call("POST","/v2/participate/responses",{idempotency_key:key,answers:{Q1:4},context:{gender:"male"}},t);
  expect(changed.result).toMatchObject({response_id:first.result.response_id,duplicate:true});
  const row=await db.prepare("SELECT context_json FROM response WHERE id=?").bind(first.result.response_id).first<any>();expect(JSON.parse(row.context_json)).toEqual({gender:"female"});
 });
 it("skipping About you stores the empty default",async()=>{
  const t=await participant();const ok=await submit(t,{});expect(ok.ok).toBe(true);
  const row=await db.prepare("SELECT context_json FROM response WHERE id=?").bind(ok.result.response_id).first<any>();expect(row.context_json).toBe("{}");
 });
 it("setup stores the facilitator's group context on select and the list shows it; unknown or name keys refused",async()=>{
  const bad=await call("POST",`/v2/assessments/${aid}/surveys`,{template_id:"tpl_written",context:{facilitator_name:"X"}},owner);expect(bad.error.code).toBe("INVALID_PARAMS");
  const sel=await call("POST",`/v2/assessments/${aid}/surveys`,{template_id:"tpl_written",context:{total_participants:"12",location_setting:"rural"}},owner);
  expect(sel.ok).toBe(true);expect(sel.result.survey.context).toEqual({total_participants:12,location_setting:"rural"});
  const list=await call("GET",`/v2/assessments/${aid}/responses`,undefined,owner);expect(list.ok).toBe(true);
  expect(list.result.suppressed).toBe(true);
  expect(list.result.group_context.find((g:any)=>g.template_id==="tpl_written").context).toEqual({total_participants:12,location_setting:"rural"});
 });
});
