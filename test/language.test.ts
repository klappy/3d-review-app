import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { execute } from "../src/dispatch";
import type { Ctx } from "../src/handlers/types";

const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"lang",modules:true,script:"export default { fetch() { return new Response('ok') } }",d1Databases:{DB:"lang-test-db"}}]}));
afterAll(()=>mf.dispose());
function statements(db:D1Database,path:string) {
  const sql=readFileSync(new URL(path,import.meta.url),"utf8").split("\n").filter(l=>!l.trimStart().startsWith("--")).join("\n");
  return sql.split(";").map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s));
}

describe("cap.language.* — a fresh project can host an assessment (D9 gap)",()=>{
  it("create → list → assessment.create; duplicate refused; archive hides from create, undo restores; outsider hidden",async()=>{
    const db=await mf.getD1Database("DB");
    for(const m of ["0001_init.sql","0002_code_escrow.sql","0003_language_archive.sql"]) await db.batch(statements(db,`../migrations/${m}`));
    await db.batch(statements(db,"../seed/synthetic.sql"));
    let n=0; const at=new Date("2026-09-16T22:00:00.000Z");
    const ctx=(actor="person_mara"):Ctx=>({env:{DB:db,SESSION_SECRET:"s"},db,principal:{kind:"user",id:actor},traceId:`tr_lang_${++n}`,now:()=>at,log:()=>{}});
    const created=await execute(ctx(),"cap.language.create",{pid:"proj_rill",name:"Kelo (invented)",code:"qak"},{tool:"write"});
    expect(created.ok).toBe(true); if(!created.ok) throw new Error(created.error.message);
    const lid=(created.result.language as any).id; expect(created.receipt?.inverse).toBe("cap.language.archive");
    const dup=await execute(ctx(),"cap.language.create",{pid:"proj_rill",name:"Kelo (invented)"},{tool:"write"});
    expect(dup.ok).toBe(false); if(!dup.ok) expect(dup.error.code).toBe("INVALID_PARAMS");
    const bad=await execute(ctx(),"cap.language.create",{pid:"proj_rill",name:"X",code:"not a code"},{tool:"write"});
    expect(bad.ok).toBe(false);
    const listed=await execute(ctx(),"cap.language.list",{pid:"proj_rill"},{tool:"read"});
    expect(listed.ok&&(listed.result.languages as any[]).some(l=>l.id===lid)).toBe(true);
    const a=await execute(ctx(),"cap.assessment.create",{pid:"proj_rill",name:"Kelo cycle 1",language_id:lid},{tool:"write"});
    expect(a.ok).toBe(true);
    const arch=await execute(ctx(),"cap.language.archive",{id:lid},{tool:"write"});
    expect(arch.ok).toBe(true); if(!arch.ok) throw new Error("archive");
    const a2=await execute(ctx(),"cap.assessment.create",{pid:"proj_rill",name:"Kelo cycle 2",language_id:lid},{tool:"write"});
    expect(a2.ok).toBe(false); if(!a2.ok) expect(a2.error.message).toContain("archived");
    const undone=await execute(ctx(),"cap.ops.undo",{token:arch.receipt?.undo_token},{tool:"write"});
    expect(undone.ok).toBe(true);
    expect((await db.prepare("SELECT archived_at FROM language WHERE id = ?").bind(lid).first<{archived_at:string|null}>())!.archived_at).toBeNull();
    // undo of create → archive
    const undoCreate=await execute(ctx(),"cap.ops.undo",{token:created.receipt?.undo_token},{tool:"write"});
    expect(undoCreate.ok).toBe(true); if(undoCreate.ok) expect(undoCreate.result.via).toBe("cap.language.archive");
    // outsider: project hidden
    const out=await execute(ctx("usr_nobody"),"cap.language.list",{pid:"proj_rill"},{tool:"read"});
    expect(out.ok).toBe(false); if(!out.ok) expect(out.error.code).toBe("NOT_FOUND_OR_NOT_VISIBLE");
    const wrong=await execute(ctx(),"cap.language.list",{pid:"proj_rill"},{tool:"write"});
    expect(wrong.ok).toBe(false); if(!wrong.ok) expect(wrong.error.code).toBe("WRONG_TOOL_FOR_CLASS");
  },30_000);
});
