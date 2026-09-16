import { describe, expect, it } from "vitest";
import type { Ctx } from "../src/handlers/types";
import { get, update } from "../src/handlers/assessment";
import { select } from "../src/handlers/survey";

const assessment = { id:"asm_x", project_id:"prj_x", language_id:"lang_x", name:"Synthetic", purpose:null, period:null, format:null, stage:"prepare", notes_reflection:null, notes_next_steps:null, archived_at:null, created_at:"2026-09-16T00:00:00Z" };
function context(projectRole:"owner"|"member", assessmentRole:string|null): {ctx:Ctx; writes:()=>number} {
  let writeCount=0;
  const db={
    prepare(sql:string) {
      let args:unknown[]=[];
      return {
        bind(...a:unknown[]){args=a;return this;},
        async first(){
          if(sql.includes("FROM assessment WHERE id")) return assessment;
          if(sql.includes('FROM "grant"')) return args[1]==="assessment" ? (assessmentRole?{role:assessmentRole}:null) : {role:projectRole};
          if(sql.includes("FROM project WHERE id")) return {id:"prj_x",name:"Synthetic",workspace_id:null,organization:null,archived_at:null,created_at:"2026-09-16T00:00:00Z",created_by:null};
          return null;
        },
        async run(){writeCount++;return {success:true};},
        async all(){return {results:[]};},
      };
    },
  } as unknown as D1Database;
  return {ctx:{env:{DB:db,SESSION_SECRET:"test"},db,principal:{kind:"user",id:"person_x"},traceId:"tr_x",now:()=>new Date("2026-09-16T00:00:00Z"),log:()=>{}},writes:()=>writeCount};
}

describe("A-3 exact assessment grants (D9)",()=>{
  for(const projectRole of ["owner","member"] as const) {
    it(`does not let a project ${projectRole} read or write an ungranted assessment`,async()=>{
      const {ctx,writes}=context(projectRole,null);
      await expect(get(ctx,{id:"asm_x"})).rejects.toMatchObject({code:"NOT_FOUND_OR_NOT_VISIBLE"});
      await expect(update(ctx,{id:"asm_x",name:"changed"})).rejects.toMatchObject({code:"NOT_FOUND_OR_NOT_VISIBLE"});
      await expect(select(ctx,{aid:"asm_x",template_id:"tpl_validation"})).rejects.toMatchObject({code:"NOT_FOUND_OR_NOT_VISIBLE"});
      expect(writes()).toBe(0);
    });
  }
  it("allows exact assessment viewer to read but not write",async()=>{
    const {ctx,writes}=context("owner","viewer");
    await expect(get(ctx,{id:"asm_x"})).resolves.toMatchObject({result:{assessment:{id:"asm_x",role:"viewer"}}});
    await expect(update(ctx,{id:"asm_x",name:"changed"})).rejects.toMatchObject({code:"NOT_AUTHORIZED_AT_SCOPE"});
    expect(writes()).toBe(0);
  });
});
