// Captain ruling 2026-09-29 (BCS training demo, bee:10809312 u3540382253-264): people read "Translators" and
// "Mid-Level Quality Roles (Facilitators, Team Leaders, CiTs)"; ids and the pinned source names never change (source_name carries them).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import app from "../src/index";
import { mintSession } from "../src/auth";
import { templateDisplayName, withDisplayName, TEMPLATE_DISPLAY_NAMES } from "../src/display-names";

const mf = new Miniflare(convertV4MiniflareOptions({workers:[{name:"display-names",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"display-names"}}]}));
let db: D1Database, env:any, owner:string;
async function call(method:string,url:string,bearer?:string) {
  const r=await app.fetch(new Request("https://local.invalid"+url,{method,headers:{"content-type":"application/json",...(bearer?{authorization:`Bearer ${bearer}`}:{})}}),env);
  const text=await r.text(); try { return {status:r.status,...JSON.parse(text)}; } catch { return {status:r.status,text}; }
}
beforeAll(async()=>{
  db=await mf.getD1Database("DB");
  for(const file of ["migrations/0001_init.sql","migrations/0002_code_escrow.sql","migrations/0003_language_archive.sql","migrations/0004_pinned_instruments.sql","migrations/0007_shared_link_context.sql","seed/synthetic.sql","migrations/0011_context.sql"]){
    const sql=readFileSync(new URL("../"+file,import.meta.url),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
    await db.batch(sql.split(";\n").map(x=>x.trim()).filter(Boolean).map(x=>db.prepare(x)));
  }
  env={DB:db,SESSION_SECRET:"synthetic-display",ENVIRONMENT:"production"};
  owner=await mintSession(env,"person_mara","user");
},60000);
afterAll(()=>mf.dispose());

describe("template display names",()=>{
  it("maps only the two ruled templates (and the legacy mid-level); everything else passes through",()=>{
    expect(templateDisplayName("tpl_validation","Validation")).toBe("Translators");
    expect(templateDisplayName("tpl_mid_level","Mid-Level")).toBe("Mid-Level Quality Roles (Facilitators, Team Leaders, CiTs)");
    expect(templateDisplayName("tpl_written","Written")).toBe("Written");
    expect(withDisplayName({id:"tpl_written",name:"Written"})).toEqual({id:"tpl_written",name:"Written"});
    expect(withDisplayName({id:"tpl_validation",name:"Validation"})).toEqual({id:"tpl_validation",name:"Translators",source_name:"Validation"});
    expect(Object.keys(TEMPLATE_DISPLAY_NAMES).sort()).toEqual(["tpl_mid_level","tpl_mid_level_v1_legacy","tpl_validation"]);
  });
  it("the template catalogue shows the display names and keeps the pinned name as source_name",async()=>{
    const r=await call("GET","/v2/templates",owner);
    expect(r.ok).toBe(true);
    const names=r.result.templates.map((t:any)=>t.name);
    expect(names).not.toContain("Validation"); expect(names).not.toContain("Mid-Level");
    const v=r.result.templates.find((t:any)=>t.id==="tpl_validation"), m=r.result.templates.find((t:any)=>t.id==="tpl_mid_level");
    expect([v.name,v.source_name]).toEqual(["Translators","Validation"]);
    expect([m.name,m.source_name]).toEqual(["Mid-Level Quality Roles (Facilitators, Team Leaders, CiTs)","Mid-Level"]);
    expect(r.result.templates.find((t:any)=>t.id==="tpl_written").source_name).toBeUndefined();
    const one=await call("GET","/v2/templates/tpl_validation@2",owner);
    expect([one.result.template.name,one.result.template.source_name]).toEqual(["Translators","Validation"]);
  });
  it("assessment, survey status and the blank print all say Translators",async()=>{
    const a=await call("GET","/v2/assessments/assess_tavo_collect",owner);
    expect(a.ok).toBe(true);
    const s=a.result.surveys.find((x:any)=>x.id==="survey_tavo");
    expect([s.template_id,s.template_name,s.template_source_name]).toEqual(["tpl_validation","Translators","Validation"]);
    const st=await call("GET","/v2/assessments/assess_tavo_collect/surveys/survey_tavo",owner);
    expect(st.result.survey.template_name).toBe("Translators");
    const p=await call("GET","/v2/assessments/assess_tavo_collect/surveys/survey_tavo/print",owner);
    expect(p.ok).toBe(true);
    expect(p.result.html).toContain("<title>Translators</title>");
    expect(p.result.html).not.toContain(">Validation<");
    expect(p.result.template_id).toBe("tpl_validation");
  });
});
